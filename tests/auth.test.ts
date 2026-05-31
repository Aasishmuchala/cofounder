import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "node:crypto";

// No SUPABASE_* in the vitest env -> dbConfigured is false, so this exercises
// the HMAC fallback path: APP_SECRET must enforce capability tokens even
// without a database (the regression the external stress run caught).
let auth: typeof import("@/lib/auth");
const SECRET = "unit-test-secret";
const hmac = (ws: string) => createHmac("sha256", SECRET).update(ws).digest("hex");

beforeAll(async () => {
  process.env.APP_SECRET = SECRET;
  auth = await import("@/lib/auth"); // dynamic import AFTER setting APP_SECRET
});

describe("authorizeWrite — no DB + APP_SECRET enforces HMAC tokens", () => {
  it("rejects missing / junk / wrong-workspace tokens", async () => {
    expect(await auth.authorizeWrite("ws1", undefined)).toBe(false);
    expect(await auth.authorizeWrite("ws1", "junk")).toBe(false);
    expect(await auth.authorizeWrite("ws1", hmac("ws-other"))).toBe(false);
  });
  it("accepts the correct token and allows workspace creation", async () => {
    expect(await auth.authorizeWrite("ws1", hmac("ws1"))).toBe(true);
    expect(await auth.authorizeWrite(undefined, undefined)).toBe(true); // creating a workspace
  });
  it("verifyWorkspaceToken is correct", () => {
    expect(auth.verifyWorkspaceToken("ws1", hmac("ws1"))).toBe(true);
    expect(auth.verifyWorkspaceToken("ws1", hmac("ws2"))).toBe(false);
    expect(auth.verifyWorkspaceToken("ws1", undefined)).toBe(false);
  });
});
