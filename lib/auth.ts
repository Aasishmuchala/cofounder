// Server-only capability tokens for anonymous workspaces.
//
// The app has no login: a workspace is owned by whoever holds its id + token.
// Rather than store a per-row secret (which needs a DB migration), the token is
// a stateless HMAC of the workspace id under a server secret:
//
//     token = HMAC-SHA256(APP_SECRET, workspaceId)
//
// The id is public (it's the read/share key); the token is only derivable by the
// server, so only the client that created the workspace ever receives one. Write
// routes verify it in constant time before mutating a workspace's tasks/artifacts.
//
// Enforcement is ACTIVE ONLY when APP_SECRET is set. With no APP_SECRET the app
// behaves exactly as before (open writes) so the keyless local demo still runs —
// production deployments set APP_SECRET to turn authorization on.
//
// FAIL-CLOSED IN PRODUCTION: the open-writes fallbacks below (no APP_SECRET, or a
// workspace whose stored edit_key is null/empty) are a deliberate DEV convenience
// for the keyless demo. They are dangerous in a real deployment, so in production
// (NODE_ENV==='production' || VERCEL) a write that cannot be POSITIVELY authorized
// is DENIED — unless HELM_ALLOW_OPEN_WRITES==='1' explicitly opts back into the old
// permissive behavior. Dev/local (no NODE_ENV=production) is unchanged. The
// prod-gating env vars are read at CALL time (not module load) so the gate reflects
// the live environment and stays test-controllable.

import { createHmac, timingSafeEqual } from "node:crypto";
import { dbConfigured, getWorkspaceEditKey } from "@/lib/supabase-rest";

const APP_SECRET = process.env.APP_SECRET || "";

/**
 * True in a real deployment (Vercel or NODE_ENV=production). When true, writes
 * must fail CLOSED: an open-writes fallback is only permitted with the explicit
 * HELM_ALLOW_OPEN_WRITES escape hatch. Read at call time so it tracks the live env.
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

/** Explicit opt-in (HELM_ALLOW_OPEN_WRITES=1) to keep the permissive open-writes
 *  fallback even in production — the escape hatch for an intentionally-public
 *  deploy. Read at call time alongside isProduction(). */
function openWritesAllowed(): boolean {
  return process.env.HELM_ALLOW_OPEN_WRITES === "1";
}

/**
 * Resolve an "open write" fallback (a path that would otherwise grant the write
 * because nothing positively authorized it). Allowed in dev, or in production
 * only when HELM_ALLOW_OPEN_WRITES=1; otherwise DENIED (fail closed).
 */
function allowOpenWrite(): boolean {
  return !isProduction() || openWritesAllowed();
}

/** Default body cap for JSON/AI routes (256 KB). The objectives/tasks/plan/spend
 *  payloads are tiny; this is generous while still rejecting a multi-MB body that
 *  would buffer in memory and (for AI routes) drive real model cost. */
export const JSON_BODY_LIMIT = 256 * 1024;

/**
 * Cheap pre-parse guard: true when the request's declared Content-Length exceeds
 * `maxBytes`. Call this BEFORE `await req.json()` so an oversized body is rejected
 * (HTTP 413) without buffering it or triggering an AI call.
 *
 * This relies on the Content-Length header (present for normal JSON POSTs). A
 * chunked/streamed body without Content-Length isn't caught here — that's an
 * accepted limitation for a guard whose goal is to stop the common multi-MB JSON
 * body; the route's own field caps (coerceText/sanitizers) still bound what's used.
 */
export function tooLarge(req: Request, maxBytes: number = JSON_BODY_LIMIT): boolean {
  const len = req.headers.get("content-length");
  if (!len) return false;
  const n = Number(len);
  return Number.isFinite(n) && n > maxBytes;
}

/** True when APP_SECRET is configured and write authorization is enforced. */
export const authEnforced = Boolean(APP_SECRET);

/** Deterministic capability token authorizing writes to `workspaceId`. */
export function workspaceToken(workspaceId: string): string {
  return createHmac("sha256", APP_SECRET).update(String(workspaceId)).digest("hex");
}

/**
 * Constant-time check that `token` authorizes writes to `workspaceId`.
 * Returns true when enforcement is off (back-compat). Fails closed on any
 * malformed / missing / wrong-length input when enforcement is on.
 */
export function verifyWorkspaceToken(
  workspaceId: unknown,
  token: unknown,
): boolean {
  if (!authEnforced) return true;
  if (typeof workspaceId !== "string" || typeof token !== "string") return false;
  const expected = workspaceToken(workspaceId);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(token, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}

/**
 * Authorize a WRITE to a workspace using its per-workspace edit key.
 *
 * - Creating a new workspace (no id yet) or running keyless/local (no DB) is
 *   always allowed.
 * - A workspace with no stored edit key is "unprotected" (legacy, created
 *   before this feature) and stays open — so existing workspaces don't break.
 * - A workspace WITH an edit key requires the caller to present the matching
 *   key (constant-time compare). Anyone with only the workspace id (a shared
 *   view link) can read but not write.
 *
 * Fails closed on a transport error for a known workspace (a transient read
 * failure must not silently grant write access).
 *
 * IN PRODUCTION the two open-writes fallbacks (no DB + no APP_SECRET; or a stored
 * edit_key that is null/empty) are DENIED unless HELM_ALLOW_OPEN_WRITES=1, so a
 * real deployment never silently grants world-writable access. Dev is unchanged.
 */
export async function authorizeWrite(
  workspaceId: string | undefined,
  providedKey: string | undefined,
): Promise<boolean> {
  // Creating a new workspace (no id yet) is always allowed.
  if (!workspaceId) return true;
  // No DB to hold per-workspace edit keys. If APP_SECRET is configured, fall
  // back to enforcing the stateless HMAC capability token; otherwise (the
  // keyless local/mock mode) writes are open in dev — but in production this
  // open path is denied unless the explicit escape hatch is set (fail closed).
  if (!dbConfigured) return authEnforced ? verifyWorkspaceToken(workspaceId, providedKey) : allowOpenWrite();
  let stored: string | null;
  try {
    stored = await getWorkspaceEditKey(workspaceId);
  } catch {
    return false;
  }
  // No stored key -> "unprotected" legacy workspace: open in dev, but in
  // production a workspace with no positive credential is denied (fail closed)
  // unless HELM_ALLOW_OPEN_WRITES=1.
  if (!stored) return allowOpenWrite();
  if (typeof providedKey !== "string") return false;
  // Compare BYTE lengths (not string .length) before timingSafeEqual — it throws
  // on unequal-length buffers, and char count != byte count for non-ASCII input.
  const a = Buffer.from(providedKey);
  const b = Buffer.from(stored);
  if (a.byteLength !== b.byteLength) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
