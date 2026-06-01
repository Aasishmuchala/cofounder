"use client";

import * as React from "react";
import { useState } from "react";
import { cx, MonoLabel, StatusBadge } from "@/components/ui/primitives";
import { departmentColor, objectiveStatus, totalSpent, isOverBudget } from "@/lib/agent-types";
import type { OrchestratorPlan, PlanObjective, PlanTask, ObjectiveStatus, Task, BudgetConfig, SpendRecord } from "@/lib/agent-types";
import { ORG_ROLES, getRoleForDepartment, specialistsForDepartment, routeTaskToSpecialist } from "@/lib/org";
import type { OrgRole } from "@/lib/org";
import type { UseCofounder } from "@/lib/use-cofounder";
import type { CustomAgent } from "@/lib/use-custom-agents";

/** Visual treatment per objective status — mirrors the StatusTag palette. */
const OBJ_STATUS_STYLE: Record<ObjectiveStatus, { label: string; bg: string; color: string }> = {
  open: { label: "Open", bg: "#efefec", color: "var(--text-50)" },
  achieved: { label: "Achieved", bg: "var(--green-tint)", color: "#2c7a3f" },
  needs_action: { label: "Needs action", bg: "#fff0ed", color: "var(--coral)" },
  cancelled: { label: "Cancelled", bg: "#efefec", color: "var(--text-30)" },
};

function ObjStatusBadge({ status }: { status: ObjectiveStatus }) {
  const s = OBJ_STATUS_STYLE[status];
  return <StatusBadge label={s.label} bg={s.bg} fg={s.color} className="shrink-0" />;
}

/* ── One C-suite role row in the org chart — its department chips plus an
   expandable 3rd tier of specialist agents (collapsed by default so the panel
   stays compact with ~50 agents). The CEO (no departments) just shows its blurb. ── */
function RoleRow({
  role,
  countByDept,
  customByDept,
  countByAgent,
}: {
  role: OrgRole;
  countByDept: Map<string, number>;
  customByDept: Map<string, number>;
  countByAgent: Map<string, number>;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDepartments = role.departments.length > 0;
  // Roll-up across every department this role owns: total specialists + tasks.
  const agentCount = role.departments.reduce((n, d) => n + specialistsForDepartment(d).length, 0);
  const taskCount = role.departments.reduce((n, d) => n + (countByDept.get(d) ?? 0), 0);
  const avatar = role.id === "CEO" ? "CEO" : role.id.replace(/[^A-Z]/g, "").slice(0, 3);

  return (
    <div className="rounded-[10px] bg-white p-3 shadow-raised">
      {hasDepartments ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full items-center gap-2 text-left"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--surface-raised)] font-mono text-[9px] uppercase tracking-[0.04em] text-[var(--text-70)] shadow-raised">
            {avatar}
          </span>
          <span className="font-display text-[14px] text-[var(--text-80)]">{role.title}</span>
          <span className="ml-auto shrink-0 font-mono text-[9px] text-[var(--text-50)]">
            {agentCount} agent{agentCount === 1 ? "" : "s"} · {taskCount} task{taskCount === 1 ? "" : "s"}
          </span>
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className={cx("shrink-0 text-[var(--text-50)] transition-transform", expanded && "rotate-90")}
            aria-hidden
          >
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--surface-raised)] font-mono text-[9px] uppercase tracking-[0.04em] text-[var(--text-70)] shadow-raised">
            {avatar}
          </span>
          <span className="font-display text-[14px] text-[var(--text-80)]">{role.title}</span>
        </div>
      )}

      {hasDepartments ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {role.departments.map((dept) => {
            const n = countByDept.get(dept) ?? 0;
            const c = customByDept.get(dept) ?? 0;
            return (
              <span
                key={dept}
                className="inline-flex items-center gap-1.5 rounded-[7px] bg-[var(--surface-raised)] px-2 py-1 font-mono text-[10px] text-[var(--text-70)] shadow-raised"
              >
                <span className="h-2 w-2 rounded-[2px]" style={{ background: departmentColor(dept) }} />
                {dept}
                {n > 0 && <span className="text-[var(--text-50)]">· {n} task{n === 1 ? "" : "s"}</span>}
                {c > 0 && <span className="text-[var(--text-50)]">· +{c}</span>}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="mt-1.5 text-[11.5px] leading-snug text-[var(--text-50)]">{role.blurb}</p>
      )}

      {/* 3rd tier: the specialists that staff each owned department (revealed on click). */}
      {hasDepartments && expanded && (
        <div className="mt-2 space-y-2 border-t border-[var(--surface-raised)] pt-2">
          {role.departments.map((dept) => {
            const specialists = specialistsForDepartment(dept);
            if (specialists.length === 0) return null;
            return (
              <div key={dept}>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-[2px]" style={{ background: departmentColor(dept) }} />
                  <MonoLabel>{dept}</MonoLabel>
                </div>
                <div className="mt-1 space-y-0.5">
                  {specialists.map((s) => {
                    const n = countByAgent.get(s.id) ?? 0;
                    return (
                      <div key={s.id} className="flex items-center gap-2 pl-3">
                        <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--text-30)]" />
                        <span className="flex-1 truncate font-display text-[12px] text-[var(--text-70)]" title={s.blurb}>
                          {s.title}
                        </span>
                        {n > 0 && (
                          <span className="shrink-0 font-mono text-[9px] text-[var(--text-50)]">
                            {n} task{n === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function OrgTab({
  cf,
  customAgents,
}: {
  cf: UseCofounder;
  brand: string;
  customAgents: CustomAgent[];
}) {
  const { tasks, meta, canEdit } = cf;
  const objectives = (meta.objectives ?? []) as PlanObjective[];

  // Goal -> plan proposal flow.
  const [goal, setGoal] = useState("");
  const [proposing, setProposing] = useState(false);
  const [proposal, setProposal] = useState<OrchestratorPlan | null>(null);
  const [approving, setApproving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Task counts per department (for the org-chart badges) — includes custom agents.
  const countByDept = new Map<string, number>();
  for (const t of tasks) countByDept.set(t.department, (countByDept.get(t.department) ?? 0) + 1);
  const customByDept = new Map<string, number>();
  for (const a of customAgents) customByDept.set(a.department, (customByDept.get(a.department) ?? 0) + 1);
  // Task counts per specialist (3rd tier) — route every task to its specialist so
  // each individual contributor carries its own task tally in the org chart.
  const countByAgent = new Map<string, number>();
  for (const t of tasks) {
    const s = routeTaskToSpecialist(t);
    if (s) countByAgent.set(s.id, (countByAgent.get(s.id) ?? 0) + 1);
  }

  async function onPropose(e?: React.FormEvent) {
    e?.preventDefault();
    const g = goal.trim();
    if (!g || proposing || !canEdit) return;
    setErr(null);
    setProposing(true);
    setProposal(null);
    const plan = await cf.proposePlan(g);
    setProposing(false);
    if (!plan || plan.objectives.length === 0) {
      setErr("Couldn't draft a plan. Try rephrasing the goal.");
      return;
    }
    setProposal(plan);
  }

  async function onApprove() {
    if (!proposal || approving || !canEdit) return;
    setApproving(true);
    await cf.approvePlan(proposal);
    setApproving(false);
    setProposal(null);
    setGoal("");
  }

  return (
    <div>
      {/* ── Org chart: C-suite → departments ── */}
      <div className="flex items-center gap-1.5">
        <span className="text-[14px] leading-none" aria-hidden>🏢</span>
        <h3 className="font-display text-[16px] text-[var(--text)]">Org chart</h3>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-50)]">
        A C-suite sits above your department agents. Set a goal and the chief of staff drafts a plan — objectives owned by
        each leader, with dependencies — for you to approve before any agent runs.
      </p>

      <div className="mt-3 space-y-1.5">
        {ORG_ROLES.map((role) => (
          <RoleRow
            key={role.id}
            role={role}
            countByDept={countByDept}
            customByDept={customByDept}
            countByAgent={countByAgent}
          />
        ))}
      </div>

      {/* ── Goal → plan ── */}
      {canEdit && (
        <>
          <MonoLabel className="mt-6 block">Set a company goal</MonoLabel>
          <form onSubmit={onPropose} className="mt-2">
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              disabled={proposing || approving}
              placeholder="e.g. Launch a paid beta to 100 design teams in 6 weeks"
              className="w-full resize-none rounded-[10px] bg-white p-3 font-display text-[13px] text-[var(--text)] shadow-raised outline-none placeholder:text-[var(--text-50)] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!goal.trim() || proposing || approving}
              className="mt-2 w-full rounded-[8px] py-2 font-display text-[13px] font-medium text-white shadow-glossy transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: "var(--text)" }}
            >
              {proposing ? "Drafting plan…" : "Draft plan"}
            </button>
          </form>
          {err && <p className="mt-2 text-[12px] text-[var(--coral)]">{err}</p>}
        </>
      )}

      {/* ── Proposed plan (awaiting approval) ── */}
      {proposal && (
        <div className="mt-4 rounded-[12px] border border-dashed border-[var(--text-30)] bg-white/60 p-3">
          <div className="flex items-center justify-between">
            <MonoLabel>Proposed plan</MonoLabel>
            <span className="font-mono text-[10px] text-[var(--text-50)]">
              {proposal.objectives.length} objective{proposal.objectives.length === 1 ? "" : "s"} · {proposal.tasks.length} task{proposal.tasks.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-2 space-y-2">
            {proposal.objectives.map((o) => (
              <ProposedObjective key={o.id} objective={o} tasks={proposal.tasks.filter((t) => t.objectiveId === o.id)} />
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onApprove}
              disabled={approving}
              className="flex-1 rounded-[8px] py-2 font-display text-[12px] font-medium text-white shadow-glossy disabled:opacity-50"
              style={{ background: "var(--green)" }}
            >
              {approving ? "Approving…" : "Approve plan"}
            </button>
            <button
              onClick={() => setProposal(null)}
              disabled={approving}
              className="flex-1 rounded-[8px] bg-[#efefec] py-2 font-display text-[12px] font-medium text-[var(--text-70)] disabled:opacity-50"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* ── Approved objectives (live roll-up) ── */}
      <MonoLabel className="mt-6 block">Objectives</MonoLabel>
      {objectives.length === 0 ? (
        <p className="mt-2 text-[13px] text-[var(--text-50)]">
          No objectives yet. Set a goal above to draft a plan.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {objectives.map((o) => (
            <ApprovedObjective key={o.id} objective={o} tasks={tasks} />
          ))}
        </div>
      )}

      {/* ── Budget & spend ledger ── */}
      <BudgetSection cf={cf} />
    </div>
  );
}

/* ── Budget ceiling + approved-spend ledger (governance only — no payments). ── */
function BudgetSection({ cf }: { cf: UseCofounder }) {
  const { meta, canEdit } = cf;
  const budget = (meta.budget ?? null) as BudgetConfig | null;
  const records = (meta.spendRecords ?? []) as SpendRecord[];
  const spent = totalSpent(records);
  // Newest spends first for the ledger view.
  const recent = [...records].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)).slice(0, 6);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const currency = budget?.currency || "USD";
  const total = budget?.totalUsd ?? 0;
  const pct = total > 0 ? Math.min(Math.round((spent / total) * 100), 100) : 0;
  const over = budget ? isOverBudget(budget, records, 0) : false;
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  async function save() {
    if (!canEdit || saving) return;
    const n = Number(draft);
    if (!Number.isFinite(n) || n < 0) return;
    setSaving(true);
    await cf.setBudget({ totalUsd: n, currency });
    setSaving(false);
    setEditing(false);
  }

  async function clear() {
    if (!canEdit || saving) return;
    setSaving(true);
    await cf.setBudget(null);
    setSaving(false);
    setEditing(false);
  }

  return (
    <>
      <div className="mt-6 flex items-center justify-between">
        <MonoLabel>Budget &amp; spend</MonoLabel>
        {canEdit && !editing && (
          <button
            onClick={() => {
              setDraft(total ? String(total) : "");
              setEditing(true);
            }}
            className="rounded-[6px] bg-white px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-50)] shadow-raised transition-colors hover:text-[var(--text)]"
          >
            {budget ? "Edit" : "Set budget"}
          </button>
        )}
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-50)]">
        Agents can propose spending; you approve it in the Inbox. Approved spends are recorded here against your budget —
        no money is ever moved.
      </p>

      {editing && canEdit && (
        <div className="mt-2 rounded-[10px] bg-white p-3 shadow-raised">
          <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-50)]">Total budget ({currency})</label>
          <input
            type="number"
            min={0}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. 10000"
            className="mt-1 w-full rounded-[8px] bg-[var(--surface-raised)] px-2.5 py-1.5 font-display text-[13px] text-[var(--text)] shadow-raised outline-none placeholder:text-[var(--text-50)]"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={save}
              disabled={saving || !draft.trim()}
              className="flex-1 rounded-[8px] py-1.5 font-display text-[12px] font-medium text-white shadow-glossy disabled:opacity-50"
              style={{ background: "var(--green)" }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {budget && (
              <button
                onClick={clear}
                disabled={saving}
                className="rounded-[8px] bg-[#efefec] px-3 py-1.5 font-display text-[12px] font-medium text-[var(--text-70)] disabled:opacity-50"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-[8px] bg-[#efefec] px-3 py-1.5 font-display text-[12px] font-medium text-[var(--text-70)] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-2 rounded-[12px] bg-white p-3 shadow-raised">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[15px] text-[var(--text-80)]">
            {currency} {fmt(spent)}
            {budget && <span className="text-[var(--text-50)]"> / {fmt(total)}</span>}
          </span>
          {budget ? (
            <span className={cx("font-mono text-[11px]", over ? "text-[var(--coral)]" : "text-[var(--text-50)]")}>
              {pct}%{over ? " · over" : ""}
            </span>
          ) : (
            <span className="font-mono text-[10px] text-[var(--text-50)]">No budget set</span>
          )}
        </div>
        {budget && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-raised)]">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(pct, spent > 0 ? 2 : 0)}%`, background: over ? "var(--coral)" : "var(--green)" }}
            />
          </div>
        )}

        {recent.length > 0 ? (
          <div className="mt-3 space-y-1.5">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: departmentColor(r.department) }} />
                <span className="flex-1 truncate font-display text-[12px] text-[var(--text-70)]">{r.label || "Spend"}</span>
                <span className="shrink-0 font-mono text-[11px] text-[var(--text-70)]">{currency} {fmt(r.amountUsd)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-[var(--text-50)]">No approved spends yet.</p>
        )}
      </div>
    </>
  );
}

/* ── A proposed objective (pre-approval; uses the model's static status). ── */
function ProposedObjective({ objective, tasks }: { objective: PlanObjective; tasks: PlanTask[] }) {
  const role = objective.role || getRoleForDepartment(objective.department);
  return (
    <div className="rounded-[9px] bg-white p-2.5 shadow-raised">
      <div className="flex items-start justify-between gap-2">
        <span className="font-display text-[13px] text-[var(--text-80)]">{objective.title}</span>
        <span className="shrink-0 rounded-[5px] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.05em] text-[var(--text-50)] shadow-raised">
          {role}
        </span>
      </div>
      {objective.description && (
        <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-50)]">{objective.description}</p>
      )}
      {tasks.length > 0 && (
        <div className="mt-2 space-y-1">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: departmentColor(t.department) }} />
              <span className="flex-1 truncate font-display text-[12px] text-[var(--text-70)]">{t.title}</span>
              {t.dependsOn && t.dependsOn.length > 0 && (
                <span className="shrink-0 font-mono text-[9px] text-[var(--text-50)]" title={`Depends on ${t.dependsOn.join(", ")}`}>
                  ⟂ {t.dependsOn.length}
                </span>
              )}
              <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.05em] text-[var(--text-50)]">{t.department}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── An approved objective (live; status rolled up from its real tasks). ── */
function ApprovedObjective({ objective, tasks }: { objective: PlanObjective; tasks: Task[] }) {
  const status = objectiveStatus(objective, tasks);
  const idSet = new Set(objective.taskIds ?? []);
  const owned = tasks.filter((t) => t.objectiveId === objective.id || idSet.has(t.id));
  const done = owned.filter((t) => t.status === "done").length;
  const role = objective.role || getRoleForDepartment(objective.department);
  return (
    <div className="rounded-[10px] bg-white p-3 shadow-raised">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-display text-[14px] text-[var(--text-80)]">{objective.title}</span>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.05em] text-[var(--text-50)]">{role}</span>
            <span className="h-1.5 w-1.5 rounded-[2px]" style={{ background: departmentColor(objective.department) }} />
            <span className="font-mono text-[9px] text-[var(--text-50)]">{objective.department}</span>
          </div>
        </div>
        <ObjStatusBadge status={status} />
      </div>
      {objective.description && (
        <p className="mt-1 text-[11.5px] leading-snug text-[var(--text-50)]">{objective.description}</p>
      )}
      {owned.length > 0 && (
        <>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--surface-raised)]">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.round((done / owned.length) * 100)}%`, background: "var(--green)" }}
            />
          </div>
          <div className="mt-2 space-y-1">
            {owned.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                {t.status === "running" ? (
                  <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-[var(--text-30)] border-t-[var(--text-70)]" />
                ) : t.status === "done" ? (
                  <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-[var(--green-tint)]">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#2c7a3f" strokeWidth="3">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                ) : (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: departmentColor(t.department) }} />
                )}
                <span
                  className={cx(
                    "flex-1 truncate font-display text-[12px]",
                    t.status === "done" ? "text-[var(--text-50)] line-through" : "text-[var(--text-70)]",
                  )}
                >
                  {t.title}
                </span>
                {t.dependsOn && t.dependsOn.length > 0 && (
                  <span className="shrink-0 font-mono text-[9px] text-[var(--text-50)]" title="Waits on prerequisite tasks">
                    ⟂ {t.dependsOn.length}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
