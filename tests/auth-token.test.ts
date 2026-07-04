import { describe, it, expect, beforeAll } from "vitest";

let auth: typeof import("@/lib/auth");

beforeAll(async () => {
  delete process.env.APP_SECRET;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_KEY;
  auth = await import("@/lib/auth");
});

describe("workspaceToken", () => {
  it("produces deterministic hex string when APP_SECRET is set", () => {
    process.env.APP_SECRET = "test-secret-32-chars-minimum-length!!";
    const a = auth.workspaceToken("ws-1");
    const b = auth.workspaceToken("ws-1");
    const c = auth.workspaceToken("ws-2");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    delete process.env.APP_SECRET;
  });
});

describe("verifyWorkspaceToken (open mode — authEnforced=false)", () => {
  it("returns true for any input in open mode", () => {
    expect(auth.authEnforced).toBe(false);
    expect(auth.verifyWorkspaceToken("ws-1", "anything")).toBe(true);
    expect(auth.verifyWorkspaceToken("ws-1", "")).toBe(true);
    expect(auth.verifyWorkspaceToken(null as unknown as string, undefined as unknown as string)).toBe(true);
  });
});
