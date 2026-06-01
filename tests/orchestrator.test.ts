import { describe, it, expect } from "vitest";
import {
  isTaskReady,
  objectiveStatus,
  blockedObjectiveIds,
  sanitizeWorkspaceMeta,
  ORCH_MAX_OBJECTIVES,
  ORCH_MAX_TASKS_PER_OBJECTIVE,
} from "@/lib/agent-types";
import type { Task, PlanObjective } from "@/lib/agent-types";
import { sanitizePlan, heuristicPlan } from "@/lib/orchestrator";
import { getRoleForDepartment, ORG_ROLES } from "@/lib/org";
import { encodeDetail, decodeDetail, stripDetailEnvelope } from "@/lib/supabase-rest";

/* ──────────────────────────── detail envelope (deps shim) ──────────────────────────── */

describe("encodeDetail / decodeDetail — orchestration envelope", () => {
  it("round-trips deps + objectiveId + executor", () => {
    const enc = encodeDetail("Build the landing page", { deps: ["t1", "t2"], objectiveId: "o3", executor: "claude-code" });
    expect(enc.startsWith("cf:")).toBe(true);
    const { meta, detail } = decodeDetail(enc);
    expect(detail).toBe("Build the landing page");
    expect(meta.deps).toEqual(["t1", "t2"]);
    expect(meta.objectiveId).toBe("o3");
    expect(meta.executor).toBe("claude-code");
  });

  it("stores the bare detail when there is nothing to encode (back-compat)", () => {
    expect(encodeDetail("just a normal task", {})).toBe("just a normal task");
    expect(encodeDetail("x", { deps: [] })).toBe("x");
    const { meta, detail } = decodeDetail("just a normal task");
    expect(meta).toEqual({});
    expect(detail).toBe("just a normal task");
  });

  it("does NOT corrupt a user-typed detail that happens to start with 'cf:...|'", () => {
    // Not valid JSON between the prefix and the pipe -> left fully intact.
    const raw = "cf:note about config|the rest of the detail";
    const { meta, detail } = decodeDetail(raw);
    expect(meta).toEqual({});
    expect(detail).toBe(raw);
  });

  it("treats a non-object JSON payload as a non-envelope", () => {
    expect(decodeDetail('cf:"hi"|rest').detail).toBe('cf:"hi"|rest');
    expect(decodeDetail("cf:42|rest").detail).toBe("cf:42|rest");
  });

  it("a detail with the prefix but no pipe is left intact", () => {
    expect(decodeDetail("cf:no pipe here").detail).toBe("cf:no pipe here");
  });

  it("decodes ONLY an allowlisted executor — a forged value is dropped", () => {
    // The legitimate value survives the round-trip…
    expect(decodeDetail('cf:{"executor":"claude-code"}|x').meta.executor).toBe("claude-code");
    // …but any other executor (a privilege-escalation attempt) is stripped.
    expect(decodeDetail('cf:{"executor":"computer-use"}|x').meta.executor).toBeUndefined();
    expect(decodeDetail('cf:{"executor":"rm -rf /"}|x').meta.executor).toBeUndefined();
    // deps/objectiveId in the SAME forged envelope are still parsed (they're not
    // privileged) — only the executor field is allowlisted.
    const m = decodeDetail('cf:{"executor":"evil","deps":["t1"],"objectiveId":"o1"}|x').meta;
    expect(m.executor).toBeUndefined();
    expect(m.deps).toEqual(["t1"]);
    expect(m.objectiveId).toBe("o1");
  });
});

/* ──────────────────────── stripDetailEnvelope (user-input guard) ──────────────────────── */

describe("stripDetailEnvelope — neutralizes a forged orchestration envelope", () => {
  it("strips a real envelope down to the bare human detail", () => {
    // A user POSTing this detail must NOT get executor=claude-code on their task.
    expect(stripDetailEnvelope('cf:{"executor":"claude-code"}|pwn')).toBe("pwn");
    expect(stripDetailEnvelope('cf:{"deps":["t1"],"objectiveId":"o1"}|do thing')).toBe("do thing");
  });
  it("leaves a plain detail (even one merely starting with 'cf:') untouched", () => {
    expect(stripDetailEnvelope("just a normal task")).toBe("just a normal task");
    // Not a real envelope (non-object / no pipe) -> preserved verbatim.
    expect(stripDetailEnvelope("cf: see the config file")).toBe("cf: see the config file");
    expect(stripDetailEnvelope("cf:note about config|the rest")).toBe("cf:note about config|the rest");
  });
  it("a forged envelope carrying ONLY a disallowed executor strips to bare text (executor never honored)", () => {
    // decodeDetail drops the bad executor -> meta is empty -> the original string
    // isn't a *recognized* envelope, so it's returned intact (no privileged field leaks).
    const raw = 'cf:{"executor":"computer-use"}|hello';
    expect(decodeDetail(raw).meta.executor).toBeUndefined();
    expect(stripDetailEnvelope(raw)).toBe(raw);
  });
  it("round-trips: a system-encoded envelope is fully stripped if a user replays it", () => {
    const enc = encodeDetail("real detail", { deps: ["t1"], executor: "claude-code" });
    expect(stripDetailEnvelope(enc)).toBe("real detail");
  });
});

/* ──────── stripDetailEnvelope — NESTED envelope smuggling (regression) ──────── *
 * A single decode pass peels only the OUTERMOST envelope; the bare remainder it
 * returns can itself be a still-live `cf:{...}|` envelope. If the column were
 * stored after one strip, rowToTask -> decodeDetail would later parse the
 * surviving inner envelope and set a PRIVILEGED routing hint the user smuggled
 * in-band: executor (claude-code triple-gate bypass), deps (a bogus id deadlocks
 * the task forever — denial-of-execution), or objectiveId (corrupts objective
 * roll-up / blocked-objective gating). The strip must reach a FIXED POINT so the
 * STORED value is inert. Trust boundary = the stored column, NEVER
 * decodeDetail-on-read. */
describe("stripDetailEnvelope — neutralizes NESTED forged envelopes (fixed point)", () => {
  // The security invariant: whatever we persist must NEVER decode back to a
  // non-empty orchestration envelope, regardless of nesting depth.
  const isInert = (s: string) => Object.keys(decodeDetail(s).meta).length === 0;
  const noHints = (s: string) => {
    const { meta } = decodeDetail(s);
    expect(meta.executor).toBeUndefined();
    expect(meta.deps).toBeUndefined();
    expect(meta.objectiveId).toBeUndefined();
  };

  it("peels a DOUBLE-nested envelope to bare text (the reported exploit)", () => {
    const attack =
      'cf:{"deps":["x"]}|cf:{"executor":"claude-code","deps":["DEADBEEF"],"objectiveId":"o_injected"}|please build';
    const stripped = stripDetailEnvelope(attack);
    expect(stripped).toBe("please build");
    expect(isInert(stripped)).toBe(true);
    noHints(stripped);
  });

  it("peels a TRIPLE-nested envelope to bare text", () => {
    const attack =
      'cf:{"deps":["a"]}|cf:{"objectiveId":"o1"}|cf:{"executor":"claude-code","deps":["DEADBEEF"]}|ship it';
    const stripped = stripDetailEnvelope(attack);
    expect(stripped).toBe("ship it");
    expect(isInert(stripped)).toBe(true);
    noHints(stripped);
  });

  it("stays inert when nesting is deep but still fits the 1000-char detail cap", () => {
    // ~24 benign padding envelopes + 1 malicious inner one (~590 chars total, so
    // a real POST/PATCH body could carry it). A SMALL fixed peel cap would leave a
    // live inner envelope behind; the stored column must still be fully inert.
    const malicious =
      'cf:{"executor":"claude-code","deps":["DEADBEEF"],"objectiveId":"o_injected"}|owned';
    let attack = malicious;
    for (let i = 0; i < 24; i++) attack = `cf:{"deps":["pad${i}"]}|` + attack;
    expect(attack.length).toBeLessThan(1000); // reachable within the route's detail cap
    const stripped = stripDetailEnvelope(attack);
    expect(stripped).toBe("owned");
    expect(isInert(stripped)).toBe(true);
    noHints(stripped);
  });

  it("fails safe on pathologically deep nesting beyond the peel cap", () => {
    // Direct callers aren't bound by the route's 1000-char cap. Even 80 nested
    // layers must not yield a stored value that decodes to a privileged hint.
    const malicious = 'cf:{"executor":"claude-code","deps":["DEADBEEF"]}|owned';
    let attack = malicious;
    for (let i = 0; i < 80; i++) attack = `cf:{"deps":["p${i}"]}|` + attack;
    const stripped = stripDetailEnvelope(attack);
    expect(isInert(stripped)).toBe(true);
    noHints(stripped);
  });

  it("preserves a benign tail that merely LOOKS like an envelope after peeling", () => {
    // Outer is a real envelope; the bare remainder starts with 'cf:' but is NOT a
    // real envelope (no JSON object) -> it must survive verbatim, not be eaten.
    const raw = 'cf:{"deps":["t1"]}|cf: just a note | with a pipe';
    expect(stripDetailEnvelope(raw)).toBe("cf: just a note | with a pipe");
  });

  it("single real envelope and plain text are unchanged (no behavior drift)", () => {
    expect(stripDetailEnvelope('cf:{"executor":"claude-code"}|pwn')).toBe("pwn");
    expect(stripDetailEnvelope("just a normal task")).toBe("just a normal task");
    expect(stripDetailEnvelope("cf: see the config file")).toBe("cf: see the config file");
  });
});

/* ──────────────────────────── plan sanitizer caps ──────────────────────────── */

describe("sanitizePlan — caps + well-formedness", () => {
  it("caps objectives at 8 and tasks at 6 per objective", () => {
    const raw = {
      goal: "x".repeat(5000),
      objectives: Array.from({ length: 20 }, (_, i) => ({
        id: `o${i}`,
        title: `Obj ${i}`,
        description: "d",
        department: "Engineering",
      })),
      // 50 tasks all under the FIRST objective -> must be capped to 6 there.
      tasks: Array.from({ length: 50 }, (_, i) => ({
        id: `t${i}`,
        title: `Task ${i}`,
        department: "Engineering",
        detail: "d",
        objectiveId: "o0",
      })),
    };
    const plan = sanitizePlan(raw);
    expect(plan.objectives).toHaveLength(ORCH_MAX_OBJECTIVES);
    // The goal is capped to 600 chars.
    expect(plan.goal.length).toBeLessThanOrEqual(600);
    // First objective got at most 6 tasks.
    const firstObjId = plan.objectives[0].id;
    const firstTasks = plan.tasks.filter((t) => t.objectiveId === firstObjId);
    expect(firstTasks.length).toBeLessThanOrEqual(ORCH_MAX_TASKS_PER_OBJECTIVE);
    // Total tasks can't exceed objectives * per-objective cap.
    expect(plan.tasks.length).toBeLessThanOrEqual(ORCH_MAX_OBJECTIVES * ORCH_MAX_TASKS_PER_OBJECTIVE);
  });

  it("coerces string field lengths and assigns canonical ids", () => {
    const plan = sanitizePlan({
      objectives: [{ id: "weird-id", title: "T".repeat(500), description: "D".repeat(5000), department: "Marketing" }],
      tasks: [{ id: "wx", title: "TT".repeat(300), department: "Marketing", detail: "DD".repeat(2000), objectiveId: "weird-id" }],
    });
    expect(plan.objectives[0].id).toBe("o1");
    expect(plan.objectives[0].title.length).toBeLessThanOrEqual(200);
    expect(plan.objectives[0].description.length).toBeLessThanOrEqual(1000);
    expect(plan.tasks[0].id).toBe("t1");
    expect(plan.tasks[0].title.length).toBeLessThanOrEqual(200);
    expect(plan.tasks[0].detail.length).toBeLessThanOrEqual(1000);
    // Task is bound to the objective via the alias map (model id -> canonical).
    expect(plan.tasks[0].objectiveId).toBe("o1");
    expect(plan.objectives[0].taskIds).toContain("t1");
  });

  it("assigns a C-suite owner role per objective department", () => {
    const plan = sanitizePlan({
      objectives: [
        { title: "Build", description: "", department: "Engineering" },
        { title: "Sell", description: "", department: "Sales" },
      ],
      tasks: [],
    });
    expect(plan.objectives[0].role).toBe(getRoleForDepartment("Engineering")); // CTO
    expect(plan.objectives[1].role).toBe(getRoleForDepartment("Sales")); // CRO
  });

  it("drops dependsOn ids that don't exist in the plan (and self-deps)", () => {
    const plan = sanitizePlan({
      objectives: [{ id: "A", title: "A", description: "", department: "Engineering" }],
      tasks: [
        { id: "a", title: "a", department: "Engineering", detail: "", objectiveId: "A", dependsOn: ["a", "ghost"] },
        { id: "b", title: "b", department: "Engineering", detail: "", objectiveId: "A", dependsOn: ["a"] },
      ],
    });
    const a = plan.tasks.find((t) => t.title === "a")!;
    const b = plan.tasks.find((t) => t.title === "b")!;
    // a's deps (self + ghost) are dropped entirely.
    expect(a.dependsOn).toEqual([]);
    // b depends on a (remapped to a's canonical id).
    expect(b.dependsOn).toEqual([a.id]);
  });

  it("binds an orphan task (unknown objectiveId) to the first objective", () => {
    const plan = sanitizePlan({
      objectives: [{ id: "real", title: "Real", description: "", department: "Design" }],
      tasks: [{ id: "x", title: "x", department: "Design", detail: "", objectiveId: "does-not-exist" }],
    });
    expect(plan.tasks[0].objectiveId).toBe(plan.objectives[0].id);
    expect(plan.objectives[0].taskIds).toContain(plan.tasks[0].id);
  });

  it("returns an empty plan for junk input (never throws)", () => {
    expect(sanitizePlan(null).objectives).toEqual([]);
    expect(sanitizePlan(42).tasks).toEqual([]);
    expect(sanitizePlan({ objectives: "nope", tasks: 7 }).objectives).toEqual([]);
  });

  it("breaks a 2-objective dependency cycle (o1<->o2) into a DAG", () => {
    const plan = sanitizePlan({
      objectives: [
        { id: "o1", title: "A", description: "", department: "Engineering", dependsOn: ["o2"] },
        { id: "o2", title: "B", description: "", department: "Design", dependsOn: ["o1"] },
      ],
      tasks: [],
    });
    const o1 = plan.objectives.find((o) => o.title === "A")!;
    const o2 = plan.objectives.find((o) => o.title === "B")!;
    // Exactly one direction survives — never both (that would be a cycle).
    const edges = (o1.dependsOn.includes(o2.id) ? 1 : 0) + (o2.dependsOn.includes(o1.id) ? 1 : 0);
    expect(edges).toBeLessThanOrEqual(1);
  });

  it("breaks a 3-objective cycle (o1->o2->o3->o1) while keeping forward edges", () => {
    const plan = sanitizePlan({
      objectives: [
        { id: "o1", title: "A", description: "", department: "Engineering", dependsOn: ["o3"] },
        { id: "o2", title: "B", description: "", department: "Design", dependsOn: ["o1"] },
        { id: "o3", title: "C", description: "", department: "Sales", dependsOn: ["o2"] },
      ],
      tasks: [],
    });
    // No cycle: following dependsOn from any node must terminate. Assert by a
    // full DFS reachability check — no objective can reach itself.
    const byId = new Map(plan.objectives.map((o) => [o.id, o]));
    const reaches = (start: string): Set<string> => {
      const seen = new Set<string>();
      const stack = [...(byId.get(start)?.dependsOn ?? [])];
      while (stack.length) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        stack.push(...(byId.get(id)?.dependsOn ?? []));
      }
      return seen;
    };
    for (const o of plan.objectives) expect(reaches(o.id).has(o.id)).toBe(false);
    // Exactly ONE back-edge is dropped to break the single cycle — the other two
    // edges survive (a 3-cycle has 3 edges; a DAG over 3 nodes in a chain has 2).
    const totalEdges = plan.objectives.reduce((n, o) => n + o.dependsOn.length, 0);
    expect(totalEdges).toBe(2);
  });
});

describe("heuristicPlan — deterministic offline fallback", () => {
  it("produces a valid, capped, dependency-ordered plan", () => {
    const plan = heuristicPlan("Launch a paid beta");
    expect(plan.objectives.length).toBeGreaterThan(0);
    expect(plan.objectives.length).toBeLessThanOrEqual(ORCH_MAX_OBJECTIVES);
    // Every task references a real objective.
    const objIds = new Set(plan.objectives.map((o) => o.id));
    for (const t of plan.tasks) expect(objIds.has(t.objectiveId as string)).toBe(true);
    // Every dep references a real task.
    const taskIds = new Set(plan.tasks.map((t) => t.id));
    for (const t of plan.tasks) for (const d of t.dependsOn ?? []) expect(taskIds.has(d)).toBe(true);
  });
});

/* ──────────────────────────── dependency gating ──────────────────────────── */

describe("isTaskReady — dependency gate (pure)", () => {
  it("a task with no deps is always ready", () => {
    expect(isTaskReady({ dependsOn: [] }, new Set())).toBe(true);
    expect(isTaskReady({}, new Set())).toBe(true);
    expect(isTaskReady({ dependsOn: undefined }, new Set())).toBe(true);
  });
  it("is ready only when ALL deps are done", () => {
    expect(isTaskReady({ dependsOn: ["a", "b"] }, new Set(["a"]))).toBe(false); // partial
    expect(isTaskReady({ dependsOn: ["a", "b"] }, new Set(["a", "b"]))).toBe(true); // all
    expect(isTaskReady({ dependsOn: ["a", "b"] }, new Set(["a", "b", "c"]))).toBe(true); // superset
  });
  it("is not ready when a dep is missing from the done set", () => {
    expect(isTaskReady({ dependsOn: ["ghost"] }, new Set(["a", "b"]))).toBe(false);
  });
  it("is circular-safe: a cycle never becomes ready (no infinite loop)", () => {
    // a depends on b, b depends on a — neither is in the done set, so neither
    // is ready. isTaskReady is a pure predicate, so there's no recursion at all.
    expect(isTaskReady({ dependsOn: ["b"] }, new Set())).toBe(false);
    expect(isTaskReady({ dependsOn: ["a"] }, new Set())).toBe(false);
  });
});

/* ──────────────────────────── objective roll-up ──────────────────────────── */

function task(id: string, status: Task["status"], objectiveId: string): Task {
  return { id, title: id, department: "Engineering", status, detail: "", objectiveId };
}
function objective(id: string, taskIds: string[], status: PlanObjective["status"] = "open"): PlanObjective {
  return { id, title: id, description: "", role: "CTO", department: "Engineering", status, taskIds, dependsOn: [], ts: 0 };
}

describe("objectiveStatus — roll-up (pure)", () => {
  it("is 'achieved' when every task is done", () => {
    const tasks = [task("t1", "done", "o1"), task("t2", "done", "o1")];
    expect(objectiveStatus(objective("o1", ["t1", "t2"]), tasks)).toBe("achieved");
  });
  it("is 'needs_action' when any task needs action (takes precedence)", () => {
    const tasks = [task("t1", "done", "o1"), task("t2", "needs_action", "o1")];
    expect(objectiveStatus(objective("o1", ["t1", "t2"]), tasks)).toBe("needs_action");
  });
  it("is 'open' when any task is still todo/running and none need action", () => {
    expect(objectiveStatus(objective("o1", ["t1", "t2"]), [task("t1", "done", "o1"), task("t2", "todo", "o1")])).toBe("open");
    expect(objectiveStatus(objective("o1", ["t1"]), [task("t1", "running", "o1")])).toBe("open");
  });
  it("is 'open' for an objective with no tasks", () => {
    expect(objectiveStatus(objective("o1", []), [])).toBe("open");
  });
  it("a cancelled objective stays cancelled regardless of tasks", () => {
    const tasks = [task("t1", "done", "o1")];
    expect(objectiveStatus(objective("o1", ["t1"], "cancelled"), tasks)).toBe("cancelled");
  });
  it("matches tasks by objectiveId OR membership in taskIds", () => {
    // task t9 isn't in taskIds but its objectiveId points at o1 -> still counted.
    const tasks = [task("t9", "needs_action", "o1")];
    expect(objectiveStatus(objective("o1", []), tasks)).toBe("needs_action");
  });
});

/* ──────────────────────── objective dependency gate (pure) ──────────────────────── */

function objWithDeps(id: string, taskIds: string[], dependsOn: string[]): PlanObjective {
  return { id, title: id, description: "", role: "CTO", department: "Engineering", status: "open", taskIds, dependsOn, ts: 0 };
}

describe("blockedObjectiveIds — objective-level dependency gate (pure)", () => {
  it("blocks an objective whose prerequisite objective isn't achieved yet", () => {
    // o1 (todo task) -> NOT achieved; o2 depends on o1 -> o2 is blocked.
    const objectives = [objWithDeps("o1", ["t1"], []), objWithDeps("o2", ["t2"], ["o1"])];
    const tasks = [task("t1", "todo", "o1"), task("t2", "todo", "o2")];
    const blocked = blockedObjectiveIds(objectives, tasks);
    expect(blocked.has("o2")).toBe(true);
    expect(blocked.has("o1")).toBe(false); // a root objective is never blocked
  });

  it("unblocks a dependent once ALL its prerequisite objectives are achieved", () => {
    // o1's tasks all done -> achieved; o2 (depends on o1) becomes runnable.
    const objectives = [objWithDeps("o1", ["t1"], []), objWithDeps("o2", ["t2"], ["o1"])];
    const tasks = [task("t1", "done", "o1"), task("t2", "todo", "o2")];
    const blocked = blockedObjectiveIds(objectives, tasks);
    expect(blocked.has("o2")).toBe(false);
  });

  it("keeps a dependent blocked if ANY of several prerequisites is unmet", () => {
    const objectives = [
      objWithDeps("o1", ["t1"], []),
      objWithDeps("o2", ["t2"], []),
      objWithDeps("o3", ["t3"], ["o1", "o2"]),
    ];
    const tasks = [task("t1", "done", "o1"), task("t2", "todo", "o2"), task("t3", "todo", "o3")];
    expect(blockedObjectiveIds(objectives, tasks).has("o3")).toBe(true); // o2 not done
  });

  it("treats a dangling/unknown prerequisite id as unmet (fails closed)", () => {
    const objectives = [objWithDeps("o2", ["t2"], ["ghost"])];
    const tasks = [task("t2", "todo", "o2")];
    expect(blockedObjectiveIds(objectives, tasks).has("o2")).toBe(true);
  });

  it("is cycle-safe: objectives in a dependency cycle stay blocked, never loop", () => {
    // o1<->o2 each depend on the other; neither can be achieved -> both blocked.
    const objectives = [objWithDeps("o1", ["t1"], ["o2"]), objWithDeps("o2", ["t2"], ["o1"])];
    const tasks = [task("t1", "todo", "o1"), task("t2", "todo", "o2")];
    const blocked = blockedObjectiveIds(objectives, tasks);
    expect(blocked.has("o1")).toBe(true);
    expect(blocked.has("o2")).toBe(true);
  });

  it("returns an empty set when no objective has dependencies (back-compat)", () => {
    const objectives = [objWithDeps("o1", ["t1"], []), objWithDeps("o2", ["t2"], [])];
    const tasks = [task("t1", "todo", "o1"), task("t2", "todo", "o2")];
    expect(blockedObjectiveIds(objectives, tasks).size).toBe(0);
  });
});

/* ──────────────────────────── meta sanitizer: objectives ──────────────────────────── */

describe("sanitizeWorkspaceMeta — objectives", () => {
  it("caps objectives at 8 and coerces fields + status", () => {
    const m = sanitizeWorkspaceMeta({
      objectives: Array.from({ length: 30 }, (_, i) => ({
        id: `o${i}`,
        title: "T".repeat(500),
        description: "D".repeat(5000),
        role: "R".repeat(200),
        department: "Engineering",
        status: i === 0 ? "bogus" : "achieved",
        taskIds: ["x", "y"],
        dependsOn: ["o0"],
        ts: 123,
      })),
    });
    expect(m.objectives).toHaveLength(ORCH_MAX_OBJECTIVES);
    expect(m.objectives![0].title.length).toBeLessThanOrEqual(200);
    expect(m.objectives![0].description.length).toBeLessThanOrEqual(1000);
    expect(m.objectives![0].role.length).toBeLessThanOrEqual(60);
    // An unknown status coerces to "open".
    expect(m.objectives![0].status).toBe("open");
    expect(m.objectives![1].status).toBe("achieved");
  });

  it("is idempotent for objectives", () => {
    const input = {
      objectives: [
        { id: "o1", title: "Build", description: "ship", role: "CTO", department: "Engineering", status: "open", taskIds: ["t1"], dependsOn: [], ts: 1 },
      ],
    };
    const once = sanitizeWorkspaceMeta(input);
    const twice = sanitizeWorkspaceMeta(once);
    expect(twice).toEqual(once);
  });

  it("defaults unknown department to Operations and drops empty taskIds", () => {
    const m = sanitizeWorkspaceMeta({
      objectives: [{ id: "o1", title: "x", description: "", role: "", department: "Nonsense", status: "open", taskIds: [""], dependsOn: [""], ts: 1 }],
    });
    expect(m.objectives![0].department).toBe("Operations");
    expect(m.objectives![0].taskIds).toEqual([]);
    expect(m.objectives![0].dependsOn).toEqual([]);
  });
});

/* ──────────────────────────── org model ──────────────────────────── */

describe("org model", () => {
  it("maps every staffed department to a real C-suite role", () => {
    const roleIds = new Set(ORG_ROLES.map((r) => r.id));
    for (const dept of ["Engineering", "Design", "Marketing", "Sales", "Support", "Operations", "Finance", "Legal"]) {
      expect(roleIds.has(getRoleForDepartment(dept))).toBe(true);
    }
  });
  it("falls back to COO for an unknown department", () => {
    expect(getRoleForDepartment("Astrology")).toBe("COO");
  });
});
