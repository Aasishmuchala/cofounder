import {
  dbConfigured,
  listActiveWorkspaceIds,
  listTasks,
  listArtifacts,
  claimTask,
  getWorkspace,
  patchTask,
} from "@/lib/supabase-rest";
import { produceDeliverable } from "@/lib/runner";
import type { Task } from "@/lib/agent-types";

export const runtime = "nodejs";
export const maxDuration = 300;

const STALE_LEASE_MS = 4 * 60 * 1000;
// Bound work per tick so a single invocation stays within maxDuration
// (each deliverable can take ~minutes). Frequent ticks drain the rest.
const MAX_PER_TICK = 3;

/**
 * Scheduled drain: produce one actionable deliverable for each active workspace
 * (up to MAX_PER_TICK total), so companies keep advancing with no tab open.
 * The atomic claim means this never collides with a watching client's runner.
 *
 * Trusted endpoint: guarded by CRON_SECRET (Vercel sends it as a Bearer token).
 * It is the SYSTEM scheduler, so it does not require per-workspace edit keys —
 * but it only ever acts on already-existing actionable tasks.
 */
async function handle(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET || "";
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }
  if (!dbConfigured) {
    return Response.json({ ok: true, ran: 0, note: "no database" });
  }

  const workspaceIds = await listActiveWorkspaceIds(50).catch(() => []);

  // Phase 1 — quickly CLAIM up to MAX_PER_TICK tasks across distinct workspaces.
  const now = Date.now();
  const staleCutoff = new Date(now - STALE_LEASE_MS).toISOString();
  const nowIso = new Date(now).toISOString();
  const jobs: { ws: string; task: Task; idea: string }[] = [];
  for (const ws of workspaceIds) {
    if (jobs.length >= MAX_PER_TICK) break;
    try {
      const [tasks, artifacts] = await Promise.all([listTasks(ws), listArtifacts(ws)]);
      const withArtifact = new Set(artifacts.map((a) => a.taskId).filter(Boolean));
      const actionable = tasks.filter(
        (t) => (t.status === "todo" || t.status === "running") && !withArtifact.has(t.id),
      );
      if (actionable.length === 0) continue;
      const claimed = await claimTask(actionable[0].id, ws, staleCutoff, nowIso).catch(() => null);
      if (!claimed) continue; // another runner holds it
      const idea = (await getWorkspace(ws).catch(() => null))?.idea ?? "";
      jobs.push({ ws, task: claimed, idea });
    } catch {
      /* skip this workspace this tick */
    }
  }

  // Phase 2 — PRODUCE the claimed deliverables in parallel, so a tick's wall
  // time is ~one deliverable rather than the sum (stays within maxDuration).
  const settled = await Promise.allSettled(
    jobs.map((jb) =>
      produceDeliverable(
        jb.ws,
        { id: jb.task.id, title: jb.task.title, department: jb.task.department, detail: jb.task.detail },
        jb.idea,
      ),
    ),
  );
  const ran: { workspace: string; task: string }[] = [];
  await Promise.all(
    settled.map((s, i) => {
      if (s.status === "fulfilled") {
        ran.push({ workspace: jobs[i].ws.slice(0, 8), task: jobs[i].task.title });
        return null;
      }
      // Failed -> surface for human attention rather than leaving it claimed.
      return patchTask(jobs[i].task.id, { status: "needs_action" }, jobs[i].ws).catch(() => {});
    }),
  );

  return Response.json({ ok: true, ran: ran.length, considered: workspaceIds.length, details: ran });
}

// Vercel cron triggers GET; POST allowed for manual/local invocation.
export async function GET(req: Request): Promise<Response> {
  return handle(req);
}
export async function POST(req: Request): Promise<Response> {
  return handle(req);
}
