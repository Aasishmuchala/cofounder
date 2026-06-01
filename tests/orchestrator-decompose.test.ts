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

/* ──────────────────────────── FIX 6 — fallback flag + max_tokens ──────────────────────────── */

describe("decomposeGoal — heuristic fallback is FLAGGED, model plan is not", () => {
  it("marks the no-client heuristic plan with fallback:true", async () => {
    getAnthropicMock.mockReturnValue(null);
    const plan = await decomposeGoal("ws1", "Launch a paid beta", null);
    expect(plan.fallback).toBe(true);
  });

  it("marks a thrown / truncated model call's heuristic fallback with fallback:true", async () => {
    getAnthropicMock.mockReturnValue({ messages: { create: vi.fn().mockRejectedValue(new Error("proxy timeout (truncated)")) } });
    const plan = await decomposeGoal(undefined, "Build an app", null);
    expect(plan.fallback).toBe(true);
  });

  it("a real model-derived plan is NOT a fallback (fallback:false)", async () => {
    const good = {
      objectives: [{ id: "o1", title: "Ship MVP", description: "", department: "Engineering" }],
      tasks: [{ id: "t1", title: "Build it", department: "Engineering", detail: "", objectiveId: "o1" }],
    };
    getAnthropicMock.mockReturnValue({
      messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "```json\n" + JSON.stringify(good) + "\n```" }] }) },
    });
    const plan = await decomposeGoal(undefined, "Grow", null);
    expect(plan.fallback).toBe(false);
    expect(plan.objectives[0].title).toBe("Ship MVP");
  });

  it("raises max_tokens to 4500 so a large objectives+tasks JSON isn't truncated", async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "```json\n" + JSON.stringify({ objectives: [{ id: "o1", title: "X", description: "", department: "Engineering" }], tasks: [] }) + "\n```" }],
    });
    getAnthropicMock.mockReturnValue({ messages: { create } });
    await decomposeGoal(undefined, "Grow", null);
    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0] as { max_tokens: number };
    expect(arg.max_tokens).toBe(4500);
  });
});
