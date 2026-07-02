// Server-only: a bounded in-process concurrency gate for EXPENSIVE generations.
//
// Each model-backed request can spawn one or more Opus calls that run for
// seconds. With no ceiling, a burst of concurrent requests on a single instance
// means (a) N simultaneous paid calls (cost + provider 429s) and (b) enough
// in-flight work to exhaust sockets/event-loop and drop connections — observed
// as ECONNRESET under a 200-way fan-out in stress testing.
//
// This is a counting semaphore with a bounded WAIT QUEUE. A caller acquires a
// slot before doing model work and releases it after. When all slots are busy
// AND the wait queue is full, acquisition fails fast so the route can return 503
// + Retry-After instead of piling on. Per-instance/in-memory by design (same
// posture as the rate limiter) — it protects a single node; a multi-node deploy
// gets the sum, which is the safe direction for a ceiling.

/** Max concurrent generations per instance. Override HELM_MAX_CONCURRENT_GENERATIONS. */
function maxConcurrent(): number {
  const raw = process.env.HELM_MAX_CONCURRENT_GENERATIONS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 6;
}

/** Max requests allowed to WAIT for a slot before we shed load (fail fast). */
function maxQueue(): number {
  const raw = process.env.HELM_MAX_GENERATION_QUEUE;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 12;
}

let active = 0;
const waiters: Array<(ok: boolean) => void> = [];

import { recordGeneration } from "@/lib/spend-guard";

/** Thrown by withGenerationSlot when the instance is saturated OR the global
 *  hourly generation ceiling is hit. Carries the suggested Retry-After (seconds)
 *  so the route can surface it — routes already map this to HTTP 503. */
export class Saturated extends Error {
  readonly retryAfterSec: number;
  constructor(retryAfterSec = 2) {
    super("generation capacity saturated");
    this.name = "Saturated";
    this.retryAfterSec = retryAfterSec;
  }
}

/** Try to take a slot immediately, else join the bounded wait queue. Resolves
 *  true when a slot is held; rejects with Saturated when the queue is full. */
function acquire(): Promise<void> {
  if (active < maxConcurrent()) {
    active++;
    return Promise.resolve();
  }
  if (waiters.length >= maxQueue()) {
    return Promise.reject(new Saturated());
  }
  return new Promise<void>((resolve, reject) => {
    waiters.push((ok) => (ok ? resolve() : reject(new Saturated())));
  });
}

function release(): void {
  const next = waiters.shift();
  if (next) {
    // Hand the slot directly to the next waiter (active stays the same).
    next(true);
  } else if (active > 0) {
    active--;
  }
}

/**
 * Run `fn` while holding a generation slot. Throws `Saturated` (before running
 * `fn`) when the instance is at capacity and the wait queue is full — the route
 * maps that to HTTP 503 + Retry-After. The slot is always released, even if `fn`
 * throws.
 */
export async function withGenerationSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquire(); // concurrency gate first (may throw Saturated when the queue is full)
  try {
    // Global hourly ceiling (fail-closed backstop), counted ONLY for slot-admitted
    // work so queue-rejected attempts don't inflate the budget. EVERY model route
    // inherits it through this single chokepoint.
    const budget = recordGeneration();
    if (!budget.allowed) throw new Saturated(Math.ceil(budget.retryAfterMs / 1000));
    return await fn();
  } finally {
    release();
  }
}

/** Test-only: current gate state. */
export function _generationGateState(): { active: number; queued: number } {
  return { active, queued: waiters.length };
}

/** Test-only: drain the gate between cases. */
export function _resetGenerationGate(): void {
  active = 0;
  waiters.length = 0;
}
