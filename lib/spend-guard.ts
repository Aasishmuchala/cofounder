// Server-only: a GLOBAL, fail-closed ceiling on model generations per instance.
//
// The other controls bound spend along different axes: the per-workspace and
// per-IP limiters cap RATE per caller, and the concurrency gate caps SIMULTANEOUS
// calls. None of them bounds the ABSOLUTE total — many distinct callers each
// under their own limit can still sum to a large bill, and a logic bug that loops
// generations server-side isn't caller-keyed at all. This is the backstop: a
// single global sliding-window counter of admitted generations. Past the ceiling,
// EVERY generation is refused (fail closed) until the window drains.
//
// It's the in-app companion to a provider-side spend cap (still recommended as
// the ultimate backstop). Per-instance/in-memory — on a multi-node deploy the
// effective ceiling is ceiling × nodes, which is the safe direction for a cap.
//
// Default: 2000/hour in production (generous for launch, bounds a runaway to a
// knowable cost), UNLIMITED in dev (keyless demo unchanged). Set
// HELM_MAX_GENERATIONS_PER_HOUR to tune; 0 / "off" disables it.

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_PROD_CEILING = 2000;

/** Resolve the ceiling (generations/hour). 0 / negative / "off" => disabled
 *  (returns null). Unset => 2000 in prod, unlimited in dev. Read at call time. */
function ceiling(): number | null {
  const raw = process.env.HELM_MAX_GENERATIONS_PER_HOUR;
  if (raw !== undefined) {
    if (/^(off|none|false)$/i.test(raw.trim())) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null; // explicit disable
    return Math.floor(n);
  }
  const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  return isProd ? DEFAULT_PROD_CEILING : null;
}

// Timestamps (epoch ms) of admitted generations within the trailing window.
let hits: number[] = [];

export interface BudgetCheck {
  allowed: boolean;
  /** ms until the oldest in-window generation ages out (only when blocked). */
  retryAfterMs: number;
}

/**
 * Check the global budget and, when there's room, RECORD this generation against
 * the window. Called once per admitted generation (inside the concurrency gate).
 * `now` is injectable for tests. Returns allowed=false (recording nothing) when
 * the instance is at its hourly ceiling.
 */
export function recordGeneration(now: number = Date.now()): BudgetCheck {
  const cap = ceiling();
  if (cap === null) return { allowed: true, retryAfterMs: 0 };

  const windowStart = now - WINDOW_MS;
  if (hits.length && hits[0] <= windowStart) {
    hits = hits.filter((t) => t > windowStart);
  }
  if (hits.length >= cap) {
    const retryAfterMs = Math.max(1000, hits[0] + WINDOW_MS - now);
    return { allowed: false, retryAfterMs };
  }
  hits.push(now);
  return { allowed: true, retryAfterMs: 0 };
}

/** Test-only: current in-window count. */
export function _spentThisWindow(now: number = Date.now()): number {
  const windowStart = now - WINDOW_MS;
  return hits.filter((t) => t > windowStart).length;
}

/** Test-only: clear the window. */
export function _resetSpendGuard(): void {
  hits = [];
}
