"use client";

import { motion } from "framer-motion";
import { RaisedCard, MonoLabel, BlinkDot } from "@/components/ui/primitives";
import { TOOLS_CAPTIONS } from "@/lib/site-data";

const EASE = [0.23, 1, 0.32, 1] as const;

/* ── Sketch 1: approval pipeline of 3 connected nodes ── */
function PipelineSketch() {
  const nodes = ["Draft", "Review", "Ship"];
  return (
    <div className="flex items-center justify-between gap-2">
      {nodes.map((n, i) => (
        <div key={n} className="flex flex-1 items-center gap-2">
          <div className="surface-gradient-chip flex h-[34px] flex-1 items-center justify-center gap-1.5 rounded-[8px] px-2">
            {i === 2 && <BlinkDot color="var(--green)" />}
            <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-70)]">
              {n}
            </span>
          </div>
          {i < nodes.length - 1 && (
            <svg width="18" height="8" viewBox="0 0 18 8" fill="none" aria-hidden>
              <path
                d="M0 4h13M13 4l-3-3M13 4l-3 3"
                stroke="var(--text-30)"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Sketch 2: stacked parallel task bars ── */
function TaskBarsSketch() {
  const bars = [
    { w: "92%", dot: "var(--green)", label: "Codebase" },
    { w: "64%", dot: "#f6dca8", label: "SEO audit" },
    { w: "78%", dot: "#f6dca8", label: "Landing page" },
  ];
  return (
    <div className="flex flex-col gap-2">
      {bars.map((b) => (
        <div key={b.label} className="flex items-center gap-2">
          <BlinkDot color={b.dot} />
          <div className="surface-gradient-chip relative h-[16px] flex-1 overflow-hidden rounded-[5px]">
            <div
              className="absolute inset-y-0 left-0 rounded-[5px] bg-[var(--text-30)]/40"
              style={{ width: b.w }}
            />
            <span className="absolute inset-y-0 left-2 flex items-center font-mono text-[8px] uppercase tracking-[0.06em] text-[var(--text-70)]">
              {b.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Sketch 3: schedule / calendar grid ── */
function ScheduleSketch() {
  const days = ["M", "T", "W", "T", "F"];
  // small deterministic "scheduled" pattern
  const active = new Set([1, 3, 6, 7, 9, 12, 14, 18]);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-5 gap-1.5">
        {days.map((d, i) => (
          <span
            key={i}
            className="text-center font-mono text-[8px] uppercase tracking-[0.06em] text-[var(--text-50)]"
          >
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-5 grid-rows-4 gap-1.5">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className={
              active.has(i)
                ? "surface-gradient-chip aspect-square rounded-[4px]"
                : "aspect-square rounded-[4px] bg-[var(--text-30)]/10"
            }
          >
            {active.has(i) && (
              <span className="flex h-full items-center justify-center">
                <span
                  className="block"
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 1,
                    background: "var(--text-50)",
                  }}
                />
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const SKETCHES = [PipelineSketch, TaskBarsSketch, ScheduleSketch];
const LABELS = ["Approvals", "Background tasks", "Schedules"];

export default function ToolsSystems() {
  return (
    <section id="tools" className="py-20 md:py-28">
      <div className="container-1440 px-5 min-[476px]:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="font-display mx-auto max-w-[18ch] text-center text-[28px] font-normal leading-[1.15] text-[var(--text)] md:text-[32px] min-[1000px]:text-[40px]"
        >
          All the tools and systems your company needs
        </motion.h2>

        <div className="mt-12 grid gap-5 md:grid-cols-3 md:mt-16">
          {TOOLS_CAPTIONS.map((caption, i) => {
            const Sketch = SKETCHES[i];
            return (
              <motion.div
                key={caption}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, ease: EASE, delay: i * 0.1 }}
              >
                <RaisedCard className="flex h-full flex-col gap-5 p-6">
                  <div className="flex items-center justify-between">
                    <MonoLabel>{LABELS[i]}</MonoLabel>
                    <MonoLabel>{`0${i + 1}`}</MonoLabel>
                  </div>
                  <div className="rounded-[8px] bg-[var(--background)] p-4">
                    <Sketch />
                  </div>
                  <p className="font-display mt-auto text-[17px] leading-[1.35] text-[var(--text-80)]">
                    {caption}
                  </p>
                </RaisedCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
