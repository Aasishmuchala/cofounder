import { describe, it, expect, vi, beforeEach } from "vitest";

// FIX 3 — compareSkills must not surface an off-topic CROSS-DEPARTMENT skill on a
// single generic NAME hit. We mock the catalog loader so the test is deterministic
// (independent of whatever skills happen to be installed under ~/.claude/skills).

import type { CatalogSkill } from "@/lib/skill-catalog";

let CATALOG: CatalogSkill[] = [];

vi.mock("@/lib/skill-catalog", () => ({
  loadCatalog: () => CATALOG,
}));

import { compareSkills } from "@/lib/skill-select";

function skill(p: Partial<CatalogSkill> & Pick<CatalogSkill, "name" | "department">): CatalogSkill {
  return { description: "", source: "community", dir: `/skills/${p.name}`, ...p } as CatalogSkill;
}

beforeEach(() => {
  CATALOG = [];
});

describe("compareSkills — cross-department relevance", () => {
  it("does NOT pick an Engineering 'pentest-checklist' as top for a Legal incorporation checklist task", () => {
    // The Engineering skill shares only the generic word "checklist" with the task —
    // a single cross-department name hit. The Legal skill is the right department and
    // is on-topic. The Legal skill must win.
    CATALOG = [
      skill({ name: "pentest-checklist", department: "Engineering", description: "Security penetration testing checklist for web apps." }),
      skill({ name: "legal-incorporation", department: "Legal", description: "Prepare incorporation documents and a company formation checklist." }),
    ];
    const res = compareSkills({
      department: "Legal",
      kind: "markdown",
      title: "Prepare incorporation checklist",
      detail: "",
    });
    expect(res.chosen).toBeTruthy();
    expect(res.chosen!.department).toBe("Legal");
    expect(res.chosen!.name).toBe("legal-incorporation");
    // The off-topic Engineering skill is dropped entirely (didn't clear the bar).
    expect(res.candidates.find((c) => c.name === "pentest-checklist")).toBeUndefined();
  });

  it("drops a cross-department skill that has only a SINGLE generic name hit (no kind match, < 2 keyword hits)", () => {
    // Only a Marketing skill exists, matching the lone generic word "plan". With no
    // same-department or General alternative, it STILL must not be chosen on one hit.
    CATALOG = [
      skill({ name: "campaign-plan", department: "Marketing", description: "Build a marketing campaign plan." }),
    ];
    const res = compareSkills({ department: "Legal", kind: "markdown", title: "Draft a compliance plan", detail: "" });
    expect(res.chosen).toBeNull();
    expect(res.candidates).toHaveLength(0);
  });

  it("ALLOWS a cross-department skill that clears the bar via a kind match", () => {
    // No same-department skill; the Design skill is cross-department but matches the
    // requested KIND ("react"), which clears the relevance bar — so it can be chosen.
    CATALOG = [
      skill({ name: "landing-page", department: "Design", description: "Design a high-converting React landing page." }),
    ];
    const res = compareSkills({ department: "Engineering", kind: "react", title: "Build the landing page", detail: "" });
    expect(res.chosen).toBeTruthy();
    expect(res.chosen!.name).toBe("landing-page");
  });

  it("ALLOWS a cross-department skill that clears the bar via >= 2 keyword hits", () => {
    CATALOG = [
      skill({ name: "cold-email-outreach", department: "Sales", description: "Write a cold outbound email outreach sequence." }),
    ];
    // "cold", "email", "outreach" — multiple keyword hits clear the bar.
    const res = compareSkills({ department: "Marketing", title: "Cold email outreach sequence", detail: "" });
    expect(res.chosen).toBeTruthy();
    expect(res.chosen!.name).toBe("cold-email-outreach");
  });

  it("same-department fit wins a tie against a single cross-department name hit", () => {
    // Both skills hit the task word "report" once. The same-department (Finance) one
    // must win because department fit (+12) outweighs a lone cross-dept name hit.
    CATALOG = [
      skill({ name: "incident-report", department: "Operations", description: "Write an incident report." }),
      skill({ name: "finance-report", department: "Finance", description: "Produce a finance report." }),
    ];
    const res = compareSkills({ department: "Finance", title: "Quarterly report", detail: "" });
    expect(res.chosen!.department).toBe("Finance");
    expect(res.chosen!.name).toBe("finance-report");
  });

  it("still returns a best OVERALL pick across departments when one is clearly more relevant", () => {
    // A strongly-matching cross-department skill (multiple keyword hits) can still be
    // chosen over a weak same-department skill — best-overall behavior is preserved.
    CATALOG = [
      skill({ name: "generic-legal", department: "Legal", description: "General legal helper." }),
      skill({ name: "react-nextjs-landing", department: "Engineering", description: "Build a React Next.js landing page site with animation." }),
    ];
    const res = compareSkills({ department: "Legal", kind: "react", title: "Build a React landing page with animation", detail: "next.js site" });
    expect(res.chosen!.name).toBe("react-nextjs-landing");
  });
});
