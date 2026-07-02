// Server-only: guards for the UNKEYED, expensive entry points.
//
// The per-workspace limiter (lib/rate-limit-db) only applies once a workspace
// exists — but the paid model routes are reachable BEFORE that: /api/onboarding
// (no workspace at all) and the first turn of /api/agent + /api/plan (no
// workspaceId yet). Those are the cost-DoS surface: a loop of anonymous POSTs
// drives unbounded model spend and unbounded workspace creation.
//
// This module adds two in-app defenses that don't depend on an external WAF:
//   1. clientIp()          — best-effort client IP from the proxy headers.
//   2. enforceAnonRateLimit — a per-IP sliding-window cap (tighter than the
//      per-workspace one) for anonymous model calls, reusing the same limiter
//      infra. Local, in-memory, per-instance — same caveat as rate-limit.ts, and
//      like it, a WAF in front is still recommended for hostile traffic; this is
//      the floor, not the ceiling.
//
// Gated to production (NODE_ENV=production || VERCEL) so the keyless local demo
// is unchanged — matching the existing keyed-limiter pattern.

import { checkRateLimit, type RateLimitResult } from "@/lib/rate-limit";

/** Anonymous per-IP budget/min for the unkeyed model routes. Tighter than the
 *  per-workspace default (an anonymous caller has no legitimate reason to fan
 *  out): override with HELM_ANON_RATELIMIT_PER_MIN. */
function anonLimitPerMin(): number {
  const raw = process.env.HELM_ANON_RATELIMIT_PER_MIN;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
}

/** True on a real deployment (read at call time so it tracks the live env). */
export function isProdRuntime(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

/**
 * Best-effort client IP. Trusts the standard proxy headers (Vercel/most hosts
 * set x-forwarded-for as a comma list, client first). Falls back to a shared
 * sentinel so a header-less request still gets bucketed (conservatively, all
 * such requests share one bucket — the safe direction). NOT spoof-proof on a
 * host that doesn't strip inbound XFF; a real edge/WAF remains the authority.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0].trim();
    if (first) return first.slice(0, 64);
  }
  const real = req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip");
  if (real) return real.trim().slice(0, 64);
  return "noaddr";
}

/**
 * Per-IP rate limit for an UNKEYED, expensive route. `bucket` namespaces the
 * window per route class (so onboarding and planning don't share a budget).
 * Returns null when allowed (or when not on a prod runtime — dev is unthrottled
 * to keep the demo working); returns a 429 Response when the IP is over budget.
 *
 * Call this at the very top of the route, BEFORE parsing the body or calling the
 * model, so a flood is rejected as cheaply as possible.
 */
export function enforceAnonRateLimit(req: Request, bucket: string): Response | null {
  if (!isProdRuntime()) return null;
  const key = `anon:${bucket}:${clientIp(req)}`;
  const rl: RateLimitResult = checkRateLimit(key, { limit: anonLimitPerMin() });
  if (rl.allowed) return null;
  return Response.json(
    { error: "rate limited" },
    { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))) } },
  );
}
