import { coerceText, isTaskReady, blockedObjectiveIds, type PlanObjective } from "@/lib/agent-types";
import { authorizeWrite, tooLarge } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { dbConfigured, listTasks, listArtifacts, patchTask, claimTask, getWorkspace } from "@/lib/supabase-rest";
import { produceDeliverable } from "@/lib/runner";

export const runtime = "nodejs";
// A single deliverable (generate + verify + maybe regenerate) can take a while.
export const maxDuration = 300;

// A claim older than this is treated as orphaned (a runner that crashed
// mid-production) and may be reclaimed. Must exceed the bounded worst-case
// production time — model calls are now capped at ~150s × (1 retry) ≈ 5 min by
// lib/anthropic.ts — so an in-flight task is never re-claimed and double-run
// while it's still legitimately working.
const STALE_LEASE_MS = 6 * 60 * 1000;

/**
 * Server-side task runner. Each call claims the next ACTIONABLE task (a todo or
 * running task with no deliverable yet) and produces it server-side, then
 * returns whether more remain. The client drives this in a loop and a cron can
 * call it too — so agents keep working after the tab closes, and pending work
 * resumes on reload (task state lives in the DB, not the client).
 */
export async function POST(req: Request): Promise<Response> {
  if (tooLarge(req)) return Response.json({ ok: false, error: "payload too large" }, { status: 413 });
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
  // Optional: run a SPECIFIC task. The client assigns distinct task ids across
  // its parallel calls so they never contend; cron may omit it (auto-pick).
  const wantTaskId = coerceText(body.taskId, 100) || undefined;

  if (!workspaceId) {
    return Response.json({ ran: null, remaining: 0, error: "no workspace" }, { status: 400 });
  }
  if (!(await authorizeWrite(workspaceId, workspaceSecret))) {
    return Response.json({ ran: null, remaining: 0, error: "unauthorized" }, { status: 403 });
  }
  // Per-workspace rate limit (PRODUCTION-ONLY) — cap how fast one workspace can
  // drive Opus generations, BEFORE any DB load or model work. Gated so the
  // keyless local demo (and the test/dev loop the client drives) is unchanged.
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    const rl = checkRateLimit(workspaceId);
    if (!rl.allowed) {
      const retryAfter = Math.ceil(rl.retryAfterMs / 1000);
      return Response.json(
        { ran: null, remaining: 0, error: "rate limited" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
  }
  if (!dbConfigured) {
    return Response.json({ ran: null, remaining: 0, persisted: false });
  }

  let tasks, artifacts, workspace;
  try {
    [tasks, artifacts, workspace] = await Promise.all([
      listTasks(workspaceId),
      listArtifacts(workspaceId),
      getWorkspace(workspaceId),
    ]);
  } catch {
    return Response.json({ ran: null, remaining: 0, error: "load failed" });
  }

  const withArtifact = new Set(artifacts.map((a) => a.taskId).filter(Boolean));
  // A task is done once it has an artifact OR its status is done — both gate deps.
  const doneIds = new Set<string>(withArtifact as Set<string>);
  for (const t of tasks) if (t.status === "done") doneIds.add(t.id);
  // OBJECTIVE GATE: an objective whose prerequisite objectives aren't achieved is
  // blocked; its tasks must not run yet (honors the orchestrator's plan ordering).
  const objectives = (workspace?.meta?.objectives ?? []) as PlanObjective[];
  const blockedObjs = blockedObjectiveIds(objectives, tasks);
  // DEPENDENCY GATE: a task is actionable only when its prerequisite tasks are
  // done (isTaskReady) AND its owning objective isn't blocked. Tasks with no deps
  // / no objective are always ready (back-compat).
  const actionable = tasks.filter(
    (t) =>
      (t.status === "todo" || t.status === "running") &&
      !withArtifact.has(t.id) &&
      !(t.objectiveId && blockedObjs.has(t.objectiveId)) &&
      isTaskReady(t, doneIds),
  );
  if (actionable.length === 0) {
    return Response.json({ ran: null, remaining: 0 });
  }

  // Pick the requested task (if still actionable) or the next available one.
  const target = wantTaskId ? actionable.find((t) => t.id === wantTaskId) : actionable[0];
  if (!target) {
    // The requested task was already finished or grabbed elsewhere.
    return Response.json({ ran: null, remaining: actionable.length, contended: true });
  }

  // Atomically claim it. If another runner (another tab, or a cron) won the
  // race, bail out without double-producing the same deliverable.
  const now = Date.now();
  const claimed = await claimTask(
    target.id,
    workspaceId,
    new Date(now - STALE_LEASE_MS).toISOString(),
    new Date(now).toISOString(),
  ).catch(() => null);
  if (!claimed) {
    return Response.json({ ran: null, remaining: actionable.length, contended: true });
  }

  try {
    await produceDeliverable(
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
    );
    return Response.json({ ran: claimed.id, remaining: Math.max(0, actionable.length - 1) });
  } catch {
    // Failed -> needs human attention; surface it rather than silently looping.
    await patchTask(claimed.id, { status: "needs_action" }, workspaceId).catch(() => {});
    return Response.json({
      ran: null,
      remaining: Math.max(0, actionable.length - 1),
      error: "run failed",
    });
  }
}
