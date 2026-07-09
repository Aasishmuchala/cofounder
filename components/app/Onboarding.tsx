"use client";

import * as React from "react";
import { cx } from "@/components/ui/primitives";
import { Stepper, MonoLabel } from "@/components/ui/primitives";
import { FOUNDER_NAME } from "@/lib/cofounder-data";
import type { BusinessPlan, ProductProfile, NameCandidate, TaglineCandidate, VibeFit } from "@/lib/onboarding";
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

/* ───────────────────────── Plan-phase stepper (6 steps) ───────────────────────── */
const PLAN_STEPS = ["Idea", "Questions", "Plan", "Profile", "Name", "Tagline"] as const;
function planStepStatus(onb: UseOnboarding): { label: string; status: "done" | "current" | "pending" }[] {
  const order: Record<string, number> = {
    idle: 0,
    asking: 1,
    planning: 2,
    ready: 2,
    profile: 3,
    naming: 4,
    tagline: 5,
    vibe: 5,
    painting: 5,
    brand: 5,
    accepted: 5,
  };
  const idx = order[onb.status] ?? 0;
  return PLAN_STEPS.map((label, i) => {
    let status: "done" | "current" | "pending";
    if (i < idx) status = "done";
    else if (i === idx) status = "current";
    else status = "pending";
    return { label, status };
  });
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
            Accept plan & build my brand →
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Step 4: Product Profile ───────────────────────── */
export function ProductProfileStep({
  onb,
  onBack,
}: {
  onb: UseOnboarding;
  onBack: () => void;
}) {
  const { idea, productProfile, brandOptions, taglineOptions, loading, status } = onb;
  const brand = idea || "your company";

  // Local editable copy — keeps the typing snappy without round-tripping state.
  const [local, setLocal] = React.useState<ProductProfile>(() =>
    productProfile ?? {
      oneLiner: "",
      icp: "",
      wedge: "",
      valueProp: "",
    },
  );

  // Whenever the AI/mock regenerates the profile, sync it in once.
  React.useEffect(() => {
    if (productProfile) setLocal(productProfile);
  }, [productProfile]);

  const fields: { key: keyof ProductProfile; label: string; hint?: string; cap: number }[] = [
    { key: "oneLiner", label: "One-liner", hint: "What the product does and for whom.", cap: 240 },
    { key: "icp", label: "Ideal customer", hint: "Specific role or segment.", cap: 160 },
    { key: "wedge", label: "Wedge", hint: "Why this wins against the alternative.", cap: 240 },
    { key: "valueProp", label: "Value prop", hint: "How it changes the customer's day.", cap: 240 },
  ];

  const ready = local.oneLiner.trim() && local.icp.trim() && local.wedge.trim() && local.valueProp.trim();

  return (
    <div className="space-y-4">
      <Stepper steps={planStepStatus(onb)} title="Build my brand" />

      <div>
        <h2 className="font-display text-[20px] leading-tight text-[var(--text)]">
          Product Profile
        </h2>
        <p className="mt-1 max-w-[44ch] text-[13px] leading-relaxed text-[var(--text-50)]">
          This is the source of truth for every brand artifact. Edit anything,
          regenerate for a fresh take, or accept to move on to your brand name.
        </p>
      </div>

      <div className="rounded-[14px] bg-white p-4 shadow-raised">
        <div className="mb-3 flex items-center justify-between">
          <MonoLabel>{brand}</MonoLabel>
          {status === "naming" && (brandOptions.length > 0 || taglineOptions.length > 0) ? (
            <MonoLabel>
              {(brandOptions.length || 0)} names · {(taglineOptions.length || 0)} taglines ready
            </MonoLabel>
          ) : null}
        </div>
        <div className="space-y-3">
          {fields.map((f) => (
            <label key={f.key} className="block">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--text-50)]">
                  {f.label}
                </span>
                <span className="font-mono text-[8px] text-[var(--text-30)]">
                  {local[f.key].length}/{f.cap}
                </span>
              </div>
              <textarea
                value={local[f.key]}
                onChange={(e) => setLocal((p) => ({ ...p, [f.key]: e.target.value.slice(0, f.cap) }))}
                placeholder={f.hint}
                rows={2}
                className="w-full resize-none rounded-[10px] border border-[var(--border-line)] bg-[var(--surface-deep)] px-3 py-2 font-display text-[13px] leading-snug text-[var(--text)] placeholder:text-[var(--text-30)] outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-[var(--text)]/12"
              />
            </label>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-[10px] bg-white p-3 shadow-raised">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--text-30)] border-t-[var(--text-70)]" />
          <span className="anim-badge-blink font-mono text-[11px] text-[var(--text-50)]">
            Cofounder is drafting names + taglines…
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="rounded-[10px] bg-white px-3 py-2.5 font-display text-[13px] text-[var(--text-70)] shadow-raised transition-colors hover:text-[var(--text)]"
        >
          ← Back to plan
        </button>
        <button
          onClick={() => void onb.regenerateBrand()}
          disabled={loading}
          className="rounded-[10px] bg-white px-3 py-2.5 font-display text-[13px] text-[var(--text-70)] shadow-raised transition-colors hover:text-[var(--text)] disabled:opacity-50"
        >
          Regenerate
        </button>
        <button
          onClick={() => onb.advanceProfile(local)}
          disabled={!ready || loading}
          className="flex-1 rounded-[10px] py-2.5 font-display text-[14px] font-medium text-white shadow-glossy transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--text)" }}
        >
          Accept profile →
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── Step 5: Brand Name ───────────────────────── */
export function BrandNameStep({
  onb,
  onBack,
}: {
  onb: UseOnboarding;
  onBack: () => void;
}) {
  const { brandOptions, taglineOptions, loading } = onb;
  const [custom, setCustom] = React.useState<string>("");
  const [showCustom, setShowCustom] = React.useState(false);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  // Default to the first option if none picked yet
  React.useEffect(() => {
    if (!picked && brandOptions.length > 0) setPicked(brandOptions[0].name);
  }, [brandOptions, picked]);

  const candidates: NameCandidate[] = React.useMemo(() => {
    const list = [...brandOptions];
    if (custom.trim()) {
      const cs = custom.trim();
      const seedTagline = taglineOptions[0]?.text || "Your idea, beautifully named.";
      list.push({
        name: cs,
        tagline: seedTagline,
        rationale: "Your custom name.",
        vibeFit: ["bold"],
      });
    }
    return list;
  }, [brandOptions, custom, taglineOptions]);

  const handlePick = (n: NameCandidate) => {
    setPicked(n.name);
  };

  const primary = picked || custom.trim();
  const canAdvance = primary.trim().length > 0 && !loading;

  return (
    <div className="space-y-4">
      <Stepper steps={planStepStatus(onb)} title="Build my brand" />

      <div>
        <h2 className="font-display text-[20px] leading-tight text-[var(--text)]">
          Pick a brand name
        </h2>
        <p className="mt-1 max-w-[44ch] text-[13px] leading-relaxed text-[var(--text-50)]">
          Cofounder drafted these from your idea + profile. Pick one — or type your own.
        </p>
      </div>

      {loading && candidates.length === 0 ? (
        <div className="flex items-center gap-2 rounded-[10px] bg-white p-3 shadow-raised">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--text-30)] border-t-[var(--text-70)]" />
          <span className="anim-badge-blink font-mono text-[11px] text-[var(--text-50)]">
            Drafting names…
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {candidates.map((c) => {
            const isPicked = picked === c.name;
            const expandedHere = expanded === c.name;
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => handlePick(c)}
                className={cx(
                  "rounded-[12px] bg-white p-3 text-left shadow-raised transition-all",
                  isPicked ? "ring-2 ring-[var(--blue)]" : "ring-1 ring-transparent hover:ring-[var(--border-line)]",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display text-[18px] font-medium leading-tight text-[var(--text)]">
                      {c.name}
                    </div>
                    {c.tagline && (
                      <div className="mt-0.5 truncate font-display text-[12.5px] text-[var(--text-70)]">
                        {c.tagline}
                      </div>
                    )}
                  </div>
                  {isPicked && (
                    <span
                      aria-hidden
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-white"
                      style={{ background: "var(--blue)", fontSize: 11 }}
                    >
                      ✓
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    {c.vibeFit.map((v) => (
                      <span
                        key={v}
                        className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.06em] text-[var(--text-50)] shadow-raised"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded(expandedHere ? null : c.name);
                    }}
                    className="font-mono text-[8px] uppercase tracking-[0.06em] text-[var(--blue)] hover:underline"
                  >
                    {expandedHere ? "Hide why" : "Why this fits"}
                  </button>
                </div>
                {expandedHere && (
                  <p className="mt-2 rounded-[8px] bg-[var(--surface-raised)] p-2 text-[11.5px] leading-relaxed text-[var(--text-50)]">
                    {c.rationale}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Custom name input */}
      <div>
        {!showCustom ? (
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className="w-full rounded-[10px] bg-white px-3 py-2.5 text-left font-display text-[13px] text-[var(--text-70)] shadow-raised transition-colors hover:text-[var(--text)]"
          >
            Or type your own name →
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-[10px] bg-white p-2 shadow-raised">
            <input
              autoFocus
              value={custom}
              onChange={(e) => setCustom(e.target.value.slice(0, 40))}
              placeholder="Your brand name"
              className="flex-1 bg-transparent px-2 py-1 font-display text-[14px] text-[var(--text)] placeholder:text-[var(--text-30)] outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setCustom("");
                setShowCustom(false);
              }}
              className="font-mono text-[9px] uppercase text-[var(--text-50)] hover:text-[var(--text)]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="rounded-[10px] bg-white px-3 py-2.5 font-display text-[13px] text-[var(--text-70)] shadow-raised transition-colors hover:text-[var(--text)]"
        >
          ← Back
        </button>
        <button
          onClick={() => void onb.regenerateBrand()}
          disabled={loading}
          className="rounded-[10px] bg-white px-3 py-2.5 font-display text-[13px] text-[var(--text-70)] shadow-raised transition-colors hover:text-[var(--text)] disabled:opacity-50"
        >
          Regenerate (5 more)
        </button>
        <button
          onClick={() => {
            const useCustom = custom.trim() && picked === custom.trim();
            const candidate = useCustom
              ? {
                  name: custom.trim(),
                  tagline: taglineOptions[0]?.text || "",
                  rationale: "Your custom name.",
                  vibeFit: ["bold" as VibeFit],
                }
              : candidates.find((c) => c.name === picked) || { name: picked ?? "", vibeFit: [] as VibeFit[] };
            onb.advanceName(candidate);
          }}
          disabled={!canAdvance}
          className="flex-1 rounded-[10px] py-2.5 font-display text-[14px] font-medium text-white shadow-glossy transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--text)" }}
        >
          Pick &quot;{primary || "…"}&quot; →
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── Step 6: Tagline ───────────────────────── */
export function TaglineStep({
  onb,
  onBack,
}: {
  onb: UseOnboarding;
  onBack: () => void;
}) {
  const { brandOptions, taglineOptions, brandName } = onb;
  const seedTagline = React.useMemo(() => {
    const fromName = brandOptions.find((n) => n.name === brandName)?.tagline;
    return fromName ?? taglineOptions[0]?.text ?? "Your idea, beautifully named.";
  }, [brandOptions, taglineOptions, brandName]);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [custom, setCustom] = React.useState<string>(seedTagline);
  const [showCustom, setShowCustom] = React.useState(false);

  const options: TaglineCandidate[] = React.useMemo(() => {
    const list = [...taglineOptions];
    if (custom.trim() && !list.some((t) => t.text === custom.trim())) {
      list.push({ text: custom.trim(), tone: "Custom" });
    }
    return list;
  }, [taglineOptions, custom]);

  React.useEffect(() => {
    if (!picked && options.length > 0) setPicked(options[0].text);
  }, [options, picked]);

  const primary = picked || custom.trim();
  const canAdvance = primary.trim().length > 0;

  return (
    <div className="space-y-4">
      <Stepper steps={planStepStatus(onb)} title="Build my brand" />

      <div>
        <h2 className="font-display text-[20px] leading-tight text-[var(--text)]">
          Pick a tagline
        </h2>
        <p className="mt-1 max-w-[44ch] text-[13px] leading-relaxed text-[var(--text-50)]">
          One line that goes under <strong className="text-[var(--text)]">{brandName || "your name"}</strong>.
          Pick one — or write your own.
        </p>
      </div>

      <div className="space-y-2">
        {options.map((t) => {
          const isPicked = picked === t.text;
          return (
            <button
              key={t.text}
              type="button"
              onClick={() => setPicked(t.text)}
              className={cx(
                "w-full rounded-[12px] bg-white p-3 text-left shadow-raised transition-all",
                isPicked ? "ring-2 ring-[var(--blue)]" : "ring-1 ring-transparent hover:ring-[var(--border-line)]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-[15px] text-[var(--text)]">{t.text}</span>
                <span
                  className="font-mono text-[8px] uppercase tracking-[0.06em]"
                  style={{ color: isPicked ? "var(--blue)" : "var(--text-50)" }}
                >
                  {t.tone}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {!showCustom ? (
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className="w-full rounded-[10px] bg-white px-3 py-2.5 text-left font-display text-[13px] text-[var(--text-70)] shadow-raised transition-colors hover:text-[var(--text)]"
        >
          Or write your own tagline →
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-[10px] bg-white p-2 shadow-raised">
          <input
            autoFocus
            value={custom}
            onChange={(e) => setCustom(e.target.value.slice(0, 160))}
            placeholder="Your tagline"
            className="flex-1 bg-transparent px-2 py-1 font-display text-[14px] text-[var(--text)] placeholder:text-[var(--text-30)] outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setCustom(seedTagline);
              setShowCustom(false);
            }}
            className="font-mono text-[9px] uppercase text-[var(--text-50)] hover:text-[var(--text)]"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="rounded-[10px] bg-white px-3 py-2.5 font-display text-[13px] text-[var(--text-70)] shadow-raised transition-colors hover:text-[var(--text)]"
        >
          ← Back to name
        </button>
        <button
          onClick={() => {
            const candidate: TaglineCandidate = {
              text: primary,
              tone: options.find((o) => o.text === primary)?.tone || "Custom",
            };
            onb.advanceTagline(candidate);
          }}
          disabled={!canAdvance}
          className="flex-1 rounded-[10px] py-2.5 font-display text-[14px] font-medium text-white shadow-glossy transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--text)" }}
        >
          Pick &quot;{primary || "…"}&quot; →
        </button>
      </div>
    </div>
  );
}