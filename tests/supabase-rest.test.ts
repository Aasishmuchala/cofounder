import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";

// FIX 5 — updateWorkspaceMeta must distinguish a real update from a no-op PATCH
// against a non-existent (valid-shaped) workspace id. With PostgREST's
// Prefer:return=representation, a 0-row PATCH returns an EMPTY array; the function
// must return null in that case so callers report persisted:false / 404.
//
// supabase-rest reads SUPABASE_URL/KEY at module load and uses the global fetch, so
// we set the env BEFORE a dynamic import and stub fetch to script the responses.

let db: typeof import("@/lib/supabase-rest");

beforeAll(async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_KEY = "test-key";
  db = await import("@/lib/supabase-rest"); // import AFTER env is set
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Build a fetch stub: the leading GET (getWorkspace) returns `current` meta; the
 *  PATCH returns `patchRows` (the representation array). */
function stubFetch(currentMeta: unknown, patchRows: unknown) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "PATCH") {
      return new Response(JSON.stringify(patchRows), { status: 200, headers: { "content-type": "application/json" } });
    }
    // getWorkspace does a GET returning an array of row(s).
    const rows = currentMeta === undefined ? [] : [{ id: "ws1", idea: "x", meta: currentMeta }];
    return new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } });
  });
}

describe("updateWorkspaceMeta — detects 0-affected-rows", () => {
  it("returns the merged meta when a row matched (representation has one row)", async () => {
    // Pre-existing meta has a connectors array; the patch sets a budget. The shallow
    // merge must KEEP the prior connectors field and ADD the budget.
    const current = { connectors: [{ id: "web-search", enabled: true }] };
    stubFetch(current, [{ id: "ws1", meta: { ...current, budget: { totalUsd: 10, currency: "USD" } } }]);
    const out = await db.updateWorkspaceMeta("ws1", { budget: { totalUsd: 10, currency: "USD" } });
    expect(out).not.toBeNull();
    expect(out!.budget).toEqual({ totalUsd: 10, currency: "USD" });
    // The shallow merge kept the prior field too.
    expect(out!.connectors).toEqual([{ id: "web-search", enabled: true }]);
  });

  it("returns null when NO row matched (empty representation array = non-existent workspace)", async () => {
    // Workspace doesn't exist: getWorkspace returns nothing AND the PATCH affects 0 rows.
    stubFetch(undefined, []);
    const out = await db.updateWorkspaceMeta("00000000-0000-0000-0000-000000000000", { budget: { totalUsd: 5, currency: "USD" } });
    expect(out).toBeNull();
  });

  it("requests return=representation (so 0-row PATCHes are detectable)", async () => {
    const spy = stubFetch({}, [{ id: "ws1", meta: {} }]);
    await db.updateWorkspaceMeta("ws1", { objectives: [] });
    const patchCall = spy.mock.calls.find((c) => (c[1]?.method ?? "").toUpperCase() === "PATCH");
    expect(patchCall).toBeTruthy();
    const headers = patchCall![1]!.headers as Record<string, string>;
    expect(headers.Prefer).toContain("return=representation");
  });

  it("throws on a transport/HTTP error (not a silent null)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "PATCH") return new Response("nope", { status: 500 });
      return new Response(JSON.stringify([{ id: "ws1", meta: {} }]), { status: 200 });
    });
    await expect(db.updateWorkspaceMeta("ws1", { objectives: [] })).rejects.toThrow();
  });
});
