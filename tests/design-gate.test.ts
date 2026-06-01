import { describe, it, expect } from "vitest";
import { selectOpenDesign } from "@/lib/open-design";
import { sanitizeWorkspaceMeta } from "@/lib/agent-types";
import { isValidSystem, isValidTemplate, needsDesignDirection, layoutsFor } from "@/lib/design-catalog";

describe("design direction — founder override", () => {
  const req = { department: "Engineering", kind: "landing_page" as const, title: "Build the website", vibeId: null };

  it("a chosen style + layout overrides the auto-selection", () => {
    const auto = selectOpenDesign(req);
    const picked = selectOpenDesign(req, { system: "glassmorphism", template: "pricing-page" });
    expect(picked.system).toBe("glassmorphism");
    expect(picked.template).toBe("pricing-page");
    expect(picked.system).not.toBe(auto.system); // proves it actually overrode the default
  });

  it("'auto' (or empty) override falls back to the keyword/vibe auto-selection", () => {
    const sel = selectOpenDesign(req, { system: "auto", template: "auto" });
    expect(sel.template).toBe("saas-landing"); // the default landing layout
  });

  it("a partial override only replaces what was chosen", () => {
    const sel = selectOpenDesign(req, { system: "luxury", template: null });
    expect(sel.system).toBe("luxury");
    expect(sel.template).toBe("saas-landing"); // template left to auto
  });
});

describe("design choice persistence (sanitizer allowlist)", () => {
  it("round-trips designChoices + designDefault and caps the brief", () => {
    const m = sanitizeWorkspaceMeta({
      designChoices: {
        t1: { style: "glassmorphism", template: "saas-landing", brief: "x".repeat(5000) },
        bad: 42, // non-object -> dropped
      },
      designDefault: { style: "luxury", template: null, brief: "premium" },
    });
    expect(m.designChoices?.t1).toEqual({ style: "glassmorphism", template: "saas-landing", brief: "x".repeat(2000) });
    expect(m.designChoices?.bad).toBeUndefined();
    expect(m.designDefault).toEqual({ style: "luxury", template: null, brief: "premium" });
  });

  it("accepts designDefault: null (re-enable gating) and survives a missing field", () => {
    expect(sanitizeWorkspaceMeta({ designDefault: null }).designDefault).toBeNull();
    expect(sanitizeWorkspaceMeta({}).designChoices).toBeUndefined();
  });
});

describe("design catalog", () => {
  it("validates style + template ids and scopes the gate", () => {
    expect(isValidSystem("glassmorphism")).toBe(true);
    expect(isValidSystem("nonsense")).toBe(false);
    expect(isValidTemplate("saas-landing")).toBe(true);
    expect(isValidTemplate("nope")).toBe(false);
    // visual deliverables are gated; brand_spec (system-only, no template) is not
    expect(needsDesignDirection("landing_page")).toBe(true);
    expect(needsDesignDirection("email")).toBe(true);
    expect(needsDesignDirection("markdown")).toBe(true);
    expect(needsDesignDirection("brand_spec")).toBe(false);
    expect(layoutsFor("landing_page", "Engineering").map((l) => l.id)).toContain("saas-landing");
    expect(layoutsFor("brand_spec", "Design")).toEqual([]);
  });
});
