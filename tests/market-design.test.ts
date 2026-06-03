import { describe, it, expect } from "vitest";
import { MARKET_TEMPLATES, marketTemplatesFor, isMarketTemplate } from "@/lib/design-catalog";
import { fetchMarketDesign } from "@/lib/market-design";

// The top design SKILL.md files in the market, shown as the Design gate's primary
// template choices. "Auto" (null) falls back to open-design.
describe("market design templates", () => {
  it("registry is well-formed: unique ids, real raw URLs consistent with repo, app kinds", () => {
    const KINDS = new Set(["landing_page", "email", "markdown", "brand_spec"]);
    const ids = new Set<string>();
    for (const t of MARKET_TEMPLATES) {
      expect(t.id, "id present").toBeTruthy();
      expect(ids.has(t.id), `duplicate id ${t.id}`).toBe(false);
      ids.add(t.id);
      expect(Boolean(t.label && t.blurb), `${t.id} label+blurb`).toBe(true);
      expect(KINDS.has(t.kind), `${t.id} kind ${t.kind}`).toBe(true);
      expect(t.repo, `${t.id} repo`).toMatch(/^[\w.-]+\/[\w.-]+$/);
      // raw must be a GitHub raw SKILL.md whose path includes its declared repo.
      expect(t.raw, `${t.id} raw`).toMatch(/^https:\/\/raw\.githubusercontent\.com\/.+\/SKILL\.md$/);
      expect(t.raw.includes(`/${t.repo}/`), `${t.id} raw matches repo`).toBe(true);
    }
    expect(MARKET_TEMPLATES.length).toBeGreaterThanOrEqual(10);
  });

  it("landing_page is the richest set and leads with the flagship frontend-design", () => {
    const land = marketTemplatesFor("landing_page");
    expect(land.length).toBeGreaterThanOrEqual(5);
    expect(land[0].id).toBe("frontend-design");
    expect(land.every((t) => t.kind === "landing_page")).toBe(true);
  });

  it("every app kind that gates design has at least one market template", () => {
    for (const kind of ["landing_page", "email", "markdown", "brand_spec"] as const) {
      expect(marketTemplatesFor(kind).length, `${kind} has options`).toBeGreaterThan(0);
    }
  });

  it("isMarketTemplate matches registry ids only (open-design layout ids are NOT market)", () => {
    expect(isMarketTemplate("frontend-design")).toBe(true);
    expect(isMarketTemplate("taste-skill")).toBe(true);
    expect(isMarketTemplate("saas-landing")).toBe(false); // an open-design layout id
    expect(isMarketTemplate("")).toBe(false);
    expect(isMarketTemplate("does-not-exist")).toBe(false);
  });

  it("fetchMarketDesign returns null for empty/unknown ids → caller falls back to open-design", async () => {
    expect(await fetchMarketDesign(null)).toBeNull();
    expect(await fetchMarketDesign(undefined)).toBeNull();
    expect(await fetchMarketDesign("")).toBeNull();
    expect(await fetchMarketDesign("not-a-real-skill")).toBeNull();
  });
});
