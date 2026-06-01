"use client";

import { useEffect, useMemo, useState } from "react";
import type { UseCofounder } from "@/lib/use-cofounder";
import type { ConnectorConfig, ConnectorToolSpec } from "@/lib/agent-types";
import { CONNECTOR_TEMPLATES, type ConnectorTemplate } from "@/lib/connector-templates";
import { cx, MonoLabel } from "@/components/ui/primitives";

type Risk = "safe" | "sensitive" | "prohibited";
interface ConnectorTool {
  name: string;
  description: string;
  risk: Risk;
}
interface Connector {
  id: string;
  label: string;
  kind: "mock" | "http-mcp" | "computer";
  enabled: boolean;
  secretEnvVar: string | null;
  tools: ConnectorTool[];
}

// Client-side mirrors of the (module-private) caps + identifier patterns the
// server enforces in sanitizeWorkspaceMeta. These are UX guards only — the
// server re-validates everything and is the source of truth — so the operator
// learns about a bad name/cap here instead of silently losing it on save.
const ENV_VAR_NAME = /^[A-Z_][A-Z0-9_]{0,60}$/;
const TOOL_NAME = /^[a-z][a-z0-9_]{0,48}$/;
const CUSTOM_CONNECTORS_MAX = 12;
const CUSTOM_TOOLS_MAX = 12;

/** Visual treatment per risk tier — mirrors the StatusTag palette language. */
const RISK_STYLE: Record<Risk, { label: string; bg: string; color: string }> = {
  safe: { label: "Safe · auto", bg: "var(--green-tint)", color: "#2c7a3f" },
  sensitive: { label: "Sensitive · approval", bg: "#fff0ed", color: "var(--coral)" },
  prohibited: { label: "Prohibited · blocked", bg: "#efefec", color: "var(--text-50)" },
};

function RiskBadge({ risk }: { risk: Risk }) {
  const s = RISK_STYLE[risk];
  return (
    <span
      className="shrink-0 rounded-[5px] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.05em]"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

export default function ConnectionsTab({ cf }: { cf: UseCofounder }) {
  const [connectors, setConnectors] = useState<Connector[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // The workspace's persisted connector configs (built-in overrides + customs).
  // The serialized registry the API returns doesn't carry the custom flag, so we
  // read it from meta to tell which list rows are user-defined (removable, and
  // toggled via meta rather than the built-in-only /api/connectors PATCH).
  const cfgs = useMemo<ConnectorConfig[]>(() => cf.connectors ?? [], [cf.connectors]);
  const customIds = useMemo(
    () => new Set(cfgs.filter((c) => c.custom === true).map((c) => c.id)),
    [cfgs],
  );
  const customCount = customIds.size;

  /** Re-pull the resolved registry (built-ins merged with this workspace's
   *  overrides + the Foundation-appended custom connectors). */
  async function refreshConnectors() {
    const ws = cf.workspaceId ? `?workspace=${encodeURIComponent(cf.workspaceId)}` : "";
    try {
      const r = await fetch(`/api/connectors${ws}`);
      const d = await r.json();
      setConnectors(Array.isArray(d.connectors) ? d.connectors : []);
    } catch {
      setConnectors([]);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async registry fetch; setConnectors lands after the await, not synchronously
    void refreshConnectors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cf.workspaceId]);

  async function toggle(c: Connector) {
    if (!cf.canEdit || busy) return;
    const nextEnabled = !c.enabled;
    setBusy(c.id);
    // Optimistic local flip.
    setConnectors((prev) => prev?.map((x) => (x.id === c.id ? { ...x, enabled: nextEnabled } : x)) ?? prev);
    // Custom connectors aren't toggleable via the built-in-only /api/connectors
    // PATCH (it rejects unknown ids) — flip their `enabled` in workspace meta,
    // which persists through the same sanitizer, then reconcile from the registry.
    if (customIds.has(c.id)) {
      const next = cfgs.map((x) => (x.id === c.id ? { ...x, enabled: nextEnabled } : x));
      cf.saveMeta({ connectors: next });
      await refreshConnectors();
      setBusy(null);
      return;
    }
    try {
      const secret = typeof window !== "undefined" ? window.localStorage.getItem("cf_secret") : "";
      const r = await fetch("/api/connectors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: cf.workspaceId,
          workspaceSecret: secret ?? undefined,
          connectorId: c.id,
          enabled: nextEnabled,
        }),
      });
      const d = (await r.json()) as { ok?: boolean; connectors?: Connector[] };
      if (d.connectors) setConnectors(d.connectors);
    } catch {
      // Revert on failure.
      setConnectors((prev) => prev?.map((x) => (x.id === c.id ? { ...x, enabled: c.enabled } : x)) ?? prev);
    }
    setBusy(null);
  }

  /** Persist the next connector config array to workspace meta (the workspace
   *  PATCH runs it through sanitizeWorkspaceMeta) and re-pull the registry. */
  async function persistConfigs(next: ConnectorConfig[]) {
    cf.saveMeta({ connectors: next });
    await refreshConnectors();
  }

  /** Add a curated template as a custom http-mcp connector (enabled by default).
   *  Adding the same id again just re-applies the template's tools/secret. */
  async function addTemplate(t: ConnectorTemplate) {
    if (!cf.canEdit || busy) return;
    setBusy(`tpl:${t.id}`);
    const cfg: ConnectorConfig = {
      id: t.id,
      enabled: true,
      custom: true,
      kind: "http-mcp",
      label: t.label,
      secretEnvVar: t.secretEnvVar,
      tools: t.tools,
    };
    const next = [...cfgs.filter((c) => c.id !== t.id), cfg];
    await persistConfigs(next);
    setBusy(null);
  }

  /** Remove a custom connector (drops its config from meta). */
  async function removeCustom(id: string) {
    if (!cf.canEdit || busy) return;
    setBusy(id);
    const next = cfgs.filter((c) => c.id !== id);
    await persistConfigs(next);
    setBusy(null);
  }

  // ids already taken (built-ins + existing customs) — disables duplicate adds.
  const takenIds = useMemo(() => {
    const s = new Set<string>(customIds);
    for (const c of connectors ?? []) s.add(c.id);
    return s;
  }, [connectors, customIds]);

  const empty = connectors !== null && connectors.length === 0;
  const atCap = customCount >= CUSTOM_CONNECTORS_MAX;

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="text-[14px] leading-none" aria-hidden>🔌</span>
        <h3 className="font-display text-[16px] text-[var(--text)]">Connections</h3>
        {connectors && (
          <span className="font-mono text-[10px] text-[var(--text-50)]">
            {connectors.filter((c) => c.enabled).length}/{connectors.length} enabled
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-50)]">
        Connectors let your agents take real actions through external tools. Every call is governed by a risk policy —
        side-effectful actions are gated behind your approval, and dangerous ones are never automated.
      </p>

      {/* Risk policy legend */}
      <div className="mt-3 space-y-1.5 rounded-[12px] bg-white p-3 shadow-raised">
        <div className="flex items-start gap-2">
          <RiskBadge risk="safe" />
          <span className="text-[11.5px] leading-snug text-[var(--text-50)]">Reads, searches, lookups — run automatically.</span>
        </div>
        <div className="flex items-start gap-2">
          <RiskBadge risk="sensitive" />
          <span className="text-[11.5px] leading-snug text-[var(--text-50)]">Send, post, purchase, create — queued for your approval first.</span>
        </div>
        <div className="flex items-start gap-2">
          <RiskBadge risk="prohibited" />
          <span className="text-[11.5px] leading-snug text-[var(--text-50)]">Money, credentials, deletion, accounts — never automated, even on approve.</span>
        </div>
      </div>

      {/* Connector cards */}
      <MonoLabel className="mt-6 block">Connectors</MonoLabel>
      {connectors === null ? (
        <p className="mt-2 text-[12px] text-[var(--text-50)]">Loading…</p>
      ) : empty ? (
        <div className="mt-2 grid place-items-center rounded-[14px] border border-dashed border-[var(--text-30)] py-10 text-center">
          <MonoLabel>No connectors configured</MonoLabel>
          <p className="mt-2 max-w-[28ch] text-[12px] text-[var(--text-50)]">Enable the built-in connectors below to let your agents take real actions.</p>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {connectors.map((c) => {
            const isCustom = customIds.has(c.id);
            return (
              <div key={c.id} className="rounded-[9px] bg-white p-3 shadow-raised">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] text-[var(--text-80)]">{c.label}</span>
                  <span className="rounded-[5px] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.05em] text-[var(--text-50)] shadow-raised">
                    {c.kind}
                  </span>
                  {isCustom && (
                    <span className="rounded-[5px] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.05em] text-[var(--text-50)] shadow-raised">
                      custom
                    </span>
                  )}
                  <button
                    onClick={() => toggle(c)}
                    disabled={!cf.canEdit || busy === c.id}
                    aria-pressed={c.enabled}
                    className={cx(
                      "ml-auto rounded-[7px] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors",
                      c.enabled
                        ? "bg-[var(--green-tint)] text-[#2c7a3f]"
                        : "bg-[var(--surface-raised)] text-[var(--text-50)] shadow-raised hover:text-[var(--text)]",
                      !cf.canEdit && "cursor-default opacity-50",
                    )}
                  >
                    {busy === c.id ? "…" : c.enabled ? "On" : "Off"}
                  </button>
                  {isCustom && cf.canEdit && (
                    <button
                      onClick={() => removeCustom(c.id)}
                      disabled={busy === c.id}
                      aria-label={`Remove ${c.label}`}
                      className="rounded-[7px] bg-[var(--surface-raised)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-50)] shadow-raised transition-colors hover:text-[var(--coral)] disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {c.id === "computer" && !c.enabled && (
                  <p className="mt-1 font-mono text-[9px] italic text-[var(--text-50)]">
                    Requires COMPUTER_USE=1 env var to activate.
                  </p>
                )}
                {/* Custom connectors call a real MCP endpoint only when the operator
                    sets the named env var; surface that so an enabled-but-unset
                    connector isn't mistaken for live. */}
                {isCustom && c.secretEnvVar && (
                  <p className="mt-1 font-mono text-[9px] italic text-[var(--text-50)]">
                    Set <span className="not-italic text-[var(--text-70)]">{c.secretEnvVar}</span> to the connector&apos;s MCP endpoint URL to make real calls.
                  </p>
                )}
                <div className="mt-2 space-y-1">
                  {c.tools.map((t) => (
                    <div key={t.name} className="flex items-center gap-2">
                      <span className="shrink-0 font-mono text-[11px] text-[var(--text-70)]">{t.name}</span>
                      <span className="flex-1 truncate text-[11px] leading-snug text-[var(--text-50)]" title={t.description}>
                        {t.description}
                      </span>
                      <RiskBadge risk={t.risk} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add a connector (curated templates) ── */}
      {cf.canEdit && (
        <>
          <div className="mt-6 flex items-center justify-between">
            <MonoLabel>Add a connector</MonoLabel>
            <span className="font-mono text-[9px] text-[var(--text-50)]">
              {customCount}/{CUSTOM_CONNECTORS_MAX} custom
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-50)]">
            One-click business connectors. Each adds a custom http-mcp connector — the operator points it at a real MCP
            endpoint by setting the named env var. Read tools run automatically; send/create tools queue for your approval.
          </p>
          <div className="mt-2 space-y-2">
            {CONNECTOR_TEMPLATES.map((t) => {
              const already = takenIds.has(t.id);
              const disabled = busy !== null || already || (atCap && !already);
              return (
                <div key={t.id} className="rounded-[9px] bg-white p-3 shadow-raised">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-[var(--text-80)]">{t.label}</span>
                    <span className="rounded-[5px] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.05em] text-[var(--text-50)] shadow-raised">
                      {t.secretEnvVar}
                    </span>
                    <button
                      onClick={() => addTemplate(t)}
                      disabled={disabled}
                      className={cx(
                        "ml-auto rounded-[7px] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors",
                        already
                          ? "bg-[var(--green-tint)] text-[#2c7a3f]"
                          : "bg-[var(--surface-raised)] text-[var(--text-70)] shadow-raised hover:text-[var(--text)]",
                        disabled && "cursor-default opacity-50",
                      )}
                    >
                      {busy === `tpl:${t.id}` ? "…" : already ? "Added" : "Add"}
                    </button>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-snug text-[var(--text-50)]">{t.blurb}</p>
                  <div className="mt-2 space-y-1">
                    {t.tools.map((tool) => (
                      <div key={tool.name} className="flex items-center gap-2">
                        <span className="shrink-0 font-mono text-[11px] text-[var(--text-70)]">{tool.name}</span>
                        <span className="flex-1 truncate text-[11px] leading-snug text-[var(--text-50)]" title={tool.description}>
                          {tool.description}
                        </span>
                        <RiskBadge risk={tool.risk} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {atCap && (
            <p className="mt-2 text-[11px] text-[var(--coral)]">
              Custom connector limit reached ({CUSTOM_CONNECTORS_MAX}). Remove one to add another.
            </p>
          )}

          {/* ── Custom connector (hand-rolled) ── */}
          <CustomConnectorForm
            onAdd={async (cfg) => {
              const next = [...cfgs.filter((c) => c.id !== cfg.id), cfg];
              await persistConfigs(next);
            }}
            takenIds={takenIds}
            atCap={atCap}
            disabled={busy !== null}
          />
        </>
      )}

      {!cf.canEdit && connectors && connectors.length > 0 && (
        <p className="mt-3 text-[11px] text-[var(--text-50)]">View only — ask the owner for an edit link to change connectors.</p>
      )}
    </div>
  );
}

/* ── Hand-rolled custom connector: a name, an endpoint ENV VAR NAME, and one or
   more tools (name + description + risk). Submitting persists it as a custom
   http-mcp connector. Mirrors the OrgTab "set a goal" form chrome. The server
   re-validates + caps everything; this form just keeps the operator honest. ── */
interface DraftTool {
  name: string;
  description: string;
  risk: "safe" | "sensitive";
}

function CustomConnectorForm({
  onAdd,
  takenIds,
  atCap,
  disabled,
}: {
  onAdd: (cfg: ConnectorConfig) => Promise<void>;
  takenIds: Set<string>;
  atCap: boolean;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [envVar, setEnvVar] = useState("");
  const [tools, setTools] = useState<DraftTool[]>([{ name: "", description: "", risk: "safe" }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setLabel("");
    setEnvVar("");
    setTools([{ name: "", description: "", risk: "safe" }]);
    setErr(null);
  }

  function updateTool(i: number, patch: Partial<DraftTool>) {
    setTools((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function addToolRow() {
    setTools((prev) => (prev.length >= CUSTOM_TOOLS_MAX ? prev : [...prev, { name: "", description: "", risk: "safe" }]));
  }
  function removeToolRow(i: number) {
    setTools((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  // Derive a stable, namespaced connector id from the label (lowercase slug). The
  // operator never types the id; tool names should be prefixed with it by hand
  // (we surface that in the helper text) so they can't collide with a built-in.
  const id = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

  async function submit() {
    if (saving || disabled) return;
    setErr(null);
    if (atCap) {
      setErr(`Custom connector limit reached (${CUSTOM_CONNECTORS_MAX}).`);
      return;
    }
    if (!id) {
      setErr("Give the connector a name.");
      return;
    }
    if (takenIds.has(id)) {
      setErr("A connector with that name already exists.");
      return;
    }
    if (!ENV_VAR_NAME.test(envVar.trim())) {
      setErr("Endpoint env var must be an ENV VAR NAME (UPPER_SNAKE_CASE).");
      return;
    }
    const cleaned: ConnectorToolSpec[] = [];
    for (const t of tools) {
      const name = t.name.trim().toLowerCase();
      if (!name && !t.description.trim()) continue; // skip blank rows
      if (!TOOL_NAME.test(name)) {
        setErr(`Tool name "${t.name || "(empty)"}" must be lower_snake_case (start with a letter).`);
        return;
      }
      cleaned.push({ name, description: t.description.trim(), risk: t.risk });
    }
    if (cleaned.length === 0) {
      setErr("Add at least one tool.");
      return;
    }
    const cfg: ConnectorConfig = {
      id,
      enabled: true,
      custom: true,
      kind: "http-mcp",
      label: label.trim(),
      secretEnvVar: envVar.trim(),
      tools: cleaned,
    };
    setSaving(true);
    await onAdd(cfg);
    setSaving(false);
    reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-[10px] border border-dashed border-[var(--text-30)] py-2.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-50)] transition-colors hover:text-[var(--text)]"
      >
        + Custom connector
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-[12px] bg-white p-3 shadow-raised">
      <div className="flex items-center justify-between">
        <MonoLabel>Custom connector</MonoLabel>
        <span className="rounded-[5px] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.05em] text-[var(--text-50)] shadow-raised">
          http-mcp
        </span>
      </div>

      <label className="mt-2 block font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-50)]">Name</label>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Acme CRM"
        maxLength={60}
        className="mt-1 w-full rounded-[8px] bg-[var(--surface-raised)] px-2.5 py-1.5 font-display text-[13px] text-[var(--text)] shadow-raised outline-none placeholder:text-[var(--text-50)]"
      />
      {id && (
        <p className="mt-1 font-mono text-[9px] text-[var(--text-50)]">
          id <span className="text-[var(--text-70)]">{id}</span> — prefix every tool name with{" "}
          <span className="text-[var(--text-70)]">{id}_</span> so it can&apos;t collide with a built-in.
        </p>
      )}

      <label className="mt-2 block font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-50)]">Endpoint env var name</label>
      <input
        value={envVar}
        onChange={(e) => setEnvVar(e.target.value.toUpperCase())}
        placeholder="e.g. ACME_MCP_URL"
        maxLength={64}
        spellCheck={false}
        className="mt-1 w-full rounded-[8px] bg-[var(--surface-raised)] px-2.5 py-1.5 font-mono text-[12px] text-[var(--text)] shadow-raised outline-none placeholder:text-[var(--text-50)]"
      />
      <p className="mt-1 font-mono text-[9px] italic text-[var(--text-50)]">
        Stored by NAME only — never the value. The operator sets this env var to the MCP endpoint URL.
      </p>

      <label className="mt-3 block font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-50)]">
        Tools ({tools.length}/{CUSTOM_TOOLS_MAX})
      </label>
      <div className="mt-1 space-y-2">
        {tools.map((t, i) => (
          <div key={i} className="rounded-[8px] bg-[var(--surface-raised)] p-2 shadow-raised">
            <div className="flex items-center gap-2">
              <input
                value={t.name}
                onChange={(e) => updateTool(i, { name: e.target.value })}
                placeholder="tool_name"
                maxLength={48}
                spellCheck={false}
                className="min-w-0 flex-1 rounded-[6px] bg-white px-2 py-1 font-mono text-[11px] text-[var(--text)] shadow-raised outline-none placeholder:text-[var(--text-50)]"
              />
              <select
                value={t.risk}
                onChange={(e) => updateTool(i, { risk: e.target.value as "safe" | "sensitive" })}
                className="shrink-0 rounded-[6px] bg-white px-2 py-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--text-70)] shadow-raised outline-none"
              >
                <option value="safe">safe</option>
                <option value="sensitive">sensitive</option>
              </select>
              {tools.length > 1 && (
                <button
                  onClick={() => removeToolRow(i)}
                  aria-label="Remove tool"
                  className="shrink-0 rounded-[6px] bg-white px-2 py-1 font-mono text-[11px] text-[var(--text-50)] shadow-raised transition-colors hover:text-[var(--coral)]"
                >
                  ×
                </button>
              )}
            </div>
            <input
              value={t.description}
              onChange={(e) => updateTool(i, { description: e.target.value })}
              placeholder="What this tool does (shown to the agent + in approvals)"
              maxLength={300}
              className="mt-1.5 w-full rounded-[6px] bg-white px-2 py-1 font-display text-[11.5px] text-[var(--text)] shadow-raised outline-none placeholder:text-[var(--text-50)]"
            />
          </div>
        ))}
      </div>
      {tools.length < CUSTOM_TOOLS_MAX && (
        <button
          onClick={addToolRow}
          className="mt-2 rounded-[6px] bg-[var(--surface-raised)] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-50)] shadow-raised transition-colors hover:text-[var(--text)]"
        >
          + Tool
        </button>
      )}

      {err && <p className="mt-2 text-[12px] text-[var(--coral)]">{err}</p>}

      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          disabled={saving || disabled}
          className="flex-1 rounded-[8px] py-2 font-display text-[12px] font-medium text-white shadow-glossy disabled:opacity-50"
          style={{ background: "var(--green)" }}
        >
          {saving ? "Adding…" : "Add connector"}
        </button>
        <button
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={saving}
          className="rounded-[8px] bg-[#efefec] px-3 py-2 font-display text-[12px] font-medium text-[var(--text-70)] disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
