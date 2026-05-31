"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { departmentColor, DEPARTMENTS } from "@/lib/agent-types";
import type { Task } from "@/lib/agent-types";
import type { UseCofounder } from "@/lib/use-cofounder";
import { cx, MonoLabel } from "@/components/ui/primitives";
import {
  AGENTS,
  DEFAULT_SUGGESTED_NEXT,
  FOUNDER_FIRST_NAME,
  LIBRARY_COVERS,
  greeting,
} from "@/lib/cofounder-data";
import type { UseOnboarding } from "@/lib/use-onboarding";
import { OnboardingFlow, BusinessPlanCard } from "@/components/app/Onboarding";
import { IdentityFlow, BrandKitCard } from "@/components/app/Identity";
import { vibeById } from "@/lib/vibes";
import DepartmentView from "@/components/app/DepartmentView";
import type { CustomAgent } from "@/lib/use-custom-agents";

type TabKey = "Home" | "Cofounder" | "Company" | "Tasks" | "Library";
const TABS: TabKey[] = ["Home", "Cofounder", "Company", "Tasks", "Library"];

export default function RightPanel({
  cf,
  brand,
  tab,
  onTabChange,
  onb,
  onAcceptPlan,
  onLaunch,
  onSend,
  selectedDept,
  onSelectDepartment,
  onClearDept,
  customAgents,
}: {
  cf: UseCofounder;
  brand: string;
  tab: TabKey;
  onTabChange: (t: TabKey) => void;
  onb: UseOnboarding;
  onAcceptPlan: () => void;
  onLaunch: () => void;
  onSend: (text: string) => void;
  selectedDept: string | null;
  onSelectDepartment: (d: string) => void;
  onClearDept: () => void;
  customAgents: CustomAgent[];
}) {
  const { messages, tasks, loading } = cf;
  const [draft, setDraft] = useState("");

  const hasCompany = messages.length > 0 || tasks.length > 0;
  const onboardingActive = onb.active && !hasCompany;
  // A shared view link (persisted workspace, no edit key): reading only.
  const viewOnly = cf.persisted && !cf.canEdit;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || loading || onboardingActive || viewOnly) return;
    onSend(text);
    setDraft("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--surface-raised)]">
      {/* Tab bar */}
      <div className="flex items-center gap-5 px-6 pt-5">
        {TABS.map((t) => {
          const active = t === tab && !selectedDept;
          return (
            <button
              key={t}
              onClick={() => {
                onClearDept();
                onTabChange(t);
              }}
              className={cx(
                "relative pb-2 font-display text-[15px] tracking-[0.1px] transition-colors",
                active ? "text-[var(--text)]" : "text-[var(--text-50)] hover:text-[var(--text-70)]",
              )}
            >
              {t}
              {active && (
                <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[var(--text)]" />
              )}
            </button>
          );
        })}
      </div>
      <div className="divider-etched" />

      {/* Tab content (scrolls) */}
      <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
        {selectedDept ? (
          <DepartmentView department={selectedDept} cf={cf} brand={brand} onBack={onClearDept} />
        ) : (
          <>
            {tab === "Home" && <HomeTab cf={cf} brand={brand} plan={onb.plan} vibeId={onb.vibeId} onSelectDepartment={onSelectDepartment} />}
            {tab === "Cofounder" && (
              <CofounderTab
                cf={cf}
                onb={onb}
                brand={brand}
                onAcceptPlan={onAcceptPlan}
                onLaunch={onLaunch}
                hasCompany={hasCompany}
              />
            )}
            {tab === "Company" && <CompanyTab brand={brand} customAgents={customAgents} />}
            {tab === "Tasks" && <TasksTab cf={cf} onSelectDepartment={onSelectDepartment} />}
            {tab === "Library" && <LibraryTab cf={cf} vibeId={onb.vibeId} brand={brand} />}
          </>
        )}
      </div>

      {/* Persistent chat footer */}
      <div className="border-t border-black/[0.06] px-5 py-4">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-[13px] leading-none" aria-hidden>🌻</span>
          <span className="font-display text-[13px] text-[var(--text-80)]">Cofounder</span>
        </div>
        <form onSubmit={submit} className="flex items-end gap-2 rounded-[14px] bg-white p-2 pl-3.5 shadow-raised">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            disabled={onboardingActive || viewOnly}
            placeholder={
              viewOnly
                ? "View only — ask the owner for an edit link to make changes."
                : onboardingActive
                  ? "Finish setup above to start chatting…"
                  : !hasCompany && !onb.started
                    ? "Share what you're building…"
                    : "Ask Cofounder anything about your company…"
            }
            className="max-h-32 flex-1 resize-none bg-transparent py-1.5 font-display text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-50)] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !draft.trim() || onboardingActive || viewOnly}
            aria-label="Send"
            className="btn-light-surface grid h-9 w-9 shrink-0 place-items-center rounded-[9px] disabled:opacity-40"
          >
            {loading ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--text-30)] border-t-[var(--text-70)]" />
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-70)" strokeWidth="2">
                <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ────────────────────────── Home ────────────────────────── */
function HomeTab({
  cf,
  brand,
  plan,
  vibeId,
  onSelectDepartment,
}: {
  cf: UseCofounder;
  brand: string;
  plan: import("@/lib/onboarding").BusinessPlan | null;
  vibeId: string | null;
  onSelectDepartment: (d: string) => void;
}) {
  const { tasks } = cf;
  const [showPlan, setShowPlan] = useState(false);
  // Time-aware greeting (client-only; deferred to avoid hydration mismatch + setState-in-effect).
  const [greet, setGreet] = useState("Good morning");
  useEffect(() => {
    const t = setTimeout(() => setGreet(greeting(new Date().getHours())), 0);
    return () => clearTimeout(t);
  }, []);
  const vibe = vibeById(vibeId);
  const done = tasks.filter((t) => t.status === "done");
  const active = tasks.filter((t) => t.status !== "done");
  const pct = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;

  const suggested = (() => {
    const fromTasks = active.filter((t) => t.status !== "running").map((t) => t.title);
    const merged = [...new Set([...fromTasks, ...DEFAULT_SUGGESTED_NEXT])];
    return merged.slice(0, 4);
  })();

  return (
    <div>
      <h1 className="font-display text-[26px] font-normal leading-tight text-[var(--text)]">
        {greet}, {FOUNDER_FIRST_NAME}
      </h1>

      {/* Roadmap banner */}
      <div className="relative mt-4 h-[120px] overflow-hidden rounded-[14px] shadow-raised">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/home-banner.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-white/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
          <span className="font-display text-[16px] text-[var(--text)] [text-shadow:0_1px_2px_rgba(255,255,255,0.5)]">{brand} Roadmap</span>
          <span className="font-mono text-[12px] text-[var(--text-70)] [text-shadow:0_1px_2px_rgba(255,255,255,0.5)]">{pct}% ›</span>
        </div>
        <div className="absolute bottom-0 left-0 h-[3px] bg-[var(--text)]/40" style={{ width: `${Math.max(pct, 3)}%` }} />
      </div>

      {/* Business plan (collapsible) */}
      {plan && (
        <div className="mt-5">
          <button
            onClick={() => setShowPlan((v) => !v)}
            className="flex w-full items-center justify-between rounded-[10px] bg-white px-3.5 py-2.5 shadow-raised"
          >
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2c7a3f" strokeWidth="2.2">
                <circle cx="12" cy="12" r="9" />
                <path d="M8 12l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-display text-[14px] text-[var(--text)]">Business Plan</span>
            </span>
            <span className={cx("text-[var(--text-50)] transition-transform", showPlan && "rotate-180")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
          {showPlan && (
            <div className="mt-2">
              <BusinessPlanCard plan={plan} brand={brand} accepted />
            </div>
          )}
        </div>
      )}

      {/* Brand kit */}
      {vibe && (
        <div className="mt-5">
          <SectionLabel className="mb-2">Brand kit</SectionLabel>
          <BrandKitCard vibe={vibe} brand={brand} />
        </div>
      )}

      {/* Tasks */}
      <SectionLabel className="mt-7">Tasks</SectionLabel>
      {active.length === 0 ? (
        <p className="mt-2 text-[13px] text-[var(--text-50)]">No active tasks yet.</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {active.map((t) => (
            <div key={t.id} className="flex items-center gap-2.5">
              {t.status === "running" ? (
                <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[var(--text-30)] border-t-[var(--text-70)]" />
              ) : (
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: departmentColor(t.department) }} />
              )}
              <span className="flex-1 truncate font-display text-[14px] text-[var(--text-80)]">{t.title}</span>
              <button
                onClick={() => onSelectDepartment(t.department)}
                className="flex shrink-0 items-center gap-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--blue)] transition-opacity hover:opacity-70"
                title={`Open ${t.department}`}
              >
                View
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Suggested next — owners only (each kicks off a write) */}
      {cf.canEdit && (
        <>
          <div className="mt-7 flex items-center justify-between">
            <SectionLabel>Suggested next</SectionLabel>
          </div>
          <div className="mt-2 space-y-2">
            {suggested.map((s) => (
              <button
                key={s}
                onClick={() => cf.send(s)}
                className="flex w-full items-center gap-2.5 text-left transition-opacity hover:opacity-70"
              >
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-[var(--text-30)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-30)]" />
                </span>
                <span className="font-display text-[14px] text-[var(--text-70)]">{s}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Archived */}
      <SectionLabel className="mt-7">Archived tasks</SectionLabel>
      {done.length === 0 ? (
        <p className="mt-2 text-[13px] text-[var(--text-50)]">No archived tasks</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {done.map((t) => (
            <div key={t.id} className="flex items-center gap-2.5 opacity-70">
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--green-tint)]">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#2c7a3f" strokeWidth="3">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="flex-1 truncate font-display text-[14px] text-[var(--text-70)] line-through">{t.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────── Cofounder (chat / onboarding) ──────────────────────── */
function CofounderTab({
  cf,
  onb,
  brand,
  onAcceptPlan,
  onLaunch,
  hasCompany,
}: {
  cf: UseCofounder;
  onb: UseOnboarding;
  brand: string;
  onAcceptPlan: () => void;
  onLaunch: () => void;
  hasCompany: boolean;
}) {
  const { messages, loading } = cf;

  // Visual-identity step (choose vibe → paint → brand kit) before spin-up.
  if (!hasCompany && (onb.status === "vibe" || onb.status === "painting" || onb.status === "brand")) {
    return <IdentityFlow onb={onb} brand={brand} onComplete={onLaunch} />;
  }

  // Onboarding (questions / business plan) before the identity step.
  if (onb.active && !hasCompany) {
    return <OnboardingFlow onb={onb} brand={brand} onAccept={onAcceptPlan} />;
  }

  // Fresh: intro prompt before the founder describes the company.
  if (!hasCompany && !onb.started) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <span className="text-[40px] leading-none" aria-hidden>🌻</span>
        <h2 className="mt-5 font-display text-[24px] font-normal text-[var(--text)]">
          Tell me more about your company
        </h2>
        <p className="mx-auto mt-3 max-w-[34ch] text-[14px] leading-relaxed text-[var(--text-50)]">
          Describe what you&apos;re building and I&apos;ll ask a few questions, draft a plan, then spin up the right agents.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((m, i) => (
        <div key={i} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
          <div
            className={cx(
              "max-w-[88%] rounded-[14px] px-3.5 py-2.5 text-[14px] leading-relaxed",
              m.role === "user"
                ? "bg-[var(--text)] text-white"
                : "bg-white text-[var(--text-80)] shadow-raised",
            )}
          >
            {m.role === "assistant" && (
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-[12px] leading-none" aria-hidden>🌻</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-50)]">Cofounder</span>
              </div>
            )}
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        </div>
      ))}
      {loading && (
        <div className="flex justify-start">
          <div className="rounded-[14px] bg-white px-3.5 py-2.5 shadow-raised">
            <span className="anim-badge-blink font-mono text-[11px] text-[var(--text-50)]">Cofounder is thinking…</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────── Company ──────────────────────── */
function CompanyTab({ brand, customAgents }: { brand: string; customAgents: CustomAgent[] }) {
  const slug = brand.toLowerCase();
  const links = [
    { label: "Staging", value: `staging.${slug}.cofounder.company` },
    { label: "Repository", value: `github.com/Cofounder-Customer-Projects/${slug}` },
    { label: "Vercel", value: `vercel.com/cofounder-customer-projects/${slug}` },
  ];
  return (
    <div>
      <div className="rounded-[12px] bg-white p-1 shadow-raised">
        {links.map((l, i) => (
          <div
            key={l.label}
            className={cx(
              "flex items-center justify-between gap-3 px-3 py-2.5",
              i < links.length - 1 && "border-b border-black/[0.05]",
            )}
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-70)]">{l.label}</span>
            <span className="flex items-center gap-1.5 truncate text-[12.5px] text-[var(--text-50)]">
              <span className="truncate">{l.value}</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-1.5">
        <span className="text-[14px] leading-none" aria-hidden>🌻</span>
        <h3 className="font-display text-[16px] text-[var(--text)]">Agents</h3>
      </div>
      <div className="mt-3 space-y-3">
        {customAgents.map((a, i) => (
          <div key={`c-${i}-${a.name}`} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-[12px] text-[var(--text-80)]">{a.name}</div>
              <div className="truncate text-[12px] leading-snug text-[var(--text-50)]">{a.blurb}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="rounded-[6px] bg-[var(--surface-raised)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-70)] shadow-raised">Edit</span>
              <span className="rounded-[6px] bg-[var(--green-tint)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em] text-[#2c7a3f]">{a.department} · Active</span>
            </div>
          </div>
        ))}
        {AGENTS.map((a) => (
          <div key={a.name} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-[12px] text-[var(--text-80)]">{a.name}</div>
              <div className="truncate text-[12px] leading-snug text-[var(--text-50)]">{a.blurb}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {a.state === "active" ? (
                <>
                  <span className="rounded-[6px] bg-[var(--surface-raised)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-70)] shadow-raised">Edit</span>
                  <span className="rounded-[6px] bg-[var(--green-tint)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em] text-[#2c7a3f]">Manual · Active</span>
                </>
              ) : (
                <span className="rounded-[6px] bg-[var(--surface-raised)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-50)] shadow-raised">Template</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────── Tasks ──────────────────────── */
function TasksTab({ cf, onSelectDepartment }: { cf: UseCofounder; onSelectDepartment: (d: string) => void }) {
  const { tasks, updateTask } = cf;
  const byDept = DEPARTMENTS.map((d) => ({ dept: d, items: tasks.filter((t) => t.department === d) })).filter(
    (g) => g.items.length > 0,
  );
  if (tasks.length === 0) {
    return <p className="text-[13px] text-[var(--text-50)]">No task agents yet. Describe your company below to spin some up.</p>;
  }
  return (
    <div className="space-y-6">
      {byDept.map((g) => (
        <div key={g.dept}>
          <button
            onClick={() => onSelectDepartment(g.dept)}
            className="flex items-center gap-2 rounded-[6px] px-1 py-0.5 -mx-1 transition-colors hover:bg-black/[0.04]"
            title={`Open ${g.dept}`}
          >
            <span className="h-2 w-2 rounded-[2px]" style={{ background: departmentColor(g.dept) }} />
            <span className="font-display text-[15px] text-[var(--text)]">{g.dept}</span>
            <span className="font-mono text-[10px] text-[var(--text-50)]">{g.items.length}</span>
          </button>
          <div className="mt-2 space-y-2">
            {g.items.map((t) => (
              <div key={t.id} className="rounded-[10px] bg-white p-3 shadow-raised">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-[14px] text-[var(--text-80)]">{t.title}</span>
                  <StatusTag status={t.status} />
                </div>
                <p className="mt-1 text-[12.5px] leading-snug text-[var(--text-50)]">{t.detail}</p>
                {t.status === "needs_action" && cf.canEdit && (
                  <div className="mt-2.5 flex gap-2">
                    <button
                      onClick={() => updateTask(t.id, { status: "running" })}
                      className="flex-1 rounded-[7px] py-1.5 font-display text-[12px] font-medium text-white shadow-glossy"
                      style={{ background: "var(--green)" }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateTask(t.id, { status: "todo" })}
                      className="flex-1 rounded-[7px] bg-[#efefec] py-1.5 font-display text-[12px] font-medium text-[var(--text-70)]"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusTag({ status }: { status: Task["status"] }) {
  const map = {
    running: { label: "Running", bg: "#e8f1fd", color: "var(--blue)" },
    needs_action: { label: "Needs action", bg: "#fff0ed", color: "var(--coral)" },
    done: { label: "Done", bg: "var(--green-tint)", color: "#2c7a3f" },
    todo: { label: "To do", bg: "#efefec", color: "var(--text-50)" },
  } as const;
  const m = map[status];
  return (
    <span className="rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.08em]" style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

/* ──────────────────────── Library ──────────────────────── */
function LibraryTab({ cf, vibeId, brand }: { cf: UseCofounder; vibeId: string | null; brand: string }) {
  const { artifacts } = cf;
  const vibe = vibeById(vibeId);
  const collections: { name: string; count: number; cover: string }[] = [];
  if (vibe) collections.push({ name: `${brand} Brand Kit`, count: 1, cover: vibe.board });
  if (artifacts.length > 0) collections.push({ name: "General", count: artifacts.length, cover: LIBRARY_COVERS[0] });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[14px] leading-none" aria-hidden>🌻</span>
          <h3 className="font-display text-[16px] text-[var(--text)]">Library</h3>
        </div>
        <span className="rounded-[7px] bg-white px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-50)] shadow-raised">
          ↑ Upload file
        </span>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-50)]">
        Your agents save their work here and are automatically referenced in future tasks unless archived.
      </p>

      {collections.length === 0 ? (
        <div className="mt-5 grid place-items-center rounded-[14px] border border-dashed border-[var(--text-30)] py-12 text-center">
          <span className="text-[26px] leading-none" aria-hidden>🗂️</span>
          <p className="mt-3 max-w-[28ch] text-[13px] text-[var(--text-50)]">
            Nothing here yet. As your agents produce deliverables, they&apos;ll collect here.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {collections.map((c) => (
            <div key={c.name} className="relative h-[150px] overflow-hidden rounded-[14px] shadow-raised">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
              <div className="absolute bottom-3 left-4">
                <div className="font-display text-[16px] text-white">{c.name}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-white/80">{c.count} item{c.count === 1 ? "" : "s"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────── shared ──────────────────────── */
function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <MonoLabel className={cx("block", className)}>{children}</MonoLabel>;
}
