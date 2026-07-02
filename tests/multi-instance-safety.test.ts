import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Multi-instance safety (migration 0002): OCC on workspace meta + the
// distributed rate-limit layer. Both are feature-detected against the live
// database, so every test drives the behavior through a mocked global fetch.

const ENV_URL = "https://db.example.supabase.co";

describe("updateWorkspaceMeta — optimistic concurrency", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    process.env.SUPABASE_URL = ENV_URL;
    process.env.SUPABASE_KEY = "service-key";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_KEY;
  });

  function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }

  it("CAS-patches with the version filter and bumps meta_version", async () => {
    const { updateWorkspaceMeta, _resetOccSupport } = await import("@/lib/supabase-rest");
    _resetOccSupport();
    fetchMock
      // versioned read
      .mockResolvedValueOnce(json(200, [{ meta: { vibeId: "calm" }, meta_version: 7 }]))
      // CAS PATCH echoes the updated row
      .mockResolvedValueOnce(json(200, [{ id: "ws1" }]));

    const next = await updateWorkspaceMeta("ws1", { brandReady: true });
    expect(next).toEqual({ vibeId: "calm", brandReady: true });

    const patchCall = fetchMock.mock.calls[1];
    expect(String(patchCall[0])).toContain("meta_version=eq.7");
    const body = JSON.parse((patchCall[1] as RequestInit).body as string);
    expect(body.meta_version).toBe(8);
    expect(body.meta).toEqual({ vibeId: "calm", brandReady: true });
  });

  it("re-reads and retries when a concurrent writer wins the race", async () => {
    const { updateWorkspaceMeta, _resetOccSupport } = await import("@/lib/supabase-rest");
    _resetOccSupport();
    fetchMock
      .mockResolvedValueOnce(json(200, [{ meta: { a: 1 }, meta_version: 1 }]))
      .mockResolvedValueOnce(json(200, [])) // CAS lost: 0 rows matched
      .mockResolvedValueOnce(json(200, [{ meta: { a: 1, other: "x" }, meta_version: 2 }]))
      .mockResolvedValueOnce(json(200, [{ id: "ws1" }])); // retry wins

    const next = await updateWorkspaceMeta("ws1", { brandReady: true });
    // The retry merged onto the CONCURRENT writer's meta — nothing lost.
    expect(next).toMatchObject({ a: 1, other: "x", brandReady: true });
    expect(String(fetchMock.mock.calls[3][0])).toContain("meta_version=eq.2");
  });

  it("falls back to the legacy unversioned PATCH on a pre-migration database", async () => {
    const { updateWorkspaceMeta, _resetOccSupport } = await import("@/lib/supabase-rest");
    _resetOccSupport();
    fetchMock
      // versioned read 400s (unknown column -> migration absent)
      .mockResolvedValueOnce(json(400, { code: "42703" }))
      // legacy read via getWorkspace
      .mockResolvedValueOnce(json(200, [{ id: "ws1", name: "", idea: "", meta: { a: 1 }, edit_key: null }]))
      // legacy PATCH
      .mockResolvedValueOnce(json(200, [{ id: "ws1" }]));

    const next = await updateWorkspaceMeta("ws1", { brandReady: true });
    expect(next).toMatchObject({ a: 1, brandReady: true });
    const patchUrl = String(fetchMock.mock.calls[2][0]);
    expect(patchUrl).not.toContain("meta_version");
    const body = JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string);
    expect(body.meta_version).toBeUndefined();
  });

  it("returns null for a missing workspace (both paths)", async () => {
    const { updateWorkspaceMeta, _resetOccSupport } = await import("@/lib/supabase-rest");
    _resetOccSupport();
    fetchMock.mockResolvedValueOnce(json(200, [])); // versioned read: no row
    expect(await updateWorkspaceMeta("ghost", { brandReady: true })).toBeNull();
  });

  it("throws after exhausting OCC retries under sustained contention", async () => {
    const { updateWorkspaceMeta, _resetOccSupport } = await import("@/lib/supabase-rest");
    _resetOccSupport();
    // Every read sees a fresh version; every CAS loses.
    let v = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET") return json(200, [{ meta: {}, meta_version: ++v }]);
      return json(200, []);
    });
    await expect(updateWorkspaceMeta("ws1", { brandReady: true })).rejects.toThrow(/OCC conflict/);
  });
});

describe("enforceRateLimit — local + shared layers", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    process.env.SUPABASE_URL = ENV_URL;
    process.env.SUPABASE_KEY = "service-key";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_KEY;
  });

  it("blocks when the shared window is exhausted even if the local window allows", async () => {
    const { enforceRateLimit, _resetRateLimitRpc } = await import("@/lib/rate-limit-db");
    const { _resetAllRateLimits } = await import("@/lib/rate-limit");
    _resetRateLimitRpc();
    _resetAllRateLimits();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([{ allowed: false, hits: 99, retry_after_ms: 31000 }]), { status: 200 }),
    );
    const rl = await enforceRateLimit("ws-shared-block");
    expect(rl.allowed).toBe(false);
    expect(rl.retryAfterMs).toBe(31000);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/rest/v1/rpc/cofounder_rate_limit");
  });

  it("fails OPEN when the RPC is absent (404) and stops probing", async () => {
    const { enforceRateLimit, _resetRateLimitRpc } = await import("@/lib/rate-limit-db");
    const { _resetAllRateLimits } = await import("@/lib/rate-limit");
    _resetRateLimitRpc();
    _resetAllRateLimits();
    fetchMock.mockResolvedValue(new Response("not found", { status: 404 }));
    expect((await enforceRateLimit("ws-404")).allowed).toBe(true);
    expect((await enforceRateLimit("ws-404")).allowed).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1); // feature-detected once
  });

  it("fails OPEN on RPC errors — the local limiter still applies", async () => {
    const { enforceRateLimit, _resetRateLimitRpc } = await import("@/lib/rate-limit-db");
    const { _resetAllRateLimits } = await import("@/lib/rate-limit");
    _resetRateLimitRpc();
    _resetAllRateLimits();
    fetchMock.mockRejectedValue(new Error("db down"));
    expect((await enforceRateLimit("ws-err")).allowed).toBe(true);
  });

  it("never calls the RPC once the LOCAL window already blocks", async () => {
    const { enforceRateLimit, _resetRateLimitRpc } = await import("@/lib/rate-limit-db");
    const { _resetAllRateLimits, checkRateLimit } = await import("@/lib/rate-limit");
    _resetRateLimitRpc();
    _resetAllRateLimits();
    fetchMock.mockResolvedValue(new Response(JSON.stringify([{ allowed: true, hits: 1, retry_after_ms: 0 }]), { status: 200 }));
    // Exhaust the local window first.
    for (let i = 0; i < 50; i++) checkRateLimit("ws-local", { limit: 20 });
    const before = fetchMock.mock.calls.length;
    const rl = await enforceRateLimit("ws-local");
    expect(rl.allowed).toBe(false);
    expect(fetchMock.mock.calls.length).toBe(before); // no network hop when locally blocked
  });
});
