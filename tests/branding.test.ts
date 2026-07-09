import { describe, it, expect } from "vitest";
import { brandName } from "@/lib/cofounder-data";

describe("brandName", () => {
  it("returns default for null/empty", () => {
    expect(brandName(null)).toBe("Untitled");
    expect(brandName("")).toBe("Untitled");
  });

  it("extracts a meaningful word from the idea text", () => {
    const name = brandName("Build a coffee shop SaaS for indie cafe owners");
    expect(name).toBeTypeOf("string");
    expect(name.length).toBeGreaterThan(0);
    expect(name).not.toBe("Untitled");
    // The name should come FROM the idea text, not a random codename
    expect(name.toLowerCase()).toMatch(/cafe|coffee/);
  });

  it("is deterministic — same input always gives same output", () => {
    const a = brandName("Build a coffee shop SaaS");
    const b = brandName("Build a coffee shop SaaS");
    expect(a).toBe(b);
  });

  it("extracts different names for different idea domains", () => {
    const coffee = brandName("Build a coffee shop management SaaS");
    const dental = brandName("Online booking platform for dentists");
    expect(coffee).not.toBe(dental);
    expect(coffee.toLowerCase()).toMatch(/coffee/);
    expect(dental.toLowerCase()).toMatch(/dentist/);
  });

  it("handles short ideas gracefully", () => {
    expect(brandName("Invoice")).toBe("Invoice");
  });
});
