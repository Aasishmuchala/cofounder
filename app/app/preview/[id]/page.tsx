import Link from "next/link";
import { getArtifact } from "@/lib/supabase-rest";

export const runtime = "nodejs";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const artifact = await getArtifact(id).catch(() => null);

  if (!artifact) {
    return (
      <div className="flex h-[calc(100vh-49px)] flex-col items-center justify-center gap-3 md:h-screen">
        <p className="font-display text-[18px] text-[var(--text-70)]">
          Deliverable not found.
        </p>
        <Link
          href="/app"
          className="btn-light-surface flex h-9 items-center rounded-[8px] px-4 font-display text-[13px] text-[var(--text-70)]"
        >
          Back to canvas
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-49px)] flex-col md:h-screen">
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-2.5">
        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-50)] hover:text-[var(--text)]"
          >
            ← Canvas
          </Link>
          <span className="font-display text-[14px] font-medium text-[var(--text)]">
            {artifact.title}
          </span>
          <span className="rounded-full bg-[var(--green-tint)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-[#2c7a3f]">
            Live preview
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {artifact.kind === "landing_page" ? (
          <iframe
            title={artifact.title}
            srcDoc={artifact.content}
            className="h-full w-full border-0 bg-white"
            sandbox="allow-same-origin"
          />
        ) : (
          <pre className="h-full overflow-auto whitespace-pre-wrap px-6 py-5 font-mono text-[13px] leading-relaxed text-[var(--text-70)]">
            {artifact.content}
          </pre>
        )}
      </div>
    </div>
  );
}
