import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkRateLimit,
  defaultRateLimitPerMin,
  resetRateLimit,
  _resetAllRateLimits,
} from "@/lib/rate-limit";

// The limiter is per-instance in-memory state shared across the module, so each
// case starts from a clean slate. A controllable clock keeps every assertion
// deterministic — no wall-clock sleeps, no fake-timer plumbing needed.
let clock = 0;
const now = () => clock;

beforeEach(() => {
  clock = 1_000_000; // arbitrary fixed epoch; cases advance it explicitly
  _resetAllRateLimits();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/* ──────────────────────────── sliding window ──────────────────────────── */

describe("checkRateLimit — sliding window per key", () => {
  it("allows up to the limit, then blocks with a positive retryAfterMs", () => {
    const opts = { limit: 3, windowMs: 60_000, now };
    // The first `limit` calls are allowed; remaining counts down to 0.
    expect(checkRateLimit("ws1", opts)).toMatchObject({ allowed: true, remaining: 2, retryAfterMs: 0 });
    expect(checkRateLimit("ws1", opts)).toMatchObject({ allowed: true, remaining: 1, retryAfterMs: 0 });
    expect(checkRateLimit("ws1", opts)).toMatchObject({ allowed: true, remaining: 0, retryAfterMs: 0 });
    // The 4th within the window is blocked.
    const blocked = checkRateLimit("ws1", opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    // retryAfter never exceeds the window length.
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("resets after the window elapses (the oldest hit ages out first)", () => {
    const opts = { limit: 2, windowMs: 60_000, now };
    const t0 = clock;
    expect(checkRateLimit("ws1", opts).allowed).toBe(true); // hit at t0
    clock = t0 + 1_000; // 1s later, so the two hits have distinct timestamps
    expect(checkRateLimit("ws1", opts).allowed).toBe(true); // hit at t0+1s
    expect(checkRateLimit("ws1", opts).allowed).toBe(false); // window full -> blocked

    // Advance just past the window for the FIRST hit only: it ages out, the
    // second (at t0+1s) is still live. One slot reclaimed and used by this call,
    // so the window is full again (remaining 0) but this request was allowed.
    clock = t0 + 60_001;
    const after = checkRateLimit("ws1", opts);
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(0);
  });

  it("decrements retryAfterMs as the window drains while blocked", () => {
    const opts = { limit: 1, windowMs: 10_000, now };
    expect(checkRateLimit("ws1", opts).allowed).toBe(true); // single slot used at t=start
    const first = checkRateLimit("ws1", opts);
    expect(first.allowed).toBe(false);
    expect(first.retryAfterMs).toBe(10_000); // full window remains

    clock += 4_000; // 4s later, still blocked but closer to the slot freeing
    const later = checkRateLimit("ws1", opts);
    expect(later.allowed).toBe(false);
    expect(later.retryAfterMs).toBe(6_000);
  });

  it("isolates keys — one workspace's usage doesn't limit another", () => {
    const opts = { limit: 1, windowMs: 60_000, now };
    expect(checkRateLimit("wsA", opts).allowed).toBe(true);
    expect(checkRateLimit("wsA", opts).allowed).toBe(false); // A is now over
    expect(checkRateLimit("wsB", opts).allowed).toBe(true); // B is untouched
  });

  it("resetRateLimit clears a single key's window", () => {
    const opts = { limit: 1, windowMs: 60_000, now };
    expect(checkRateLimit("ws1", opts).allowed).toBe(true);
    expect(checkRateLimit("ws1", opts).allowed).toBe(false);
    resetRateLimit("ws1");
    expect(checkRateLimit("ws1", opts).allowed).toBe(true); // window wiped
  });
});

/* ──────────────────────────── env-configured default limit ──────────────────────────── */

describe("defaultRateLimitPerMin — HELM_RATELIMIT_PER_MIN parsing", () => {
  it("defaults to 20 when the env var is absent", () => {
    vi.stubEnv("HELM_RATELIMIT_PER_MIN", "");
    expect(defaultRateLimitPerMin()).toBe(20);
  });

  it("honors a valid positive override", () => {
    vi.stubEnv("HELM_RATELIMIT_PER_MIN", "5");
    expect(defaultRateLimitPerMin()).toBe(5);
  });

  it("falls back to the default on junk / zero / negative (a bad value must not disable the limit)", () => {
    vi.stubEnv("HELM_RATELIMIT_PER_MIN", "not-a-number");
    expect(defaultRateLimitPerMin()).toBe(20);
    vi.stubEnv("HELM_RATELIMIT_PER_MIN", "0");
    expect(defaultRateLimitPerMin()).toBe(20);
    vi.stubEnv("HELM_RATELIMIT_PER_MIN", "-3");
    expect(defaultRateLimitPerMin()).toBe(20);
  });

  it("checkRateLimit uses the env default when no explicit limit is given", () => {
    vi.stubEnv("HELM_RATELIMIT_PER_MIN", "2");
    const opts = { windowMs: 60_000, now }; // no `limit` → env default (2)
    expect(checkRateLimit("ws1", opts).allowed).toBe(true);
    expect(checkRateLimit("ws1", opts).allowed).toBe(true);
    expect(checkRateLimit("ws1", opts).allowed).toBe(false); // 3rd over the env limit of 2
  });
});
