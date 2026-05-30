"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useCofounder } from "@/lib/use-cofounder";
import { MonoLabel, RaisedCard, cx } from "@/components/ui/primitives";
import Canvas from "@/components/app/Canvas";

const EASE = [0.23, 1, 0.32, 1] as const;

const STARTERS = [
  "Start an AI newsletter about climate tech",
  "Launch a coffee subscription startup",
  "Build a fitness coaching app",
];

export default function CanvasPage() {
  const cf = useCofounder();
  const { messages, tasks, loading, send } = cf;

  const [draft, setDraft] = React.useState("");
  const submit = React.useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    send(text);
    setDraft("");
  }, [draft, send]);

  const isEmpty = messages.length === 0 && tasks.length === 0 && !loading;

  /* ── Empty hero state ─────────────────────────────────────── */
  if (isEmpty) {
    return (
      <div className="flex h-[calc(100vh-49px)] flex-col md:h-screen">
        <div className="flex flex-1 items-center justify-center px-5 py-16 min-[476px]:px-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="w-full max-w-[640px] text-center"
          >
            <MonoLabel>Agent canvas · the helm</MonoLabel>
            <h1 className="mt-4 font-display text-[28px] font-normal leading-[1.12] text-[var(--text)] md:text-[36px] min-[1000px]:text-[42px]">
              What company do you want to run?
            </h1>
            <p className="mx-auto mt-3 max-w-[44ch] text-[15px] leading-[1.5] text-[var(--text-70)]">
              Spin up task agents across engineering, sales, design, and ops.
              Nothing ships without your approval.
            </p>

            <div className="mx-auto mt-7 max-w-[560px] text-left">
              <RaisedCard deep className="flex items-end gap-2 rounded-[16px] p-2.5">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  rows={2}
                  placeholder="Ask Helm to spin up new task agents…"
                  className="max-h-40 flex-1 resize-none bg-transparent px-2.5 py-1.5 font-display text-[16px] text-[var(--text)] outline-none placeholder:text-[var(--text-50)]"
                />
                <button
                  type="button"
                  onClick={submit}
                  disabled={loading || !draft.trim()}
                  aria-label="Send"
                  className="btn-light-surface flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[8px] disabled:opacity-45"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M12 19V5M5 12l7-7 7 7"
                      stroke="var(--text-80)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </RaisedCard>

              {/* starter chips */}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className={cx(
                      "surface-gradient-chip rounded-full px-3 py-1.5 font-display text-[13px] text-[var(--text-70)]",
                      "transition-colors hover:text-[var(--text)]"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ── Live interactive canvas ──────────────────────────────── */
  return (
    <div className="h-[calc(100vh-49px)] md:h-screen">
      <Canvas cf={cf} />
    </div>
  );
}
