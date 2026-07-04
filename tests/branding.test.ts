import { describe, it, expect } from "vitest";
import { brandName } from "@/lib/cofounder-data";

describe("brandName", () => {
  it("returns default for null/empty", () => {
    expect(brandName(null)).toBe("Untitled");
    expect(brandName("")).toBe("Untitled");
  });

  it("returns a deterministic branded codename for any idea", () => {
    const a = brandName("Build a coffee shop app");
    const b = brandName("Build a coffee shop app");
    expect(a).toBe(b); // deterministic
    expect(a).toBeTypeOf("string");
    expect(a.length).toBeGreaterThan(0);
  });

  it("returns a different name for different ideas", () => {
    const a = brandName("Build a coffee shop app");
    const b = brandName("Create a Saas platform for designers");
    expect(a).not.toBe(b);
  });

  it("returns a value from the known pool", () => {
    const names = [
      "STHYRA", "NOVERA", "AURELIO", "VANTA", "LUMEN", "OBLISK",
      "CADENCE", "MERIDIAN", "HALCYON", "AXIOM", "VERANT", "SOLARA",
    ];
    const result = brandName("any idea at all");
    expect(names).toContain(result);
  });
});
