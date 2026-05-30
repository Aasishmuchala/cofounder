"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useCofounder } from "@/lib/use-cofounder";
import {
  DEPARTMENT_META,
  type Task,
  type TaskStatus,
} from "@/lib/agent-types";
import { RaisedCard, BlinkDot, MonoLabel, cx } from "@/components/ui/primitives";

const EASE = [0.23, 1, 0.32, 1] as const;

function deptColor(department?: string): string {
  if (!department) return "var(--text-50)";
  return DEPARTMENT_META?.[department]?.color ?? "var(--text-50)";
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  running: "Running",
  needs_action: "Needs action",
  done: "Done",
};

function StatusBadge({ status }: { status?: TaskStatus }) {
  const s = (status ?? "todo") as TaskStatus;
  const styles: Record<TaskStatus, { bg: string; fg: string; dot: string; animate?: boolean }> = {
    todo: { bg: "var(--surface-deep)", fg: "var(--text-50)", dot: "var(--text-30)" },
    running: { bg: "rgba(242,183,5,0.12)", fg: "#8a6d10", dot: "var(--amber)", animate: true },
    needs_action: { bg: "var(--coral-tint)", fg: "var(--coral)", dot: "var(--coral)" },
    done: { bg: "var(--green-tint)", fg: "#2c7a3f", dot: "var(--green)" },
  };
  const v = styles[s] ?? styles.todo;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] font-mono text-[9px] font-medium uppercase tracking-[0.06em]"
      style={{ background: v.bg, color: v.fg, boxShadow: "inset 0 0 0 0.6px rgba(0,0,0,0.06)" }}
    >
      <span
        className={cx("inline-block h-[5px] w-[5px] rounded-full", v.animate && "anim-badge-blink")}
        style={{ background: v.dot }}
      />
      {STATUS_LABEL[s] ?? "To do"}
    </span>
  );
}

export default function TasksPage() {
  const hook = useCofounder?.() ?? {};
  const tasks: Task[] = Array.isArray(hook?.tasks) ? hook.tasks : [];

  // Group tasks by department, preserving first-seen order.
  const groups = React.useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const dept = t?.department || "General";
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept)!.push(t);
    }
    return Array.from(map.entries());
  }, [tasks]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-[var(--border-line)] px-5 py-4 min-[476px]:px-8">
        <div className="container-1440 flex items-center gap-3">
          <div>
            <MonoLabel>Tasks</MonoLabel>
            <h1 className="mt-0.5 font-display text-[20px] font-medium leading-tight text-[var(--text)]">
              All task agents
            </h1>
          </div>
          <Link
            href="/app"
            className="btn-light-surface ml-auto inline-flex h-[36px] items-center gap-1.5 rounded-[8px] px-3 font-display text-[13px] text-[var(--text-80)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Canvas
          </Link>
        </div>
      </div>

      <div className="px-5 py-8 min-[476px]:px-8">
        <div className="container-1440">
          {tasks.length === 0 ? (
            <RaisedCard className="mx-auto max-w-[520px] p-8 text-center">
              <MonoLabel>Empty</MonoLabel>
              <p className="mt-3 font-display text-[16px] text-[var(--text)]">
                No tasks yet — start on the Canvas.
              </p>
              <p className="mt-1.5 text-[13px] text-[var(--text-70)]">
                Describe the company you want to run and Helm will spin up
                task agents for you.
              </p>
              <Link
                href="/app"
                className="btn-light-surface mt-5 inline-flex h-[40px] items-center rounded-[8px] px-4 font-display text-[14px] text-[var(--text-80)]"
              >
                Go to Canvas
              </Link>
            </RaisedCard>
          ) : (
            <div className="flex flex-col gap-8">
              {groups.map(([dept, deptTasks], gi) => (
                <motion.section
                  key={dept}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.1 }}
                  transition={{ duration: 0.5, ease: EASE, delay: Math.min(gi * 0.05, 0.3) }}
                >
                  <div className="mb-2.5 flex items-center gap-2">
                    <BlinkDot color={deptColor(dept)} />
                    <h2 className="font-display text-[15px] font-medium text-[var(--text)]">
                      {dept}
                    </h2>
                    <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-50)]">
                      {deptTasks.length}
                    </span>
                  </div>

                  <RaisedCard className="overflow-hidden p-0">
                    {deptTasks.map((t, i) => (
                      <div key={t?.id ?? i}>
                        {i > 0 ? (
                          <div className="divider-etched mx-4" />
                        ) : null}
                        <div className="flex items-start gap-3 px-4 py-3">
                          <span
                            className="mt-1.5 inline-block h-[6px] w-[6px] shrink-0 rounded-full"
                            style={{ background: deptColor(t?.department) }}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-display text-[14px] font-medium leading-snug text-[var(--text)]">
                              {t?.title ?? "Untitled task"}
                            </div>
                            {t?.detail ? (
                              <div className="mt-0.5 text-[13px] leading-[1.45] text-[var(--text-70)]">
                                {t.detail}
                              </div>
                            ) : null}
                          </div>
                          <div className="shrink-0 pt-0.5">
                            <StatusBadge status={t?.status} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </RaisedCard>
                </motion.section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
