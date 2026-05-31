import { describe, it, expect, beforeEach, vi } from "vitest";

const getAnthropicMock = vi.fn();
const getWorkspaceMock = vi.fn();
vi.mock("@/lib/anthropic", () => ({ getAnthropic: () => getAnthropicMock(), MODEL: "test-model" }));
vi.mock("@/lib/supabase-rest", () => ({
  getWorkspace: (...a: unknown[]) => getWorkspaceMock(...a),
  updateWorkspaceMeta: vi.fn(), insertTasks: vi.fn(),
}));

import { decomposeGoal } from "@/lib/orchestrator";
import { ORCH_MAX_OBJECTIVES } from "@/lib/agent-types";

beforeEach(() => {
  getAnthropicMock.mockReset(); getWorkspaceMock.mockReset();
  getWorkspaceMock.mockResolvedValue({ idea: "an uptime monitor" });
});

describe("decomposeGoal — graceful degradation (no live model)", () => {
  it("returns the deterministic heuristic plan when no client is configured (mock mode)", async () => {
    getAnthropicMock.mockReturnValue(null);
    const plan = await decomposeGoal("ws1", "Launch a paid beta", null);
    expect(plan.objectives.length).toBeGreaterThan(0);
    expect(plan.objectives.length).toBeLessThanOrEqual(ORCH_MAX_OBJECTIVES);
    expect(plan.goal).toContain("Launch a paid beta");
    const objIds = new Set(plan.objectives.map((o) => o.id));
    for (const t of plan.tasks) expect(objIds.has(t.objectiveId as string)).toBe(true);
  });

  it("falls back to the heuristic when the model call throws", async () => {
    getAnthropicMock.mockReturnValue({ messages: { create: vi.fn().mockRejectedValue(new Error("rate limited")) } });
    const plan = await decomposeGoal(undefined, "Build an app", null);
    expect(plan.objectives.length).toBeGreaterThan(0);
  });

  it("falls back to the heuristic when the model returns unparseable JSON", async () => {
    getAnthropicMock.mockReturnValue({
      messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "not json at all" }] }) },
    });
    const plan = await decomposeGoal(undefined, "Ship a feature", null);
    expect(plan.objectives.length).toBeGreaterThan(0);
  });

  it("uses + RE-CAPS a well-formed model plan, never trusting its counts", async () => {
    const oversized = {
      objectives: Array.from({ length: 20 }, (_, i) => ({ id: `o${i}`, title: `Obj ${i}`, description: "", department: "Engineering" })),
      tasks: Array.from({ length: 40 }, (_, i) => ({ id: `t${i}`, title: `Task ${i}`, department: "Engineering", detail: "", objectiveId: "o0" })),
    };
    getAnthropicMock.mockReturnValue({
      messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "```json\n" + JSON.stringify(oversized) + "\n```" }] }) },
    });
    const plan = await decomposeGoal(undefined, "Grow", null);
    expect(plan.objectives.length).toBe(ORCH_MAX_OBJECTIVES);
    expect(plan.tasks.length).toBeLessThanOrEqual(ORCH_MAX_OBJECTIVES * 6);
  });
});
