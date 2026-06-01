import { coerceText, sanitizeWorkspaceMeta } from "@/lib/agent-types";
import type { ConnectorConfig, ConnectorToolSpec } from "@/lib/agent-types";
import { authorizeWrite, tooLarge } from "@/lib/auth";
import { dbConfigured, getWorkspace, updateWorkspaceMeta } from "@/lib/supabase-rest";
import { BUILT_IN_IDS, getConnectorRegistry, type ConnectorDef } from "@/lib/connectors";

export const runtime = "nodejs";

/**
 * Connector registry API.
 *   GET  /api/connectors?workspace=<id>  -> the resolved connector registry for
 *        a workspace (built-ins merged with the workspace's enabled overrides,
 *        then its CUSTOM http-mcp connectors), each tool carrying its risk badge.
 *        No auth (read-only).
 *   PATCH /api/connectors                -> enable/disable a BUILT-IN connector
 *        (and optionally set its secret ENV VAR NAME). authorizeWrite-gated.
 *   POST  /api/connectors                -> define/update a CUSTOM http-mcp
 *        connector (id + label + secretEnvVar NAME + tools). authorizeWrite-gated.
 *   DELETE /api/connectors               -> remove a CUSTOM connector by id (never
 *        a built-in). authorizeWrite-gated.
 *
 * Degrades gracefully with no DB: GET returns the built-in registry with
 * persisted:false; the writes return persisted:false without error.
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

/** ENV VAR NAME shape (UPPER_SNAKE_CASE) — mirrors sanitizeWorkspaceMeta's
 *  ENV_VAR_NAME. A custom connector references its secret/endpoint by NAME only,
 *  never as a value (a pasted secret has lowercase/spaces and fails this). */
const ENV_VAR_NAME = /^[A-Z_][A-Z0-9_]{0,60}$/;

/** A custom connector id must be a slug (lowercase, digits, '-'/'_'), and is
 *  rejected if it collides with a built-in id (checked separately). */
const CUSTOM_CONNECTOR_ID = /^[a-z][a-z0-9_-]{0,38}$/;

/** Every tool name the built-ins expose — a custom connector's tool may not reuse
 *  one (uniqueness across the whole registry, so a custom tool can't shadow a
 *  built-in). getConnectorRegistry(null) carries every built-in's full tools[]
 *  (the env gates flip `enabled`, never the tool list), so this is complete. */
const BUILT_IN_TOOL_NAMES = new Set(
  getConnectorRegistry(null).flatMap((c) => c.tools.map((t) => t.name)),
);

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
  const conn = (body.connector && typeof body.connector === "object" && !Array.isArray(body.connector)
    ? body.connector
    : {}) as Record<string, unknown>;

  if (!workspaceId) {
    return Response.json({ ok: false, error: "no workspace" }, { status: 400 });
  }
  // id must be a slug and NEVER a built-in id (custom connectors only).
  const connectorId = coerceText(conn.id, 40).toLowerCase();
  if (!CUSTOM_CONNECTOR_ID.test(connectorId)) {
    return Response.json({ ok: false, error: "connector id must be a slug (lowercase, digits, '-' or '_')" }, { status: 400 });
  }
  if (BUILT_IN_IDS.has(connectorId)) {
    return Response.json({ ok: false, error: "id collides with a built-in connector" }, { status: 400 });
  }
  // secretEnvVar (optional) is an ENV VAR NAME, never a secret value. The sanitizer
  // drops it if it fails the pattern; reject explicitly here so the caller knows.
  const secretEnvVar = coerceText(conn.secretEnvVar, 64);
  if (secretEnvVar && !ENV_VAR_NAME.test(secretEnvVar)) {
    return Response.json({ ok: false, error: "secretEnvVar must be an ENV VAR NAME (UPPER_SNAKE_CASE)" }, { status: 400 });
  }
  // tools: non-empty; each risk in {safe,sensitive}; no name may collide with a
  // built-in tool name. The sanitizer re-validates names/params + clamps caps; we
  // pass the raw specs through and let it coerce, but reject the cases the caller
  // most needs to learn about (empty tools, a bad risk, a built-in collision).
  if (!Array.isArray(conn.tools) || conn.tools.length === 0) {
    return Response.json({ ok: false, error: "at least one tool is required" }, { status: 400 });
  }
  const tools: ConnectorToolSpec[] = [];
  for (const t of conn.tools as unknown[]) {
    const to = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
    const name = coerceText(to.name, 48).toLowerCase();
    if (BUILT_IN_TOOL_NAMES.has(name)) {
      return Response.json({ ok: false, error: `tool '${name}' collides with a built-in tool name` }, { status: 400 });
    }
    if (to.risk !== undefined && to.risk !== "safe" && to.risk !== "sensitive") {
      return Response.json({ ok: false, error: "tool risk must be 'safe' or 'sensitive'" }, { status: 400 });
    }
    const spec: ConnectorToolSpec = {
      name,
      description: coerceText(to.description, 300),
      risk: to.risk === "sensitive" ? "sensitive" : "safe",
    };
    if (Array.isArray(to.params)) {
      spec.params = (to.params as unknown[]).map((p) => coerceText(p, 32).toLowerCase()).filter(Boolean);
    }
    tools.push(spec);
  }

  if (!(await authorizeWrite(workspaceId, workspaceSecret))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }
  if (!dbConfigured) {
    return Response.json({ ok: true, persisted: false, connectors: serialize(getConnectorRegistry(null)) });
  }

  // Build the custom config (kind FORCED "http-mcp" — the only user-definable
  // transport). secretEnvVar is included by NAME only when present.
  const cfg: ConnectorConfig = {
    id: connectorId,
    enabled: typeof conn.enabled === "boolean" ? conn.enabled : true,
    custom: true,
    kind: "http-mcp",
    tools,
    ...(coerceText(conn.label, 60) ? { label: coerceText(conn.label, 60) } : {}),
    ...(secretEnvVar ? { secretEnvVar } : {}),
  };

  try {
    const current = (await getWorkspace(workspaceId).then((w) => w?.meta?.connectors ?? []).catch(() => [])) as ConnectorConfig[];
    // Replace an existing config with the same id (update), else append (add).
    const next = current.filter((c) => c.id !== connectorId);
    next.push(cfg);
    // Re-run through the meta sanitizer (validates custom: caps tools/params,
    // drops bad names, clamps risk, forces kind, caps custom connectors <=12).
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
  const connectorId = coerceText(body.connectorId, 40).toLowerCase();

  if (!workspaceId || !connectorId) {
    return Response.json({ ok: false, error: "missing workspace or connectorId" }, { status: 400 });
  }
  // Only CUSTOM connectors may be removed — a built-in id is never deletable
  // (the built-ins always exist in the registry; toggle them off via PATCH).
  if (BUILT_IN_IDS.has(connectorId)) {
    return Response.json({ ok: false, error: "cannot remove a built-in connector" }, { status: 400 });
  }
  if (!(await authorizeWrite(workspaceId, workspaceSecret))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }
  if (!dbConfigured) {
    return Response.json({ ok: true, persisted: false, connectors: serialize(getConnectorRegistry(null)) });
  }

  try {
    const current = (await getWorkspace(workspaceId).then((w) => w?.meta?.connectors ?? []).catch(() => [])) as ConnectorConfig[];
    const next = current.filter((c) => c.id !== connectorId);
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
