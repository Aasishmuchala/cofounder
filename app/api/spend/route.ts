import { coerceText, coerceDepartment, sanitizeWorkspaceMeta, SPEND_MAX_RECORDS } from "@/lib/agent-types";
import type { SpendRecord } from "@/lib/agent-types";
import { authorizeWrite, tooLarge } from "@/lib/auth";
import { dbConfigured, getWorkspace, updateWorkspaceMeta } from "@/lib/supabase-rest";

export const runtime = "nodejs";

/**
 * Spend ledger persistence (the governed-spend layer's record-only store, in
 * meta.spendRecords). Money is NEVER moved here — a SpendRecord is a governance
 * log entry, recorded when a propose_spend approval is approved (see
 * app/api/approvals) or added/removed manually by the owner from the Org tab.
 *
 *   GET    /api/spend?workspace=<id>  -> { spendRecords, spentUsd } (no auth).
 *   POST   { workspaceId, workspaceSecret, department, amountUsd, label,
 *            objectiveId?, taskId? } -> append a SpendRecord (ring buffer).
 *   DELETE { workspaceId, workspaceSecret, id } -> remove a SpendRecord by id.
 *
 * Both writes are authorizeWrite-gated. No payment API, no card/banking call,
 * no external request anywhere in this route. Degrades gracefully with no DB.
 */

function spentUsd(records: SpendRecord[]): number {
  return records.reduce((s, r) => s + (typeof r.amountUsd === "number" && r.amountUsd > 0 ? r.amountUsd : 0), 0);
}

export async function GET(req: Request): Promise<Response> {
  const workspaceId = coerceText(new URL(req.url).searchParams.get("workspace"), 100);
  if (!dbConfigured || !workspaceId) {
    return Response.json({ spendRecords: [], spentUsd: 0, persisted: false });
  }
  const ws = await getWorkspace(workspaceId).catch(() => null);
  const records = (ws?.meta?.spendRecords ?? []) as SpendRecord[];
  return Response.json({ spendRecords: records, spentUsd: spentUsd(records), persisted: true });
}

export async function POST(req: Request): Promise<Response> {
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
  const amountUsd = typeof body.amountUsd === "number" && Number.isFinite(body.amountUsd) ? body.amountUsd : NaN;
  const label = coerceText(body.label, 120);

  if (!workspaceId) {
    return Response.json({ ok: false, error: "no workspace" }, { status: 400 });
  }
  if (!Number.isFinite(amountUsd) || amountUsd < 0) {
    return Response.json({ ok: false, error: "amountUsd must be a non-negative number" }, { status: 400 });
  }
  if (!(await authorizeWrite(workspaceId, workspaceSecret))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }
  if (!dbConfigured) {
    return Response.json({ ok: true, persisted: false });
  }

  const record: SpendRecord = {
    id: `sp_${Math.random().toString(36).slice(2, 10)}`,
    department: coerceDepartment(body.department),
    amountUsd,
    label,
    ts: Date.now(),
    objectiveId: typeof body.objectiveId === "string" ? body.objectiveId.slice(0, 40) : null,
    taskId: typeof body.taskId === "string" ? body.taskId.slice(0, 100) : null,
  };

  try {
    const current = (await getWorkspace(workspaceId)
      .then((w) => (w?.meta?.spendRecords ?? []) as SpendRecord[])
      .catch(() => [])) as SpendRecord[];
    const next = [...current, record].slice(-SPEND_MAX_RECORDS);
    // Re-run through the meta sanitizer (caps + validates the spendRecords array).
    const patch = sanitizeWorkspaceMeta({ spendRecords: next });
    const meta = await updateWorkspaceMeta(workspaceId, patch);
    // null => no such workspace (the PATCH matched 0 rows). Don't report success.
    if (!meta) {
      return Response.json({ ok: false, persisted: false, error: "workspace not found" }, { status: 404 });
    }
    const recs = (meta.spendRecords ?? []) as SpendRecord[];
    return Response.json({ ok: true, persisted: true, spendRecords: recs, spentUsd: spentUsd(recs) });
  } catch {
    return Response.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request): Promise<Response> {
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
  const id = coerceText(body.id, 40);

  if (!workspaceId || !id) {
    return Response.json({ ok: false, error: "missing workspace or id" }, { status: 400 });
  }
  if (!(await authorizeWrite(workspaceId, workspaceSecret))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }
  if (!dbConfigured) {
    return Response.json({ ok: true, persisted: false });
  }

  try {
    const current = (await getWorkspace(workspaceId)
      .then((w) => (w?.meta?.spendRecords ?? []) as SpendRecord[])
      .catch(() => [])) as SpendRecord[];
    const next = current.filter((r) => r.id !== id);
    const patch = sanitizeWorkspaceMeta({ spendRecords: next });
    const meta = await updateWorkspaceMeta(workspaceId, patch);
    // null => no such workspace (the PATCH matched 0 rows). Don't report success.
    if (!meta) {
      return Response.json({ ok: false, persisted: false, error: "workspace not found" }, { status: 404 });
    }
    const recs = (meta.spendRecords ?? []) as SpendRecord[];
    return Response.json({ ok: true, persisted: true, spendRecords: recs, spentUsd: spentUsd(recs) });
  } catch {
    return Response.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
