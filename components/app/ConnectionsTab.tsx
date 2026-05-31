"use client";

import { useEffect, useState } from "react";
import type { UseCofounder } from "@/lib/use-cofounder";
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
  kind: "mock" | "http-mcp";
  enabled: boolean;
  secretEnvVar: string | null;
  tools: ConnectorTool[];
}

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

  useEffect(() => {
    const ws = cf.workspaceId ? `?workspace=${encodeURIComponent(cf.workspaceId)}` : "";
    fetch(`/api/connectors${ws}`)
      .then((r) => r.json())
      .then((d) => setConnectors(Array.isArray(d.connectors) ? d.connectors : []))
      .catch(() => setConnectors([]));
  }, [cf.workspaceId]);

  async function toggle(c: Connector) {
    if (!cf.canEdit || busy) return;
    const nextEnabled = !c.enabled;
    setBusy(c.id);
    // Optimistic local flip.
    setConnectors((prev) => prev?.map((x) => (x.id === c.id ? { ...x, enabled: nextEnabled } : x)) ?? prev);
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

  const empty = connectors !== null && connectors.length === 0;

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
          {connectors.map((c) => (
            <div key={c.id} className="rounded-[9px] bg-white p-3 shadow-raised">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[12px] text-[var(--text-80)]">{c.label}</span>
                <span className="rounded-[5px] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.05em] text-[var(--text-50)] shadow-raised">
                  {c.kind}
                </span>
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
              </div>
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
          ))}
        </div>
      )}

      {!cf.canEdit && connectors && connectors.length > 0 && (
        <p className="mt-3 text-[11px] text-[var(--text-50)]">View only — ask the owner for an edit link to change connectors.</p>
      )}
    </div>
  );
}
