import { coerceText, isTaskReady, blockedObjectiveIds, type PlanObjective } from "@/lib/agent-types";
import { authorizeWrite } from "@/lib/auth";
import { dbConfigured, listTasks, listArtifacts, claimTask, patchTask, getWorkspace } from "@/lib/supabase-rest";
import { produceDeliverable } from "@/lib/runner";

export const runtime = "nodejs";
export const maxDuration = 300;

const STALE_LEASE_MS = 4 * 60 * 1000;

/**
 * Stream one task's deliverable to the client over SSE: the department agent's
 * tool calls, its writing (token by token), the review phase, and the final
 * persisted artifact. Claims the task atomically (same lease as /api/run) so a
 * streamed run and a background/cron run can never double-produce it.
 *
 * Events: `status` {phase} · `reset` (new hop) · `delta` {t} · `tool` {names}
 *         · `done` {artifactId,score,kind,title} · `error` {message}
 */
export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }
  const workspaceId = coerceText(body.workspaceId, 100);
  const workspaceSecret = coerceText(body.workspaceSecret, 200) || undefined;
  const idea = coerceText(body.idea, 4000);
  const taskId = coerceText(body.taskId, 100);

  if (!workspaceId || !taskId) {
    return Response.json({ error: "missing workspace or task" }, { status: 400 });
  }
  if (!(await authorizeWrite(workspaceId, workspaceSecret))) {
    return Response.json({ error: "unauthorized" }, { status: 403 });
  }
  if (!dbConfigured) {
    return Response.json({ error: "no database" }, { status: 400 });
  }

  // Only run a task that's actionable and not already produced.
  let tasks, artifacts, workspace;
  try {
    [tasks, artifacts, workspace] = await Promise.all([
      listTasks(workspaceId),
      listArtifacts(workspaceId),
      getWorkspace(workspaceId),
    ]);
  } catch {
    return Response.json({ error: "load failed" }, { status: 500 });
  }
  const withArtifact = new Set(artifacts.map((a) => a.taskId).filter(Boolean));
  // Dependency gate: a task is streamable only once its prerequisites are done.
  const doneIds = new Set<string>(withArtifact as Set<string>);
  for (const t of tasks) if (t.status === "done") doneIds.add(t.id);
  // Objective gate: don't stream a task whose owning objective is still blocked
  // by an unachieved prerequisite objective (same rule as /api/run + /api/cron).
  const objectives = (workspace?.meta?.objectives ?? []) as PlanObjective[];
  const blockedObjs = blockedObjectiveIds(objectives, tasks);
  const target = tasks.find(
    (t) =>
      t.id === taskId &&
      (t.status === "todo" || t.status === "running") &&
      !withArtifact.has(t.id) &&
      !(t.objectiveId && blockedObjs.has(t.objectiveId)) &&
      isTaskReady(t, doneIds),
  );
  if (!target) {
    return Response.json({ error: "not actionable" }, { status: 409 });
  }

  // Atomic claim — bail if another runner already holds it.
  const now = Date.now();
  const claimed = await claimTask(
    target.id,
    workspaceId,
    new Date(now - STALE_LEASE_MS).toISOString(),
    new Date(now).toISOString(),
  ).catch(() => null);
  if (!claimed) {
    return Response.json({ error: "contended" }, { status: 409 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* controller already closed */
        }
      };
      try {
        send("status", { phase: "writing", department: claimed.department, title: claimed.title });
        const { artifact } = await produceDeliverable(
          workspaceId,
          {
            id: claimed.id,
            title: claimed.title,
            department: claimed.department,
            detail: claimed.detail,
            deps: claimed.dependsOn,
            objectiveId: claimed.objectiveId,
            executor: claimed.executor,
          },
          idea,
          {
            onHop: () => send("reset", {}),
            onText: (t) => send("delta", { t }),
            onTool: (names) => send("tool", { names }),
            onPhase: (phase) => send("status", { phase }),
          },
        );
        send("done", {
          artifactId: artifact.id,
          score: artifact.eval?.score ?? null,
          kind: artifact.kind,
          title: artifact.title,
        });
      } catch {
        await patchTask(claimed.id, { status: "needs_action" }, workspaceId).catch(() => {});
        send("error", { message: "run failed" });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
