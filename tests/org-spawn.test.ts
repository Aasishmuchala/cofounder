import { describe, it, expect } from "vitest";
import { sanitizePlan } from "@/lib/orchestrator";
import { sanitizeWorkspaceMeta } from "@/lib/agent-types";

// The CEO-first emergent org: the plan names the departments the business needs,
// sanitizePlan derives a tailored subset, and meta.activeDepartments persists it.

describe("spawned org — sanitizePlan.departments", () => {
  it("derives a tailored subset: model pick UNION every working department, invalids dropped", () => {
    const plan = sanitizePlan({
      goal: "x",
      departments: ["Finance", "Security", "Legal", "NotADept"],
      objectives: [
        { id: "o1", title: "a", department: "Finance", dependsOn: [] },
        { id: "o2", title: "b", department: "Engineering", dependsOn: [] },
      ],
      tasks: [{ id: "t1", title: "t", department: "Marketing", objectiveId: "o1", dependsOn: [] }],
    });
    const d = new Set(plan.departments);
    expect(d.has("Finance")).toBe(true);
    expect(d.has("Security")).toBe(true);
    expect(d.has("Legal")).toBe(true);
    expect(d.has("Engineering")).toBe(true); // unioned from objective o2
    expect(d.has("Marketing")).toBe(true); // unioned from task t1
    expect(d.has("NotADept")).toBe(false); // invalid dropped
    expect(plan.departments.length).toBeLessThan(12); // a focused subset, not the whole org
  });

  it("never omits a department that has work (no orphan roles)", () => {
    const plan = sanitizePlan({
      goal: "x",
      departments: ["Marketing"], // model named only Marketing...
      objectives: [{ id: "o1", title: "a", department: "Finance", dependsOn: [] }], // ...but the work is Finance
      tasks: [],
    });
    expect(plan.departments).toContain("Finance");
  });
});

describe("spawned org — meta.activeDepartments persistence", () => {
  it("keeps only valid, de-duped departments", () => {
    const m = sanitizeWorkspaceMeta({
      activeDepartments: ["Engineering", "Engineering", "Bogus", "Finance", 42],
    });
    expect(m.activeDepartments).toEqual(["Engineering", "Finance"]);
  });

  it("drops activeDepartments when none are valid or the field is absent", () => {
    expect(sanitizeWorkspaceMeta({ activeDepartments: ["Bogus"] }).activeDepartments).toBeUndefined();
    expect(sanitizeWorkspaceMeta({}).activeDepartments).toBeUndefined();
  });
});
