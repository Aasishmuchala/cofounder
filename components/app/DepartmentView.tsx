"use client";

import * as React from "react";
import { useState } from "react";
import { cx } from "@/components/ui/primitives";
import { departmentColor } from "@/lib/agent-types";
import type { Task, Artifact } from "@/lib/agent-types";
import { departmentInfo } from "@/lib/cofounder-data";
import type { UseCofounder } from "@/lib/use-cofounder";

function Collapsible({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div className="rounded-[12px] bg-white p-1 shadow-raised">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5"
      >
        <span className="flex items-center gap-1.5">
          <span className="font-display text-[15px] text-[var(--text)]">{title}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-30)" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
          </svg>
        </span>
        <span className="flex items-center gap-2">
          {count !== undefined && <span className="font-mono text-[11px] text-[var(--text-50)]">{count}</span>}
          <span className={cx("text-[var(--text-50)] transition-transform", open && "rotate-180")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </span>
      </button>
      {open && <div className="px-3 pb-3 pt-0.5">{children}</div>}
    </div>
  );
}

export default function DepartmentView({
  department,
  cf,
  brand,
  onBack,
}: {
  department: string;
  cf: UseCofounder;
  brand: string;
  onBack: () => void;
}) {
  const info = departmentInfo(department);
  const color = departmentColor(department);
  const tasks = cf.tasks.filter((t: Task) => t.department === department);
  const deptTaskIds = new Set(tasks.map((t) => t.id));
  const files = cf.artifacts.filter((a: Artifact) => a.taskId && deptTaskIds.has(a.taskId));

  return (
    <div className="space-y-4">
      {/* breadcrumb */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-[var(--text-50)] transition-colors hover:text-[var(--text)]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em]">{brand}</span>
        <span className="font-mono text-[10px] text-[var(--text-30)]">/</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-70)]">{department}</span>
      </button>

      {/* header */}
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-[9px] shadow-raised" style={{ background: `${color}22` }}>
          <span className="h-3 w-3 rounded-[3px]" style={{ background: color }} />
        </span>
        <h2 className="font-display text-[22px] text-[var(--text)]">{department}</h2>
      </div>

      {/* cover */}
      {info && (
        <div className="overflow-hidden rounded-[14px] shadow-raised">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={info.cover} alt="" className="h-[160px] w-full object-cover" />
        </div>
      )}
      <p className="font-mono text-[12px] leading-relaxed text-[var(--text-70)]">
        {info?.blurb ?? `${department} agents handle work for this part of the company.`}
      </p>

      {/* Agents */}
      <Collapsible title="Agents" count={info ? 1 : 0} defaultOpen>
        {info ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[11px] text-[var(--text-30)]">0</span>
              <span className="font-mono text-[12px] text-[var(--text-80)]">{info.agent}</span>
              <span className="font-mono text-[10px] text-[var(--text-50)]">Default</span>
            </div>
            <span className="rounded-[6px] bg-[var(--surface-raised)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-70)] shadow-raised">Edit</span>
          </div>
        ) : null}
        <div className="mt-2 grid place-items-center rounded-[8px] bg-[var(--surface-raised)] py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-50)]">
          + New Agent
        </div>
      </Collapsible>

      {/* Tasks */}
      <Collapsible title="Tasks" count={tasks.length}>
        {tasks.length === 0 ? (
          <p className="text-[12.5px] text-[var(--text-50)]">No tasks yet.</p>
        ) : (
          <div className="space-y-1.5">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2">
                <span className="truncate font-display text-[13px] text-[var(--text-80)]">{t.title}</span>
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-50)]">{t.status.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        )}
      </Collapsible>

      {/* Files */}
      <Collapsible title="Files" count={files.length}>
        {files.length === 0 ? (
          <p className="text-[12.5px] text-[var(--text-50)]">No files yet — deliverables this department produces land here.</p>
        ) : (
          <div className="space-y-1.5">
            {files.map((f, i) => (
              <div key={f.id ?? i} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                <span className="truncate font-display text-[13px] text-[var(--text-70)]">{f.title}</span>
              </div>
            ))}
          </div>
        )}
      </Collapsible>

      {/* Context */}
      <Collapsible title="Context" count={1}>
        <div className="flex items-center gap-2 text-[12.5px] text-[var(--text-70)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-30)]" />
          {brand} business context
        </div>
      </Collapsible>
    </div>
  );
}
