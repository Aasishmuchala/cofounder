import { coerceText } from "@/lib/agent-types";
import { authorizeWrite } from "@/lib/auth";
import { createSignedUrl, dbConfigured } from "@/lib/supabase-rest";

export const runtime = "nodejs";

/**
 * Resolve a PRIVATE Library object to a short-lived signed URL and redirect to
 * it. Library uploads live in a private bucket (see uploadToStorage), so files
 * are not world-readable by URL; the owner's client links here and gets a fresh
 * time-limited URL each click.
 *
 *   GET /api/files?workspace=<id>&path=<objectPath>&secret=<editKey>
 *     -> 302 redirect to a signed URL (default 10-min TTL).
 *
 * AUTHORIZATION: the edit key is required (authorizeWrite), so a view-link holder
 * who can merely READ the workspace (and therefore see file names in meta) still
 * cannot download the private bytes. TENANT SCOPING: the object key is namespaced
 * `<workspaceId>/…`, and we verify the requested path starts with exactly that
 * prefix — so a valid token for workspace A can never sign a file under B, and a
 * traversal / absolute path is rejected.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const workspaceId = coerceText(url.searchParams.get("workspace"), 100);
  const secret = coerceText(url.searchParams.get("secret"), 200) || undefined;
  const path = coerceText(url.searchParams.get("path"), 300);

  if (!workspaceId || !path) {
    return Response.json({ ok: false, error: "missing workspace or path" }, { status: 400 });
  }
  // Path must be a safe relative key inside THIS workspace's namespace — reject
  // traversal, absolute paths, schemes, and cross-tenant keys before signing.
  const prefix = `${workspaceId}/`;
  if (
    path.includes("..") ||
    path.startsWith("/") ||
    /^[a-z]+:\/\//i.test(path) ||
    !path.startsWith(prefix) ||
    path.length <= prefix.length
  ) {
    return Response.json({ ok: false, error: "invalid path" }, { status: 400 });
  }
  if (!(await authorizeWrite(workspaceId, secret))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }
  if (!dbConfigured) {
    return Response.json({ ok: false, error: "no storage" }, { status: 400 });
  }

  const signed = await createSignedUrl(path).catch(() => null);
  if (!signed) return Response.json({ ok: false, error: "not found" }, { status: 404 });
  // 302 to the fresh signed URL; no-store so the redirect itself isn't cached
  // (the target expires).
  return new Response(null, {
    status: 302,
    headers: { Location: signed, "Cache-Control": "no-store" },
  });
}
