import { coerceText, sanitizeWorkspaceMeta } from "@/lib/agent-types";
import type { BudgetConfig, SpendRecord } from "@/lib/agent-types";
import { authorizeWrite, tooLarge } from "@/lib/auth";
import { dbConfigured, getWorkspace, updateWorkspaceMeta } from "@/lib/supabase-rest";

export const runtime = "nodejs";

/**
 * Budget config API (the governed-spend layer's ceiling, in meta.budget). The
 * budget is a GOVERNANCE bound, not a payment limit — money is never moved.
 *
 *   GET   /api/budget?workspace=<id>  -> { budget, spentUsd, spendRecords } where
 *         spentUsd = sum of spendRecords[].amountUsd. No auth (read-only).
 *   PATCH { workspaceId, workspaceSecret, budget: BudgetConfig | null }
 *         -> set or clear the budget (sanitizer-validated). authorizeWrite-gated.
 *
 * Degrades gracefully with no DB.
 */

function spentUsd(records: SpendRecord[]): number {
  return records.reduce((s, r) => s + (typeof r.amountUsd === "number" && r.amountUsd > 0 ? r.amountUsd : 0), 0);
}

export async function GET(req: Request): Promise<Response> {
  const workspaceId = coerceText(new URL(req.url).searchParams.get("workspace"), 100);
  if (!dbConfigured || !workspaceId) {
    return Response.json({ budget: null, spentUsd: 0, spendRecords: [], persisted: false });
  }
  const ws = await getWorkspace(workspaceId).catch(() => null);
  const records = (ws?.meta?.spendRecords ?? []) as SpendRecord[];
  return Response.json({
    budget: (ws?.meta?.budget ?? null) as BudgetConfig | null,
    spendRecords: records,
    spentUsd: spentUsd(records),
    persisted: true,
  });
}

export async function PATCH(req: Request): Promise<Response> {
  if (tooLarge(req)) return Response.json({ ok: false, error: "payload too large" }, { status: 413 });
  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }
  const workspaceId = coerceText(body.workspaceId, 100);
  const workspaceSecret = coerceText(body.workspaceSecret, 200) || undefined;

  if (!workspaceId) {
    return Response.json({ ok: false, error: "no workspace" }, { status: 400 });
  }
  // budget must be an object (set) or explicit null (clear). Anything else is bad input.
  const hasBudget = "budget" in body;
  const budgetIsObject = body.budget && typeof body.budget === "object" && !Array.isArray(body.budget);
  if (!hasBudget || (body.budget !== null && !budgetIsObject)) {
    return Response.json({ ok: false, error: "budget must be an object or null" }, { status: 400 });
  }
  if (!(await authorizeWrite(workspaceId, workspaceSecret))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }
  if (!dbConfigured) {
    return Response.json({ ok: true, persisted: false });
  }

  try {
    // The sanitizer clamps totalUsd, coerces currency/periodLabel, or passes null through.
    const patch = sanitizeWorkspaceMeta({ budget: body.budget as BudgetConfig | null });
    const meta = await updateWorkspaceMeta(workspaceId, patch);
    // null => no such workspace (the PATCH matched 0 rows). Don't report success.
    if (!meta) {
      return Response.json({ ok: false, persisted: false, error: "workspace not found" }, { status: 404 });
    }
    const records = (meta.spendRecords ?? []) as SpendRecord[];
    return Response.json({
      ok: true,
      persisted: true,
      budget: (meta.budget ?? null) as BudgetConfig | null,
      spentUsd: spentUsd(records),
    });
  } catch {
    return Response.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
