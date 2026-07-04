import { describe, it, expect } from "vitest";
import {
  coerceText,
  coerceStatus,
  coerceDepartment,
  sanitizeWorkspaceMeta,
} from "@/lib/agent-types";

describe("coerceText", () => {
  it("returns empty string for null/undefined", () => {
    expect(coerceText(null as unknown as string)).toBe("");
    expect(coerceText(undefined as unknown as string)).toBe("");
  });

  it("returns empty string for objects (non-string)", () => {
    expect(coerceText(42 as unknown as string)).toBe("");
    expect(coerceText(0 as unknown as string)).toBe("");
  });

  it("truncates to maxLength", () => {
    const long = "a".repeat(1000);
    expect(coerceText(long, 10)).toBe("a".repeat(10));
  });

  it("strips whitespace and returns raw for normal strings", () => {
    expect(coerceText("  hello  ")).toBe("hello");
  });
});

describe("coerceStatus", () => {
  it("passes valid statuses through", () => {
    expect(coerceStatus("todo")).toBe("todo");
    expect(coerceStatus("running")).toBe("running");
    expect(coerceStatus("needs_action")).toBe("needs_action");
    expect(coerceStatus("done")).toBe("done");
  });

  it("defaults invalid statuses to todo", () => {
    expect(coerceStatus("invalid")).toBe("todo");
    expect(coerceStatus("")).toBe("todo");
    expect(coerceStatus(undefined as unknown as string)).toBe("todo");
  });

  it("is case-sensitive (lowercase only)", () => {
    expect(coerceStatus("DONE")).toBe("todo");
    expect(coerceStatus("Running")).toBe("todo");
  });
});

describe("coerceDepartment", () => {
  const VALID = [
    "Engineering", "Sales", "Marketing", "Design",
    "Support", "Operations", "Finance", "Legal",
    "Product", "People", "Data", "Security",
  ] as const;

  for (const dept of VALID) {
    it(`passes "${dept}" through`, () => {
      expect(coerceDepartment(dept)).toBe(dept);
    });
  }

  it("collapses unknown departments to Operations", () => {
    expect(coerceDepartment("HR")).toBe("Operations");
    expect(coerceDepartment("")).toBe("Operations");
    expect(coerceDepartment(undefined as unknown as string)).toBe("Operations");
  });
});

describe("sanitizeWorkspaceMeta", () => {
  it("caps objectives to ORCH_MAX_OBJECTIVES (8) and clamps plan keys", () => {
    const meta = {
      plan: { product: "x".repeat(500), icp: "y", model: "z" },
      objectives: [] as unknown[],
      vibeId: "a".repeat(50), // too long
    };
    // Push 12 objectives (max is 8)
    for (let i = 0; i < 12; i++) {
      (meta.objectives as unknown[]).push({
        id: `o${i}`,
        title: "Test objective",
        description: "desc",
        status: "open",
      });
    }
    const s = sanitizeWorkspaceMeta(meta as Parameters<typeof sanitizeWorkspaceMeta>[0]);

    // Objectives capped to 8
    expect(s.objectives).toHaveLength(8);

    // Plan is present (JSON.stringify <= 8000)
    expect(s.plan?.product?.length).toBe(500);

    // vibeId capped to 40 chars
    expect(s.vibeId?.length).toBe(40);
  });

  it("passes through a minimal meta", () => {
    const s = sanitizeWorkspaceMeta({});
    expect(s).toBeTypeOf("object");
  });

  it("strips unknown keys", () => {
    const s = sanitizeWorkspaceMeta({ foo: "bar" as never });
    expect((s as Record<string, unknown>).foo).toBeUndefined();
  });
});
