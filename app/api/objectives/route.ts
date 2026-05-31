import { coerceText, sanitizeWorkspaceMeta } from "@/lib/agent-types";
import type { PlanObjective, ObjectiveStatus } from "@/lib/agent-types";
import { authorizeWrite } from "@/lib/auth";
import { dbConfigured, getWorkspace, updateWorkspaceMeta } from "@/lib/supabase-rest";

export const runtime = "nodejs";

/**
 * Objectives CRUD (the orchestration layer's durable objectives, stored in
 * meta.objectives).
 *
 *   GET   /api/objectives?workspace=<id>  -> { objectives } (no auth, read-only).
 *   PATCH /api/objectives { workspaceId, workspaceSecret, id, status }
 *         -> update one objective's status (e.g. cancel). authorizeWrite-gated.
 *
 * Objectives are CREATED via /api/plan (decompose -> approve), not here — this
 * route is for reading + light status edits. Degrades gracefully with no DB.
 */

export async function GET(req: Request): Promise<Response> {
  const workspaceId = coerceText(new URL(req.url).searchParams.get("workspace"), 100);
  if (!dbConfigured || !workspaceId) {
    return Response.json({ objectives: [], persisted: false });
  }
  const ws = await getWorkspace(workspaceId).catch(() => null);
  return Response.json({ objectives: ws?.meta?.objectives ?? [], persisted: true });
}

const VALID_STATUS = new Set<ObjectiveStatus>(["open", "achieved", "needs_action", "cancelled"]);

export async function PATCH(req: Request): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }
  const workspaceId = coerceText(body.workspaceId, 100);
  const workspaceSecret = coerceText(body.workspaceSecret, 200) || undefined;
  const id = coerceText(body.id, 40);
  const status = VALID_STATUS.has(body.status as ObjectiveStatus) ? (body.status as ObjectiveStatus) : null;

  if (!workspaceId || !id) {
    return Response.json({ ok: false, error: "missing workspace or id" }, { status: 400 });
  }
  if (!status) {
    return Response.json({ ok: false, error: "invalid status" }, { status: 400 });
  }
  if (!(await authorizeWrite(workspaceId, workspaceSecret))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }
  if (!dbConfigured) {
    return Response.json({ ok: true, persisted: false });
  }

  try {
    const current = (await getWorkspace(workspaceId)
      .then((w) => (w?.meta?.objectives ?? []) as PlanObjective[])
      .catch(() => [])) as PlanObjective[];
    const next = current.map((o) => (o.id === id ? { ...o, status } : o));
    // Re-run through the meta sanitizer (caps + validates the objectives array).
    const patch = sanitizeWorkspaceMeta({ objectives: next });
    const meta = await updateWorkspaceMeta(workspaceId, patch);
    return Response.json({ ok: true, persisted: true, objectives: meta.objectives ?? [] });
  } catch {
    return Response.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
