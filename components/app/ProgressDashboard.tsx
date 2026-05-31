"use client";

import type { UseCofounder } from "@/lib/use-cofounder";
import { DEPARTMENTS, departmentColor } from "@/lib/agent-types";

/** Compact company-progress dashboard: throughput, quality, and per-department
 *  breakdown — computed from the live tasks + deliverables. */
export default function ProgressDashboard({ cf }: { cf: UseCofounder }) {
  const { tasks, artifacts } = cf;
  if (tasks.length === 0) return null;

  const done = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const scored = artifacts.filter((a) => a.eval && typeof a.eval.score === "number");
  const avg = scored.length
    ? Math.round((scored.reduce((s, a) => s + (a.eval!.score || 0), 0) / scored.length) * 10) / 10
    : null;
  const activeDepts = new Set(tasks.map((t) => t.department)).size;

  const byDept = DEPARTMENTS.map((d) => {
    const items = tasks.filter((t) => t.department === d);
    return { dept: d, total: items.length, done: items.filter((t) => t.status === "done").length };
  }).filter((g) => g.total > 0);

  const stats: { label: string; value: string; sub?: string }[] = [
    { label: "Deliverables", value: String(artifacts.length) },
    { label: "Avg quality", value: avg !== null ? `${avg}` : "—", sub: avg !== null ? "/10" : "" },
    { label: "Tasks done", value: `${done}/${tasks.length}`, sub: `${pct}%` },
    { label: "Active agents", value: String(activeDepts) },
  ];

  return (
    <div className="rounded-[14px] bg-white p-4 shadow-raised">
      <div className="mb-3 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-50)]">
        Company progress
      </div>
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[10px] bg-[var(--surface-raised)] px-2.5 py-2 shadow-raised">
            <div className="flex items-baseline gap-0.5">
              <span className="font-display text-[20px] leading-none text-[var(--text)]">{s.value}</span>
              {s.sub && <span className="font-mono text-[10px] text-[var(--text-50)]">{s.sub}</span>}
            </div>
            <div className="mt-1 truncate font-mono text-[8.5px] uppercase tracking-[0.05em] text-[var(--text-50)]">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {byDept.length > 0 && (
        <div className="mt-3.5 space-y-1.5">
          {byDept.map((g) => (
            <div key={g.dept} className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: departmentColor(g.dept) }} />
              <span className="w-[88px] shrink-0 truncate font-display text-[12px] text-[var(--text-70)]">{g.dept}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${g.total ? (g.done / g.total) * 100 : 0}%`, background: departmentColor(g.dept) }}
                />
              </span>
              <span className="w-9 shrink-0 text-right font-mono text-[10px] text-[var(--text-50)]">{g.done}/{g.total}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
