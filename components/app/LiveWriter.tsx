"use client";

import * as React from "react";
import type { StreamState } from "@/lib/use-cofounder";
import { departmentColor } from "@/lib/agent-types";
import { cx } from "@/components/ui/primitives";

/**
 * Bottom-center "live writing" panel: shows the focus deliverable being
 * streamed — the department agent, its current phase (researching context /
 * writing / reviewing), and the text appearing token-by-token. The ⤢ control
 * EXPANDS it into a tall, scrollable view that follows the stream, so the founder
 * can watch the agent write in real time; collapse returns to the ambient strip.
 */
export default function LiveWriter({ streaming }: { streaming: StreamState | null }) {
  const [expanded, setExpanded] = React.useState(false);
  const bodyRef = React.useRef<HTMLPreElement>(null);

  // On expand/collapse, jump to the newest text.
  React.useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [expanded]);

  // Follow the stream — but only if already near the bottom, so scrolling UP to
  // re-read earlier output isn't yanked back on every token.
  React.useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [streaming?.text]);

  if (!streaming) return null;

  const phaseLabel =
    streaming.phase === "researching"
      ? "reading the company's context…"
      : streaming.phase === "reviewing"
        ? "reviewing & polishing…"
        : "writing…";

  // Collapsed shows just the tail; expanded shows the whole stream (scrollable).
  const text = expanded
    ? streaming.text
    : streaming.text.length > 600
      ? streaming.text.slice(-600)
      : streaming.text;
  const color = departmentColor(streaming.department);

  return (
    <div
      className={cx(
        "absolute bottom-24 left-1/2 z-30 -translate-x-1/2",
        expanded ? "w-[min(960px,96%)]" : "w-[min(620px,92%)]",
      )}
    >
      <div className="pointer-events-auto overflow-hidden rounded-[16px] border border-[var(--border-line)] bg-white/90 shadow-deep backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ background: color }}
            />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          </span>
          <span className="shrink-0 font-display text-[13px] text-[var(--text)]">
            {streaming.department} agent
          </span>
          <span className="anim-badge-blink truncate font-mono text-[11px] text-[var(--text-50)]">
            {phaseLabel}
          </span>
          {streaming.tools.length > 0 && streaming.phase === "researching" && (
            <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-50)] sm:inline">
              {streaming.tools.join(" · ")}
            </span>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Collapse" : "Expand — watch it write in real time"}
            aria-label={expanded ? "Collapse the live writer" : "Expand the live writer"}
            aria-pressed={expanded}
            className="ml-auto shrink-0 rounded-[7px] px-1.5 py-1 text-[var(--text-50)] transition-colors hover:bg-black/[0.05] hover:text-[var(--text)]"
          >
            {expanded ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" />
              </svg>
            )}
          </button>
        </div>
        <pre
          ref={bodyRef}
          className={cx(
            "overflow-auto whitespace-pre-wrap px-4 py-3 font-mono leading-relaxed text-[var(--text-70)]",
            expanded ? "max-h-[64vh] text-[12.5px]" : "max-h-[160px] text-[11.5px]",
          )}
        >
          {text}
          <span className="ml-0.5 inline-block h-[13px] w-[7px] translate-y-[2px] animate-pulse bg-[var(--text-50)]" />
        </pre>
      </div>
    </div>
  );
}
