"use client";

import * as React from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import {
  SectionEyebrow,
  SectionHeadline,
  SectionLead,
  RevealOnView,
  RaisedCard,
  MonoLabel,
  BlinkDot,
  cx,
} from "@/components/ui/primitives";
import { ROADMAP_STAGES, type RoadmapStatus } from "@/lib/site-data";

const EASE = [0.23, 1, 0.32, 1] as const;

const STEPS = [
  {
    key: "idea",
    label: "Idea",
    body: "Tell Helm what you want to build. One paragraph is enough.",
  },
  {
    key: "initial",
    label: "Initial",
    body: "Helm lays out the first 30 days — name, codebase, incorporation.",
  },
  {
    key: "identity",
    label: "Identity",
    body: "Brand, domain, bank, socials. The boring stuff, on autopilot.",
  },
  {
    key: "live",
    label: "Live",
    body: "First customers, first revenue, first hire. You stay in the loop.",
  },
];

/* ── Per-step visualisations ──────────────────────────────────── */
function TypewriterIdea() {
  const text =
    "An AI voice agent that schedules appointments for dentists.";
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    const t = window.setInterval(() => {
      setN((i) => (i >= text.length ? 0 : i + 1));
    }, 60);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="rounded-[10px] bg-[var(--surface-deep)] p-4 shadow-raised">
      <div className="flex items-center gap-2">
        <BlinkDot color="var(--green)" />
        <MonoLabel>YOUR IDEA</MonoLabel>
      </div>
      <div className="font-display mt-3 text-[15px] leading-[1.5] text-[var(--text)]">
        {text.slice(0, n)}
        <span className="anim-caret ml-0.5 inline-block h-4 w-px bg-[var(--text)] align-middle" />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: RoadmapStatus }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--green-tint)] px-2.5 py-1">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 13l4 4L19 7"
            stroke="var(--green)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--green)]">
          Done
        </span>
      </span>
    );
  }
  const map: Record<
    Exclude<RoadmapStatus, "done">,
    { label: string; bg: string; fg: string; dot?: string }
  > = {
    user: { label: "User task", bg: "var(--surface-deep)", fg: "var(--text-50)" },
    agent: {
      label: "Agent task",
      bg: "rgba(29,112,217,0.08)",
      fg: "var(--blue)",
      dot: "var(--blue)",
    },
    approval: {
      label: "Agent requires approval",
      bg: "rgba(242,183,5,0.12)",
      fg: "#9a7400",
      dot: "var(--amber)",
    },
    available: { label: "Available", bg: "var(--surface-deep)", fg: "var(--text-50)" },
    locked: { label: "Locked", bg: "var(--surface-deep)", fg: "var(--text-30)" },
  };
  const s = map[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{
        background: s.bg,
        boxShadow: "inset 0 0 0 0.7px rgba(0,0,0,0.08)",
      }}
    >
      {s.dot && <BlinkDot color={s.dot} />}
      <span
        className="font-mono text-[10px] uppercase tracking-[0.06em]"
        style={{ color: s.fg }}
      >
        {s.label}
      </span>
    </span>
  );
}

function RoadmapMock() {
  return (
    <RaisedCard deep className="overflow-hidden p-4">
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <BlinkDot color="var(--green)" />
          <MonoLabel>Company roadmap</MonoLabel>
        </div>
        <MonoLabel>Live</MonoLabel>
      </div>
      <div className="flex flex-col gap-3">
        {ROADMAP_STAGES.map((stage) => (
          <div
            key={stage.stage}
            className="rounded-[10px] bg-[var(--surface-deep)] p-3"
            style={{ boxShadow: "inset 0 0 0 0.7px rgba(0,0,0,0.06)" }}
          >
            <div className="flex items-center justify-between pb-2">
              <span className="font-display text-[13.5px] text-[var(--text)]">
                {stage.stage}
              </span>
              <span className="font-mono text-[10.5px] tabular-nums text-[var(--text-50)]">
                {stage.progress}
              </span>
            </div>
            {stage.steps.map((s, i) => (
              <div key={s.label} className="flex items-center gap-3 py-1.5">
                {i > 0 && <div className="divider-etched my-1 w-full" />}
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[4px] bg-[var(--surface-raised)] font-mono text-[9px] text-[var(--text-50)]">
                  {i + 1}
                </span>
                <span className="font-display flex-1 truncate text-[13px] text-[var(--text-80)]">
                  {s.label}
                </span>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </RaisedCard>
  );
}

/* An animated logo being drawn — uses `anim-draw-line` on the strokes */
function BrandSpecMock() {
  return (
    <RaisedCard deep className="overflow-hidden p-5">
      <div className="flex items-center justify-between pb-4">
        <MonoLabel>Brand spec</MonoLabel>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(29,112,217,0.08)] px-2.5 py-1">
          <BlinkDot color="var(--blue)" />
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--blue)]">
            Agent drawing
          </span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="aspect-square rounded-[10px] bg-white p-4 shadow-raised">
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <g
              fill="none"
              stroke="var(--text)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="200"
              className="anim-draw-line-loop"
            >
              <circle cx="50" cy="50" r="32" />
              <path d="M50 22 L72 60 L28 60 Z" />
              <line x1="50" y1="34" x2="50" y2="56" />
              <line x1="32" y1="56" x2="68" y2="56" />
            </g>
          </svg>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <MonoLabel>WORDMARK</MonoLabel>
            <div className="font-display mt-1 text-[24px] font-semibold tracking-[-0.02em] text-[var(--text)]">
              Helm
            </div>
          </div>
          <div>
            <MonoLabel>PRIMARY</MonoLabel>
            <div className="mt-2 flex gap-2">
              {[
                "var(--text)",
                "var(--green)",
                "var(--blue)",
                "var(--coral)",
                "var(--amber)",
              ].map((c) => (
                <span
                  key={c}
                  className="block h-7 w-7 rounded-[6px] shadow-raised"
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <MonoLabel>VOICE</MonoLabel>
            <p className="font-display mt-1 text-[13px] text-[var(--text-70)]">
              Confident, direct, helpful. Plain English. No marketing fluff.
            </p>
          </div>
        </div>
      </div>
    </RaisedCard>
  );
}

function DeployProgress() {
  const [pct, setPct] = React.useState(0);
  React.useEffect(() => {
    if (pct >= 100) return;
    const t = window.setInterval(() => setPct((p) => Math.min(100, p + 3)), 60);
    return () => window.clearInterval(t);
  }, [pct]);
  const lines = [
    "Cloning repository",
    "Installing dependencies",
    "Running type checks",
    "Building production bundle",
    "Deploying to helm.run",
  ];
  const doneLines = Math.floor((pct / 100) * lines.length);
  return (
    <RaisedCard deep className="overflow-hidden p-5">
      <div className="flex items-center justify-between pb-4">
        <MonoLabel>Deploy preview</MonoLabel>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--green-tint)] px-2.5 py-1">
          <BlinkDot color="var(--green)" />
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--green)]">
            Live
          </span>
        </span>
      </div>

      <div className="font-display text-[18px] text-[var(--text)]">
        {pct < 100 ? `Deploying… ${pct}%` : "Deployed ✓"}
      </div>
      <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--border-line)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--green)] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
        <div
          className="anim-scan-line absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/60 to-transparent"
          aria-hidden
        />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {lines.map((l, i) => (
          <div key={l} className="flex items-center gap-2 text-[12.5px]">
            {i < doneLines ? (
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--green)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            ) : i === doneLines ? (
              <span
                className="block h-2 w-2 rounded-full bg-[var(--green)]"
                style={{ animation: "badge-blink 1.2s ease-in-out infinite" }}
                aria-hidden
              />
            ) : (
              <span className="block h-2 w-2 rounded-full bg-[var(--text-30)]/30" aria-hidden />
            )}
            <span
              className={cx(
                "font-mono",
                i < doneLines
                  ? "text-[var(--green)]"
                  : i === doneLines
                    ? "text-[var(--text)]"
                    : "text-[var(--text-30)]",
              )}
            >
              {l}
            </span>
          </div>
        ))}
      </div>
    </RaisedCard>
  );
}

/* ── Section ──────────────────────────────────────────────────── */
export default function LifecycleStartBuild() {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.4", "end 0.7"],
  });
  const active = Math.min(
    STEPS.length - 1,
    Math.max(0, Math.floor(scrollYProgress.get() * STEPS.length)),
  );

  const visuals: Record<number, React.ReactNode> = {
    0: <TypewriterIdea />,
    1: <RoadmapMock />,
    2: <BrandSpecMock />,
    3: <DeployProgress />,
  };

  return (
    <section
      id="start"
      ref={ref}
      className="relative py-20 md:py-28"
    >
      <div className="container-1440 px-5 min-[476px]:px-8">
        {/* Heading */}
        <RevealOnView>
          <div className="mx-auto flex max-w-[820px] flex-col items-center text-center">
            <SectionEyebrow index="04">Start · Build</SectionEyebrow>
            <SectionHeadline accent="in days, not months." className="mt-6">
              Go from idea to live company,
            </SectionHeadline>
            <SectionLead className="mt-5">
              The first four milestones, executed in sequence. Each step has its
              own agent, its own tools, and a human checkpoint where it matters.
            </SectionLead>
          </div>
        </RevealOnView>

        {/* Sticky scrollytelling: stepper left, animated detail right */}
        <div className="mt-16 grid items-start gap-10 md:grid-cols-[260px_minmax(0,1fr)] md:gap-12">
          {/* Sticky stepper */}
          <div className="md:sticky md:top-28">
            <MonoLabel>Your roadmap</MonoLabel>
            <ol className="mt-4 flex flex-col gap-1">
              {STEPS.map((s, i) => {
                const isActive = i === active;
                const isDone = i < active;
                return (
                  <li key={s.key}>
                    <motion.div
                      animate={{
                        opacity: i <= active ? 1 : 0.5,
                      }}
                      className={cx(
                        "flex items-start gap-3 rounded-[10px] p-3 transition-colors",
                        isActive && "surface-gradient-chip",
                      )}
                    >
                      <span
                        className={cx(
                          "grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[11px] font-medium",
                          isDone
                            ? "bg-[var(--green)] text-white"
                            : isActive
                              ? "bg-[var(--blue)] text-white"
                              : "border border-[var(--border-line)] bg-white text-[var(--text-50)]",
                        )}
                      >
                        {isDone ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path
                              d="M5 13l4 4L19 7"
                              stroke="white"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          `0${i + 1}`
                        )}
                      </span>
                      <div>
                        <div className="font-display text-[15px] text-[var(--text)]">
                          {s.label}
                        </div>
                        <div className="font-display mt-0.5 text-[12px] text-[var(--text-70)]">
                          {s.body}
                        </div>
                      </div>
                    </motion.div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Right pane — current step's detail */}
          <div className="flex flex-col gap-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                {visuals[active]}
              </motion.div>
            </AnimatePresence>
            {/* A second card stacked underneath the active one for density */}
            <RevealOnView>
              <RaisedCard className="flex items-center justify-between gap-4 p-5">
                <div>
                  <MonoLabel>UP NEXT</MonoLabel>
                  <div className="font-display mt-1 text-[16px] text-[var(--text)]">
                    {STEPS[Math.min(active + 1, STEPS.length - 1)].label}
                  </div>
                </div>
                <span className="font-display inline-flex h-10 items-center gap-2 rounded-[8px] bg-[var(--text)] px-4 text-[13.5px] text-white">
                  Run your roadmap
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </RaisedCard>
            </RevealOnView>
          </div>
        </div>
      </div>
    </section>
  );
}