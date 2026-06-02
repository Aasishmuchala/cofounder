"use client";

import * as React from "react";
import type { StreamState } from "@/lib/use-cofounder";
import { departmentColor } from "@/lib/agent-types";
import { cx } from "@/components/ui/primitives";

/**
 * Bottom-center "live writing" stack: one panel per currently-running agent, each
 * streaming token-by-token. The ⤢ control on a panel EXPANDS it into a tall,
 * scrollable view that follows the stream, so the founder can watch ANY agent write
 * in real time — not just the focus one; the rest stay compact strips.
 */
export default function LiveWriter({ streams }: { streams: StreamState[] }) {
  if (!streams.length) return null;
  return (
    <div className="pointer-events-none absolute bottom-24 left-1/2 z-30 flex w-[min(680px,94%)] -translate-x-1/2 flex-col gap-1.5">
      {streams.map((s) => (
        <LiveWriterPanel key={s.taskId} stream={s} solo={streams.length === 1} />
      ))}
    </div>
  );
}

function phaseLabelFor(phase: string): string {
  return phase === "researching"
    ? "reading the company's context…"
    : phase === "reviewing"
      ? "reviewing & polishing…"
      : "writing…";
}

function LiveWriterPanel({ stream, solo }: { stream: StreamState; solo: boolean }) {
  const [expanded, setExpanded] = React.useState(false);
  const bodyRef = React.useRef<HTMLPreElement>(null);
  // A lone agent shows its body by default (the old behaviour); in a crowd each
  // starts as a compact strip so the stack stays readable — expand the one to watch.
  const showBody = expanded || solo;

  React.useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [expanded]);
  // Follow the stream — but only when already near the bottom, so scrolling UP to
  // re-read isn't yanked back on every token.
  React.useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [stream.text]);

  const color = departmentColor(stream.department);
  const phaseLabel = phaseLabelFor(stream.phase);
  const text = expanded
    ? stream.text
    : stream.text.length > 600
      ? stream.text.slice(-600)
      : stream.text;
  const lastLine = stream.text.split("\n").filter((l) => l.trim()).slice(-1)[0] ?? "";

  return (
    <div className="pointer-events-auto shrink-0 overflow-hidden rounded-[14px] border border-[var(--border-line)] bg-white/90 shadow-deep backdrop-blur-xl">
      <button
        onClick={() => setExpanded((v) => !v)}
        title={expanded ? "Collapse" : "Expand — watch this agent write in real time"}
        aria-pressed={expanded}
        className="flex w-full items-center gap-2 px-3.5 py-2 text-left"
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: color }} />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        </span>
        <span className="shrink-0 font-display text-[13px] text-[var(--text)]">{stream.department} agent</span>
        <span className="anim-badge-blink shrink-0 font-mono text-[11px] text-[var(--text-50)]">{phaseLabel}</span>
        {!showBody && lastLine && (
          <span className="truncate font-mono text-[10px] text-[var(--text-40)]">{lastLine}</span>
        )}
        <span className="ml-auto shrink-0 text-[var(--text-50)]" aria-hidden>
          {expanded ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" />
            </svg>
          )}
        </span>
      </button>
      {showBody && (
        <pre
          ref={bodyRef}
          className={cx(
            "overflow-auto whitespace-pre-wrap border-t border-black/[0.06] px-4 py-3 font-mono leading-relaxed text-[var(--text-70)]",
            expanded ? "max-h-[60vh] text-[12.5px]" : "max-h-[150px] text-[11.5px]",
          )}
        >
          {text}
          <span className="ml-0.5 inline-block h-[13px] w-[7px] translate-y-[2px] animate-pulse bg-[var(--text-50)]" />
        </pre>
      )}
    </div>
  );
}
