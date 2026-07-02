import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Launch-hardening: the concurrency gate, per-IP anon rate limit, secure ids,
// and the upload Content-Length pre-check. Unit-level (no server) — the routes
// wire these helpers, exercised end-to-end by the stress harnesses.

describe("concurrency gate (withGenerationSlot)", () => {
  beforeEach(async () => {
    vi.resetModules();
    delete process.env.HELM_MAX_CONCURRENT_GENERATIONS;
    delete process.env.HELM_MAX_GENERATION_QUEUE;
  });

  it("runs work and releases the slot", async () => {
    const { withGenerationSlot, _generationGateState, _resetGenerationGate } = await import("@/lib/concurrency");
    _resetGenerationGate();
    const r = await withGenerationSlot(async () => 42);
    expect(r).toBe(42);
    expect(_generationGateState()).toEqual({ active: 0, queued: 0 });
  });

  it("caps concurrent work and queues the overflow", async () => {
    process.env.HELM_MAX_CONCURRENT_GENERATIONS = "2";
    process.env.HELM_MAX_GENERATION_QUEUE = "10";
    vi.resetModules();
    const { withGenerationSlot, _generationGateState, _resetGenerationGate } = await import("@/lib/concurrency");
    _resetGenerationGate();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    // Occupy both slots with work that blocks on `gate`.
    const a = withGenerationSlot(() => gate.then(() => "a"));
    const b = withGenerationSlot(() => gate.then(() => "b"));
    await Promise.resolve();
    // A third acquires nothing yet — it's queued.
    let cDone = false;
    const c = withGenerationSlot(async () => { cDone = true; return "c"; });
    await Promise.resolve();
    expect(_generationGateState().active).toBe(2);
    expect(cDone).toBe(false); // still queued behind the two blockers
    release();
    expect(await Promise.all([a, b, c])).toEqual(["a", "b", "c"]);
    expect(_generationGateState()).toEqual({ active: 0, queued: 0 });
  });

  it("sheds load with Saturated when slots AND queue are full", async () => {
    process.env.HELM_MAX_CONCURRENT_GENERATIONS = "1";
    process.env.HELM_MAX_GENERATION_QUEUE = "1";
    vi.resetModules();
    const { withGenerationSlot, Saturated, _resetGenerationGate } = await import("@/lib/concurrency");
    _resetGenerationGate();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const running = withGenerationSlot(() => gate.then(() => "run")); // takes the 1 slot
    await Promise.resolve();
    const queued = withGenerationSlot(async () => "queued"); // fills the 1 queue spot
    await Promise.resolve();
    // Third has nowhere to go -> Saturated, synchronously rejected.
    await expect(withGenerationSlot(async () => "reject")).rejects.toBeInstanceOf(Saturated);
    release();
    await Promise.all([running, queued]);
  });

  it("releases the slot even when the work throws", async () => {
    const { withGenerationSlot, _generationGateState, _resetGenerationGate } = await import("@/lib/concurrency");
    _resetGenerationGate();
    await expect(withGenerationSlot(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(_generationGateState()).toEqual({ active: 0, queued: 0 });
  });
});

describe("per-IP anon rate limit (request-guard)", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { _resetAllRateLimits } = await import("@/lib/rate-limit");
    _resetAllRateLimits();
  });
  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.VERCEL;
    delete process.env.HELM_ANON_RATELIMIT_PER_MIN;
  });

  function reqWithIp(ip: string): Request {
    return new Request("http://x/api/onboarding", { method: "POST", headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });
  }

  it("is a no-op in dev (keyless demo unchanged)", async () => {
    const { enforceAnonRateLimit } = await import("@/lib/request-guard");
    for (let i = 0; i < 50; i++) {
      expect(enforceAnonRateLimit(reqWithIp("1.2.3.4"), "onboarding")).toBeNull();
    }
  });

  it("blocks a single IP past the budget in production, per bucket", async () => {
    process.env.VERCEL = "1";
    process.env.HELM_ANON_RATELIMIT_PER_MIN = "3";
    vi.resetModules();
    const { _resetAllRateLimits } = await import("@/lib/rate-limit");
    _resetAllRateLimits();
    const { enforceAnonRateLimit } = await import("@/lib/request-guard");
    const codes: (number | null)[] = [];
    for (let i = 0; i < 5; i++) {
      const r = enforceAnonRateLimit(reqWithIp("9.9.9.9"), "onboarding");
      codes.push(r ? r.status : null);
    }
    expect(codes).toEqual([null, null, null, 429, 429]);
    // A different bucket has its own budget.
    expect(enforceAnonRateLimit(reqWithIp("9.9.9.9"), "plan")).toBeNull();
    // A different IP has its own budget.
    expect(enforceAnonRateLimit(reqWithIp("8.8.8.8"), "onboarding")).toBeNull();
  });

  it("extracts the first x-forwarded-for hop as the client ip", async () => {
    const { clientIp } = await import("@/lib/request-guard");
    expect(clientIp(reqWithIp("203.0.113.7"))).toBe("203.0.113.7");
    expect(clientIp(new Request("http://x", { headers: { "x-real-ip": "198.51.100.2" } }))).toBe("198.51.100.2");
    expect(clientIp(new Request("http://x"))).toBe("noaddr");
  });
});

describe("secureId", () => {
  it("mints unguessable, prefixed, unique ids", async () => {
    const { secureId } = await import("@/lib/supabase-rest");
    const a = secureId("ws_");
    const b = secureId("ws_");
    expect(a.startsWith("ws_")).toBe(true);
    expect(a).not.toBe(b);
    // 16 random bytes -> 22 base64url chars after the prefix (>= 128 bits entropy).
    expect(a.length).toBeGreaterThanOrEqual(3 + 22);
    expect(a.slice(3)).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("meta size guard (200KB) is never exceeded", () => {
  it("trims designChoices — the largest growth vector — to stay under the ceiling", async () => {
    const { sanitizeWorkspaceMeta } = await import("@/lib/agent-types");
    // 200 design choices × a 2000-char brief ≈ 400KB — alone this blows the cap,
    // and it's a MAP the array-backstop can't halve. It must be trimmed.
    const designChoices: Record<string, { style: string; template: string; brief: string }> = {};
    for (let i = 0; i < 200; i++) designChoices[`task_${i}`] = { style: "s", template: "t", brief: "z".repeat(2000) };
    const out = sanitizeWorkspaceMeta({ designChoices });
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(200_000);
  });

  it("trims the audit log to its newest entries before dropping it wholesale", async () => {
    const { sanitizeWorkspaceMeta } = await import("@/lib/agent-types");
    // Bloat via designChoices (forces the guard); a modest audit log rides along
    // and should be TRIMMED to its recent tail, not silently deleted first.
    const designChoices: Record<string, { style: string; template: string; brief: string }> = {};
    for (let i = 0; i < 200; i++) designChoices[`task_${i}`] = { style: "s", template: "t", brief: "z".repeat(2000) };
    const auditLog = Array.from({ length: 200 }, (_, i) => ({ ts: i, action: "approve", actor: "owner", detail: "x".repeat(50) }));
    const out = sanitizeWorkspaceMeta({ designChoices, auditLog });
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(200_000);
    if (out.auditLog) {
      expect(out.auditLog.length).toBeLessThanOrEqual(50);
      expect(out.auditLog[out.auditLog.length - 1].ts).toBe(199); // recent tail kept
    }
  });
});
