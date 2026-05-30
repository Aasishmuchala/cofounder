"use client";

import { useState } from "react";
import type { Artifact } from "@/lib/agent-types";

const KIND_LABEL: Record<string, string> = {
  landing_page: "Landing page · HTML",
  brand_spec: "Brand spec",
  markdown: "Document",
  email: "Email",
};

/** Very small Markdown-ish renderer (headings, bold, list items, tables-as-text). */
function renderMarkdown(src: string) {
  const lines = src.split("\n");
  return lines.map((line, i) => {
    if (/^#\s/.test(line))
      return (
        <h2 key={i} className="mt-4 font-display text-[20px] font-semibold text-[var(--text)]">
          {line.replace(/^#\s/, "")}
        </h2>
      );
    if (/^##\s/.test(line))
      return (
        <h3 key={i} className="mt-3 font-display text-[16px] font-medium text-[var(--text)]">
          {line.replace(/^##\s/, "")}
        </h3>
      );
    if (/^[-*]\s/.test(line))
      return (
        <li key={i} className="ml-4 list-disc text-[13.5px] leading-relaxed text-[var(--text-70)]">
          {boldify(line.replace(/^[-*]\s/, ""))}
        </li>
      );
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return (
      <p key={i} className="text-[13.5px] leading-relaxed text-[var(--text-70)]">
        {boldify(line)}
      </p>
    );
  });
}

function boldify(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p))
      return (
        <strong key={i} className="font-semibold text-[var(--text)]">
          {p.slice(2, -2)}
        </strong>
      );
    if (/^`[^`]+`$/.test(p))
      return (
        <code key={i} className="rounded bg-black/5 px-1 py-0.5 font-mono text-[12px]">
          {p.slice(1, -1)}
        </code>
      );
    return <span key={i}>{p}</span>;
  });
}

export default function ArtifactPanel({
  artifact,
  onClose,
}: {
  artifact: Artifact;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isHtml = artifact.kind === "landing_page";

  return (
    <div className="absolute inset-0 z-40 flex justify-end">
      {/* scrim */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
      />
      {/* panel */}
      <div className="relative flex h-full w-[min(560px,92%)] flex-col bg-[var(--background)] shadow-deep">
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-3.5">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-50)]">
              {KIND_LABEL[artifact.kind] ?? "Deliverable"} · generated
            </div>
            <div className="font-display text-[16px] font-medium text-[var(--text)]">
              {artifact.title}
            </div>
            {artifact.skill &&
              (() => {
                const s = artifact.skill;
                const { icon, verb } =
                  s.source === "authored"
                    ? { icon: "✍️", verb: "authored skill" }
                    : s.source === "house"
                      ? { icon: "🏛", verb: "house skill" }
                      : { icon: "⚡", verb: "equipped" };
                const label = `${icon} ${verb}: ${s.name}${s.metric ? ` · ${s.metric}` : ""}`;
                const cls =
                  "mt-1 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-50)] hover:text-[var(--text)]";
                return s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" title={`${s.name} (${s.source})`} className={cls}>
                    {label}
                  </a>
                ) : (
                  <span className={cls} title={s.name}>
                    {label}
                  </span>
                );
              })()}
          </div>
          <div className="flex items-center gap-2">
            {isHtml && (
              <a
                href={`/app/preview/${artifact.id}`}
                target="_blank"
                rel="noreferrer"
                className="btn-light-surface flex h-8 items-center rounded-[8px] px-3 font-display text-[12px] text-[var(--text-70)]"
              >
                Open ↗
              </a>
            )}
            <button
              onClick={() => {
                navigator.clipboard?.writeText(artifact.content);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
              className="btn-light-surface flex h-8 items-center rounded-[8px] px-3 font-display text-[12px] text-[var(--text-70)]"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--text-50)] hover:bg-black/5"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {isHtml ? (
            <iframe
              title={artifact.title}
              srcDoc={artifact.content}
              className="h-full w-full border-0 bg-white"
              sandbox="allow-same-origin"
            />
          ) : (
            <div className="px-5 py-4">{renderMarkdown(artifact.content)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
