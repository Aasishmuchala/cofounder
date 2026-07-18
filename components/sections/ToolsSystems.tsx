"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  SectionEyebrow,
  SectionHeadline,
  SectionLead,
  RevealOnView,
  RaisedCard,
  MonoLabel,
  BlinkDot,
} from "@/components/ui/primitives";

const EASE = [0.23, 1, 0.32, 1] as const;

/* ─────────────────────────────────────────────────────────────
   Widget 1 — Approvals: 3 nodes connected; click each to toggle.
   Flowing dot animates along the active edge.
   ───────────────────────────────────────────────────────────── */
type ApproveState = "pending" | "approved" | "rejected";
const APPROVE_LABELS = ["Draft", "Review", "Ship"];

function ApprovalsWidget() {
  const [states, setStates] = React.useState<ApproveState[]>([
    "approved",
    "approved",
    "pending",
  ]);

  const cycle = (i: number) =>
    setStates((s) => {
      const next = [...s];
      next[i] =
        next[i] === "pending"
          ? "approved"
          : next[i] === "approved"
            ? "rejected"
            : "pending";
      return next;
    });

  const color = (s: ApproveState) =>
    s === "approved"
      ? "var(--green)"
      : s === "rejected"
        ? "var(--coral)"
        : "var(--text-50)";

  const bg = (s: ApproveState) =>
    s === "approved"
      ? "var(--green-tint)"
      : s === "rejected"
        ? "var(--coral-tint)"
        : "var(--surface-deep)";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <MonoLabel>Click a node to toggle</MonoLabel>
        <MonoLabel>
          {states.filter((s) => s === "approved").length}/{states.length}
        </MonoLabel>
      </div>
      <div className="flex items-center gap-2">
        {APPROVE_LABELS.map((n, i) => (
          <React.Fragment key={n}>
            <button
              type="button"
              onClick={() => cycle(i)}
              className="surface-gradient-chip flex h-[44px] flex-1 items-center justify-center gap-2 rounded-[10px] px-2 transition-colors hover:brightness-105"
              style={{ background: bg(states[i]) }}
            >
              {states[i] === "approved" ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M5 13l4 4L19 7"
                    stroke={color(states[i])}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : states[i] === "rejected" ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke={color(states[i])}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <BlinkDot color={color(states[i])} />
              )}
              <span
                className="font-mono text-[10px] font-medium uppercase tracking-[0.08em]"
                style={{ color: color(states[i]) }}
              >
                {n}
              </span>
            </button>
            {i < APPROVE_LABELS.length - 1 && (
              <svg width="18" height="10" viewBox="0 0 18 10" fill="none" aria-hidden>
                <line
                  x1="0"
                  y1="5"
                  x2="14"
                  y2="5"
                  stroke={
                    states[i] === "approved" && states[i + 1] !== "rejected"
                      ? "var(--green)"
                      : "var(--text-30)"
                  }
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeDasharray={states[i] === "approved" ? "0" : "2 3"}
                />
                {states[i] === "approved" && states[i + 1] !== "rejected" && (
                  <circle r="1.5" fill="var(--green)">
                    <animate
                      attributeName="cx"
                      values="0;14;0"
                      dur="1.8s"
                      repeatCount="indefinite"
                    />
                    <animate attributeName="cy" values="5;5;5" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                )}
              </svg>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Widget 2 — Background tasks: progress bars tick up on a loop.
   Click to pause/resume a task.
   ───────────────────────────────────────────────────────────── */
type Task = { id: string; label: string; paused: boolean; pct: number; dot: string };

const TASK_SEED: Task[] = [
  { id: "t1", label: "Codebase scan", paused: false, pct: 0, dot: "var(--green)" },
  { id: "t2", label: "SEO audit", paused: false, pct: 0, dot: "#f6dca8" },
  { id: "t3", label: "Landing page deploy", paused: false, pct: 0, dot: "#f6dca8" },
  { id: "t4", label: "Backlink monitor", paused: false, pct: 0, dot: "var(--green)" },
];

function BackgroundTasksWidget() {
  const [tasks, setTasks] = React.useState<Task[]>(TASK_SEED);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setTasks((prev) =>
        prev.map((t) =>
          t.paused
            ? t
            : {
                ...t,
                pct: t.pct >= 100 ? 12 : t.pct + 1.2,
              },
        ),
      );
    }, 80);
    return () => window.clearInterval(id);
  }, []);

  const toggle = (id: string) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, paused: !t.paused } : t)),
    );

  const running = tasks.filter((t) => !t.paused).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <MonoLabel>{running} running · click to pause</MonoLabel>
        <MonoLabel>{tasks.length} total</MonoLabel>
      </div>
      {tasks.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => toggle(t.id)}
          className="group flex items-center gap-3 text-left"
        >
          <BlinkDot color={t.paused ? "var(--text-30)" : t.dot} />
          <div className="surface-gradient-chip relative h-[18px] flex-1 overflow-hidden rounded-[5px]">
            <div
              className="absolute inset-y-0 left-0 rounded-[5px] bg-[var(--text-30)]/45"
              style={{ width: `${t.pct}%`, transition: "width 80ms linear" }}
            />
            <span className="absolute inset-y-0 left-2 flex items-center font-mono text-[8.5px] uppercase tracking-[0.06em] text-[var(--text-70)]">
              {t.label}
            </span>
            <span className="absolute inset-y-0 right-2 flex items-center font-mono text-[8.5px] tabular-nums text-[var(--text-50)]">
              {Math.round(t.pct)}%
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Widget 3 — Schedules: 5×4 calendar grid; click cells to toggle.
   Counter updates live. localStorage persists.
   ───────────────────────────────────────────────────────────── */
const DAYS = ["M", "T", "W", "Th", "F"];
const ROWS = 4;
const STORAGE_KEY = "helm-schedules-v1";

function ScheduleWidget() {
  const [active, setActive] = React.useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) return new Set(JSON.parse(raw) as number[]);
    } catch {
      // ignore
    }
    return new Set([2, 6, 8, 12, 17]);
  });

  React.useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(Array.from(active)),
      );
    } catch {
      // ignore
    }
  }, [active]);

  const toggle = (i: number) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const total = DAYS.length * ROWS;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <MonoLabel>Click days to schedule</MonoLabel>
        <MonoLabel>
          {active.size} / {total} this week
        </MonoLabel>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {DAYS.map((d) => (
          <span
            key={d}
            className="text-center font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-50)]"
          >
            {d}
          </span>
        ))}
        {Array.from({ length: total }).map((_, i) => {
          const isOn = active.has(i);
          return (
            <motion.button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              animate={{
                backgroundColor: isOn
                  ? "rgba(167,139,250,0.18)"
                  : "rgba(0,0,0,0.06)",
                scale: isOn ? 1.04 : 1,
              }}
              transition={{ duration: 0.25, ease: EASE }}
              className="relative aspect-square rounded-[5px]"
              aria-label={`Toggle day ${i}`}
            >
              {isOn && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="block h-1.5 w-1.5 rounded-full"
                    style={{ background: "#6d49c2" }}
                  />
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
      <p className="px-1 text-[11.5px] text-[var(--text-50)]">
        Persists to <span className="font-mono">localStorage</span> — your
        schedule survives a refresh.
      </p>
    </div>
  );
}

/* ── Section ──────────────────────────────────────────────────── */
const WIDGETS: Array<{
  idx: string;
  label: string;
  title: string;
  Component: React.ComponentType;
}> = [
  {
    idx: "01",
    label: "Approvals",
    title: "You stay in control — nothing ships without your nod.",
    Component: ApprovalsWidget,
  },
  {
    idx: "02",
    label: "Background tasks",
    title: "Run a dozen jobs at once, in parallel, in the background.",
    Component: BackgroundTasksWidget,
  },
  {
    idx: "03",
    label: "Schedules",
    title: "Plug in apps, skills, and recurring schedules. Helm just runs.",
    Component: ScheduleWidget,
  },
];

export default function ToolsSystems() {
  return (
    <section id="tools" className="py-20 md:py-28">
      <div className="container-1440 px-5 min-[476px]:px-8">
        <RevealOnView>
          <div className="mx-auto flex max-w-[820px] flex-col items-center text-center">
            <SectionEyebrow index="06">Tools &amp; systems</SectionEyebrow>
            <SectionHeadline accent="boring plumbing, done." className="mt-6">
              All the
            </SectionHeadline>
            <SectionLead className="mt-5">
              Approvals, background tasks, recurring schedules — the kind of
              infrastructure work that used to need an ops team. Now it's a
              checkbox.
            </SectionLead>
          </div>
        </RevealOnView>

        <div className="mt-14 grid gap-5 md:grid-cols-3 md:gap-6">
          {WIDGETS.map((w, i) => {
            const Comp = w.Component;
            return (
              <RevealOnView key={w.idx} delay={i * 0.08}>
                <RaisedCard className="flex h-full flex-col gap-5 p-6">
                  <div className="flex items-center justify-between">
                    <MonoLabel>{w.label.toUpperCase()}</MonoLabel>
                    <MonoLabel>{w.idx}</MonoLabel>
                  </div>
                  <div className="rounded-[10px] bg-[var(--surface-deep)] p-4 shadow-raised">
                    <Comp />
                  </div>
                  <p className="font-display text-[15.5px] leading-[1.4] text-[var(--text-80)]">
                    {w.title}
                  </p>
                </RaisedCard>
              </RevealOnView>
            );
          })}
        </div>
      </div>
    </section>
  );
}