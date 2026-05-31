"use client";

import { useEffect, useState } from "react";
import type { UseCofounder } from "@/lib/use-cofounder";
import { deliverableFor, departmentColor } from "@/lib/agent-types";
import { cx, MonoLabel } from "@/components/ui/primitives";

interface Scored { name: string; description: string; department: string; source: string; score: number; reasons: string[] }
interface Skill { name: string; description: string; department: string; source: string }

const DEPTS = ["Engineering", "Design", "Marketing", "Sales", "Support", "Operations", "Finance", "Legal", "General"];

function ScoreBar({ score, max }: { score: number; max: number }) {
  return (
    <span className="h-1.5 w-14 overflow-hidden rounded-full bg-black/10">
      <span className="block h-full rounded-full bg-[var(--text)]" style={{ width: `${Math.max(6, (score / Math.max(max, 1)) * 100)}%` }} />
    </span>
  );
}

export default function SkillsTab({ cf }: { cf: UseCofounder }) {
  const [overview, setOverview] = useState<{ total: number; departments: { department: string; count: number }[] } | null>(null);
  const [dept, setDept] = useState("Engineering");
  const [q, setQ] = useState("");
  const [list, setList] = useState<Skill[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [cmp, setCmp] = useState<{ chosen: Scored | null; candidates: Scored[] } | null>(null);
  const [cmpTaskId, setCmpTaskId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/skills").then((r) => r.json()).then(setOverview).catch(() => {});
  }, []);

  useEffect(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    else p.set("department", dept);
    fetch(`/api/skills?${p}`).then((r) => r.json()).then((d) => { setList(d.skills || []); setListTotal(d.total || 0); }).catch(() => {});
  }, [dept, q]);

  async function compareTask(t: { id: string; title: string; department: string; detail?: string }) {
    setCmpTaskId(t.id);
    setCmp(null);
    const { kind } = deliverableFor(t.department);
    const p = new URLSearchParams({ compare: "1", department: t.department, kind, title: t.title, detail: t.detail ?? "" });
    const d = await fetch(`/api/skills?${p}`).then((r) => r.json()).catch(() => null);
    setCmp(d);
  }

  const countFor = (d: string) => overview?.departments.find((x) => x.department === d)?.count ?? 0;
  const maxScore = cmp?.candidates[0]?.score ?? 1;

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="text-[14px] leading-none" aria-hidden>🧠</span>
        <h3 className="font-display text-[16px] text-[var(--text)]">Skills</h3>
        {overview && <span className="font-mono text-[10px] text-[var(--text-50)]">{overview.total} preloaded</span>}
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-50)]">
        Every agent equips the best-matching skill for its task. Skills are segregated by department; for each task the
        candidates are compared and the top one is chosen.
      </p>

      {/* Per-task comparison */}
      {cf.tasks.length > 0 && (
        <div className="mt-4">
          <MonoLabel className="block">Compare skills for a task</MonoLabel>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {cf.tasks.slice(0, 8).map((t) => (
              <button
                key={t.id}
                onClick={() => compareTask(t)}
                className={cx(
                  "max-w-full truncate rounded-[8px] px-2.5 py-1 font-display text-[11.5px] transition-colors",
                  cmpTaskId === t.id ? "bg-[var(--text)] text-white" : "bg-white text-[var(--text-70)] shadow-raised hover:text-[var(--text)]",
                )}
              >
                {t.title}
              </button>
            ))}
          </div>

          {cmp && cmpTaskId && (
            <div className="mt-3 rounded-[12px] bg-white p-3.5 shadow-raised">
              {cmp.chosen ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-[6px] bg-[var(--green-tint)] px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.06em] text-[#2c7a3f]">★ chosen</span>
                    <span className="font-mono text-[13px] text-[var(--text)]">{cmp.chosen.name}</span>
                    <span className="ml-auto font-mono text-[10px] text-[var(--text-50)]">score {cmp.chosen.score}</span>
                  </div>
                  <p className="mt-1 text-[12px] leading-snug text-[var(--text-50)]">{cmp.chosen.description}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {cmp.chosen.reasons.map((r) => (
                      <span key={r} className="rounded-[5px] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[8.5px] text-[var(--text-50)] shadow-raised">{r}</span>
                    ))}
                  </div>
                  {cmp.candidates.length > 1 && (
                    <div className="mt-3 border-t border-black/[0.06] pt-2.5">
                      <div className="mb-1.5 font-mono text-[8.5px] uppercase tracking-[0.08em] text-[var(--text-50)]">Compared against</div>
                      <div className="space-y-1">
                        {cmp.candidates.slice(1, 6).map((c) => (
                          <div key={c.name} className="flex items-center gap-2">
                            <span className="flex-1 truncate font-mono text-[11px] text-[var(--text-70)]">{c.name}</span>
                            <ScoreBar score={c.score} max={maxScore} />
                            <span className="w-5 text-right font-mono text-[9px] text-[var(--text-50)]">{c.score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[12px] text-[var(--text-50)]">No catalog skill matched — the agent uses its open-design + house craft instead.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Catalog browser */}
      <MonoLabel className="mt-6 block">Browse the catalog</MonoLabel>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search 1,300+ skills…"
        className="mt-2 w-full rounded-[10px] bg-white px-3 py-2 font-display text-[13px] text-[var(--text)] shadow-raised outline-none placeholder:text-[var(--text-50)]"
      />
      {!q.trim() && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DEPTS.map((d) => (
            <button
              key={d}
              onClick={() => setDept(d)}
              className={cx(
                "flex items-center gap-1 rounded-[8px] px-2 py-1 font-display text-[11px] transition-colors",
                dept === d ? "bg-[var(--text)] text-white" : "bg-white text-[var(--text-70)] shadow-raised hover:text-[var(--text)]",
              )}
            >
              {d !== "General" && <span className="h-1.5 w-1.5 rounded-full" style={{ background: departmentColor(d) }} />}
              {d}
              <span className={cx("font-mono text-[9px]", dept === d ? "text-white/70" : "text-[var(--text-50)]")}>{countFor(d)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-50)]">
        {q.trim() ? `${listTotal} match${listTotal === 1 ? "" : "es"}` : `${countFor(dept)} ${dept} skills`}
      </div>
      <div className="mt-2 space-y-1.5">
        {list.map((s) => (
          <div key={s.name} className="rounded-[9px] bg-white px-3 py-2 shadow-raised">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12px] text-[var(--text-80)]">{s.name}</span>
              <span className="ml-auto rounded-[5px] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.05em] text-[var(--text-50)] shadow-raised">{s.department}</span>
            </div>
            {s.description && <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-[var(--text-50)]">{s.description}</p>}
          </div>
        ))}
        {list.length === 0 && <p className="text-[12px] text-[var(--text-50)]">No skills found.</p>}
      </div>
    </div>
  );
}
