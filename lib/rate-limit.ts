// Per-workspace rate limiting for the expensive AI generation routes.
//
// /api/execute and /api/run each turn one request into real Opus generations,
// so any holder of a workspace's edit key could loop them and run up unbounded
// model spend. This is a dependency-free, in-memory sliding-window limiter keyed
// by workspaceId: it caps how many such calls a single workspace may make per
// rolling window and tells the caller when to retry.
//
// IMPORTANT — this state is PER-INSTANCE (in-process memory). On a multi-instance
// deploy (e.g. several Vercel lambdas / containers) each instance keeps its own
// window, so the effective limit is multiplied by the instance count. A shared
// store (Redis / Postgres) is required to enforce a single global limit across
// instances; this in-memory limiter is a first line of defense against a single
// client looping generations, not a distributed quota.

/* ──────────────────────────── config (env) ──────────────────────────── */

/** Default per-workspace request budget per window when the env override is
 *  absent or unparseable. 20/min is generous for normal interactive/cron use
 *  while still capping a runaway loop of Opus generations. */
const DEFAULT_LIMIT = 20;
/** Default rolling window length. The budget above applies per this window. */
const DEFAULT_WINDOW_MS = 60_000;

/**
 * Parse a positive-integer env var, falling back to `fallback` on anything
 * missing / non-numeric / non-positive. Mirrors the defensive coercion used
 * elsewhere (e.g. spend/budget clamping) — a bad env value must never disable
 * the limit by yielding 0 or NaN.
 */
function envPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

/** Resolved default limit (requests per minute) — HELM_RATELIMIT_PER_MIN overrides. */
export function defaultRateLimitPerMin(): number {
  return envPositiveInt("HELM_RATELIMIT_PER_MIN", DEFAULT_LIMIT);
}

/* ──────────────────────────── limiter ──────────────────────────── */

export interface RateLimitOptions {
  /** Max allowed requests within the window. Defaults to defaultRateLimitPerMin(). */
  limit?: number;
  /** Rolling window length in ms. Defaults to 60_000 (one minute). */
  windowMs?: number;
  /** Clock source (epoch millis). Injectable for deterministic tests; defaults
   *  to the runtime clock. Production callers omit it. */
  now?: () => number;
}

export interface RateLimitResult {
  /** True when this request is within budget and may proceed. */
  allowed: boolean;
  /** Requests still allowed in the current window AFTER this one (0 when blocked). */
  remaining: number;
  /** ms until at least one slot frees up. 0 when allowed; > 0 when blocked
   *  (suitable for a Retry-After header, rounded up to whole seconds by the caller). */
  retryAfterMs: number;
}

// One ring of recent hit timestamps per key. Entries older than the window are
// pruned in place on access, so a key that goes quiet shrinks to an empty ring —
// keeping the map from growing unboundedly under normal (per-workspace) key churn.
const buckets = new Map<string, number[]>();

/**
 * Record a hit for `key` and report whether it is within the limit.
 *
 * Sliding-window: a request is allowed when fewer than `limit` hits fall inside
 * the trailing `windowMs`. When allowed, the hit's timestamp is recorded (so it
 * counts against subsequent requests); when blocked, nothing is recorded and the
 * caller is told how long until the oldest in-window hit expires.
 *
 * Reads the runtime epoch-millis clock internally (override via opts.now for tests).
 */
export function checkRateLimit(key: string, opts: RateLimitOptions = {}): RateLimitResult {
  const limit = opts.limit ?? defaultRateLimitPerMin();
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const clock = opts.now ?? Date.now;
  const now = clock();
  const windowStart = now - windowMs;

  const hits = buckets.get(key) ?? [];
  // Drop timestamps that have aged out of the trailing window.
  let live = hits;
  if (hits.length && hits[0] <= windowStart) {
    live = hits.filter((ts) => ts > windowStart);
  }

  if (live.length >= limit) {
    // Blocked: the window is full. A slot frees up when the OLDEST in-window hit
    // exits the window — retryAfter is the time until that happens.
    const oldest = live[0];
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    buckets.set(key, live); // persist the pruned ring
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  live.push(now);
  buckets.set(key, live);
  return { allowed: true, remaining: Math.max(0, limit - live.length), retryAfterMs: 0 };
}

/** Drop a key's bucket. Exposed mainly so tests can isolate cases; also lets a
 *  caller reclaim memory for a workspace it knows is finished. No-op if absent. */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Test-only: clear ALL buckets so cases don't leak window state into each other. */
export function _resetAllRateLimits(): void {
  buckets.clear();
}
