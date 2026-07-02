// PURE (no model, no DB): a plan-review gate modeled on GStack's cadence
// (plan-ceo-review -> plan-eng-review -> qa). After decomposeGoal produces a bounded
// plan, reviewPlan() runs deterministic quality gates over it, applies safe
// auto-fixes, and returns the adjusted plan plus a structured review the UI can show
// the founder BEFORE they approve. This deepens Helm's single-shot decompose into a
// plan -> review -> refine step without touching the (stress-tested) execution path.
//
// Faithful to GStack, but as heuristics rather than model calls, so it is instant,
// free, and unit-tested (tests/plan-review.test.ts). The gates:
//   coverage    (plan-eng-review) — every objective must have >=1 task; empty
//                                    objectives are DROPPED (they can't ship anything).
//   sequencing  (plan-ceo-review) — go-to-market work must depend on the build work;
//                                    the missing dependency is ADDED (cycle-safe).
//   staffing    (plan-ceo-review) — the CEO should staff a focused org (<=7 depts);
//                                    over-staffing is flagged.
//   qa          (qa / retro)      — the plan should include a review/QA step; its
//                                    absence is flagged (Helm still judges each
//                                    deliverable, so this is a warning, not a block).

import type { OrchestratorPlan, PlanObjective, PlanTask } from "@/lib/agent-types";

export type GateStatus = "pass" | "warn" | "fixed";

export interface PlanGate {
  /** Stable gate id (coverage | sequencing | staffing | qa). */
  name: string;
  status: GateStatus;
  /** Human-readable finding, safe to show the founder. */
  note: string;
}

export interface PlanReview {
  gates: PlanGate[];
  /** 0–100 quality score (100 = every gate clean, no fixes needed). */
  score: number;
  /** True when no gate is warning (auto-fixes still count as passing). */
  passed: boolean;
  /** One-line summary of the review outcome. */
  summary: string;
}

const GTM_RE = /\blaunch|go[- ]?to[- ]?market|\bgtm\b|growth|acquisi|campaign|\bsell\b|revenue|outreach|pipeline|demand/i;
const BUILD_RE = /\bbuild\b|\bship\b|product|\bmvp\b|prototype|develop|engineer|brand|design|scaffold|architecture/i;
const QA_RE = /\bqa\b|\btest\b|review|verif|audit|quality|retro|check|validat/i;
const BUILD_DEPTS = new Set(["Engineering", "Product", "Design"]);
const GTM_DEPTS = new Set(["Marketing", "Sales"]);

/** Deep-copy the objective/task arrays so reviewPlan never mutates its input. */
function clonePlan(plan: OrchestratorPlan): OrchestratorPlan {
  return {
    ...plan,
    objectives: plan.objectives.map((o) => ({ ...o, dependsOn: [...(o.dependsOn ?? [])], taskIds: [...(o.taskIds ?? [])] })),
    tasks: plan.tasks.map((t) => ({ ...t, dependsOn: [...(t.dependsOn ?? [])] })),
    departments: [...plan.departments],
  };
}

/** True if `from` can already reach `to` along dependsOn edges (so adding to->from
 *  would create a cycle). Iterative DFS over the objective graph. */
function reaches(objectives: PlanObjective[], from: string, to: string): boolean {
  const byId = new Map(objectives.map((o) => [o.id, o]));
  const stack = [from];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const dep of byId.get(id)?.dependsOn ?? []) stack.push(dep);
  }
  return false;
}

function isBuild(o: PlanObjective, tasks: PlanTask[]): boolean {
  if (BUILD_DEPTS.has(o.department)) return true;
  const text = `${o.title} ${o.description}`;
  if (BUILD_RE.test(text)) return true;
  return tasks.some((t) => t.objectiveId === o.id && BUILD_RE.test(`${t.title} ${t.detail}`));
}

function isGtm(o: PlanObjective, tasks: PlanTask[]): boolean {
  if (GTM_DEPTS.has(o.department)) return true;
  const text = `${o.title} ${o.description}`;
  if (GTM_RE.test(text)) return true;
  return tasks.some((t) => t.objectiveId === o.id && GTM_RE.test(`${t.title} ${t.detail}`));
}

/**
 * Run the plan-review gates. Returns the (possibly auto-fixed) plan and the review.
 * Pure + deterministic; safe to call on any sanitized OrchestratorPlan.
 */
export function reviewPlan(input: OrchestratorPlan): { plan: OrchestratorPlan; review: PlanReview } {
  const plan = clonePlan(input);
  const gates: PlanGate[] = [];

  // ── coverage (plan-eng-review): drop objectives with no tasks ──────────────
  const taskCountOf = (id: string) => plan.tasks.filter((t) => t.objectiveId === id).length;
  const empties = plan.objectives.filter((o) => taskCountOf(o.id) === 0);
  if (empties.length) {
    const emptyIds = new Set(empties.map((o) => o.id));
    plan.objectives = plan.objectives
      .filter((o) => !emptyIds.has(o.id))
      // Strip any dependency on a now-removed objective.
      .map((o) => ({ ...o, dependsOn: o.dependsOn.filter((d) => !emptyIds.has(d)) }));
    gates.push({
      name: "coverage",
      status: "fixed",
      note: `Dropped ${empties.length} objective${empties.length > 1 ? "s" : ""} with no tasks (${empties.map((o) => o.title).join(", ")}).`,
    });
  } else {
    gates.push({ name: "coverage", status: "pass", note: "Every objective has at least one task." });
  }

  // ── sequencing (plan-ceo-review): GTM must depend on build ─────────────────
  const buildObjs = plan.objectives.filter((o) => isBuild(o, plan.tasks));
  const gtmObjs = plan.objectives.filter((o) => isGtm(o, plan.tasks) && !isBuild(o, plan.tasks));
  if (buildObjs.length && gtmObjs.length) {
    let added = 0;
    let alreadyOk = 0;
    for (const gtm of gtmObjs) {
      const dependsOnABuild = gtm.dependsOn.some((d) => buildObjs.some((b) => b.id === d));
      if (dependsOnABuild) {
        alreadyOk++;
        continue;
      }
      // Add a dep on the FIRST build objective that wouldn't create a cycle
      // (i.e. that build objective must not already depend on this GTM objective).
      const target = buildObjs.find((b) => b.id !== gtm.id && !reaches(plan.objectives, b.id, gtm.id));
      if (target) {
        gtm.dependsOn.push(target.id);
        added++;
      }
    }
    if (added) {
      gates.push({ name: "sequencing", status: "fixed", note: `Wired ${added} go-to-market objective${added > 1 ? "s" : ""} to depend on the build work first.` });
    } else {
      gates.push({ name: "sequencing", status: "pass", note: `Go-to-market work already follows the build work (${alreadyOk} ordered).` });
    }
  } else {
    gates.push({ name: "sequencing", status: "pass", note: "No build/go-to-market ordering to enforce." });
  }

  // ── staffing (plan-ceo-review): focused org, <=7 departments ───────────────
  const depts = new Set(plan.objectives.map((o) => o.department));
  if (depts.size > 7) {
    gates.push({ name: "staffing", status: "warn", note: `Plan staffs ${depts.size} departments — consider narrowing to the 3–7 this business actually needs.` });
  } else {
    gates.push({ name: "staffing", status: "pass", note: `Focused org: ${depts.size} department${depts.size === 1 ? "" : "s"}.` });
  }

  // ── qa (qa / retro): a review/QA step should exist ─────────────────────────
  const hasQa =
    plan.objectives.some((o) => QA_RE.test(`${o.title} ${o.description}`)) ||
    plan.tasks.some((t) => QA_RE.test(`${t.title} ${t.detail}`));
  if (hasQa) {
    gates.push({ name: "qa", status: "pass", note: "Plan includes a review/QA step." });
  } else {
    gates.push({ name: "qa", status: "warn", note: "No explicit QA/review step — Helm still quality-judges each deliverable, but consider adding a review objective." });
  }

  // Score: warnings hurt; auto-fixes are good outcomes but signal the plan needed help.
  const warns = gates.filter((g) => g.status === "warn").length;
  const fixes = gates.filter((g) => g.status === "fixed").length;
  const score = Math.max(0, Math.min(100, 100 - warns * 20 - fixes * 5));
  const passed = warns === 0;
  const summary = passed
    ? fixes
      ? `Plan reviewed and tightened (${fixes} auto-fix${fixes > 1 ? "es" : ""}).`
      : "Plan passed review cleanly."
    : `Plan reviewed: ${warns} thing${warns > 1 ? "s" : ""} to consider.`;

  return { plan, review: { gates, score, passed, summary } };
}
