import { coerceText, type DesignChoice, type WorkspaceMeta } from "@/lib/agent-types";
import { authorizeWrite, tooLarge } from "@/lib/auth";
import { dbConfigured, getWorkspace, updateWorkspaceMeta } from "@/lib/supabase-rest";
import { isValidSystem, isValidTemplate } from "@/lib/design-catalog";

export const runtime = "nodejs";

/**
 * Founder design-direction store. The Design Direction gate (a visual deliverable
 * is held until the founder picks a style/layout/brief) POSTs choices here; the
 * runner reads them from workspace.meta and overrides its auto-selection.
 *
 *   { taskId, choice }                  -> set a per-task choice (unblocks that task)
 *   { applyToAll: true, choice }        -> set the workspace default (unblocks all)
 *   { clearDefault: true }              -> drop the default (re-enable per-task gating)
 *
 * Auth-gated identically to every other write (per-workspace capability token).
 */

/** Validate + normalize a choice. Unknown style/template ids drop to null (=auto)
 *  so a bad value can never reach the open-design fetch; the brief is capped. */
function normalizeChoice(raw: unknown): DesignChoice {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const style = typeof o.style === "string" && isValidSystem(o.style) ? o.style : null;
  const template = typeof o.template === "string" && isValidTemplate(o.template) ? o.template : null;
  return { style, template, brief: coerceText(o.brief, 2000) };
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
  const taskId = coerceText(body.taskId, 100) || undefined;
  const applyToAll = body.applyToAll === true;
  const clearDefault = body.clearDefault === true;

  if (!workspaceId) return Response.json({ ok: false, error: "no workspace" }, { status: 400 });
  if (!(await authorizeWrite(workspaceId, workspaceSecret))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }
  if (!dbConfigured) {
    // Keyless/local demo — nothing to persist; the client keeps its own state.
    return Response.json({ ok: true, persisted: false });
  }
  if (!applyToAll && !clearDefault && !taskId) {
    return Response.json({ ok: false, error: "taskId required for a per-task choice" }, { status: 400 });
  }

  const meta = (await getWorkspace(workspaceId)
    .then((w) => w?.meta ?? null)
    .catch(() => null)) as WorkspaceMeta | null;
  const patch: WorkspaceMeta = {};

  if (clearDefault) {
    patch.designDefault = null;
  } else if (applyToAll) {
    patch.designDefault = normalizeChoice(body.choice);
  } else if (taskId) {
    // updateWorkspaceMeta shallow-merges, so write the FULL per-task map.
    const current: Record<string, DesignChoice> = { ...(meta?.designChoices ?? {}) };
    current[taskId] = normalizeChoice(body.choice);
    const keys = Object.keys(current);
    if (keys.length > 200) for (const k of keys.slice(0, keys.length - 200)) delete current[k];
    patch.designChoices = current;
  }

  try {
    const next = await updateWorkspaceMeta(workspaceId, patch);
    if (!next) return Response.json({ ok: false, error: "no such workspace" }, { status: 404 });
    return Response.json({ ok: true, persisted: true });
  } catch {
    return Response.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
