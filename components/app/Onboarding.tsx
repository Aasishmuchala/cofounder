"use client";

import * as React from "react";
import { cx } from "@/components/ui/primitives";
import { FOUNDER_NAME } from "@/lib/cofounder-data";
import type { BusinessPlan } from "@/lib/onboarding";
import type { UseOnboarding } from "@/lib/use-onboarding";

function DocIcon() {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-white shadow-raised">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.6">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
        <path d="M14 3v5h5M8.5 13h7M8.5 16.5h5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/* ───────────────────────── Business Plan card ───────────────────────── */
export function BusinessPlanCard({
  plan,
  brand,
  accepted,
}: {
  plan: BusinessPlan;
  brand: string;
  accepted?: boolean;
}) {
  return (
    <div className="rounded-[14px] bg-white p-4 shadow-raised">
      <div className="mb-3 flex items-center gap-2.5">
        <DocIcon />
        <div>
          <div className="font-display text-[16px] text-[var(--text)]">Business Plan</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-50)]">
            {brand} · {FOUNDER_NAME}
          </div>
        </div>
      </div>

      <div className="rounded-[10px] bg-[var(--surface-raised)] p-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--blue)]">Company Values</span>
        <ul className="mt-1.5 space-y-1.5">
          {plan.values.map((v, i) => (
            <li key={i} className="flex gap-2 text-[13px] leading-snug text-[var(--text-70)]">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--text-30)]" />
              <span>{v}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-2.5 rounded-[10px] bg-[var(--surface-raised)] p-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--green)]">Go-To-Market Strategy</span>
        <ul className="mt-1.5 space-y-2">
          {plan.gtm.map((g, i) => (
            <li key={i} className="text-[13px] leading-snug text-[var(--text-70)]">
              <strong className="font-semibold text-[var(--text)]">{g.label}:</strong> {g.text}
            </li>
          ))}
        </ul>
      </div>

      {accepted && (
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[var(--text-70)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2c7a3f" strokeWidth="2.4">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-display text-[13px]">Business Plan Accepted</span>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Onboarding flow ───────────────────────── */
export function OnboardingFlow({
  onb,
  brand,
  onAccept,
}: {
  onb: UseOnboarding;
  brand: string;
  onAccept: () => void;
}) {
  const { status, questions, answers, plan, loading, allAnswered, answer, buildPlan } = onb;

  // Auto-generate the plan once every question is answered.
  React.useEffect(() => {
    if (allAnswered && status === "asking") void buildPlan();
  }, [allAnswered, status, buildPlan]);

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <DocIcon />
          <div>
            <div className="font-display text-[18px] text-[var(--text)]">Onboarding</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-50)]">
              {brand} · {FOUNDER_NAME}
            </div>
          </div>
        </div>
        <button
          onClick={onAccept}
          className="rounded-[8px] bg-white px-2.5 py-1.5 font-display text-[12px] text-[var(--text-70)] shadow-raised transition-colors hover:text-[var(--text)]"
        >
          Skip onboarding →
        </button>
      </div>

      {/* questions */}
      {questions.length === 0 && loading ? (
        <p className="anim-badge-blink font-mono text-[12px] text-[var(--text-50)]">
          Cofounder is preparing a few questions…
        </p>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => {
            const picked = answers[q.id];
            return (
              <div key={q.id} className="rounded-[12px] bg-white p-3.5 shadow-raised">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-[14px] leading-snug text-[var(--text)]">{q.prompt}</span>
                  {picked && (
                    <span className="shrink-0 rounded-[6px] bg-[var(--green-tint)] px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.08em] text-[#2c7a3f]">
                      Answered
                    </span>
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {q.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => answer(q.id, opt)}
                      className={cx(
                        "rounded-full px-3 py-1.5 text-left font-display text-[12.5px] transition-colors",
                        picked === opt
                          ? "bg-[var(--text)] text-white"
                          : "surface-gradient-chip text-[var(--text-70)] hover:text-[var(--text)]",
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* planning / plan */}
      {status === "planning" && (
        <div className="flex items-center gap-2 rounded-[12px] bg-white p-3.5 shadow-raised">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--text-30)] border-t-[var(--text-70)]" />
          <span className="font-display text-[13px] text-[var(--text-70)]">
            Building your business context and plan…
          </span>
        </div>
      )}

      {status === "ready" && plan && (
        <div className="space-y-3">
          <BusinessPlanCard plan={plan} brand={brand} />
          <button
            onClick={onAccept}
            className="w-full rounded-[12px] py-3 font-display text-[15px] font-medium text-white shadow-glossy transition-opacity hover:opacity-90"
            style={{ background: "var(--text)" }}
          >
            Accept business plan & spin up the company
          </button>
        </div>
      )}
    </div>
  );
}
