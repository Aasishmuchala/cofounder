"use client";

import * as React from "react";
import type { StreamState } from "@/lib/use-cofounder";
import { departmentColor } from "@/lib/agent-types";

/**
 * Bottom-center "live writing" panel: shows the focus deliverable being
 * streamed — the department agent, its current phase (researching context /
 * writing / reviewing), and the text appearing token-by-token.
 */
export default function LiveWriter({ streaming }: { streaming: StreamState | null }) {
  if (!streaming) return null;

  const phaseLabel =
    streaming.phase === "researching"
      ? "reading the company's context…"
      : streaming.phase === "reviewing"
        ? "reviewing & polishing…"
        : "writing…";

  // Show the tail of the stream so the newest text is always visible.
  const tail = streaming.text.length > 600 ? streaming.text.slice(-600) : streaming.text;
  const color = departmentColor(streaming.department);

  return (
    <div className="pointer-events-none absolute bottom-24 left-1/2 z-30 w-[min(620px,92%)] -translate-x-1/2">
      <div className="overflow-hidden rounded-[16px] border border-[var(--border-line)] bg-white/90 shadow-deep backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ background: color }}
            />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          </span>
          <span className="font-display text-[13px] text-[var(--text)]">
            {streaming.department} agent
          </span>
          <span className="anim-badge-blink font-mono text-[11px] text-[var(--text-50)]">
            {phaseLabel}
          </span>
          {streaming.tools.length > 0 && streaming.phase === "researching" && (
            <span className="ml-auto truncate font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-50)]">
              {streaming.tools.join(" · ")}
            </span>
          )}
        </div>
        <pre className="max-h-[160px] overflow-hidden whitespace-pre-wrap px-4 py-3 font-mono text-[11.5px] leading-relaxed text-[var(--text-70)]">
          {tail}
          <span className="ml-0.5 inline-block h-[13px] w-[7px] translate-y-[2px] animate-pulse bg-[var(--text-50)]" />
        </pre>
      </div>
    </div>
  );
}
