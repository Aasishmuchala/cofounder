import { describe, it, expect } from "vitest";
import { isOverBudget, totalSpent, SPEND_MAX_RECORDS } from "@/lib/agent-types";
import type { PendingApproval, SpendRecord, BudgetConfig } from "@/lib/agent-types";

// Faithful DB-free copy of app/api/approvals/route.ts spendRecordFromApproval (keep in sync).
function spendRecordFromApproval(approval: PendingApproval): SpendRecord | null {
  if (approval.toolName !== "propose_spend") return null;
  const a = approval.args;
  const amount = typeof a.amount === "number" && Number.isFinite(a.amount) && a.amount > 0 ? a.amount : 0;
  const vendor = (typeof a.vendor === "string" ? a.vendor : "").slice(0, 80) || "vendor";
  const reason = (typeof a.reason === "string" ? a.reason : "").slice(0, 80);
  return {
    id: "sp_x", taskId: approval.taskId || null, objectiveId: null,
    department: "Finance", amountUsd: amount,
    label: reason ? `${vendor} — ${reason}`.slice(0, 120) : vendor, ts: 0,
  };
}
const pa = (o: Partial<PendingApproval> = {}): PendingApproval => ({
  id: "ap1", taskId: "t1", connectorId: "finance", toolName: "propose_spend",
  args: { amount: 500, currency: "USD", vendor: "AWS", reason: "infra" }, ts: 0, ...o,
});

describe("spendRecordFromApproval — approve records governance-only spend (never pays)", () => {
  it("builds a Finance SpendRecord from an approved propose_spend", () => {
    const rec = spendRecordFromApproval(pa())!;
    expect(rec).not.toBeNull();
    expect(rec.amountUsd).toBe(500);
    expect(rec.department).toBe("Finance");
    expect(rec.label).toBe("AWS — infra");
    expect(rec.taskId).toBe("t1");
  });
  it("returns null for any non-spend tool (NO ledger write on other approvals)", () => {
    expect(spendRecordFromApproval(pa({ toolName: "send_email" }))).toBeNull();
  });
  it("coerces a negative / non-numeric amount to 0 (never a debt)", () => {
    expect(spendRecordFromApproval(pa({ args: { amount: -100, vendor: "X", reason: "y" } }))!.amountUsd).toBe(0);
    expect(spendRecordFromApproval(pa({ args: { amount: "lots", vendor: "X", reason: "y" } }))!.amountUsd).toBe(0);
  });
  it("labels with the bare vendor when there is no reason", () => {
    expect(spendRecordFromApproval(pa({ args: { amount: 10, vendor: "Figma" } }))!.label).toBe("Figma");
  });
  it("ring-buffers the ledger to the newest SPEND_MAX_RECORDS on append", () => {
    const existing: SpendRecord[] = Array.from({ length: SPEND_MAX_RECORDS }, (_, i) => ({ id: `old${i}`, department: "Finance", amountUsd: 1, label: "x", ts: i }));
    const spend = spendRecordFromApproval(pa())!;
    const next = [...existing, spend].slice(-SPEND_MAX_RECORDS);
    expect(next.length).toBe(SPEND_MAX_RECORDS);
    expect(next[next.length - 1].id).toBe(spend.id);
    expect(next[0].id).toBe("old1"); // oldest dropped
  });
  it("an over-budget proposal is still recordable (warning, never a block)", () => {
    const budget: BudgetConfig = { totalUsd: 1000, currency: "USD" };
    const ledger: SpendRecord[] = [{ id: "s1", department: "Finance", amountUsd: 900, label: "x", ts: 0 }];
    expect(isOverBudget(budget, ledger, 500)).toBe(true);
    const rec = spendRecordFromApproval(pa({ args: { amount: 500, vendor: "AWS", reason: "more" } }))!;
    expect(rec.amountUsd).toBe(500); // produced regardless of over-budget
    expect(totalSpent([...ledger, rec])).toBe(1400);
  });
});
