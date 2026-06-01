import { coerceText } from "@/lib/agent-types";
import { authorizeWrite } from "@/lib/auth";
import { uploadToStorage, dbConfigured } from "@/lib/supabase-rest";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Allowlist of content-types accepted for upload. Deliberately EXCLUDES
// image/svg+xml and text/html — both can carry inline scripts and would execute
// when served from the public storage bucket (stored XSS). Add a type here only
// after confirming it can't be interpreted as active content by a browser.
const ALLOWED_CONTENT_TYPES = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
]);

/**
 * Pure predicate: is `contentType` on the upload allowlist? Match is
 * case-insensitive and tolerant of a parameter suffix (e.g. "text/csv;
 * charset=utf-8") — only the bare type/subtype before the first ";" is checked.
 * A missing/empty content-type is rejected (we don't guess; the caller must
 * declare a safe type). Exported so it can be unit-tested as a pure check.
 */
export function isAllowedContentType(contentType: string | null | undefined): boolean {
  if (typeof contentType !== "string") return false;
  const bare = contentType.split(";")[0].trim().toLowerCase();
  return ALLOWED_CONTENT_TYPES.has(bare);
}

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
  // Reject types that aren't on the safe allowlist (e.g. SVG/HTML, which can
  // carry inline scripts that would execute when served from the public bucket).
  if (!isAllowedContentType(file.type)) {
    return Response.json(
      { ok: false, error: "unsupported file type" },
      { status: 415 },
    );
  }

  // NOTE: the storage bucket (cofounder-uploads) is PUBLIC — every uploaded
  // object is world-readable by its URL. For production, prefer a PRIVATE bucket
  // and hand out short-lived signed URLs instead of public object URLs.
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
