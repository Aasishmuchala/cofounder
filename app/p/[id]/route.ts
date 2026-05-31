import { getArtifact } from "@/lib/supabase-rest";
import { buildIsolatedReactPage } from "@/lib/react-preview";

export const runtime = "nodejs";

const HTML = { "content-type": "text/html; charset=utf-8" };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Public, chrome-free published view of a deliverable — a real shareable URL.
 * Landing pages are served as their own standalone HTML document; other
 * deliverables get a minimal readable wrapper.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const artifact = await getArtifact(id).catch(() => null);

  if (!artifact) {
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>Not found</title><body style="font-family:ui-sans-serif,system-ui;display:grid;place-items:center;min-height:100vh;margin:0;color:#555">This page isn't published (or was removed).</body>`,
      { status: 404, headers: HTML },
    );
  }

  if (artifact.kind === "landing_page") {
    // The deliverable is a React/Next page component — render it live inside a
    // sandboxed, null-origin iframe (its JS can't touch this origin).
    return new Response(buildIsolatedReactPage(artifact.content, artifact.title), { headers: HTML });
  }

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(artifact.title)}</title>
<style>
:root{color-scheme:light}
body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;max-width:720px;margin:56px auto;padding:0 22px;line-height:1.65;color:#16161f}
pre{white-space:pre-wrap;word-wrap:break-word;font:inherit;margin:0}
</style></head><body><pre>${esc(artifact.content)}</pre></body></html>`;
  return new Response(html, { headers: HTML });
}
