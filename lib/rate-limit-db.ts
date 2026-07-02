// Server-only: DISTRIBUTED rate limiting on top of the in-memory limiter.
//
// lib/rate-limit.ts is per-instance (documented caveat: the effective limit is
// limit × instances, and it resets on deploy). When Supabase is configured AND
// migration 0002 is applied, this module adds a shared, atomic fixed-window
// counter in Postgres (the cofounder_rate_limit RPC) so the cap holds across
// every serverless instance.
//
// Design decisions:
//   - LOCAL FIRST: the in-memory sliding window runs before any network hop —
//     it's free, and it alone stops a single-instance tight loop.
//   - FAIL OPEN on the DB layer: if the RPC is missing (pre-migration), errors,
//     or times out, generation must not go down with it — the local limiter
//     still applies. A 404 from PostgREST (unknown function) disables further
//     attempts for the process lifetime (feature detection, probed once).
//   - Fixed window in the DB (one atomic upsert) vs sliding locally — the local
//     sliding window smooths the fixed window's boundary burst case.

import { checkRateLimit, defaultRateLimitPerMin, type RateLimitResult } from "@/lib/rate-limit";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY;

const WINDOW_MS = 60_000;
/** Keep the shared check snappy — a slow limiter must not tax every generation. */
const RPC_TIMEOUT_MS = 1_500;

/** null = not probed; false once the RPC is known-absent (404). */
let rpcAvailable: boolean | null = null;

/** Test-only: reset the RPC feature-detection state. */
export function _resetRateLimitRpc(): void {
  rpcAvailable = null;
}

interface RpcRow {
  allowed: boolean;
  hits: number;
  retry_after_ms: number;
}

/** One atomic check-and-increment against the shared Postgres window.
 *  Returns null when the shared layer is unavailable (absent/erroring) —
 *  the caller then relies on the local limiter alone (fail open). */
async function checkShared(key: string, limit: number): Promise<RateLimitResult | null> {
  if (!URL || !KEY || rpcAvailable === false) return null;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), RPC_TIMEOUT_MS);
  try {
    const res = await fetch(`${URL}/rest/v1/rpc/cofounder_rate_limit`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_key: key, p_limit: limit, p_window_ms: WINDOW_MS }),
      signal: ac.signal,
    });
    if (res.status === 404) {
      rpcAvailable = false; // migration 0002 not applied — stop probing
      return null;
    }
    if (!res.ok) return null; // transient DB trouble — fail open to the local limiter
    rpcAvailable = true;
    const rows = (await res.json().catch(() => [])) as RpcRow[];
    const r = Array.isArray(rows) ? rows[0] : (rows as unknown as RpcRow);
    if (!r || typeof r.allowed !== "boolean") return null;
    return {
      allowed: r.allowed,
      remaining: Math.max(0, limit - (typeof r.hits === "number" ? r.hits : limit)),
      retryAfterMs: typeof r.retry_after_ms === "number" ? Math.max(0, r.retry_after_ms) : 0,
    };
  } catch {
    return null; // network/timeout — fail open
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The rate-limit gate the generation routes call: local sliding window first
 * (free, always on), then the shared Postgres window when available. Blocked by
 * EITHER layer ⇒ blocked (the stricter answer wins); the shared layer being
 * unreachable never blocks. Same result shape the routes already consume.
 */
export async function enforceRateLimit(key: string): Promise<RateLimitResult> {
  const limit = defaultRateLimitPerMin();
  const local = checkRateLimit(key, { limit });
  if (!local.allowed) return local;
  const shared = await checkShared(key, limit);
  if (shared && !shared.allowed) return shared;
  // Report the tighter remaining of the two layers (informational only).
  return shared
    ? { allowed: true, remaining: Math.min(local.remaining, shared.remaining), retryAfterMs: 0 }
    : local;
}
