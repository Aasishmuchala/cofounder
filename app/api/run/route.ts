import { coerceText } from "@/lib/agent-types";
import { verifyWorkspaceToken } from "@/lib/auth";
import { dbConfigured, listTasks, listArtifacts, patchTask } from "@/lib/supabase-rest";
import { produceDeliverable } from "@/lib/runner";

export const runtime = "nodejs";
// A single deliverable (generate + verify + maybe regenerate) can take a while.
export const maxDuration = 300;

/**
 * Server-side task runner. Each call claims the next ACTIONABLE task (a todo or
 * running task with no deliverable yet) and produces it server-side, then
 * returns whether more remain. The client drives this in a loop and a cron can
 * call it too — so agents keep working after the tab closes, and pending work
 * resumes on reload (task state lives in the DB, not the client).
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

  if (!workspaceId) {
    return Response.json({ ran: null, remaining: 0, error: "no workspace" }, { status: 400 });
  }
  if (!verifyWorkspaceToken(workspaceId, workspaceSecret)) {
    return Response.json({ ran: null, remaining: 0, error: "unauthorized" }, { status: 403 });
  }
  if (!dbConfigured) {
    return Response.json({ ran: null, remaining: 0, persisted: false });
  }

  let tasks, artifacts;
  try {
    [tasks, artifacts] = await Promise.all([listTasks(workspaceId), listArtifacts(workspaceId)]);
  } catch {
    return Response.json({ ran: null, remaining: 0, error: "load failed" });
  }

  const withArtifact = new Set(artifacts.map((a) => a.taskId).filter(Boolean));
  const actionable = tasks.filter(
    (t) => (t.status === "todo" || t.status === "running") && !withArtifact.has(t.id),
  );
  if (actionable.length === 0) {
    return Response.json({ ran: null, remaining: 0 });
  }

  const t = actionable[0];
  // Claim: flip todo -> running so the workspace reflects work-in-progress even
  // for other observers (and so a stale todo isn't re-picked).
  if (t.status === "todo") {
    await patchTask(t.id, { status: "running" }, workspaceId).catch(() => {});
  }
  try {
    await produceDeliverable(
      workspaceId,
      { id: t.id, title: t.title, department: t.department, detail: t.detail },
      idea,
    );
    return Response.json({ ran: t.id, remaining: actionable.length - 1 });
  } catch {
    // Failed -> needs human attention; surface it rather than silently looping.
    await patchTask(t.id, { status: "needs_action" }, workspaceId).catch(() => {});
    return Response.json({ ran: null, remaining: actionable.length - 1, error: "run failed" });
  }
}
