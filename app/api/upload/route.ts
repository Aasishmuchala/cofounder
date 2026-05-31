import { coerceText } from "@/lib/agent-types";
import { authorizeWrite } from "@/lib/auth";
import { uploadToStorage, dbConfigured } from "@/lib/supabase-rest";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// POST /api/upload  (multipart: file, workspaceId, workspaceSecret)
//   -> uploads to the Library bucket, returns { file: { name, url } }.
export async function POST(req: Request): Promise<Response> {
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ ok: false, error: "bad form" }, { status: 400 });

  const file = form.get("file");
  const workspaceId = coerceText(form.get("workspaceId"), 100) || undefined;
  const workspaceSecret = coerceText(form.get("workspaceSecret"), 200) || undefined;

  if (!(file instanceof File)) return Response.json({ ok: false, error: "no file" }, { status: 400 });
  if (!workspaceId) return Response.json({ ok: false, error: "no workspace" }, { status: 400 });
  if (!(await authorizeWrite(workspaceId, workspaceSecret))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }
  if (!dbConfigured) return Response.json({ ok: false, persisted: false });
  if (file.size > MAX_BYTES) return Response.json({ ok: false, error: "too large (max 10MB)" }, { status: 400 });

  const safe = (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "file";
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${workspaceId}/${Date.now()}-${rand}-${safe}`;
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const url = await uploadToStorage(path, bytes, file.type);
    if (!url) return Response.json({ ok: false, error: "upload failed" }, { status: 500 });
    return Response.json({ ok: true, file: { name: (file.name || safe).slice(0, 120), url } });
  } catch {
    return Response.json({ ok: false, error: "upload failed" }, { status: 500 });
  }
}
