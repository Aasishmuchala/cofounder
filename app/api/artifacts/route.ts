import { listArtifacts, updateArtifact, dbConfigured } from "@/lib/supabase-rest";
import { coerceText } from "@/lib/agent-types";
import { authorizeWrite } from "@/lib/auth";

export const runtime = "nodejs";

// GET /api/artifacts?workspace=<id>  -> all deliverables for a workspace
export async function GET(req: Request) {
  if (!dbConfigured) return Response.json({ artifacts: [], persisted: false });
  const workspace = new URL(req.url).searchParams.get("workspace");
  if (!workspace) return Response.json({ artifacts: [], persisted: true });
  try {
    const artifacts = await listArtifacts(workspace);
    return Response.json({ artifacts, persisted: true });
  } catch {
    return Response.json({ artifacts: [], persisted: false });
  }
}

// PATCH /api/artifacts  { id, workspaceId, workspaceSecret, content?, title? }
//   -> edit a deliverable in place (owner only).
export async function PATCH(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }
  const id = coerceText(body.id, 100);
  const workspaceId = coerceText(body.workspaceId, 100) || undefined;
  const workspaceSecret = coerceText(body.workspaceSecret, 200) || undefined;
  if (!id || !workspaceId) {
    return Response.json({ ok: false, error: "missing id/workspace" }, { status: 400 });
  }
  if (!(await authorizeWrite(workspaceId, workspaceSecret))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }
  if (!dbConfigured) return Response.json({ ok: false, persisted: false });
  // Strip control chars (Postgres text rejects them) before saving the edit.
  const content = coerceText(body.content, 200000).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  const title = coerceText(body.title, 200);
  if (!content && !title) {
    return Response.json({ ok: false, error: "nothing to update" }, { status: 400 });
  }
  try {
    const artifact = await updateArtifact(id, { content: content || undefined, title: title || undefined }, workspaceId);
    return Response.json({ ok: true, artifact });
  } catch {
    return Response.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
