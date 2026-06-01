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

  it("caps live contexts at 8 and evicts (closes) the least-recently-used beyond the cap", async () => {
    // Open 9 distinct workspaces, never reusing any. With no reuse, insertion order
    // IS recency order, so the LRU victim is the oldest-inserted (ws-1 / context #1).
    for (let i = 1; i <= 9; i++) {
      await runComputerTool("browse", { url: `https://w${i}.example.com` }, `ws-${i}`);
    }
    // 9 contexts were created in total...
    expect(contextCount).toBe(9);
    // ...but the LRU (context #1, ws-1) was evicted + CLOSED to keep <= 8 live.
    expect(closedContexts).toContain(1);
    expect(closedContexts).toHaveLength(1);

    // Re-browsing ws-1 now spins up a fresh context (its old one was evicted).
    const before = contextCount;
    await runComputerTool("browse", { url: "https://w1-again.example.com" }, "ws-1");
    expect(contextCount).toBe(before + 1);
  });

  it("treats reuse as recency (LRU): re-using the oldest key protects it from eviction", async () => {
    // Fill the cap exactly: ws-1..ws-8 -> contexts #1..#8 (ids assigned in create order).
    for (let i = 1; i <= 8; i++) {
      await runComputerTool("browse", { url: `https://w${i}.example.com` }, `ws-${i}`);
    }
    expect(contextCount).toBe(8);

    // REUSE ws-1 (a cache hit) — bumps it to most-recently-used. Creates NO new
    // context (proves reuse refreshes recency without re-launching a session).
    await runComputerTool("browse", { url: "https://w1-again.example.com" }, "ws-1");
    expect(contextCount).toBe(8);

    // Now open a 9th workspace. Under naive FIFO this would evict ws-1 (oldest
    // INSERTED); under true LRU it must evict ws-2 (oldest USED), because ws-1 was
    // just refreshed.
    await runComputerTool("browse", { url: "https://w9.example.com" }, "ws-9");
    expect(contextCount).toBe(9);

    // The recently-used key's context (#1) is PROTECTED — not closed; the genuine
    // LRU (ws-2 / context #2) was the eviction victim instead.
    expect(closedContexts).not.toContain(1);
    expect(closedContexts).toContain(2);
    expect(closedContexts).toHaveLength(1);
  });

  it("memoizes the in-flight create: concurrent first-calls for ONE key share ONE context", async () => {
    // Two tools dispatched for the SAME brand-new workspace BEFORE its context exists
    // (e.g. a browse + a browser_act in flight together). Without promise-memoization
    // both calls miss the cache, both create a context, and the 2nd set() orphans the
    // 1st (leaked — never closed, never in the map) while splitting the calls across
    // two different pages — violating "share a page within a workspace".
    await Promise.all([
      runComputerTool("browse", { url: "https://example.com" }, "ws-concurrent"),
      runComputerTool("browser_act", { action: "click", selector: "#go" }, "ws-concurrent"),
    ]);

    // Exactly ONE context + ONE page was created and SHARED; nothing was orphaned,
    // so nothing was closed.
    expect(contextCount).toBe(1);
    expect(pageCount).toBe(1);
    expect(closedContexts).toHaveLength(0);
  });

  it("returns {status:'disabled'} (no browser launch) when COMPUTER_USE is off", async () => {
    vi.stubEnv("COMPUTER_USE", "");
    const out = await runComputerTool("browse", { url: "https://example.com" }, "ws-A");
    expect(out).toContain("disabled");
    // The gate short-circuits BEFORE any context creation.
    expect(contextCount).toBe(0);
  });
});
