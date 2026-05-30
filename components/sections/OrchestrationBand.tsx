"use client";

import { motion } from "framer-motion";
import {
  RaisedCard,
  Chip,
  BlinkDot,
  MonoLabel,
  cx,
} from "@/components/ui/primitives";
import { DEPARTMENTS } from "@/lib/site-data";

const EASE = [0.23, 1, 0.32, 1] as const;

const NAV_ITEMS = [
  { label: "Home", active: false },
  { label: "Company", active: false },
  { label: "Helm", active: true },
  { label: "Tasks", active: false },
  { label: "Library", active: false },
];

const TASK_ROWS = [
  { title: "Spin up marketing agent", status: "RUNNING", dot: "var(--green)" },
  { title: "Draft Q3 launch plan", status: "IN REVIEW", dot: "#f6dca8" },
  { title: "Incorporate LLC", status: "NEEDS APPROVAL", dot: "var(--coral)" },
];

/* Simple SVG donut progress ring */
function ProgressRing({ value = 60 }: { value?: number }) {
  const size = 36;
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border-line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--green)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute font-mono text-[8px] font-medium text-[var(--text-70)]">
        {value}%
      </span>
    </div>
  );
}

export default function OrchestrationBand() {
  return (
    <section className="relative w-full py-20 md:py-28">
      <div className="container-1440 px-5 min-[476px]:px-8">
        {/* Heading */}
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="font-display mx-auto max-w-[24ch] text-center text-[28px] font-normal leading-[1.15] text-[var(--text)] md:text-[32px] min-[1000px]:text-[40px]"
        >
          Helm is an agent orchestration platform designed to help you run an
          entire business
        </motion.h2>

        {/* Department chips */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.12 }}
          className="mx-auto mt-8 flex max-w-[680px] flex-wrap items-center justify-center gap-2.5"
        >
          {DEPARTMENTS.map((dept) => (
            <Chip key={dept}>{dept}</Chip>
          ))}
        </motion.div>

        {/* Orchestration UI mock */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
          className="mx-auto mt-14 max-w-[920px]"
        >
          <RaisedCard deep className="overflow-hidden p-0">
            {/* Top bar */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] surface-gradient-chip">
                  <span className="block h-2 w-2 rounded-full bg-[var(--text-50)]" />
                </span>
                <span className="truncate font-mono text-[10px] tracking-[0.04em] text-[var(--text-50)]">
                  Helm&nbsp;/&nbsp;
                  <span className="text-[var(--text-80)]">your company</span>
                </span>
              </div>
              <ProgressRing value={60} />
            </div>

            <EtchedLine />

            {/* Body: sidebar + main */}
            <div className="flex">
              {/* Sidebar */}
              <nav className="hidden w-[160px] shrink-0 flex-col gap-1 border-r border-[var(--border-soft)] p-3 sm:flex">
                {NAV_ITEMS.map((item) => (
                  <span
                    key={item.label}
                    className={cx(
                      "font-display flex items-center rounded-[8px] px-3 py-2 text-[14px]",
                      item.active
                        ? "surface-gradient-chip text-[var(--text)]"
                        : "text-[var(--text-50)]"
                    )}
                  >
                    {item.label}
                  </span>
                ))}
              </nav>

              {/* Main area */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center justify-between px-4 py-3 md:px-5">
                  <MonoLabel>Active tasks</MonoLabel>
                  <MonoLabel>{TASK_ROWS.length} running</MonoLabel>
                </div>

                <div className="flex flex-col gap-2 px-4 pb-4 md:px-5">
                  {TASK_ROWS.map((task) => (
                    <div
                      key={task.title}
                      className="surface-gradient-chip flex items-center gap-3 rounded-[10px] px-3.5 py-3"
                    >
                      <BlinkDot color={task.dot} />
                      <span className="font-display flex-1 truncate text-[14px] text-[var(--text-80)]">
                        {task.title}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-50)]">
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Chat input bar */}
                <div className="px-4 pb-4 md:px-5">
                  <div className="surface-gradient-chip flex items-center gap-3 rounded-[10px] px-3.5 py-2.5">
                    <span className="flex-1 truncate font-display text-[13px] text-[var(--text-50)]">
                      Ask Helm to spin up new tasks agents…
                    </span>
                    <button
                      type="button"
                      className="btn-light-surface grid h-7 w-7 shrink-0 place-items-center rounded-[7px]"
                      aria-label="Send"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--text-70)"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 19V5" />
                        <path d="M5 12l7-7 7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </RaisedCard>
        </motion.div>
      </div>
    </section>
  );
}

function EtchedLine() {
  return <div className="divider-etched w-full" />;
}
