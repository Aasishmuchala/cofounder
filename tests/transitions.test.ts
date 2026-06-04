import { describe, it, expect } from "vitest";
import { transitionsBlock } from "@/lib/transitions";

describe("transitions.dev motion grounding", () => {
  it("injects the transitions system for animated HTML deliverables", () => {
    for (const kind of ["landing_page", "pitch_deck"] as const) {
      const b = transitionsBlock(kind);
      expect(b).toContain("transitions.dev");
      expect(b).toContain("prefers-reduced-motion"); // accessibility guard mandated
      expect(b).toContain(":root"); // the shared semantic token block is included
      expect(b).toMatch(/t-\*/); // the t-* namespacing convention
    }
  });

  it("is empty for non-HTML deliverables (markdown / email / brand_spec)", () => {
    for (const kind of ["markdown", "email", "brand_spec"] as const) {
      expect(transitionsBlock(kind)).toBe("");
    }
  });

  it("scopes a pitch deck to CSS-only patterns, landing pages to the full system", () => {
    expect(transitionsBlock("pitch_deck")).toMatch(/PURE-CSS|CSS-ONLY|NO <script>/);
    expect(transitionsBlock("landing_page")).toMatch(/<script>|GSAP/);
  });
});
