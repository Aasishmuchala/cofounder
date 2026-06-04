"use client";

import { useState } from "react";
import { isHtmlDeliverable, type Artifact } from "@/lib/agent-types";
import type { UseCofounder } from "@/lib/use-cofounder";
import { buildReactHarness } from "@/lib/react-preview";

const KIND_LABEL: Record<string, string> = {
  landing_page: "Landing page · Next.js",
  brand_spec: "Brand spec",
  markdown: "Document",
  email: "Email",
  pitch_deck: "Pitch deck",
};

function scoreStyle(score: number): { background: string; color: string } {
  if (score >= 8) return { background: "var(--green-tint)", color: "#2c7a3f" };
  if (score >= 6) return { background: "#fbf0d4", color: "#8a6d1f" };
  return { background: "#fff0ed", color: "var(--coral)" };
}

/** Very small Markdown-ish renderer (headings, bold, list items). */
function renderMarkdown(src: string) {
  return src.split("\n").map((line, i) => {
    if (/^#\s/.test(line))
      return <h2 key={i} className="mt-4 font-display text-[20px] font-semibold text-[var(--text)]">{line.replace(/^#\s/, "")}</h2>;
    if (/^##\s/.test(line))
      return <h3 key={i} className="mt-3 font-display text-[16px] font-medium text-[var(--text)]">{line.replace(/^##\s/, "")}</h3>;
    if (/^[-*]\s/.test(line))
      return <li key={i} className="ml-4 list-disc text-[13.5px] leading-relaxed text-[var(--text-70)]">{boldify(line.replace(/^[-*]\s/, ""))}</li>;
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return <p key={i} className="text-[13.5px] leading-relaxed text-[var(--text-70)]">{boldify(line)}</p>;
  });
}

function boldify(s: string) {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} className="font-semibold text-[var(--text)]">{p.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(p)) return <code key={i} className="rounded bg-black/5 px-1 py-0.5 font-mono text-[12px]">{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  });
}

const actBtn =
  "btn-light-surface flex h-8 items-center rounded-[8px] px-3 font-display text-[12px] text-[var(--text-70)] disabled:opacity-40";

export default function ArtifactPanel({
  artifact,
  cf,
  onOpenArtifact,
  onClose,
}: {
  artifact: Artifact;
  cf: UseCofounder;
  onOpenArtifact: (id: string) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(artifact.content);
  const [busy, setBusy] = useState(false);

  // Self-contained HTML deliverables (landing page / pitch deck) render live in
  // the sandboxed iframe AND get a full-screen "Open ↗". isSite stays landing-
  // page-only — it gates the Next.js project "Export ↓", which a deck has no
  // equivalent for.
  const rendersAsHtml = isHtmlDeliverable(artifact.kind);
  const isSite = artifact.kind === "landing_page";
  const canEdit = cf.canEdit;
  // Versions = all artifacts for this task (cf.artifacts is newest-first).
  const versions = artifact.taskId ? cf.artifacts.filter((a) => a.taskId === artifact.taskId && a.id) : [];
  const task = cf.tasks.find((t) => t.id === artifact.taskId);

  async function save() {
    setBusy(true);
    await cf.saveArtifact(artifact.id, draft);
    setBusy(false);
    setEditing(false);
  }
  async function regenerate() {
    if (!task) return;
    setBusy(true);
    const created = await cf.regenerate(task);
    setBusy(false);
    if (created?.id) onOpenArtifact(created.id);
  }

  return (
    <div className="absolute inset-0 z-40 flex justify-end">
      <div className="t-fade-in absolute inset-0 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />
      <div className="t-drawer-in relative flex h-full w-[min(620px,94%)] flex-col bg-[var(--background)] shadow-deep">
        {/* header */}
        <div className="flex items-center justify-between gap-2 border-b border-black/5 px-5 py-3.5">
          <div className="min-w-0">
            <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-50)]">
              {KIND_LABEL[artifact.kind] ?? "Deliverable"} · generated
            </div>
            <div className="truncate font-display text-[16px] font-medium text-[var(--text)]">{artifact.title}</div>
            {artifact.skill && (() => {
              const s = artifact.skill;
              const { icon, verb } =
                s.source === "authored" ? { icon: "✍️", verb: "authored skill" }
                : s.source === "house" ? { icon: "🏛", verb: "house skill" }
                : { icon: "⚡", verb: "equipped" };
              const label = `${icon} ${verb}: ${s.name}${s.metric ? ` · ${s.metric}` : ""}`;
              const cls = "mt-1 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-50)] hover:text-[var(--text)]";
              return s.url
                ? <a href={s.url} target="_blank" rel="noreferrer" className={cls}>{label}</a>
                : <span className={cls} title={s.name}>{label}</span>;
            })()}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isSite && !editing && (
              <a href={`/api/export/${artifact.id}`} className={actBtn} title="Download as a runnable Next.js project">Export ↓</a>
            )}
            {rendersAsHtml && !editing && (
              <a href={`/app/preview/${artifact.id}`} target="_blank" rel="noreferrer" className={actBtn}>Open ↗</a>
            )}
            {canEdit && !editing && task && (
              <button onClick={regenerate} disabled={busy} className={actBtn} title="Generate a fresh version (keeps this one in history)">
                {busy ? "Working…" : "Regenerate"}
              </button>
            )}
            {canEdit && !editing && (
              <button onClick={() => { setDraft(artifact.content); setEditing(true); }} className={actBtn}>Edit</button>
            )}
            {editing && (
              <>
                <button onClick={save} disabled={busy} className={actBtn} style={{ color: "var(--green)" }}>{busy ? "Saving…" : "Save"}</button>
                <button onClick={() => setEditing(false)} className={actBtn}>Cancel</button>
              </>
            )}
            {!editing && (
              <button
                onClick={() => { navigator.clipboard?.writeText(artifact.content); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
                className={actBtn}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            )}
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--text-50)] hover:bg-black/5" aria-label="Close">✕</button>
          </div>
        </div>

        {/* version history */}
        {versions.length > 1 && !editing && (
          <div className="flex items-center gap-1.5 border-b border-black/5 bg-[var(--surface-raised)] px-5 py-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-50)]">Versions</span>
            {versions.map((v, idx) => {
              const num = versions.length - idx; // newest = highest
              const active = v.id === artifact.id;
              return (
                <button
                  key={v.id}
                  onClick={() => onOpenArtifact(v.id)}
                  className={`rounded-[6px] px-2 py-0.5 font-mono text-[10px] ${active ? "bg-[var(--text)] text-white" : "bg-white text-[var(--text-70)] shadow-raised hover:text-[var(--text)]"}`}
                  title={idx === 0 ? "Latest" : ""}
                >
                  v{num}
                </button>
              );
            })}
          </div>
        )}

        {/* eval band */}
        {artifact.eval && !editing && (
          <div className="border-b border-black/5 bg-[var(--surface-raised)] px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="rounded-[7px] px-2 py-1 font-mono text-[13px] font-bold" style={scoreStyle(artifact.eval.score)}>
                {artifact.eval.score.toFixed(1)}<span className="text-[10px] font-normal opacity-70">/10</span>
              </span>
              <span className="font-display text-[13px] text-[var(--text-80)]">Quality score</span>
              <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-50)]">
                {artifact.eval.judged ? "AI-judged" : "auto checks"}{artifact.eval.iterations > 1 ? ` · ${artifact.eval.iterations} drafts` : ""}
              </span>
            </div>
            {artifact.eval.rubric.length > 0 && (
              <div className="mt-2.5 grid grid-cols-2 gap-x-5 gap-y-1.5">
                {artifact.eval.rubric.map((r) => (
                  <div key={r.label} className="flex items-center gap-2">
                    <span className="flex-1 truncate text-[11px] text-[var(--text-50)]">{r.label}</span>
                    <span className="h-1 w-12 overflow-hidden rounded-full bg-black/10"><span className="block h-full rounded-full" style={{ width: `${r.score * 10}%`, background: scoreStyle(r.score).color }} /></span>
                    <span className="w-4 text-right font-mono text-[9px] text-[var(--text-50)]">{r.score}</span>
                  </div>
                ))}
              </div>
            )}
            {artifact.eval.notes && <p className="mt-2.5 text-[11.5px] italic leading-snug text-[var(--text-50)]">“{artifact.eval.notes}”</p>}
          </div>
        )}

        {/* content / editor */}
        <div className="min-h-0 flex-1 overflow-auto">
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="h-full w-full resize-none border-0 bg-[#0c0c12] p-4 font-mono text-[12px] leading-relaxed text-[#e6e6ef] outline-none"
            />
          ) : rendersAsHtml ? (
            <iframe
              title={artifact.title}
              srcDoc={buildReactHarness(artifact.content, artifact.title)}
              className="h-full w-full border-0 bg-white"
              sandbox="allow-scripts"
            />
          ) : (
            <div className="px-5 py-4">{renderMarkdown(artifact.content)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
