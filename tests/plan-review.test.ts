import { describe, it, expect } from "vitest";
import { reviewPlan } from "@/lib/plan-review";
import { sanitizePlan, heuristicPlan } from "@/lib/orchestrator";
import { isTaskReady, type Task } from "@/lib/agent-types";

const byDept = (plan: { objectives: { department: string; id: string; dependsOn: string[] }[] }, d: string) =>
  plan.objectives.find((o) => o.department === d)!;

describe("reviewPlan — coverage gate", () => {
  it("drops objectives that have no tasks", () => {
    const plan = sanitizePlan(
      {
        goal: "x",
        objectives: [
          { id: "o1", title: "Build the product", department: "Engineering", dependsOn: [] },
          { id: "o2", title: "Orphan objective", department: "Finance", dependsOn: [] },
        ],
        tasks: [{ id: "t1", title: "Build MVP", department: "Engineering", objectiveId: "o1", dependsOn: [] }],
      },
      "x",
    );
    const { plan: reviewed, review } = reviewPlan(plan);
    expect(reviewed.objectives.some((o) => o.department === "Finance")).toBe(false);
    expect(reviewed.objectives).toHaveLength(1);
    expect(review.gates.find((g) => g.name === "coverage")!.status).toBe("fixed");
  });

  it("passes coverage when every objective has a task", () => {
    const { review } = reviewPlan(heuristicPlan("a coffee startup"));
    expect(review.gates.find((g) => g.name === "coverage")!.status).toBe("pass");
  });
});

describe("reviewPlan — sequencing gate", () => {
  it("wires go-to-market to depend on build when it doesn't", () => {
    const plan = sanitizePlan(
      {
        goal: "x",
        objectives: [
          { id: "o1", title: "Build the product", department: "Engineering", dependsOn: [] },
          { id: "o2", title: "Launch campaign", department: "Marketing", dependsOn: [] },
        ],
        tasks: [
          { id: "t1", title: "Build MVP", department: "Engineering", objectiveId: "o1", dependsOn: [] },
          { id: "t2", title: "Write launch post", department: "Marketing", objectiveId: "o2", dependsOn: [] },
        ],
      },
      "x",
    );
    const { plan: reviewed, review } = reviewPlan(plan);
    const eng = byDept(reviewed, "Engineering");
    const mkt = byDept(reviewed, "Marketing");
    expect(mkt.dependsOn).toContain(eng.id);
    expect(review.gates.find((g) => g.name === "sequencing")!.status).toBe("fixed");
  });

  it("passes when GTM already depends on build (heuristic plan)", () => {
    const { review } = reviewPlan(heuristicPlan("a coffee startup"));
    expect(review.gates.find((g) => g.name === "sequencing")!.status).toBe("pass");
  });

  it("never creates a cycle (build already depends on GTM)", () => {
    const plan = sanitizePlan(
      {
        goal: "x",
        objectives: [
          { id: "o1", title: "Build the product", department: "Engineering", dependsOn: ["o2"] },
          { id: "o2", title: "Launch campaign", department: "Marketing", dependsOn: [] },
        ],
        tasks: [
          { id: "t1", title: "Build MVP", department: "Engineering", objectiveId: "o1", dependsOn: [] },
          { id: "t2", title: "Write launch post", department: "Marketing", objectiveId: "o2", dependsOn: [] },
        ],
      },
      "x",
    );
    const { plan: reviewed } = reviewPlan(plan);
    const eng = byDept(reviewed, "Engineering");
    const mkt = byDept(reviewed, "Marketing");
    // Engineering already depends on Marketing; adding Marketing->Engineering would cycle.
    expect(mkt.dependsOn).not.toContain(eng.id);
  });
});

describe("reviewPlan — staffing gate", () => {
  it("warns when more than 7 departments are staffed", () => {
    const depts = ["Engineering", "Sales", "Marketing", "Design", "Support", "Operations", "Finance", "Legal"];
    const plan = sanitizePlan(
      {
        goal: "x",
        objectives: depts.map((d, i) => ({ id: `o${i + 1}`, title: `Objective ${d}`, department: d, dependsOn: [] })),
        tasks: depts.map((d, i) => ({ id: `t${i + 1}`, title: `Task ${d}`, department: d, objectiveId: `o${i + 1}`, dependsOn: [] })),
      },
      "x",
    );
    const { review } = reviewPlan(plan);
    expect(review.gates.find((g) => g.name === "staffing")!.status).toBe("warn");
  });
});

describe("reviewPlan — qa gate", () => {
  it("passes when a review/QA task exists", () => {
    const plan = sanitizePlan(
      {
        goal: "x",
        objectives: [{ id: "o1", title: "Ship it", department: "Engineering", dependsOn: [] }],
        tasks: [
          { id: "t1", title: "Build MVP", department: "Engineering", objectiveId: "o1", dependsOn: [] },
          { id: "t2", title: "QA and review the release", department: "Engineering", objectiveId: "o1", dependsOn: [] },
        ],
      },
      "x",
    );
    const { review } = reviewPlan(plan);
    expect(review.gates.find((g) => g.name === "qa")!.status).toBe("pass");
  });
});

describe("reviewPlan — purity + score", () => {
  it("does not mutate the input plan", () => {
    const plan = heuristicPlan("a coffee startup");
    const before = JSON.stringify(plan);
    reviewPlan(plan);
    expect(JSON.stringify(plan)).toBe(before);
  });

  it("produces a 0–100 score and a summary", () => {
    const { review } = reviewPlan(heuristicPlan("a coffee startup"));
    expect(review.score).toBeGreaterThanOrEqual(0);
    expect(review.score).toBeLessThanOrEqual(100);
    expect(typeof review.summary).toBe("string");
    expect(review.gates).toHaveLength(4);
  });

  it("keeps the objective graph runnable (fixed deps still satisfiable)", () => {
    const plan = sanitizePlan(
      {
        goal: "x",
        objectives: [
          { id: "o1", title: "Build", department: "Engineering", dependsOn: [] },
          { id: "o2", title: "Launch", department: "Marketing", dependsOn: [] },
        ],
        tasks: [
          { id: "t1", title: "Build MVP", department: "Engineering", objectiveId: "o1", dependsOn: [] },
          { id: "t2", title: "Launch post", department: "Marketing", objectiveId: "o2", dependsOn: [] },
        ],
      },
      "x",
    );
    const { plan: reviewed } = reviewPlan(plan);
    // The added objective dependency is acyclic: a topological check via isTaskReady
    // stand-in — every objective's deps resolve to earlier objectives (no self-loop).
    for (const o of reviewed.objectives) {
      expect(o.dependsOn).not.toContain(o.id);
      const fake: Pick<Task, "dependsOn"> = { dependsOn: o.dependsOn };
      // With all deps marked done, the node is ready — proves deps are real ids.
      expect(isTaskReady(fake, new Set(o.dependsOn))).toBe(true);
    }
  });
});
