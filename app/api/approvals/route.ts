import { coerceText, redactArgs } from "@/lib/agent-types";
import type { PendingApproval, AuditEntry } from "@/lib/agent-types";
import { authorizeWrite } from "@/lib/auth";
import { dbConfigured, getWorkspace, updateWorkspaceMeta, patchTask } from "@/lib/supabase-rest";
import { getConnectorRegistry, classifyTool, isContentProhibited, dispatchConnectorTool } from "@/lib/connectors";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Human-approval gate for SENSITIVE connector actions.
 *   GET  /api/approvals?workspace=<id>  -> the pending approvals for a workspace.
 *        No auth (read-only).
 *   POST /api/approvals { workspaceId, workspaceSecret, approvalId, action }
 *        action="approve" -> DETERMINISTICALLY execute the frozen { tool, args }
 *          (the model is never re-invoked), record the outcome to the audit log,
 *          remove the approval, and clear needs_action when no more pending for
 *          that task.
 *        action="deny"    -> record the denial, remove the approval, set the task
 *          back to todo (retryable, matching the Inbox decline behavior).
 *        authorizeWrite-gated.
 *
 * SECURITY (defense-in-depth): the stored toolName is re-classified before
 * executing — a PROHIBITED tool returns 403 even on approve, so even a tampered
 * meta record can never trigger a prohibited action.
 *
 * Degrades gracefully with no DB: GET returns []; POST returns persisted:false.
 */

export async function GET(req: Request): Promise<Response> {
  const workspaceId = coerceText(new URL(req.url).searchParams.get("workspace"), 100);
  if (!dbConfigured || !workspaceId) {
    return Response.json({ approvals: [], persisted: false });
  }
  const ws = await getWorkspace(workspaceId).catch(() => null);
  return Response.json({ approvals: ws?.meta?.pendingApprovals ?? [], persisted: true });
}

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }
  const workspaceId = coerceText(body.workspaceId, 100);
  const workspaceSecret = coerceText(body.workspaceSecret, 200) || undefined;
  const approvalId = coerceText(body.approvalId, 40);
  const action = body.action === "approve" || body.action === "deny" ? body.action : null;

  if (!workspaceId) {
    return Response.json({ ok: false, error: "no workspace" }, { status: 400 });
  }
  if (!action) {
    return Response.json({ ok: false, error: "action must be approve or deny" }, { status: 400 });
  }
  if (!(await authorizeWrite(workspaceId, workspaceSecret))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }
  if (!dbConfigured) {
    return Response.json({ ok: true, persisted: false });
  }

  const ws = await getWorkspace(workspaceId).catch(() => null);
  if (!ws) {
    return Response.json({ ok: false, error: "not found" }, { status: 404 });
  }
  const pending = (ws.meta?.pendingApprovals ?? []) as PendingApproval[];
  const approval = pending.find((p) => p.id === approvalId);
  if (!approval) {
    return Response.json({ ok: false, error: "approval not found" }, { status: 404 });
  }

  const registry = getConnectorRegistry(ws.meta?.connectors);
  // Defense-in-depth: re-check the stored tool against the policy. A PROHIBITED
  // tool is blocked even when a human clicks Approve. This covers BOTH name/tier
  // prohibition (classifyTool) AND content prohibition (isContentProhibited — e.g.
  // a tampered approval whose run_shell command is destructive / references a
  // credential path). dispatchConnectorTool re-checks again at execution time.
  if (
    action === "approve" &&
    (classifyTool(approval.toolName, registry) === "prohibited" ||
      isContentProhibited(approval.toolName, approval.args))
  ) {
    return Response.json(
      { ok: false, error: "This action is prohibited by policy and cannot be executed. The human must perform it manually." },
      { status: 403 },
    );
  }

  const auditLog = (ws.meta?.auditLog ?? []) as AuditEntry[];
  const remaining = pending.filter((p) => p.id !== approvalId);
  // Redact sensitive arg keys for the audit record (readable without leaking).
  const redactedArgs = redactArgs(approval.args) as Record<string, string>;

  let result: string | undefined;
  if (action === "approve") {
    // Execute the FROZEN { tool, args } deterministically — output is
    // injection-scanned + capped inside dispatchConnectorTool.
    result = await dispatchConnectorTool(approval.toolName, approval.args, registry);
    auditLog.push({ approvalId, action: "approve", outcome: result, ts: Date.now(), redactedArgs });
  } else {
    auditLog.push({ approvalId, action: "deny", ts: Date.now(), redactedArgs });
  }

  // Persist meta FIRST (audit + removed approval), THEN flip the task status.
  // Ordering matters: never mark a task resolved if the audit write failed.
  try {
    // Cap the audit log inline (newest 200). This path writes via
    // updateWorkspaceMeta (a raw shallow merge), so the sanitizer's ring-buffer
    // cap isn't applied here — and we must NOT route this through
    // sanitizeWorkspaceMeta, because that redacts pendingApprovals.args and would
    // corrupt the REAL args of other still-pending approvals (they need real
    // values to execute on approval).
    await updateWorkspaceMeta(workspaceId, { pendingApprovals: remaining, auditLog: auditLog.slice(-200) });
  } catch {
    return Response.json({ ok: false, error: "save failed" }, { status: 500 });
  }

  // Clear the task. On approve: if this task has no more pending approvals, it's
  // done. On deny: send it back to todo so it can be retried (matches Inbox).
  const taskStillPending = remaining.some((p) => p.taskId === approval.taskId);
  if (approval.taskId) {
    if (action === "deny") {
      await patchTask(approval.taskId, { status: "todo" }, workspaceId).catch(() => {});
    } else if (!taskStillPending) {
      await patchTask(approval.taskId, { status: "done" }, workspaceId).catch(() => {});
    }
  }

  return Response.json({ ok: true, persisted: true, ...(result !== undefined ? { result } : {}) });
}
