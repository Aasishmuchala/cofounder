import { coerceText, sanitizeWorkspaceMeta } from "@/lib/agent-types";
import type { ConnectorConfig } from "@/lib/agent-types";
import { authorizeWrite, tooLarge } from "@/lib/auth";
import { dbConfigured, getWorkspace, updateWorkspaceMeta } from "@/lib/supabase-rest";
import { BUILT_IN_IDS, getConnectorRegistry, type ConnectorDef } from "@/lib/connectors";

export const runtime = "nodejs";

/**
 * Connector registry API.
 *   GET  /api/connectors?workspace=<id>  -> the resolved connector registry for
 *        a workspace (built-ins merged with the workspace's enabled overrides),
 *        each tool carrying its risk badge. No auth (read-only).
 *   PATCH /api/connectors                -> enable/disable a connector (and
 *        optionally set its secret ENV VAR NAME). authorizeWrite-gated.
 *
 * Degrades gracefully with no DB: GET returns the built-in registry with
 * persisted:false; PATCH returns persisted:false without error.
 */

/** Client-safe view of a connector (drops nothing sensitive — secrets are never
 *  stored as values — but normalizes the shape the UI consumes). */
function serialize(reg: ConnectorDef[]) {
  return reg.map((c) => ({
    id: c.id,
    label: c.label,
    kind: c.kind,
    enabled: c.enabled,
    secretEnvVar: c.secretEnvVar ?? null,
    tools: c.tools.map((t) => ({ name: t.name, description: t.description, risk: t.risk })),
  }));
}

export async function GET(req: Request): Promise<Response> {
  const workspaceId = coerceText(new URL(req.url).searchParams.get("workspace"), 100);

  if (!dbConfigured || !workspaceId) {
    return Response.json({ connectors: serialize(getConnectorRegistry(null)), persisted: false });
  }
  const ws = await getWorkspace(workspaceId).catch(() => null);
  const registry = getConnectorRegistry(ws?.meta?.connectors);
  return Response.json({ connectors: serialize(registry), persisted: true });
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
  const connectorId = coerceText(body.connectorId, 40);

  if (!workspaceId) {
    return Response.json({ ok: false, error: "no workspace" }, { status: 400 });
  }
  // Only built-in connectors may be toggled — reject unknown ids.
  if (!BUILT_IN_IDS.has(connectorId)) {
    return Response.json({ ok: false, error: "unknown connector" }, { status: 400 });
  }
  if (!(await authorizeWrite(workspaceId, workspaceSecret))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }
  if (!dbConfigured) {
    return Response.json({ ok: true, persisted: false, connectors: serialize(getConnectorRegistry(null)) });
  }

  // secretEnvVar (optional) must be an ENV VAR NAME, never a secret value. The
  // sanitizer drops it if it fails the pattern; reject explicitly here too so the
  // caller learns their input was bad rather than silently losing it.
  const secretEnvVar = coerceText(body.secretEnvVar, 64);
  if (secretEnvVar && !/^[A-Z_][A-Z0-9_]{0,60}$/.test(secretEnvVar)) {
    return Response.json({ ok: false, error: "secretEnvVar must be an ENV VAR NAME (UPPER_SNAKE_CASE)" }, { status: 400 });
  }

  try {
    const current = (await getWorkspace(workspaceId).then((w) => w?.meta?.connectors ?? []).catch(() => [])) as ConnectorConfig[];
    const next: ConnectorConfig[] = [];
    let found = false;
    for (const c of current) {
      if (c.id === connectorId) {
        found = true;
        next.push({
          id: connectorId,
          enabled: typeof body.enabled === "boolean" ? body.enabled : c.enabled,
          ...(secretEnvVar ? { secretEnvVar } : c.secretEnvVar ? { secretEnvVar: c.secretEnvVar } : {}),
        });
      } else {
        next.push(c);
      }
    }
    if (!found) {
      next.push({
        id: connectorId,
        enabled: body.enabled === true,
        ...(secretEnvVar ? { secretEnvVar } : {}),
      });
    }
    // Re-run through the meta sanitizer (caps + validates the connectors array).
    const patch = sanitizeWorkspaceMeta({ connectors: next });
    const meta = await updateWorkspaceMeta(workspaceId, patch);
    // null => no such workspace (the PATCH matched 0 rows). Don't report success.
    if (!meta) {
      return Response.json({ ok: false, persisted: false, error: "workspace not found" }, { status: 404 });
    }
    return Response.json({
      ok: true,
      persisted: true,
      connectors: serialize(getConnectorRegistry(meta.connectors)),
    });
  } catch {
    return Response.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
