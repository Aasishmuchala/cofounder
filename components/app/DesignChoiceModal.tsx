"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { UseCofounder } from "@/lib/use-cofounder";
import { deliverableFor, type DesignChoice } from "@/lib/agent-types";
import { DESIGN_SYSTEMS, layoutsFor, marketTemplatesFor, defaultTemplateFor } from "@/lib/design-catalog";
import { cx } from "@/components/ui/primitives";

const AUTO = "__auto__";

/**
 * The Design Direction gate. Whenever a visual deliverable (landing page / email /
 * formatted doc) is ready to run but has no founder direction yet (cf.pendingDesign),
 * this pops so the founder picks the STYLE, LAYOUT, and a free-text BRIEF before the
 * agent builds it. "Build this one" applies to the focused task; "Apply to all
 * remaining" sets a workspace default so the rest run without prompting. Dismissing
 * collapses it to a chip; a NEW design task re-opens it.
 */
export default function DesignChoiceModal({ cf }: { cf: UseCofounder }) {
  const task = cf.pendingDesign[0] ?? null;
  const remaining = cf.pendingDesign.length;

  // Carries the last picks forward to the next task (founders usually want consistency).
  const [style, setStyle] = useState<string>(AUTO);
  const [layout, setLayout] = useState<string>(AUTO);
  const [brief, setBrief] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Re-open when the focused design task changes (new design work → pop again).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: re-open the gate when the focused design task changes (new design work)
    setDismissed(false);
  }, [task?.id]);

  const kind = task ? deliverableFor(task.department, task.title, task.detail).kind : "markdown";
  const layouts = useMemo(
    () => (task ? layoutsFor(kind, task.department) : []),
    [task, kind],
  );
  // The top design SKILL.md files in the market for this kind — the PRIMARY
  // template choices. "Auto" (below) falls back to open-design.
  const templates = useMemo(() => (task ? marketTemplatesFor(kind) : []), [task, kind]);
  // The skill "Auto" resolves to for this kind (landing → flagship; else open-design).
  const dflt = useMemo(() => (task ? defaultTemplateFor(kind) : null), [task, kind]);

  if (!task || !cf.canEdit) return null;

  const choice = (): DesignChoice => ({
    style: style === AUTO ? null : style,
    template: layout === AUTO ? null : layout,
    brief: brief.trim(),
  });

  const submit = async (applyToAll: boolean) => {
    setBusy(true);
    try {
      await cf.setDesignDirection(choice(), applyToAll ? { applyToAll: true } : { taskId: task.id });
    } finally {
      setBusy(false);
    }
  };

  // Collapsed: a re-opener chip so the founder isn't trapped but can't lose the gate.
  if (dismissed) {
    return (
      <button
        onClick={() => setDismissed(false)}
        className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 inline-flex items-center gap-2 rounded-full bg-[var(--text)] px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-white shadow-deep"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ffd34d]" />
        {remaining} design task{remaining === 1 ? "" : "s"} awaiting your direction — choose
      </button>
    );
  }

  return (
    <div
      className="t-fade-in fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => setDismissed(true)}
    >
      <div
        className="t-modal-in max-h-[88vh] w-full max-w-[560px] overflow-auto rounded-[16px] bg-white p-5 shadow-deep"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-50)]">
              Design direction
            </div>
            <div className="mt-0.5 font-display text-[19px] font-medium leading-tight text-[var(--text)]">
              {task.title}
            </div>
            <div className="mt-1 font-mono text-[11px] text-[var(--text-50)]">
              {task.department} · {deliverableFor(task.department, task.title, task.detail).noun}
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Later"
            className="rounded-[7px] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-50)] transition-colors hover:text-[var(--text)]"
          >
            Later
          </button>
        </div>

        {/* TEMPLATE — the top design SKILL.md files in the market come FIRST (the
            founder's primary pick). "Auto" falls back to open-design. The open-design
            layout sub-choices (saas-landing / pricing / …) follow, tagged. */}
        <div className="mt-4">
          <Label>Template</Label>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            <Choice active={layout === AUTO} onClick={() => setLayout(AUTO)} title="Auto" blurb={dflt ? `Default · ${dflt.label}` : "Open Design picks the best fit."} tag={dflt ? dflt.repo.split("/")[0] : "default"} />
            {templates.map((t) => (
              <Choice key={t.id} active={layout === t.id} onClick={() => setLayout(t.id)} title={t.label} blurb={t.blurb} tag={t.repo.split("/")[0]} />
            ))}
            {layouts.map((l) => (
              <Choice key={l.id} active={layout === l.id} onClick={() => setLayout(l.id)} title={l.label} blurb={l.blurb} tag="open design" />
            ))}
          </div>
        </div>

        {/* STYLE (visual system — refines the look on top of the chosen template) */}
        <div className="mt-4">
          <Label>Style</Label>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            <Choice active={style === AUTO} onClick={() => setStyle(AUTO)} title="Auto" blurb="Let the agent pick the best fit." />
            {DESIGN_SYSTEMS.map((s) => (
              <Choice key={s.id} active={style === s.id} onClick={() => setStyle(s.id)} title={s.label} blurb={s.blurb} />
            ))}
          </div>
        </div>

        {/* BRIEF */}
        <div className="mt-4">
          <Label>Design brief (optional)</Label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            placeholder="Colors, references, tone, must-haves — e.g. 'dark, Stripe-like, indigo accents, one bold headline, no stock photos.'"
            className="mt-1.5 w-full resize-none rounded-[10px] border border-[var(--text-20)] bg-[var(--surface-raised)] p-3 text-[13px] leading-relaxed text-[var(--text-80)] outline-none focus:border-[var(--text-40)]"
          />
        </div>

        {/* actions */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            onClick={() => submit(false)}
            disabled={busy}
            className="rounded-[9px] bg-[var(--text)] px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "…" : "Build this one"}
          </button>
          <button
            onClick={() => submit(true)}
            disabled={busy}
            className="rounded-[9px] bg-[var(--green-tint)] px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[#2c7a3f] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Apply to all remaining
          </button>
          <span className="ml-auto font-mono text-[10px] text-[var(--text-40)]">
            {remaining} waiting
          </span>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-50)]">{children}</div>;
}

function Choice({
  active,
  onClick,
  title,
  blurb,
  tag,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  blurb: string;
  tag?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={tag ? `${blurb} — ${tag}` : blurb}
      className={cx(
        "rounded-[9px] border p-2 text-left transition-colors",
        active
          ? "border-[var(--text)] bg-[var(--surface-raised)] shadow-raised"
          : "border-[var(--text-20)] bg-white hover:border-[var(--text-40)]",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="truncate font-display text-[12px] font-medium leading-tight text-[var(--text-80)]">{title}</div>
        {tag ? (
          <span className="shrink-0 rounded-[4px] bg-[var(--surface-raised)] px-1 py-px font-mono text-[8px] uppercase tracking-[0.03em] text-[var(--text-40)]">
            {tag}
          </span>
        ) : null}
      </div>
      <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[var(--text-50)]">{blurb}</div>
    </button>
  );
}
