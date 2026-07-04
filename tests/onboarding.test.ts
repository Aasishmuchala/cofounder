import { describe, it, expect } from "vitest";
import { mockQuestions, mockPlan, parseQuestions, parsePlan } from "@/lib/onboarding";

describe("mockQuestions", () => {
  it("returns 4-5 onboarding questions", () => {
    const qs = mockQuestions();
    expect(qs.length).toBeGreaterThanOrEqual(4);
    expect(qs.length).toBeLessThanOrEqual(5);
    for (const q of qs) {
      expect(q).toHaveProperty("id");
      expect(q).toHaveProperty("prompt");
      expect(q).toHaveProperty("options");
      expect(q.options.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("mockPlan", () => {
  it("returns a plan with context + values + gtm", () => {
    const plan = mockPlan("AI for coffee shops", []);
    expect(plan.context.product).toBeTypeOf("string");
    expect(plan.context.icp).toBeTypeOf("string");
    expect(plan.context.model).toBeTypeOf("string");
    expect(plan.values.length).toBeGreaterThan(0);
    expect(plan.gtm.length).toBeGreaterThan(0);
    for (const item of plan.gtm) {
      expect(item).toHaveProperty("label");
      expect(item).toHaveProperty("text");
    }
  });
});

describe("parseQuestions", () => {
  it("parses a valid JSON block", () => {
    const input = '```json\n{"questions":[{"id":"q1","prompt":"Test?","options":["A","B","C"]}]}\n```';
    const result = parseQuestions(input);
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe("q1");
  });

  it("returns null for unparseable input", () => {
    expect(parseQuestions("not json")).toBeNull();
    expect(parseQuestions("")).toBeNull();
    expect(parseQuestions("```json\n{}}\n```")).toBeNull();
  });
});

describe("parsePlan", () => {
  it("parses a valid plan block", () => {
    const input = '```json\n{"context":{"product":"Test","icp":"Devs","model":"SaaS"},"values":["Fast"],"gtm":[{"label":"Channel","text":"Online"}]}\n```';
    const result = parsePlan(input);
    expect(result).not.toBeNull();
    expect(result!.context.product).toBe("Test");
    expect(result!.gtm).toHaveLength(1);
  });

  it("returns null for missing required keys", () => {
    const input = '```json\n{"context":{"product":"Test"}}\n```';
    expect(parsePlan(input)).toBeNull();
  });
});
