import { describe, it, expect, beforeEach, vi } from "vitest";

const insertTasksMock = vi.fn();
const getWorkspaceMock = vi.fn();
const updateWorkspaceMetaMock = vi.fn();
vi.mock("@/lib/supabase-rest", () => ({
  insertTasks: (...a: unknown[]) => insertTasksMock(...a),
  getWorkspace: (...a: unknown[]) => getWorkspaceMock(...a),
  updateWorkspaceMeta: (...a: unknown[]) => updateWorkspaceMetaMock(...a),
  // Transparent passthrough — materializePlan now runs under a per-workspace lock.
  withWorkspaceLock: (_id: string, fn: () => unknown) => fn(),
}));
vi.mock("@/lib/anthropic", () => ({ getAnthropic: () => null, MODEL: "test-model" }));

import { materializePlan } from "@/lib/orchestrator";
import { ORCH_MAX_OBJECTIVES } from "@/lib/agent-types";

let seq = 0;
beforeEach(() => {
  insertTasksMock.mockReset(); getWorkspaceMock.mockReset(); updateWorkspaceMetaMock.mockReset(); seq = 0;
  insertTasksMock.mockImplementation(async (_ws: string, rows: { title: string }[]) => {
    seq += 1; return [{ id: `real-${seq}`, title: rows[0].title }];
  });
  getWorkspaceMock.mockResolvedValue({ meta: { objectives: [] } });
  updateWorkspaceMetaMock.mockResolvedValue({});
});

describe("materializePlan — insert ordering + id remapping", () => {
  it("inserts prerequisites before dependents and remaps deps to real ids", async () => {
    const plan = {
      objectives: [{ id: "o1", title: "Build", description: "", department: "Engineering" }],
      tasks: [
        { id: "t3", title: "C", department: "Engineering", detail: "", objectiveId: "o1", dependsOn: ["t2"] },
        { id: "t2", title: "B", department: "Engineering", detail: "", objectiveId: "o1", dependsOn: ["t1"] },
        { id: "t1", title: "A", department: "Engineering", detail: "", objectiveId: "o1", dependsOn: [] },
      ],
    };
    const res = await materializePlan("ws1", plan);
    const order = insertTasksMock.mock.calls.map((c) => (c[1] as { title: string }[])[0].title);
    expect(order).toEqual(["A", "B", "C"]); // roots first
    expect(insertTasksMock.mock.calls[2][1][0].dependsOn).toEqual(["real-2"]); // C -> real id of B
    expect(insertTasksMock.mock.calls[0][1][0].dependsOn).toEqual([]); // A has none
    expect(res.taskCount).toBe(3);
  });

  it("stamps executor='claude-code' on Engineering tasks ONLY", async () => {
    const plan = {
      objectives: [
        { id: "o1", title: "Build", description: "", department: "Engineering" },
        { id: "o2", title: "Sell", description: "", department: "Sales" },
      ],
      tasks: [
        { id: "t1", title: "Eng", department: "Engineering", detail: "", objectiveId: "o1" },
        { id: "t2", title: "Sales", department: "Sales", detail: "", objectiveId: "o2" },
      ],
    };
    await materializePlan("ws1", plan);
    const rows = insertTasksMock.mock.calls.map((c) => (c[1] as { department: string; executor?: string }[])[0]);
    expect(rows.find((r) => r.department === "Engineering")!.executor).toBe("claude-code");
    expect(rows.find((r) => r.department === "Sales")!.executor).toBeUndefined();
  });

  it("merges new objectives onto existing meta.objectives and caps at ORCH_MAX_OBJECTIVES", async () => {
    // 6 existing + 3 new = 9 -> slice(-8) drops the oldest ("Old 0"). (6 is below
    // the cap so the concurrency guard does NOT fire — the merge proceeds.)
    const existing = Array.from({ length: 6 }, (_, i) => ({
      id: `old${i}`, title: `Old ${i}`, description: "", role: "CTO",
      department: "Engineering", status: "open", taskIds: [], dependsOn: [], ts: 0,
    }));
    getWorkspaceMock.mockResolvedValue({ meta: { objectives: existing } });
    const plan = {
      objectives: [
        { id: "o1", title: "New A", description: "", department: "Engineering" },
        { id: "o2", title: "New B", description: "", department: "Design" },
        { id: "o3", title: "New C", description: "", department: "Sales" },
      ],
      tasks: [],
    };
    await materializePlan("ws1", plan);
    const merged = updateWorkspaceMetaMock.mock.calls[0][1].objectives as { title: string }[];
    expect(merged.length).toBe(ORCH_MAX_OBJECTIVES);
    expect(merged[merged.length - 1].title).toBe("New C"); // newest last
    expect(merged.some((o) => o.title === "Old 0")).toBe(false); // oldest evicted
  });

  it("returns empty + writes NOTHING for a junk/empty plan", async () => {
    const res = await materializePlan("ws1", null);
    expect(res).toEqual({ objectives: [], taskCount: 0 });
    expect(insertTasksMock).not.toHaveBeenCalled();
    expect(updateWorkspaceMetaMock).not.toHaveBeenCalled();
  });

  it("skips a task whose insert fails and does NOT wire it as a dependency", async () => {
    insertTasksMock.mockImplementation(async (_ws: string, rows: { title: string }[]) => {
      if (rows[0].title === "B") return []; // B fails to insert
      seq += 1; return [{ id: `real-${seq}`, title: rows[0].title }];
    });
    const plan = {
      objectives: [{ id: "o1", title: "Build", description: "", department: "Engineering" }],
      tasks: [
        { id: "t1", title: "A", department: "Engineering", detail: "", objectiveId: "o1" },
        { id: "t2", title: "B", department: "Engineering", detail: "", objectiveId: "o1", dependsOn: ["t1"] },
        { id: "t3", title: "C", department: "Engineering", detail: "", objectiveId: "o1", dependsOn: ["t2"] },
      ],
    };
    const res = await materializePlan("ws1", plan);
    expect(res.taskCount).toBe(2); // A + C inserted, B dropped
    const cRow = insertTasksMock.mock.calls.find((c) => (c[1] as { title: string }[])[0].title === "C")![1][0];
    expect(cRow.dependsOn).toEqual([]); // B's real id never existed
  });

  it("cycle guard: a plan-local dependency cycle terminates and still inserts every task", async () => {
    const plan = {
      objectives: [{ id: "o1", title: "O", description: "", department: "Engineering" }],
      tasks: [
        { id: "t1", title: "A", department: "Engineering", detail: "", objectiveId: "o1", dependsOn: ["t2"] },
        { id: "t2", title: "B", department: "Engineering", detail: "", objectiveId: "o1", dependsOn: ["t1"] },
      ],
    };
    const res = await materializePlan("ws1", plan); // must not hang (depthOf `seen` guard)
    expect(res.taskCount).toBe(2);
  });

  it("refuses to merge new objectives when already at the cap (concurrency guard)", async () => {
    // Re-read returns a workspace ALREADY at ORCH_MAX_OBJECTIVES (a concurrent
    // approval committed first). The tasks still insert, but we must NOT clobber
    // the existing objectives via the slice cap — so updateWorkspaceMeta is skipped.
    const full = Array.from({ length: ORCH_MAX_OBJECTIVES }, (_, i) => ({
      id: `full${i}`, title: `Full ${i}`, description: "", role: "CTO",
      department: "Engineering", status: "open", taskIds: [], dependsOn: [], ts: 0,
    }));
    getWorkspaceMock.mockResolvedValue({ meta: { objectives: full } });
    const plan = {
      objectives: [{ id: "o1", title: "Late", description: "", department: "Engineering" }],
      tasks: [{ id: "t1", title: "A", department: "Engineering", detail: "", objectiveId: "o1" }],
    };
    const res = await materializePlan("ws1", plan);
    expect(res.taskCount).toBe(1); // the task DID insert
    expect(res.capped).toBe(true); // signalled
    expect(updateWorkspaceMetaMock).not.toHaveBeenCalled(); // no clobbering write
  });
});
