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

import { createHmac, timingSafeEqual } from "node:crypto";
import { dbConfigured, getWorkspaceEditKey } from "@/lib/supabase-rest";

const APP_SECRET = process.env.APP_SECRET || "";

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
 */
export async function authorizeWrite(
  workspaceId: string | undefined,
  providedKey: string | undefined,
): Promise<boolean> {
  // Creating a new workspace (no id yet) is always allowed.
  if (!workspaceId) return true;
  // No DB to hold per-workspace edit keys. If APP_SECRET is configured, fall
  // back to enforcing the stateless HMAC capability token; otherwise (the
  // keyless local/mock mode) writes are open.
  if (!dbConfigured) return authEnforced ? verifyWorkspaceToken(workspaceId, providedKey) : true;
  let stored: string | null;
  try {
    stored = await getWorkspaceEditKey(workspaceId);
  } catch {
    return false;
  }
  if (!stored) return true;
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
