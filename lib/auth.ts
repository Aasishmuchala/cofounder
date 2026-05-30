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
