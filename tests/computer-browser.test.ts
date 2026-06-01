import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// FIX 2 — cross-tenant browser isolation.
//
// lib/computer.ts shares a SINGLE Chromium process but must give each workspace its
// OWN Playwright BrowserContext (cookie jar / page set), so browse -> screenshot ->
// browser_act share a page WITHIN a workspace but never bleed ACROSS workspaces.
//
// Playwright is loaded LAZILY (await import("playwright")) inside getBrowser, so
// vi.mock intercepts it and NO real browser is launched. The mock counts how many
// contexts/pages were created and records which page each navigation hit, so we can
// assert isolation. This lives in its OWN test file (separate module graph) so the
// module-level browser singleton doesn't collide with tests/computer.test.ts, which
// never exercises the browser path.

let contextCount = 0;
let pageCount = 0;
const closedContexts: number[] = [];
// Records { contextId } for each goto so we can prove same-key shares a context and
// different-keys get different contexts.
const navigations: { contextId: number; url: string }[] = [];

vi.mock("playwright", () => {
  function makePage(contextId: number) {
    return {
      goto: async (url: string) => {
        navigations.push({ contextId, url });
      },
      title: async () => "Example Domain",
      screenshot: async () => Buffer.from("png-bytes"),
      click: async () => {},
      fill: async () => {},
      press: async () => {},
      url: () => "https://example.com/",
    };
  }
  function makeContext() {
    const id = ++contextCount;
    return {
      newPage: async () => {
        pageCount++;
        return makePage(id);
      },
      close: async () => {
        closedContexts.push(id);
      },
    };
  }
  return {
    chromium: {
      launch: async () => ({
        newContext: async () => makeContext(),
        close: async () => {},
      }),
    },
  };
});

import { runComputerTool, __resetBrowserSessionsForTest } from "@/lib/computer";

function activeEnv() {
  vi.stubEnv("COMPUTER_USE", "1");
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("VERCEL", "");
  // Allow private/example endpoints through the SSRF guard for these tests.
  vi.stubEnv("MCP_ALLOW_PRIVATE", "1");
}

beforeEach(() => {
  // Clear live sessions FIRST (module-level Map persists across tests in this file),
  // then zero the counters so each test starts from a clean, known baseline.
  __resetBrowserSessionsForTest();
  contextCount = 0;
  pageCount = 0;
  closedContexts.length = 0;
  navigations.length = 0;
  activeEnv();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("browser sessions — per-workspace context isolation", () => {
  it("reuses ONE context+page across calls WITHIN the same session key", async () => {
    await runComputerTool("browse", { url: "https://example.com" }, "ws-A");
    await runComputerTool("screenshot", {}, "ws-A");
    await runComputerTool("browser_act", { action: "click", selector: "#go" }, "ws-A");

    // A single context and a single page served all three same-workspace calls.
    expect(contextCount).toBe(1);
    expect(pageCount).toBe(1);
    expect(navigations).toHaveLength(1);
    expect(navigations[0].contextId).toBe(1);
  });

  it("creates a SEPARATE context+page for a DIFFERENT session key (no cross-tenant bleed)", async () => {
    await runComputerTool("browse", { url: "https://a.example.com" }, "ws-A");
    await runComputerTool("browse", { url: "https://b.example.com" }, "ws-B");

    // Two workspaces -> two isolated contexts/pages.
    expect(contextCount).toBe(2);
    expect(pageCount).toBe(2);
    // The two navigations landed on DISTINCT contexts.
    expect(navigations).toHaveLength(2);
    expect(navigations[0].contextId).not.toBe(navigations[1].contextId);
  });

  it("falls back to a single shared default context when NO session key is given", async () => {
    await runComputerTool("browse", { url: "https://a.example.com" });
    await runComputerTool("screenshot", {});
    await runComputerTool("browse", { url: "https://b.example.com" });

    // No key -> the shared default context is reused for every keyless call.
    expect(contextCount).toBe(1);
    expect(pageCount).toBe(1);
    expect(navigations.every((n) => n.contextId === 1)).toBe(true);
  });

  it("caps live contexts at 8 and evicts (closes) the OLDEST beyond the cap", async () => {
    // Open 9 distinct workspaces; the 9th must evict the 1st.
    for (let i = 1; i <= 9; i++) {
      await runComputerTool("browse", { url: `https://w${i}.example.com` }, `ws-${i}`);
    }
    // 9 contexts were created in total...
    expect(contextCount).toBe(9);
    // ...but the oldest (context #1, ws-1) was evicted + CLOSED to keep <= 8 live.
    expect(closedContexts).toContain(1);
    expect(closedContexts).toHaveLength(1);

    // Re-browsing ws-1 now spins up a fresh context (its old one was evicted).
    const before = contextCount;
    await runComputerTool("browse", { url: "https://w1-again.example.com" }, "ws-1");
    expect(contextCount).toBe(before + 1);
  });

  it("returns {status:'disabled'} (no browser launch) when COMPUTER_USE is off", async () => {
    vi.stubEnv("COMPUTER_USE", "");
    const out = await runComputerTool("browse", { url: "https://example.com" }, "ws-A");
    expect(out).toContain("disabled");
    // The gate short-circuits BEFORE any context creation.
    expect(contextCount).toBe(0);
  });
});
