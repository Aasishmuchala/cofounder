import { describe, it, expect } from "vitest";
import { DEPARTMENTS } from "@/lib/agent-types";
import {
  ORG_ROLES,
  SPECIALISTS,
  getRoleForDepartment,
  specialistsForDepartment,
  allSpecialists,
  specialistById,
  routeTaskToSpecialist,
  type SpecialistAgent,
} from "@/lib/org";

const DEPT_SET = new Set<string>(DEPARTMENTS);

describe("ORG_ROLES — C-suite roster integrity", () => {
  it("CEO owns no department; every other role owns exactly one VALID department", () => {
    const ceo = ORG_ROLES.find((r) => r.id === "CEO");
    expect(ceo).toBeTruthy();
    expect(ceo!.departments).toEqual([]); // top of the org owns nothing
    for (const role of ORG_ROLES) {
      if (role.id === "CEO") continue;
      expect(role.departments).toHaveLength(1); // exactly one
      expect(DEPT_SET.has(role.departments[0])).toBe(true); // a real department
    }
  });

  it("role ids are unique + non-empty", () => {
    const ids = ORG_ROLES.map((r) => r.id);
    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every department is owned by exactly ONE C-suite role (no gaps, no doubles)", () => {
    const owners: Record<string, number> = {};
    for (const role of ORG_ROLES) for (const d of role.departments) owners[d] = (owners[d] ?? 0) + 1;
    for (const d of DEPARTMENTS) expect(owners[d]).toBe(1); // each owned exactly once
  });
});

describe("SPECIALISTS — roster integrity", () => {
  it("every map key is a valid department", () => {
    for (const dept of Object.keys(SPECIALISTS)) expect(DEPT_SET.has(dept)).toBe(true);
  });

  it("every specialist.department equals its map key", () => {
    for (const [dept, list] of Object.entries(SPECIALISTS)) {
      for (const s of list) expect(s.department).toBe(dept);
    }
  });

  it("all specialist ids are unique + non-empty across the whole roster", () => {
    const ids = allSpecialists().map((s) => s.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length); // no collisions across departments
  });

  it("every specialist has a non-empty title + blurb", () => {
    for (const s of allSpecialists()) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.blurb.length).toBeGreaterThan(0);
    }
  });

  it("every department with a C-suite owner has >= 1 specialist", () => {
    // Each of the 12 departments has a dedicated owner (verified above), so each
    // must staff at least one specialist.
    for (const d of DEPARTMENTS) {
      expect(Array.isArray(SPECIALISTS[d])).toBe(true);
      expect(SPECIALISTS[d].length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("getRoleForDepartment — department -> accountable role", () => {
  it("maps each of the 12 departments to a real (non-fallback) owning role", () => {
    for (const d of DEPARTMENTS) {
      const roleId = getRoleForDepartment(d);
      const role = ORG_ROLES.find((r) => r.id === roleId);
      expect(role).toBeTruthy(); // a known role
      expect(role!.departments).toContain(d); // it genuinely owns this department
    }
  });

  it("resolves the canonical owners exactly", () => {
    expect(getRoleForDepartment("Operations")).toBe("COO");
    expect(getRoleForDepartment("Engineering")).toBe("CTO");
    expect(getRoleForDepartment("Product")).toBe("CPO");
    expect(getRoleForDepartment("Design")).toBe("HeadOfDesign");
    expect(getRoleForDepartment("Marketing")).toBe("CMO");
    expect(getRoleForDepartment("Sales")).toBe("CRO");
    expect(getRoleForDepartment("Finance")).toBe("CFO");
    expect(getRoleForDepartment("People")).toBe("CHRO");
    expect(getRoleForDepartment("Support")).toBe("CCO");
    expect(getRoleForDepartment("Data")).toBe("CDO");
    expect(getRoleForDepartment("Legal")).toBe("GC");
    expect(getRoleForDepartment("Security")).toBe("CISO");
  });

  it("falls back to COO for an unknown department", () => {
    expect(getRoleForDepartment("Nonexistent")).toBe("COO");
  });
});

describe("specialistsForDepartment / specialistById / allSpecialists", () => {
  it("returns the right list for a known department", () => {
    const eng = specialistsForDepartment("Engineering");
    expect(eng).toBe(SPECIALISTS.Engineering); // the actual roster list
    expect(eng.map((s) => s.id)).toContain("eng-backend");
  });

  it("returns [] for an unknown department", () => {
    expect(specialistsForDepartment("Nonexistent")).toEqual([]);
  });

  it("specialistById finds a known id and returns null for a missing one", () => {
    const s = specialistById("fin-valuation");
    expect(s).toBeTruthy();
    expect(s!.id).toBe("fin-valuation");
    expect(s!.department).toBe("Finance");
    expect(specialistById("does-not-exist")).toBeNull();
  });

  it("allSpecialists length equals the sum across departments", () => {
    const sum = Object.values(SPECIALISTS).reduce((n, list) => n + list.length, 0);
    expect(allSpecialists()).toHaveLength(sum);
  });

  it("allSpecialists contains exactly the union of every department's roster", () => {
    const flatIds = allSpecialists().map((s) => s.id).sort();
    const unionIds = Object.values(SPECIALISTS).flat().map((s) => s.id).sort();
    expect(flatIds).toEqual(unionIds);
  });
});

describe("routeTaskToSpecialist — assignment resolution", () => {
  it("(1) returns the agentId-matched specialist when task.agentId is a valid id", () => {
    // Even when the agentId belongs to a DIFFERENT department than task.department,
    // an explicit valid assignment wins (it is resolved by id first).
    const res = routeTaskToSpecialist({ department: "Engineering", agentId: "fin-valuation" });
    expect(res).toBeTruthy();
    expect(res!.id).toBe("fin-valuation");
  });

  it("(2) falls back to a department specialist when agentId is absent", () => {
    const res = routeTaskToSpecialist({ department: "Finance", title: "Quarterly budget forecast", detail: "" });
    expect(res).toBeTruthy();
    expect(res!.department).toBe("Finance");
  });

  it("(2) falls back to a department specialist when agentId is invalid", () => {
    // An unknown agentId must not be honored — it routes within the department instead.
    const res = routeTaskToSpecialist({ department: "Finance", agentId: "not-a-real-id", title: "tax filing", detail: "" });
    expect(res).toBeTruthy();
    expect(res!.department).toBe("Finance");
    expect(res!.id).not.toBe("not-a-real-id");
  });

  it("(2) picks the best keyword-overlap specialist within the department", () => {
    // The task strongly overlaps the Fundraising specialist's blurb
    // ("deck, data room, and investor outreach") — it must win over the rest.
    const res = routeTaskToSpecialist({
      department: "Finance",
      title: "Build the fundraising deck and investor data room",
      detail: "",
    });
    expect(res!.id).toBe("fin-fundraising");
  });

  it("(3) falls back to the department's first specialist when there is no keyword signal", () => {
    // Empty title/detail -> no tokens -> deterministic first-specialist fallback.
    const res = routeTaskToSpecialist({ department: "Engineering", title: "", detail: "" });
    expect(res).toBe(SPECIALISTS.Engineering[0]);
  });

  it("(4) returns null for an unknown department", () => {
    expect(routeTaskToSpecialist({ department: "Nonexistent", title: "anything", detail: "x" })).toBeNull();
  });

  it("is deterministic — identical inputs always resolve to the same specialist", () => {
    const task = { department: "Marketing", title: "Grow organic search traffic with technical SEO", detail: "" };
    const a = routeTaskToSpecialist(task);
    const b = routeTaskToSpecialist(task);
    expect(a).toBeTruthy();
    expect(a!.id).toBe(b!.id);
  });

  it("every department resolves to one of its OWN specialists when routed by department alone", () => {
    for (const d of DEPARTMENTS) {
      const res = routeTaskToSpecialist({ department: d, title: "", detail: "" });
      expect(res).toBeTruthy();
      const ownIds = new Set((SPECIALISTS[d] as SpecialistAgent[]).map((s) => s.id));
      expect(ownIds.has(res!.id)).toBe(true);
    }
  });
});
