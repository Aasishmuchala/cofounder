import { coerceText } from "@/lib/agent-types";
import { verifyWorkspaceToken } from "@/lib/auth";
import { dbConfigured, listTasks, listArtifacts, patchTask, claimTask } from "@/lib/supabase-rest";
import { produceDeliverable } from "@/lib/runner";

export const runtime = "nodejs";
// A single deliverable (generate + verify + maybe regenerate) can take a while.
export const maxDuration = 300;

// A claim older than this is treated as orphaned (a runner that crashed
// mid-production) and may be reclaimed.
const STALE_LEASE_MS = 4 * 60 * 1000;

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
  // Optional: run a SPECIFIC task. The client assigns distinct task ids across
  // its parallel calls so they never contend; cron may omit it (auto-pick).
  const wantTaskId = coerceText(body.taskId, 100) || undefined;

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
      { id: claimed.id, title: claimed.title, department: claimed.department, detail: claimed.detail },
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
