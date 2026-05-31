import { describe, it, expect } from "vitest";
import {
  sanitizeWorkspaceMeta,
  totalSpent,
  isOverBudget,
  SPEND_MAX_RECORDS,
  BUDGET_MAX_USD,
} from "@/lib/agent-types";
import type { SpendRecord, BudgetConfig } from "@/lib/agent-types";
import {
  BUILT_IN_CONNECTORS,
  BUILT_IN_IDS,
  getConnectorRegistry,
  classifyTool,
  dispatchConnectorTool,
} from "@/lib/connectors";

// The full registry the policy classifier sees, finance enabled.
const ENABLED = getConnectorRegistry(BUILT_IN_CONNECTORS.map((c) => ({ id: c.id, enabled: true })));

/* ──────────────────────────── spend classification ──────────────────────────── */

describe("propose_spend classification — ALWAYS approval-required", () => {
  it("classifies propose_spend as 'sensitive' (never safe, never prohibited, never null)", () => {
    const tier = classifyTool("propose_spend", ENABLED);
    expect(tier).toBe("sensitive");
    // It must NEVER be auto-executable (safe) and must NEVER be hard-blocked
    // (prohibited) — a human CAN approve a spend proposal.
    expect(tier).not.toBe("safe");
    expect(tier).not.toBe("prohibited");
    expect(tier).not.toBeNull();
  });

  it("the finance connector + propose_spend tool exist with risk:sensitive", () => {
    const finance = BUILT_IN_CONNECTORS.find((c) => c.id === "finance");
    expect(finance).toBeDefined();
    expect(finance!.kind).toBe("finance");
    const tool = finance!.tools.find((t) => t.name === "propose_spend");
    expect(tool).toBeDefined();
    expect(tool!.risk).toBe("sensitive");
    // The required args are amount/currency/vendor/reason.
    expect(tool!.inputSchema.required).toEqual(["amount", "currency", "vendor", "reason"]);
  });

  it("'finance' is a toggleable built-in connector id", () => {
    expect(BUILT_IN_IDS.has("finance")).toBe(true);
  });

  it("the PROHIBITED_NAME guard does NOT match propose_spend (it matches money MOVEMENT)", () => {
    // Money-movement verbs are prohibited; 'propose' is not. This is what lets a
    // human approve a proposal while transfer/wire/pay remain categorically blocked.
    const reg = ENABLED.concat([
      {
        id: "evil",
        label: "Evil",
        kind: "mock" as const,
        enabled: true,
        tools: [
          { name: "transfer_money", description: "x", inputSchema: { type: "object", properties: {} }, risk: "sensitive" as const },
          { name: "send_payment", description: "x", inputSchema: { type: "object", properties: {} }, risk: "sensitive" as const },
        ],
      },
    ]);
    expect(classifyTool("transfer_money", reg)).toBe("prohibited");
    expect(classifyTool("send_payment", reg)).toBe("prohibited");
    expect(classifyTool("propose_spend", reg)).toBe("sensitive");
  });
});

describe("propose_spend executor — RECORDS only, never pays", () => {
  it("returns a payment-free 'recorded' confirmation (the audit outcome)", async () => {
    const out = await dispatchConnectorTool(
      "propose_spend",
      { amount: 500, currency: "USD", vendor: "AWS", reason: "Staging infra" },
      ENABLED,
    );
    expect(out).not.toContain("blocked");
    expect(out).toContain("recorded");
    const parsed = JSON.parse(out) as { status: string; payment: string; amount: number; vendor: string };
    expect(parsed.status).toBe("recorded");
    expect(parsed.payment).toBe("none"); // explicit: no money moves
    expect(parsed.amount).toBe(500);
    expect(parsed.vendor).toBe("AWS");
  });
});

/* ──────────────────────────── budget math (pure) ──────────────────────────── */

function rec(amountUsd: number): Pick<SpendRecord, "amountUsd"> {
  return { amountUsd };
}

describe("totalSpent — pure sum of approved spend", () => {
  it("sums amounts including zero-amount records", () => {
    expect(totalSpent([rec(100), rec(0), rec(250.5)])).toBe(350.5);
  });
  it("is 0 for an empty ledger", () => {
    expect(totalSpent([])).toBe(0);
  });
  it("treats negative / non-finite amounts as 0 (defense-in-depth on raw input)", () => {
    expect(totalSpent([rec(100), rec(-50), rec(Number.NaN), rec(Infinity)])).toBe(100);
  });
});

describe("isOverBudget — over-budget warning (pure, informational)", () => {
  const budget: BudgetConfig = { totalUsd: 1000, currency: "USD" };
  it("is true when sum + proposal exceeds the budget", () => {
    expect(isOverBudget(budget, [rec(900)], 200)).toBe(true); // 1100 > 1000
  });
  it("is false when sum + proposal is within the budget", () => {
    expect(isOverBudget(budget, [rec(900)], 100)).toBe(false); // 1000 == 1000, not over
    expect(isOverBudget(budget, [rec(500)], 100)).toBe(false);
  });
  it("is false when there is no budget (an absent ceiling can't be exceeded)", () => {
    expect(isOverBudget(null, [rec(9_999_999)], 1)).toBe(false);
    expect(isOverBudget(undefined, [rec(9_999_999)], 1)).toBe(false);
  });
  it("ignores a negative proposed amount (treated as 0)", () => {
    expect(isOverBudget(budget, [rec(1000)], -500)).toBe(false); // 1000 not > 1000
  });
});

/* ──────────────────────────── meta sanitizer: spend + budget ──────────────────────────── */

describe("sanitizeWorkspaceMeta — spendRecords ring buffer + coercion", () => {
  it("caps spendRecords at 500 (keeps the NEWEST)", () => {
    const m = sanitizeWorkspaceMeta({
      spendRecords: Array.from({ length: 600 }, (_, i) => ({
        id: `sp${i}`,
        department: "Finance",
        amountUsd: i,
        label: `spend ${i}`,
        ts: i,
      })),
    });
    expect(m.spendRecords!.length).toBe(SPEND_MAX_RECORDS);
    // slice(-500) keeps the newest 500 — i.e. ids sp100..sp599.
    expect(m.spendRecords![0].id).toBe("sp100");
    expect(m.spendRecords![m.spendRecords!.length - 1].id).toBe("sp599");
  });

  it("coerces amountUsd to a non-negative, finite number and clamps the ceiling", () => {
    const m = sanitizeWorkspaceMeta({
      spendRecords: [
        { id: "a", department: "Finance", amountUsd: -100, label: "neg", ts: 1 },
        { id: "b", department: "Finance", amountUsd: Number.NaN, label: "nan", ts: 2 },
        { id: "c", department: "Finance", amountUsd: BUDGET_MAX_USD * 2, label: "huge", ts: 3 },
        { id: "d", department: "Finance", amountUsd: 42.5, label: "ok", ts: 4 },
      ],
    });
    expect(m.spendRecords![0].amountUsd).toBe(0); // negative -> 0
    expect(m.spendRecords![1].amountUsd).toBe(0); // NaN -> 0
    expect(m.spendRecords![2].amountUsd).toBe(BUDGET_MAX_USD); // clamped
    expect(m.spendRecords![3].amountUsd).toBe(42.5); // valid kept
  });

  it("coerces department to a canonical value and caps the label", () => {
    const m = sanitizeWorkspaceMeta({
      spendRecords: [{ id: "x", department: "Nonsense", amountUsd: 10, label: "L".repeat(500), ts: 1 }],
    });
    expect(m.spendRecords![0].department).toBe("Operations"); // unknown -> Operations
    expect(m.spendRecords![0].label.length).toBeLessThanOrEqual(120);
  });

  it("is idempotent for spendRecords + budget", () => {
    const input = {
      budget: { totalUsd: 5000, currency: "USD", periodLabel: "Q3" },
      spendRecords: [{ id: "sp1", department: "Finance", amountUsd: 100, label: "AWS — infra", ts: 1, objectiveId: null, taskId: "t1" }],
    };
    const once = sanitizeWorkspaceMeta(input);
    const twice = sanitizeWorkspaceMeta(once);
    expect(twice).toEqual(once);
  });
});

describe("sanitizeWorkspaceMeta — budget config", () => {
  it("clamps totalUsd to [0, 1e9], uppercases currency, caps periodLabel", () => {
    const m = sanitizeWorkspaceMeta({
      budget: { totalUsd: -50, currency: "usd", periodLabel: "P".repeat(100) },
    });
    expect(m.budget!.totalUsd).toBe(0); // negative clamped
    expect(m.budget!.currency).toBe("USD"); // uppercased
    expect(m.budget!.periodLabel!.length).toBeLessThanOrEqual(40);
  });

  it("clamps an over-large budget to the ceiling", () => {
    const m = sanitizeWorkspaceMeta({ budget: { totalUsd: BUDGET_MAX_USD * 5, currency: "USD" } });
    expect(m.budget!.totalUsd).toBe(BUDGET_MAX_USD);
  });

  it("passes an explicit null budget through (clearing)", () => {
    const m = sanitizeWorkspaceMeta({ budget: null });
    expect(m.budget).toBeNull();
  });

  it("defaults a missing/blank currency to USD", () => {
    const m = sanitizeWorkspaceMeta({ budget: { totalUsd: 100, currency: "" } });
    expect(m.budget!.currency).toBe("USD");
  });
});

/* ──────────────────────────── secondary size guard ──────────────────────────── */

describe("sanitizeWorkspaceMeta — secondary size guard trims the ledger", () => {
  it("drops auditLog first, then trims spendRecords to newest 100 when the surviving meta is still oversized", () => {
    // Per-field caps (label<=120, args<=2KB, etc.) make spendRecords alone unable
    // to breach 200KB, so the secondary guard fires only in COMBINATION. Build a
    // meta whose surviving fields (pendingApprovals + files + spendRecords) clear
    // 200KB AFTER auditLog is dropped, forcing the ledger trim.
    const m = sanitizeWorkspaceMeta({
      pendingApprovals: Array.from({ length: 50 }, (_, i) => ({
        id: `p${i}`, taskId: `t${i}`, connectorId: "computer", toolName: "run_shell",
        args: { a: "z".repeat(900), b: "y".repeat(900) }, ts: i,
      })),
      files: Array.from({ length: 50 }, (_, i) => ({ name: `f${i}`, url: "https://example.com/" + "u".repeat(560) })),
      auditLog: Array.from({ length: 200 }, (_, i) => ({ approvalId: `a${i}`, action: "approve", ts: i, outcome: "y".repeat(900) })),
      spendRecords: Array.from({ length: 500 }, (_, i) => ({ id: `sp${i}`, department: "Finance", amountUsd: i, label: "x".repeat(120), ts: i })),
    });
    // auditLog is dropped first (lowest priority).
    expect(m.auditLog).toBeUndefined();
    // spendRecords trimmed to the newest 100 (keeps the highest-numbered ids).
    expect(m.spendRecords!.length).toBe(100);
    expect(m.spendRecords![m.spendRecords!.length - 1].id).toBe("sp499");
    // The final blob is under the budget.
    expect(JSON.stringify(m).length).toBeLessThanOrEqual(200_000);
  });

  it("keeps the full ledger when the meta is comfortably within budget", () => {
    // No secondary trim when there's headroom — the ring buffer cap (500) is the
    // only bound that applies in the common case.
    const m = sanitizeWorkspaceMeta({
      spendRecords: Array.from({ length: 300 }, (_, i) => ({ id: `sp${i}`, department: "Finance", amountUsd: i, label: "small", ts: i })),
    });
    expect(m.spendRecords!.length).toBe(300);
  });
});
