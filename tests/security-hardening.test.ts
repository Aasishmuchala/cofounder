import { describe, it, expect, beforeAll, afterEach } from "vitest";

// Security-hardening unit tests. No live DB / network: SUPABASE_* are left UNSET
// so dbConfigured is false and authorizeWrite exercises its in-process fallbacks
// (no DB to read an edit key from). We also leave APP_SECRET UNSET for the auth
// module so the "open writes" fallback path is reachable — the fail-closed gate
// under test is the production check, which is read at CALL time and so is
// controllable per-test via process.env.
//
// IMPORTANT: auth.ts captures APP_SECRET / authEnforced at MODULE LOAD, so we
// scrub APP_SECRET (and SUPABASE_*) BEFORE the dynamic import below. The prod
// knobs (NODE_ENV, VERCEL, HELM_ALLOW_OPEN_WRITES) are read at call time, so each
// test sets and restores them around the call.

let auth: typeof import("@/lib/auth");
let upload: typeof import("@/app/api/upload/route");

beforeAll(async () => {
  // Reach the keyless/no-DB open-write fallback: no Supabase + no APP_SECRET.
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_KEY;
  delete process.env.APP_SECRET;
  auth = await import("@/lib/auth"); // import AFTER scrubbing the load-time env
  upload = await import("@/app/api/upload/route");
});

// Snapshot + restore the call-time prod knobs around each test so cases can't
// leak environment into one another (or into other test files).
const PROD_KEYS = ["NODE_ENV", "VERCEL", "HELM_ALLOW_OPEN_WRITES"] as const;
let saved: Record<string, string | undefined>;

function setEnv(values: Partial<Record<(typeof PROD_KEYS)[number], string | undefined>>): void {
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

afterEach(() => {
  // Restore exactly what each key was before the test (delete if it was unset).
  for (const k of PROD_KEYS) {
    // process.env.NODE_ENV is typed read-only by Next's env augmentation; cast to a
    // writable record so we can restore the snapshot (this is a test-only helper).
    if (saved[k] === undefined) delete process.env[k];
    else (process.env as Record<string, string | undefined>)[k] = saved[k];
  }
});

// Capture the baseline once the module + keys exist (beforeAll already ran).
beforeAll(() => {
  saved = Object.fromEntries(PROD_KEYS.map((k) => [k, process.env[k]])) as Record<string, string | undefined>;
});

describe("authorizeWrite — fail-closed in production (no DB, no APP_SECRET)", () => {
  // A known workspace id with no credential. Without the prod gate this is the
  // legacy "open write" path; the gate must DENY it in production.
  const WS = "ws-known";

  it("DEV (no NODE_ENV=production, no VERCEL): open writes are allowed (demo unchanged)", async () => {
    setEnv({ NODE_ENV: "development", VERCEL: undefined, HELM_ALLOW_OPEN_WRITES: undefined });
    expect(await auth.authorizeWrite(WS, undefined)).toBe(true);
  });

  it("PROD (NODE_ENV=production): an un-authorizable write is DENIED", async () => {
    setEnv({ NODE_ENV: "production", VERCEL: undefined, HELM_ALLOW_OPEN_WRITES: undefined });
    expect(await auth.authorizeWrite(WS, undefined)).toBe(false);
  });

  it("PROD (VERCEL set): an un-authorizable write is DENIED", async () => {
    setEnv({ NODE_ENV: "development", VERCEL: "1", HELM_ALLOW_OPEN_WRITES: undefined });
    expect(await auth.authorizeWrite(WS, undefined)).toBe(false);
  });

  it("PROD + HELM_ALLOW_OPEN_WRITES=1: the escape hatch re-opens writes", async () => {
    setEnv({ NODE_ENV: "production", VERCEL: undefined, HELM_ALLOW_OPEN_WRITES: "1" });
    expect(await auth.authorizeWrite(WS, undefined)).toBe(true);
  });

  it("PROD + HELM_ALLOW_OPEN_WRITES set to something other than '1': still DENIED", async () => {
    setEnv({ NODE_ENV: "production", VERCEL: undefined, HELM_ALLOW_OPEN_WRITES: "true" });
    expect(await auth.authorizeWrite(WS, undefined)).toBe(false);
  });

  it("creating a workspace (no id) is always allowed, even fail-closed in prod", async () => {
    setEnv({ NODE_ENV: "production", VERCEL: undefined, HELM_ALLOW_OPEN_WRITES: undefined });
    expect(await auth.authorizeWrite(undefined, undefined)).toBe(true);
  });
});

describe("upload content-type allowlist (isAllowedContentType)", () => {
  it("accepts each allowlisted type", () => {
    for (const t of [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/json",
    ]) {
      expect(upload.isAllowedContentType(t)).toBe(true);
    }
  });

  it("rejects script-capable types (SVG, HTML) — the XSS/exec risk", () => {
    expect(upload.isAllowedContentType("image/svg+xml")).toBe(false);
    expect(upload.isAllowedContentType("text/html")).toBe(false);
  });

  it("rejects other types and octet-stream", () => {
    expect(upload.isAllowedContentType("application/octet-stream")).toBe(false);
    expect(upload.isAllowedContentType("application/x-msdownload")).toBe(false);
    expect(upload.isAllowedContentType("video/mp4")).toBe(false);
  });

  it("is case-insensitive and tolerates a charset/parameter suffix", () => {
    expect(upload.isAllowedContentType("IMAGE/PNG")).toBe(true);
    expect(upload.isAllowedContentType("text/csv; charset=utf-8")).toBe(true);
    expect(upload.isAllowedContentType("Text/Plain;charset=UTF-8")).toBe(true);
    expect(upload.isAllowedContentType("  application/json  ")).toBe(true);
    // The suffix must not let a disallowed bare type through.
    expect(upload.isAllowedContentType("text/html; charset=utf-8")).toBe(false);
  });

  it("rejects a missing / empty / non-string content-type (no guessing)", () => {
    expect(upload.isAllowedContentType(undefined)).toBe(false);
    expect(upload.isAllowedContentType(null)).toBe(false);
    expect(upload.isAllowedContentType("")).toBe(false);
    // @ts-expect-error — guarding the runtime type check
    expect(upload.isAllowedContentType(123)).toBe(false);
  });
});
