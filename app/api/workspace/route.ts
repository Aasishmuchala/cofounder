import { coerceText, sanitizeWorkspaceMeta } from "@/lib/agent-types";
import { authorizeWrite, tooLarge } from "@/lib/auth";
import { dbConfigured, getWorkspace, updateWorkspaceMeta } from "@/lib/supabase-rest";

export const runtime = "nodejs";

/**
 * Durable per-company state (brand identity, business plan, custom agents) that
 * used to live only in the browser. GET reads the meta blob; PATCH merges a
 * patch into it (writes require the workspace capability token).
 */

// GET /api/workspace?id=<workspaceId> — read name + idea + meta.
export async function GET(req: Request): Promise<Response> {
  const id = coerceText(new URL(req.url).searchParams.get("id"), 100);
  if (!id) {
    return Response.json({ ok: false, error: "no workspace" }, { status: 400 });
  }
  if (!dbConfigured) {
    return Response.json({ ok: true, persisted: false, meta: {} });
  }
  const ws = await getWorkspace(id).catch(() => null);
  if (!ws) {
    return Response.json({ ok: false, error: "not found" }, { status: 404 });
  }
  return Response.json({
    ok: true,
    persisted: true,
    name: ws.name,
    idea: ws.idea,
    meta: ws.meta,
    protected: ws.protected,
  });
}

// PATCH /api/workspace — merge a (sanitized) meta patch into the workspace.
export async function PATCH(req: Request): Promise<Response> {
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
  if (!workspaceId) {
    return Response.json({ ok: false, error: "no workspace" }, { status: 400 });
  }
  if (!(await authorizeWrite(workspaceId, workspaceSecret))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }
  if (!dbConfigured) {
    return Response.json({ ok: true, persisted: false, meta: {} });
  }
  const patch = sanitizeWorkspaceMeta(body.meta);
  try {
    const meta = await updateWorkspaceMeta(workspaceId, patch);
    // null => no such workspace (the PATCH matched 0 rows). Don't report success.
    if (!meta) {
      return Response.json({ ok: false, persisted: false, error: "workspace not found" }, { status: 404 });
    }
    return Response.json({ ok: true, persisted: true, meta });
  } catch {
    return Response.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
