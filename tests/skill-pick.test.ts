import { describe, it, expect } from "vitest";
import { compareSkills } from "@/lib/skill-select";
import { loadCatalog } from "@/lib/skill-catalog";

// Curated-local-first: every deliverable should equip a relevant skill from the
// local catalog (>= the runner's equip floor of 12), so no agent falls back to a
// generic house style or a random live-discovery repo.
describe("skill selection — curated local catalog covers every deliverable", () => {
  const cases = [
    { department: "Engineering", kind: "landing_page", title: "Build the marketing website landing page" },
    { department: "Finance", kind: "markdown", title: "Build a DCF valuation model" },
    { department: "Legal", kind: "markdown", title: "Incorporation checklist and contracts" },
    { department: "Marketing", kind: "markdown", title: "Launch announcement blog post" },
    { department: "Sales", kind: "email", title: "Cold outbound email to prospects" },
    { department: "Design", kind: "brand_spec", title: "Brand spec and visual identity" },
  ];

  it("loads a non-empty catalog (vendored skills present)", () => {
    expect(loadCatalog().length).toBeGreaterThan(0);
  });

  for (const c of cases) {
    it(`${c.department}/${c.kind} → equips a curated skill (score >= 12)`, () => {
      const cmp = compareSkills(c);
      expect(cmp.chosen).not.toBeNull();
      expect(cmp.chosen!.score).toBeGreaterThanOrEqual(12);
    });
  }
});
