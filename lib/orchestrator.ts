// SERVER-ONLY: the orchestration / goal-decomposition engine.
//
// A C-suite layer above the 8 department agents. Given a founder GOAL plus the
// company context (idea + brand + plan), decomposeGoal() calls the model ONCE to
// produce a BOUNDED, structured plan — Objectives (each owned by a C-suite role /
// department) and Tasks under them with explicit dependencies. The plan is
// returned for HUMAN APPROVAL; nothing is written until materializePlan() runs.
//
// HARD BOUNDS (enforced by sanitizePlan, independent of what the model returns):
//   <= 8 objectives, <= 6 tasks per objective, depth <= 2 (objective -> task),
//   no autonomous re-planning (decompose is called exactly once per goal).
//
// This module imports getAnthropic + supabase-rest (server-only) and lib/org.ts
// (pure). It must NEVER be imported by a client component — only by the
// app/api/plan route. The pure helpers (sanitizePlan) carry no model call and are
// unit-tested directly.

import type Anthropic from "@anthropic-ai/sdk";
import {
  coerceText,
  coerceDepartment,
  ORCH_MAX_OBJECTIVES,
  ORCH_MAX_TASKS_PER_OBJECTIVE,
  type OrchestratorPlan,
  type PlanObjective,
  type PlanTask,
  type WorkspaceMeta,
} from "@/lib/agent-types";
import { getRoleForDepartment } from "@/lib/org";
import { getAnthropic, MODEL } from "@/lib/anthropic";
import { getWorkspace, updateWorkspaceMeta, insertTasks, withWorkspaceLock } from "@/lib/supabase-rest";

/** Departments routed to the local Claude Code executor (Feature 2). The
 *  orchestrator stamps executor="claude-code" on these tasks at creation time;
 *  the runner falls back to the normal path when that executor is inactive. */
const CLAUDE_CODE_DEPARTMENTS = new Set(["Engineering"]);

/** Extract the first fenced (or bare) JSON object from a model reply. */
function fencedJson(text: string): string {
  const m = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/);
  return (m ? m[1] : text).trim();
}

/**
 * Coerce an UNTRUSTED plan-shaped value (model output OR a replayed request
 * body) into a bounded, well-formed OrchestratorPlan. This is the single source
 * of truth for the caps — the model is told the limits, but we never trust it:
 *   - objectives capped at 8; tasks capped at 6 PER OBJECTIVE (and total).
 *   - every objective has a stable id, an owner role derived from its department,
 *     and a status of "open".
 *   - every task references a real objective id (dropped otherwise) and only
 *     dependsOn ids that exist within the plan (forward refs / typos dropped).
 *   - depth is structurally 2 (objectives -> tasks); there is no deeper nesting.
 * Pure + deterministic — unit-tested without any model call.
 */
export function sanitizePlan(raw: unknown, goalFallback = ""): OrchestratorPlan {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const goal = coerceText(r.goal, 600) || coerceText(goalFallback, 600);

  // ---- Objectives (capped at 8) ----
  const rawObjectives = Array.isArray(r.objectives) ? (r.objectives as unknown[]) : [];
  const objectives: PlanObjective[] = [];
  const objIdByIndex = new Map<number, string>();
  // Map any model-provided objective id (string) -> our canonical id, so task
  // objectiveId references resolve even when the model invents its own ids.
  const objIdAlias = new Map<string, string>();

  rawObjectives.slice(0, ORCH_MAX_OBJECTIVES).forEach((o, i) => {
    const obj = (o && typeof o === "object" ? o : {}) as Record<string, unknown>;
    const id = `o${i + 1}`;
    objIdByIndex.set(i, id);
    const providedId = coerceText(obj.id, 60);
    if (providedId) objIdAlias.set(providedId, id);
    const department = coerceDepartment(obj.department);
    const role = coerceText(obj.role, 60) || getRoleForDepartment(department);
    objectives.push({
      id,
      title: coerceText(obj.title, 200) || `Objective ${i + 1}`,
      description: coerceText(obj.description, 1000),
      role,
      department,
      status: "open",
      taskIds: [],
      // dependsOn resolved in a second pass (need all ids first).
      dependsOn: Array.isArray(obj.dependsOn)
        ? (obj.dependsOn as unknown[]).map((d) => coerceText(d, 60)).filter(Boolean)
        : [],
      ts: Date.now(),
    });
  });

  const validObjIds = new Set(objectives.map((o) => o.id));
  // Resolve objective-level dependsOn through the alias map; drop unknowns + self.
  for (const obj of objectives) {
    obj.dependsOn = obj.dependsOn
      .map((d) => objIdAlias.get(d) ?? (validObjIds.has(d) ? d : ""))
      .filter((d) => d && d !== obj.id);
  }
  // Break any CYCLE in the objective graph (o1->o2->o1). Objective deps are used
  // to gate task execution (see the run-route actionable filters), so a cycle
  // would otherwise deadlock every task under the cyclic objectives forever. We
  // do a DFS over objectives in declared order and drop only the back-edges that
  // would close a cycle — forward (DAG) deps are preserved. This makes the
  // objective graph a guaranteed DAG before it is ever persisted/gated on.
  {
    const objById = new Map(objectives.map((o) => [o.id, o] as const));
    const VISITING = 1;
    const DONE = 2;
    const state = new Map<string, number>();
    const visit = (id: string, stack: Set<string>): void => {
      state.set(id, VISITING);
      stack.add(id);
      const o = objById.get(id);
      if (o) {
        o.dependsOn = o.dependsOn.filter((dep) => {
          // A dep currently on the DFS stack closes a cycle -> drop this edge.
          if (stack.has(dep)) return false;
          if (state.get(dep) !== DONE) visit(dep, stack);
          // Re-check: visiting `dep` may have left it (DONE) without a cycle.
          return true;
        });
      }
      stack.delete(id);
      state.set(id, DONE);
    };
    for (const o of objectives) if (state.get(o.id) !== DONE) visit(o.id, new Set());
  }

  // ---- Tasks (capped at 6 PER OBJECTIVE) ----
  const rawTasks = Array.isArray(r.tasks) ? (r.tasks as unknown[]) : [];
  const tasks: PlanTask[] = [];
  const perObjectiveCount = new Map<string, number>();
  const taskIdByProvided = new Map<string, string>();
  let taskSeq = 0;

  // First pass: assign canonical ids + objective binding, enforcing the per-
  // objective cap. A task whose objective is unknown is bound to the FIRST
  // objective (so nothing is silently lost when the model omits/typos the link).
  const firstObjId = objectives[0]?.id ?? null;
  const stagedTasks: { task: PlanTask; rawDeps: string[] }[] = [];
  for (const t of rawTasks) {
    const tk = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
    let objId =
      objIdAlias.get(coerceText(tk.objectiveId, 60)) ??
      (validObjIds.has(coerceText(tk.objectiveId, 60)) ? coerceText(tk.objectiveId, 60) : null);
    if (!objId) objId = firstObjId;
    if (!objId) break; // no objectives at all -> no tasks
    const count = perObjectiveCount.get(objId) ?? 0;
    if (count >= ORCH_MAX_TASKS_PER_OBJECTIVE) continue; // cap per objective
    perObjectiveCount.set(objId, count + 1);
    taskSeq += 1;
    const id = `t${taskSeq}`;
    const providedId = coerceText(tk.id, 60);
    if (providedId) taskIdByProvided.set(providedId, id);
    const department = coerceDepartment(tk.department);
    const task: PlanTask = {
      id,
      title: coerceText(tk.title, 200) || `Task ${taskSeq}`,
      department,
      detail: coerceText(tk.detail, 1000),
      objectiveId: objId,
      dependsOn: [],
    };
    stagedTasks.push({
      task,
      rawDeps: Array.isArray(tk.dependsOn)
        ? (tk.dependsOn as unknown[]).map((d) => coerceText(d, 60)).filter(Boolean)
        : [],
    });
  }

  // Second pass: resolve task dependsOn through the alias map (drop unknown / self),
  // and record taskIds on each objective.
  const validTaskIds = new Set(stagedTasks.map((s) => s.task.id));
  for (const { task, rawDeps } of stagedTasks) {
    task.dependsOn = rawDeps
      .map((d) => taskIdByProvided.get(d) ?? (validTaskIds.has(d) ? d : ""))
      .filter((d) => d && d !== task.id);
    tasks.push(task);
    const obj = objectives.find((o) => o.id === task.objectiveId);
    if (obj) obj.taskIds.push(task.id);
  }

  // Break any CYCLE in the TASK graph too (same rationale as objectives above):
  // isTaskReady gates on task.dependsOn, so a t1->t2->t1 cycle would deadlock those
  // tasks forever. DFS in declared order, dropping only back-edges that close a cycle.
  {
    const taskById = new Map(tasks.map((t) => [t.id, t] as const));
    const DONE = 2;
    const state = new Map<string, number>();
    const visit = (id: string, stack: Set<string>): void => {
      state.set(id, 1);
      stack.add(id);
      const t = taskById.get(id);
      if (t) {
        t.dependsOn = (t.dependsOn ?? []).filter((dep) => {
          if (stack.has(dep)) return false; // back-edge closes a cycle -> drop
          if (state.get(dep) !== DONE) visit(dep, stack);
          return true;
        });
      }
      stack.delete(id);
      state.set(id, DONE);
    };
    for (const t of tasks) if (state.get(t.id) !== DONE) visit(t.id, new Set());
  }

  return { goal, objectives, tasks };
}

/** Build the company-context block injected into the decomposition prompt. */
function contextBlock(idea: string, meta: WorkspaceMeta | null): string {
  const plan = meta?.plan ?? null;
  const parts: string[] = [`Company idea: "${idea || "a new startup"}".`];
  if (plan?.context) {
    parts.push(
      `Product: ${coerceText(plan.context.product, 240) || "—"}. ICP: ${coerceText(plan.context.icp, 160) || "—"}. Model: ${coerceText(plan.context.model, 120) || "—"}.`,
    );
  }
  if (Array.isArray(plan?.values) && plan.values.length) {
    parts.push(`Values: ${plan.values.slice(0, 4).map((v) => coerceText(v, 80)).join(", ")}.`);
  }
  if (meta?.vibeId) parts.push(`Brand vibe: ${coerceText(meta.vibeId, 40)}.`);
  return parts.join(" ");
}

/** The departments the model may assign work to (the 8 staffed departments). */
const DECOMPOSE_SYSTEM = `You are the COO / chief of staff of an AI-run startup. Given the founder's GOAL and the company context, produce a BOUNDED execution plan that the C-suite will run.

Return ONLY a single fenced json block of this exact shape:
\`\`\`json
{
  "objectives": [
    { "id": "o1", "title": "...", "description": "one sentence on the outcome", "department": "Engineering", "dependsOn": [] }
  ],
  "tasks": [
    { "id": "t1", "title": "...", "department": "Engineering", "detail": "concrete, actionable detail for the agent", "objectiveId": "o1", "dependsOn": [] }
  ]
}
\`\`\`

HARD RULES:
- AT MOST 8 objectives. AT MOST 6 tasks per objective. Depth is exactly 2 (objective -> task) — never nest deeper.
- Every objective.department and task.department MUST be one of: Engineering, Design, Marketing, Sales, Support, Operations, Finance, Legal.
- Each task.objectiveId MUST reference an objective id you defined. Each dependsOn entry MUST reference an id you defined earlier (objectives depend on objectives; tasks depend on tasks). NO cycles.
- Order matters: foundational work (e.g. brand, product) should come before work that depends on it, expressed via dependsOn.
- Be specific and realistic to THIS company. No filler. Output ONLY the json block.`;

/**
 * Decompose a founder GOAL into a bounded, structured plan. Calls the model
 * ONCE (no loop, no autonomous re-planning) and returns the plan WITHOUT any DB
 * writes — the caller presents it for human approval. Degrades to a deterministic
 * heuristic plan when no API key is configured (mock mode), so the flow is
 * demoable offline exactly like the rest of the app.
 */
export async function decomposeGoal(
  workspaceId: string | undefined,
  goal: string,
  meta: WorkspaceMeta | null,
): Promise<OrchestratorPlan> {
  const cleanGoal = coerceText(goal, 600);
  const idea = (workspaceId ? (await getWorkspace(workspaceId).then((w) => w?.idea).catch(() => "")) : "") || "";
  const client = getAnthropic();

  if (client) {
    try {
      const resp = await client.messages.create({
        model: MODEL,
        // 4500 (was 2400): the full objectives+tasks JSON for a rich plan can exceed
        // 2400 output tokens, and a TRUNCATED reply fails JSON.parse below — silently
        // dropping the founder to the generic heuristic even when the model tried.
        // The plan is still HARD-bounded by sanitizePlan regardless of this ceiling.
        max_tokens: 4500,
        system: [{ type: "text", text: DECOMPOSE_SYSTEM }],
        messages: [
          {
            role: "user",
            content: `${contextBlock(idea, meta)}\n\nFOUNDER GOAL: ${cleanGoal}\n\nProduce the plan now.`,
          },
        ],
      });
      const text = (resp.content as Anthropic.ContentBlock[])
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      const parsed = JSON.parse(fencedJson(text)) as unknown;
      const plan = sanitizePlan({ ...(parsed as object), goal: cleanGoal }, cleanGoal);
      // If the model returned nothing usable, fall through to the heuristic.
      // A real model-derived plan is explicitly NOT a fallback.
      if (plan.objectives.length > 0) return { ...plan, fallback: false };
    } catch {
      /* fall through to the deterministic heuristic plan */
    }
  }

  // No API key, or the model reply was unusable/truncated -> generic template.
  return heuristicPlan(cleanGoal);
}

/**
 * Deterministic fallback plan (no model). A small, sensible cross-functional
 * plan keyed off the goal so mock mode still demonstrates the full
 * decompose -> approve -> dependency-gated-run flow.
 */
export function heuristicPlan(goal: string): OrchestratorPlan {
  const g = coerceText(goal, 200) || "the goal";
  const raw = {
    goal: g,
    objectives: [
      { id: "o1", title: "Define product & brand", description: `Establish the product scope and brand for ${g}.`, department: "Design", dependsOn: [] },
      { id: "o2", title: "Build the product", description: `Ship the first working version toward ${g}.`, department: "Engineering", dependsOn: ["o1"] },
      { id: "o3", title: "Go to market", description: `Launch and drive demand for ${g}.`, department: "Marketing", dependsOn: ["o2"] },
    ],
    tasks: [
      { id: "t1", title: "Brand spec", department: "Design", detail: `Produce the brand spec supporting: ${g}.`, objectiveId: "o1", dependsOn: [] },
      { id: "t2", title: "Landing page", department: "Engineering", detail: `Build the marketing landing page for: ${g}.`, objectiveId: "o2", dependsOn: ["t1"] },
      { id: "t3", title: "Launch announcement", department: "Marketing", detail: `Write the launch announcement for: ${g}.`, objectiveId: "o3", dependsOn: ["t2"] },
      { id: "t4", title: "Outbound email", department: "Sales", detail: `Draft a cold outbound email for: ${g}.`, objectiveId: "o3", dependsOn: ["t2"] },
    ],
  };
  // fallback:true marks this as the generic template (no bespoke model plan), so the
  // UI can tell the founder to refine it. Stamped AFTER sanitizePlan (which builds a
  // clean object and would otherwise drop the flag).
  return { ...sanitizePlan(raw, g), fallback: true };
}

/**
 * Materialize an approved plan into the workspace:
 *   1. Re-sanitize the (untrusted) plan body (caps enforced again server-side).
 *   2. Insert the plan's tasks. Each task is stamped with its objectiveId and the
 *      executor routing hint (Engineering -> claude-code, reserved for Feature 2),
 *      with dependsOn wired to the REAL inserted task ids (plan-local ids are
 *      remapped). deps + objectiveId are persisted via the detail envelope
 *      (no schema migration — see supabase-rest encodeDetail).
 *   3. Push the objectives (with their real taskIds) into meta.objectives via the
 *      read-push-write updateWorkspaceMeta path (so other meta fields are kept).
 *
 * Tasks must be inserted in dependency order so a later task can reference an
 * already-inserted prerequisite's real id. The plan's t-ids are a topological-ish
 * order already (the model is told to define prerequisites first), but we sort
 * defensively by dependency depth to be safe.
 */
export async function materializePlan(
  workspaceId: string,
  rawPlan: unknown,
): Promise<{ objectives: PlanObjective[]; taskCount: number; capped?: boolean }> {
  const plan = sanitizePlan(rawPlan);
  if (plan.objectives.length === 0) return { objectives: [], taskCount: 0 };

  // Serialize per workspace so a double-click / two-tab approve can't clobber
  // objectives or duplicate tasks (updateWorkspaceMeta is a non-atomic RMW).
  return withWorkspaceLock(workspaceId, async () => {
    // Idempotency: if this exact plan (matched by objective titles) is already
    // materialized, return it unchanged rather than inserting a second copy.
    const already = (await getWorkspace(workspaceId)
      .then((w) => (w?.meta?.objectives ?? []) as PlanObjective[])
      .catch(() => [])) as PlanObjective[];
    const alreadyTitles = new Set(already.map((o) => o.title));
    if (plan.objectives.every((o) => alreadyTitles.has(o.title))) {
      return { objectives: already, taskCount: 0 };
    }

  // Order tasks by dependency depth (roots first) so prerequisites are inserted
  // before dependents and we can map plan-local ids -> real DB ids in one pass.
  const byId = new Map(plan.tasks.map((t) => [t.id, t]));
  const depthCache = new Map<string, number>();
  const depthOf = (id: string, seen: Set<string>): number => {
    if (depthCache.has(id)) return depthCache.get(id) as number;
    if (seen.has(id)) return 0; // cycle guard
    const t = byId.get(id);
    if (!t || !t.dependsOn || t.dependsOn.length === 0) {
      depthCache.set(id, 0);
      return 0;
    }
    seen.add(id);
    const d = 1 + Math.max(0, ...t.dependsOn.map((dep) => depthOf(dep, seen)));
    seen.delete(id);
    depthCache.set(id, d);
    return d;
  };
  const ordered = [...plan.tasks].sort((a, b) => depthOf(a.id, new Set()) - depthOf(b.id, new Set()));

  // Insert one task at a time so each gets its real id before dependents are
  // built. (Plans cap at 48 tasks, so this is bounded and infrequent.)
  const realIdByPlanId = new Map<string, string>();
  const realIdByObjective = new Map<string, string[]>();
  for (const t of ordered) {
    const realDeps = (t.dependsOn ?? [])
      .map((d) => realIdByPlanId.get(d))
      .filter((d): d is string => Boolean(d));
    const executor = CLAUDE_CODE_DEPARTMENTS.has(t.department) ? "claude-code" : undefined;
    const inserted = await insertTasks(workspaceId, [
      {
        title: t.title,
        department: t.department,
        status: "todo",
        detail: t.detail,
        dependsOn: realDeps,
        objectiveId: t.objectiveId ?? null,
        executor,
      },
    ]).catch(() => []);
    const real = inserted[0];
    if (!real) continue;
    realIdByPlanId.set(t.id, real.id);
    if (t.objectiveId) {
      const arr = realIdByObjective.get(t.objectiveId) ?? [];
      arr.push(real.id);
      realIdByObjective.set(t.objectiveId, arr);
    }
  }

  // Wire each objective's taskIds to the REAL inserted ids, then read-push-write
  // into meta.objectives (preserving any objectives already present).
  const materializedObjectives: PlanObjective[] = plan.objectives.map((o) => ({
    ...o,
    taskIds: realIdByObjective.get(o.id) ?? [],
  }));

  const existing = (await getWorkspace(workspaceId)
    .then((w) => (w?.meta?.objectives ?? []) as PlanObjective[])
    .catch(() => [])) as PlanObjective[];
  // Concurrency guard: updateWorkspaceMeta is a non-atomic read-modify-write, so
  // two near-simultaneous approvals (double-click / two tabs) could both read the
  // same base and clobber each other — silently evicting one materialization's
  // objectives via the slice() cap while its tasks are already inserted. If the
  // workspace is ALREADY at the objective cap, refuse to merge more here rather
  // than drop someone's objectives; the freshly-inserted tasks still exist and
  // remain visible/runnable (they just aren't grouped under a new objective).
  if (existing.length >= ORCH_MAX_OBJECTIVES) {
    return { objectives: materializedObjectives, taskCount: realIdByPlanId.size, capped: true };
  }
  // Newest objectives last; cap at the objective limit (sanitizer re-caps too).
  const merged = [...existing, ...materializedObjectives].slice(-ORCH_MAX_OBJECTIVES);
  await updateWorkspaceMeta(workspaceId, { objectives: merged }).catch(() => {});

  return { objectives: materializedObjectives, taskCount: realIdByPlanId.size };
  });
}
