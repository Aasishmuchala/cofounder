"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui/primitives";
import { departmentColor } from "@/lib/agent-types";
import { DEPARTMENT_INFO } from "@/lib/cofounder-data";
import type { UseCofounder } from "@/lib/use-cofounder";

type Kind = "needs_action" | "running" | "done";
interface Item {
  id: string;
  taskId?: string;
  title: string;
  subtitle: string;
  dept: string;
  kind: Kind;
}

function agentFor(dept: string): string {
  return DEPARTMENT_INFO[dept]?.agent ?? `${dept} Agent`;
}

function relative(ts: number | undefined, now: number): string {
  if (!ts || !now) return "just now";
  const d = now - ts;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
}

export default function InboxPanel({
  cf,
  onSelectDepartment,
}: {
  cf: UseCofounder;
  onSelectDepartment?: (dept: string) => void;
}) {
  const { tasks, artifacts, updateTask } = cf;
  const [expanded, setExpanded] = useState(false);
  const [alerts, setAlerts] = useState(false);

  // build the activity feed (needs-approval first, then working, then delivered)
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const items: Item[] = [];
  tasks
    .filter((t) => t.status === "needs_action")
    .forEach((t) => items.push({ id: `na-${t.id}`, taskId: t.id, title: t.title, subtitle: "Needs your approval", dept: t.department, kind: "needs_action" }));
  tasks
    .filter((t) => t.status === "running")
    .forEach((t) => items.push({ id: `rn-${t.id}`, taskId: t.id, title: t.title, subtitle: `${agentFor(t.department)} is working…`, dept: t.department, kind: "running" }));
  artifacts.forEach((a) => {
    const t = a.taskId ? taskById.get(a.taskId) : undefined;
    const dept = t?.department ?? "Operations";
    items.push({ id: `ar-${a.id ?? a.title}`, taskId: a.taskId ?? undefined, title: t?.title ?? a.title, subtitle: `${agentFor(dept)} responded`, dept, kind: "done" });
  });

  // first-seen timestamps (for relative time) + a ticking "now"
  const idsKey = items.map((i) => i.id).join("|");
  const [seen, setSeen] = useState<Record<string, number>>({});
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot first-seen stamp; returns prev once stamped
    setSeen((prev) => {
      const t = Date.now();
      let changed = false;
      const next: Record<string, number> = { ...prev };
      for (const i of items) if (next[i.id] === undefined) { next[i.id] = t; changed = true; }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the item id list
  }, [idsKey]);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const seed = setTimeout(() => setNow(Date.now()), 0);
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(seed);
      clearInterval(iv);
    };
  }, []);

  if (tasks.length === 0) return null;

  const needsCount = items.filter((i) => i.kind === "needs_action").length;
  const shown = items.slice(0, 6);

  const toggleAlerts = () => {
    if (!alerts && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    setAlerts((v) => !v);
  };

  return (
    <div className="absolute bottom-5 left-5 z-20 w-[290px]">
      {expanded && (
        <div className="mb-2 overflow-hidden rounded-[14px] bg-white shadow-deep">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-2.5">
            <span className="font-display text-[15px] text-[var(--text)]">Inbox</span>
            <button
              onClick={toggleAlerts}
              className={cx(
                "flex items-center gap-1.5 rounded-[7px] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.06em] shadow-raised transition-colors",
                alerts ? "bg-[var(--green-tint)] text-[#2c7a3f]" : "bg-[var(--surface-raised)] text-[var(--text-50)]",
              )}
            >
              <span className={cx("h-1.5 w-1.5 rounded-full", alerts ? "bg-[#2c7a3f]" : "bg-[var(--text-30)]")} />
              Desktop alerts
            </button>
          </div>
          <div className="max-h-[300px] overflow-auto">
            {shown.map((it) => (
              <button
                key={it.id}
                onClick={() => onSelectDepartment?.(it.dept)}
                className="flex w-full items-start gap-2.5 border-b border-black/[0.04] px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-black/[0.02]"
              >
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: `${departmentColor(it.dept)}22` }}>
                  {it.kind === "running" ? (
                    <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-[var(--text-30)] border-t-[var(--text-70)]" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: departmentColor(it.dept) }} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-display text-[13px] font-medium text-[var(--text-80)]">{it.title}</span>
                    <span className="shrink-0 font-mono text-[9px] text-[var(--text-50)]">{relative(seen[it.id], now)}</span>
                  </span>
                  <span className="block truncate text-[12px] text-[var(--text-50)]">{it.subtitle}</span>
                  {it.kind === "needs_action" && it.taskId && (
                    <span className="mt-1.5 flex gap-1.5">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateTask(it.taskId as string, { status: "running" });
                        }}
                        className="rounded-[6px] px-2 py-0.5 font-display text-[11px] font-medium text-white shadow-glossy"
                        style={{ background: "var(--green)" }}
                      >
                        Approve
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateTask(it.taskId as string, { status: "todo" });
                        }}
                        className="rounded-[6px] bg-[#efefec] px-2 py-0.5 font-display text-[11px] font-medium text-[var(--text-70)]"
                      >
                        Decline
                      </span>
                    </span>
                  )}
                </span>
              </button>
            ))}
            {shown.length === 0 && (
              <div className="px-4 py-4 text-[12.5px] text-[var(--text-50)]">No agent updates yet.</div>
            )}
          </div>
        </div>
      )}

      {/* collapsed bar */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-raised transition-colors hover:bg-black/[0.02]"
      >
        <span className="relative grid h-4 w-4 place-items-center text-[var(--text-50)]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {needsCount > 0 && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--coral)]" />}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-70)]">
          {items.length} agent update{items.length === 1 ? "" : "s"}
        </span>
        <span className={cx("text-[var(--text-50)] transition-transform", expanded && "rotate-180")}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </button>
    </div>
  );
}
