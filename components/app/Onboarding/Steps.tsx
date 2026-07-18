"use client";

import * as React from "react";
import { cx } from "@/components/ui/primitives";
import { BusinessPlanCard } from "@/components/app/Onboarding";
import { BrandKitCard } from "@/components/app/Identity";
import { VIBES, vibeById } from "@/lib/vibes";
import type { UseOnboarding } from "@/lib/use-onboarding";
import type { ProductProfile, NameCandidate, TaglineCandidate, VibeFit } from "@/lib/onboarding";

/* ───────────────────────── Shared layout pieces ───────────────────────── */
export function StepHeader({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {icon && (
        <div className="mb-3 grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--green-tint)]">
          {icon}
        </div>
      )}
      <h1 className="font-display text-[26px] font-medium leading-tight tracking-[-0.01em] text-[var(--text)] md:text-[30px]">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 max-w-[55ch] font-display text-[14px] leading-relaxed text-[var(--text-50)]">
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ───────────────────────── Step 1: Idea ───────────────────────── */
export function StepIdea({
  onb,
  initial,
}: {
  onb: UseOnboarding;
  initial?: string;
}) {
  const [idea, setIdea] = React.useState(initial ?? "");
  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = idea.trim();
    if (!text) return;
    void onb.start(text);
  };
  return (
    <div>
      <StepHeader
        title="What are you building?"
        subtitle="One line — what does the company do and for whom? You can change this later."
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        }
      />
      <textarea
        autoFocus
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e as unknown as React.FormEvent);
        }}
        rows={4}
        placeholder="e.g. An AI-native invoicing tool for freelance designers in India"
        className="w-full resize-none rounded-[14px] border border-[var(--border-line)] bg-white px-4 py-3 font-display text-[15px] leading-relaxed text-[var(--text)] placeholder:text-[var(--text-30)] outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-[var(--text)]/12"
      />
      <div className="mt-2 flex items-center justify-between text-[var(--text-50)]">
        <span className="font-mono text-[10px] uppercase tracking-[0.06em]">⌘ ↵ to start</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.06em]">{idea.length}/240</span>
      </div>
      {/* Hidden submit so the form works */}
      <button type="button" onClick={() => submit()} className="hidden" aria-hidden />
    </div>
  );
}

/* ───────────────────────── Step 2: Questions (one at a time) ───────────────────────── */
export function StepQuestions({ onb }: { onb: UseOnboarding }) {
  const {
    questions,
    answers,
    answer,
    loading,
    allAnswered,
    buildPlan,
    questionsAreMock,
    questionsMockReason,
    retryQuestions,
  } = onb;

  // Render one question per screen. Track local index; auto-advance when all
  // are answered (existing useCofounder.buildPlan triggers via status="asking").
  const [idx, setIdx] = React.useState(0);

  // Expose advance/back to the parent (modal Continue button) via a hidden
  // button + data attr, so the modal's footer Continue/Back can drive flow.
  const advanceRef = React.useRef<HTMLButtonElement>(null);

  // Clamp `idx` defensively (questions might shrink on a retry) — derived
  // from `questions.length`, no effect needed.
  const safeIdx = Math.min(idx, Math.max(0, questions.length - 1));

  if (loading || questions.length === 0) {
    return (
      <div>
        <StepHeader
          title="Drafting questions for your idea…"
          subtitle="Cofounder is reading your idea and writing the sharpest 5 it can."
        />
        <ProgressRail idx={0} total={5} />
        <div className="mt-8 flex items-center gap-2.5">
          <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--text)]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-50)]">
            thinking
          </span>
        </div>
      </div>
    );
  }

  const q = questions[safeIdx];
  const picked = answers[q.id];
  const isLast = safeIdx + 1 >= questions.length;
  const canAdvance = Boolean(picked);

  // Local "advance" handler — moves to next question OR builds the plan when
  // the last question is answered. buildPlan() flips status to "planning" then
  // "ready", which the parent page reactively renders.
  const advance = () => {
    if (!picked) return;
    if (isLast) {
      if (allAnswered) void buildPlan();
      return;
    }
    setIdx(safeIdx + 1);
  };

  const back = () => {
    if (safeIdx > 0) setIdx(safeIdx - 1);
  };

  return (
    <div data-test="step-questions">
      {/* Mock-fallback notice: surfaces only when the questions came from the
          deterministic fallback (no key, parse failure, or transport error).
          Dismissable + retryable — never silent. */}
      {questionsAreMock && (
        <MockNotice
          reason={questionsMockReason}
          onRetry={() => void retryQuestions()}
          retrying={loading}
        />
      )}

      <div className="mb-1.5 flex items-center justify-between">
        <ProgressRail idx={safeIdx} total={questions.length} />
      </div>

      <h1
        className="font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-[var(--text)] md:text-[34px]"
        key={q.id /* re-mount on question change so the entrance replays */}
      >
        {q.prompt}
      </h1>
      <p className="mt-2.5 max-w-[52ch] font-display text-[13.5px] leading-relaxed text-[var(--text-50)]">
        Pick the position that fits best — there&apos;s no wrong answer, just a starting point for the plan.
      </p>

      {/* Stacked option rows: each is a position the founder takes. Picked
          state fills ink and shows a small check; unpicked rows are quiet
          cards with a hover lift. */}
      <ul className="mt-6 flex flex-col gap-2.5">
        {q.options.map((opt, i) => {
          const isPicked = picked === opt;
          return (
            <li
              key={`${q.id}-${opt}`}
              className="hf-q-enter"
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <button
                type="button"
                onClick={() => answer(q.id, opt)}
                aria-pressed={isPicked}
                className={cx(
                  "group flex w-full items-center gap-3 rounded-[12px] border px-4 py-3.5 text-left transition-all duration-200",
                  isPicked
                    ? "border-[var(--text)] bg-[var(--text)] text-white shadow-[0_2px_12px_rgba(0,0,0,0.18)]"
                    : "border-[var(--border-line)] bg-[var(--surface-raised)] text-[var(--text-80)] hover:-translate-y-[1px] hover:border-[var(--text-50)] hover:text-[var(--text)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)]",
                )}
              >
                <span
                  aria-hidden
                  className={cx(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-all duration-200",
                    isPicked
                      ? "border-white bg-white"
                      : "border-[var(--text-30)] group-hover:border-[var(--text-50)]",
                  )}
                >
                  {isPicked ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="3" aria-hidden>
                      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </span>
                <span className="flex-1 font-display text-[15px] leading-snug">{opt}</span>
                <span
                  className={cx(
                    "font-mono text-[10px] uppercase tracking-[0.1em] transition-colors",
                    isPicked ? "text-white/70" : "text-[var(--text-30)] group-hover:text-[var(--text-50)]",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Inline mini-nav — the modal footer Continue button drives the same
          advance via the hidden button below. */}
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={back}
          disabled={safeIdx === 0}
          className="font-display text-[12.5px] text-[var(--text-50)] transition-colors hover:text-[var(--text)] disabled:opacity-30"
        >
          ← back
        </button>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-30)]">
          {safeIdx + 1} / {questions.length}
        </span>
        <button
          type="button"
          onClick={advance}
          disabled={!canAdvance}
          className="font-display text-[12.5px] text-[var(--text-70)] transition-colors hover:text-[var(--text)] disabled:opacity-30"
        >
          {isLast ? "build plan →" : "next →"}
        </button>
      </div>
      {/* Hidden Continue trigger — the modal footer Continue clicks this. */}
      <button
        ref={advanceRef}
        type="button"
        onClick={advance}
        disabled={!canAdvance}
        data-questions-advance
        style={{ display: "none" }}
        aria-hidden
      />

      {/* scoped keyframes for the option entrance + the rail fill */}
      <style>{`
        @keyframes hf-q-enter {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hf-q-enter { animation: hf-q-enter 320ms cubic-bezier(0.22, 1, 0.36, 1) backwards; }
        @media (prefers-reduced-motion: reduce) {
          .hf-q-enter { animation: none; }
        }
      `}</style>
    </div>
  );
}

/* ──── The progress rail: a single hairline split into N segments, the
        current + all completed segments filled with ink. Segments-to-the-left
        of idx are filled (the founder has answered those); the current
        segment is filled with a slightly lighter shade; the rest are empty
        hairlines. ──── */
function ProgressRail({ idx, total }: { idx: number; total: number }) {
  const safeTotal = Math.max(1, total);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-valuenow={idx + 1}
      aria-label={`Question ${idx + 1} of ${safeTotal}`}
      className="flex w-full items-center gap-1.5"
    >
      {Array.from({ length: safeTotal }).map((_, i) => {
        const done = i < idx;
        const here = i === idx;
        return (
          <span
            key={i}
            className={cx(
              "h-[3px] flex-1 rounded-full transition-colors duration-300",
              done ? "bg-[var(--text)]" : here ? "bg-[var(--text-70)]" : "bg-[var(--border-line)]",
            )}
          />
        );
      })}
      <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-50)]">
        {idx + 1} / {safeTotal}
      </span>
    </div>
  );
}

/* ──── Map a fallback reason from the API to a specific, actionable
        message. The single most-common cause (the user's shell already
        exports ANTHROPIC_BASE_URL, hijacking the SDK's apiKey path) is
        called out so they don't have to guess. ──── */
function reasonCopy(reason: string | null | undefined): { title: string; body: string; retryable: boolean } {
  switch (reason) {
    case "no_credential":
      return {
        title: "No AI key configured.",
        body: "Set ANTHROPIC_API_KEY (or HELM_ANTHROPIC_API_KEY) in .env.local and restart the server.",
        retryable: false,
      };
    case "auth_rejected":
      return {
        title: "The AI provider rejected the key.",
        body: "Check that the key in .env.local is valid and has access to claude-opus-4-8 on this gateway.",
        retryable: false,
      };
    case "not_found":
      return {
        title: "AI endpoint not reachable.",
        body: "Your shell may have set ANTHROPIC_BASE_URL — try the HELM_ANTHROPIC_* overrides in .env.local, or unset the base URL.",
        retryable: false,
      };
    case "rate_limited":
      return {
        title: "Rate limited by the AI provider.",
        body: "Wait a moment and retry — the provider asked us to slow down.",
        retryable: true,
      };
    case "upstream_5xx":
      return {
        title: "The AI provider returned a server error.",
        body: "Retry in a few seconds. Your idea and answers are safe.",
        retryable: true,
      };
    case "timeout":
      return {
        title: "The AI call timed out.",
        body: "The provider is slow or unreachable. Retry, or raise HELM_ANTHROPIC_TIMEOUT_MS in .env.local.",
        retryable: true,
      };
    case "network":
      return {
        title: "Couldn&apos;t reach the AI provider.",
        body: "Check your network connection and retry.",
        retryable: true,
      };
    case "empty_response":
    case "parse_failed":
    default:
      return {
        title: "Using a generic template — Cofounder couldn&apos;t draft questions tailored to your idea.",
        body: "Your answers will still work, but a tailored plan usually fits better. Try once more?",
        retryable: true,
      };
  }
}

/* ──── The mock-fallback notice: surfaces when questions came from the
        deterministic fallback. Title + body are tailored to the specific
        failure reason from the API so the founder can act on it. ──── */
function MockNotice({
  reason,
  onRetry,
  retrying,
}: {
  reason: string | null | undefined;
  onRetry: () => void;
  retrying: boolean;
}) {
  const { title, body, retryable } = reasonCopy(reason);
  return (
    <div
      role="status"
      className="mb-5 flex items-start gap-3 rounded-[10px] border border-[var(--coral)]/30 bg-[var(--coral-tint)]/60 px-4 py-3"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--coral)" strokeWidth="2" aria-hidden className="mt-0.5 shrink-0">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
      </svg>
      <div className="flex-1">
        <p className="font-display text-[13px] font-medium leading-snug text-[var(--text)]">
          {title}
        </p>
        <p className="mt-1 font-display text-[12px] leading-snug text-[var(--text-70)]">
          {body}
        </p>
      </div>
      {retryable && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex h-[28px] shrink-0 items-center rounded-[7px] border border-[var(--coral)]/40 bg-white px-2.5 font-display text-[12px] text-[var(--coral)] transition-colors hover:border-[var(--coral)] hover:bg-[var(--coral)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {retrying ? "Retrying…" : "Retry"}
        </button>
      )}
    </div>
  );
}

/* ───────────────────────── Step 3: Plan ───────────────────────── */
export function StepPlan({ onb }: { onb: UseOnboarding }) {
  const { plan, loading, idea } = onb;
  if (loading || !plan) {
    return (
      <div>
        <StepHeader
          title="Drafting your business plan…"
          subtitle="Cofounder is turning your answers into a tight business context."
        />
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--text-30)] border-t-[var(--text-70)]" />
          <span className="anim-badge-blink font-mono text-[12px] text-[var(--text-50)]">
            generating…
          </span>
        </div>
      </div>
    );
  }
  return (
    <div>
      <StepHeader
        title="Here's your business plan"
        subtitle="Built from your idea and answers. Review it, then continue."
      />
      <BusinessPlanCard plan={plan} brand={idea || "your company"} />
    </div>
  );
}

/* ───────────────────────── Step 4: Product Profile ───────────────────────── */
export function StepProfile({ onb }: { onb: UseOnboarding }) {
  const { productProfile, loading } = onb;
  const [local, setLocal] = React.useState<ProductProfile>(
    () =>
      productProfile ?? {
        oneLiner: "",
        icp: "",
        wedge: "",
        valueProp: "",
      },
  );
  React.useEffect(() => {
    if (productProfile) setLocal(productProfile);
  }, [productProfile]);

  const fields: { key: keyof ProductProfile; label: string; hint: string; cap: number }[] = [
    { key: "oneLiner", label: "One-liner", hint: "What the product does and for whom.", cap: 240 },
    { key: "icp", label: "Ideal customer", hint: "Specific role or segment.", cap: 160 },
    { key: "wedge", label: "Wedge", hint: "Why this wins against the alternative.", cap: 240 },
    { key: "valueProp", label: "Value prop", hint: "How it changes the customer's day.", cap: 240 },
  ];

  return (
    <div>
      <StepHeader
        title="Your product profile"
        subtitle="Generated from your idea + answers. Edit anything or accept as-is."
      />
      <div className="space-y-4">
        {fields.map((f) => (
          <label key={f.key} className="block">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-50)]">
                {f.label}
              </span>
              <span className="font-mono text-[10px] text-[var(--text-30)]">
                {local[f.key].length}/{f.cap}
              </span>
            </div>
            <textarea
              value={local[f.key]}
              onChange={(e) =>
                setLocal((p) => ({ ...p, [f.key]: e.target.value.slice(0, f.cap) }))
              }
              placeholder={f.hint}
              rows={2}
              className="w-full resize-none rounded-[10px] border border-[var(--border-line)] bg-white px-3 py-2 font-display text-[13px] leading-snug text-[var(--text)] placeholder:text-[var(--text-30)] outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-[var(--text)]/12"
            />
          </label>
        ))}
      </div>
      {loading && (
        <div className="mt-3 flex items-center gap-2 text-[var(--text-50)]">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--text-30)] border-t-[var(--text-70)]" />
          <span className="anim-badge-blink font-mono text-[11px]">
            Cofounder is drafting names + taglines…
          </span>
        </div>
      )}
      {/* Expose the local profile via a hidden setter for the modal's Continue */}
      <button
        type="button"
        onClick={() => onb.advanceProfile(local)}
        style={{ display: "none" }}
        aria-hidden
        data-profile-accept
      />
    </div>
  );
}

/* ───────────────────────── Step 5: Name ───────────────────────── */
export function StepName({ onb }: { onb: UseOnboarding }) {
  const { brandOptions, taglineOptions } = onb;
  const [picked, setPicked] = React.useState<string | null>(null);
  const [custom, setCustom] = React.useState<string>("");
  const [showCustom, setShowCustom] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!picked && brandOptions.length > 0) setPicked(brandOptions[0].name);
  }, [brandOptions, picked]);

  const candidates: NameCandidate[] = React.useMemo(() => {
    const list = [...brandOptions];
    if (custom.trim()) {
      const cs = custom.trim();
      list.push({
        name: cs,
        tagline: taglineOptions[0]?.text || "Your idea, beautifully named.",
        rationale: "Your custom name.",
        vibeFit: ["bold" as VibeFit],
      });
    }
    return list;
  }, [brandOptions, custom, taglineOptions]);

  const primary = picked || custom.trim();

  // Wire the pick action to a hidden button the modal Continue can fire.
  React.useEffect(() => {
    const btn = document.querySelector<HTMLButtonElement>("[data-name-accept]");
    if (!btn) return;
    btn.onclick = () => {
      const useCustom = custom.trim() && picked === custom.trim();
      const candidate: NameCandidate = useCustom
        ? {
            name: custom.trim(),
            tagline: taglineOptions[0]?.text || "",
            rationale: "Your custom name.",
            vibeFit: ["bold" as VibeFit],
          }
        : candidates.find((c) => c.name === picked) || {
            name: picked ?? "",
            tagline: "",
            rationale: "",
            vibeFit: [] as VibeFit[],
          };
      onb.advanceName(candidate);
    };
  }, [picked, custom, candidates, taglineOptions, onb]);

  return (
    <div>
      <StepHeader
        title="Pick your brand name"
        subtitle={`Cofounder drafted ${brandOptions.length} candidates from your idea + answers. Pick one — or type your own.`}
      />
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {candidates.map((c) => {
          const isPicked = picked === c.name;
          const expandedHere = expanded === c.name;
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => setPicked(c.name)}
              className={cx(
                "relative rounded-[12px] bg-white p-3.5 text-left shadow-raised transition-all",
                isPicked
                  ? "ring-2 ring-[var(--blue)]"
                  : "ring-1 ring-transparent hover:ring-[var(--border-line)]",
              )}
            >
              {isPicked && (
                <span
                  className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full text-white"
                  style={{ background: "var(--blue)", fontSize: 11 }}
                  aria-hidden
                >
                  ✓
                </span>
              )}
              <div className="font-display text-[19px] font-medium leading-tight text-[var(--text)]">
                {c.name}
              </div>
              {c.tagline && (
                <div className="mt-0.5 truncate font-display text-[12.5px] text-[var(--text-70)]">
                  {c.tagline}
                </div>
              )}
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {c.vibeFit.slice(0, 3).map((v) => (
                    <span
                      key={v}
                      className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.06em] text-[var(--text-50)]"
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
                  {expandedHere ? "hide why" : "why this fits"}
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
      <div className="mt-3">
        {!showCustom ? (
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className="w-full rounded-[10px] border border-dashed border-[var(--border-line)] bg-transparent px-3 py-2.5 text-left font-display text-[13px] text-[var(--text-70)] hover:border-[var(--text-50)] hover:text-[var(--text)]"
          >
            Or type your own name →
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-[10px] border border-[var(--border-line)] bg-white px-3 py-2">
            <input
              autoFocus
              value={custom}
              onChange={(e) => setCustom(e.target.value.slice(0, 40))}
              placeholder="Your brand name"
              className="flex-1 bg-transparent font-display text-[14px] text-[var(--text)] placeholder:text-[var(--text-30)] outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setCustom("");
                setShowCustom(false);
              }}
              className="font-mono text-[9px] uppercase text-[var(--text-50)] hover:text-[var(--text)]"
            >
              cancel
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onb.regenerateBrand({ keepProfile: true })}
        className="mt-2 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-50)] hover:text-[var(--text)]"
      >
        ↻ Regenerate (5 more)
      </button>
      <button
        type="button"
        onClick={() => {
          const useCustom = custom.trim() && picked === custom.trim();
          const candidate: NameCandidate = useCustom
            ? {
                name: custom.trim(),
                tagline: taglineOptions[0]?.text || "",
                rationale: "Your custom name.",
                vibeFit: ["bold" as VibeFit],
              }
            : candidates.find((c) => c.name === picked) || {
                name: picked ?? "",
                tagline: "",
                rationale: "",
                vibeFit: [] as VibeFit[],
              };
          onb.advanceName(candidate);
        }}
        style={{ display: "none" }}
        aria-hidden
        data-name-accept
      />
      <span className="hidden" aria-hidden>{primary}</span>
    </div>
  );
}

/* ───────────────────────── Step 6: Tagline ───────────────────────── */
export function StepTagline({ onb }: { onb: UseOnboarding }) {
  const { taglineOptions, brandName, brandOptions } = onb;
  const seedTagline = React.useMemo(() => {
    const fromName = brandOptions.find((n) => n.name === brandName)?.tagline;
    return fromName ?? taglineOptions[0]?.text ?? "Your idea, beautifully named.";
  }, [brandOptions, taglineOptions, brandName]);

  const [picked, setPicked] = React.useState<string | null>(null);
  const [custom, setCustom] = React.useState<string>(seedTagline);
  const [showCustom, setShowCustom] = useShowCustom();

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

  React.useEffect(() => {
    const btn = document.querySelector<HTMLButtonElement>("[data-tagline-accept]");
    if (!btn) return;
    btn.onclick = () => {
      const candidate: TaglineCandidate = {
        text: primary,
        tone: options.find((o) => o.text === primary)?.tone || "Custom",
      };
      onb.advanceTagline(candidate);
    };
  }, [primary, options, onb]);

  return (
    <div>
      <StepHeader
        title="Pick a tagline"
        subtitle={`One line that goes under your brand name: ${brandName ?? ""}.`}
      />
      <div className="space-y-2">
        {options.map((t) => {
          const isPicked = picked === t.text;
          return (
            <button
              key={t.text}
              type="button"
              onClick={() => setPicked(t.text)}
              className={cx(
                "flex w-full items-center justify-between gap-3 rounded-[12px] bg-white p-4 text-left shadow-raised transition-all",
                isPicked
                  ? "ring-2 ring-[var(--blue)]"
                  : "ring-1 ring-transparent hover:ring-[var(--border-line)]",
              )}
            >
              <span className="font-display text-[16px] text-[var(--text)]">{t.text}</span>
              <span
                className="font-mono text-[9px] uppercase tracking-[0.06em]"
                style={{ color: isPicked ? "var(--blue)" : "var(--text-50)" }}
              >
                {t.tone}
              </span>
            </button>
          );
        })}
      </div>
      {!showCustom ? (
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className="mt-3 w-full rounded-[10px] border border-dashed border-[var(--border-line)] bg-transparent px-3 py-2.5 text-left font-display text-[13px] text-[var(--text-70)] hover:border-[var(--text-50)] hover:text-[var(--text)]"
        >
          Or write your own tagline →
        </button>
      ) : (
        <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-[var(--border-line)] bg-white px-3 py-2">
          <input
            autoFocus
            value={custom}
            onChange={(e) => setCustom(e.target.value.slice(0, 160))}
            placeholder="Your tagline"
            className="flex-1 bg-transparent font-display text-[14px] text-[var(--text)] placeholder:text-[var(--text-30)] outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setCustom(seedTagline);
              setShowCustom(false);
            }}
            className="font-mono text-[9px] uppercase text-[var(--text-50)] hover:text-[var(--text)]"
          >
            cancel
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          const candidate: TaglineCandidate = {
            text: primary,
            tone: options.find((o) => o.text === primary)?.tone || "Custom",
          };
          onb.advanceTagline(candidate);
        }}
        style={{ display: "none" }}
        aria-hidden
        data-tagline-accept
      />
    </div>
  );
}

// Hook helper — kept inline since it's tiny and used only here.
function useShowCustom() {
  return React.useState(false);
}

/* ───────────────────────── Step 7: Vibe ───────────────────────── */
const VIBE_TOKEN_MAP: Record<string, string> = {
  minimal: "pastel-utility",
  bold: "brutalist-grid",
  playful: "soft-pop",
  premium: "editorial-mint",
  technical: "saturated-tech",
};

export function StepVibe({ onb }: { onb: UseOnboarding }) {
  const { userVibeFit, brandName, chooseVibe } = onb;
  const recommendedIds: string[] = React.useMemo(() => {
    if (userVibeFit.length === 0) return [];
    return userVibeFit.map((t) => VIBE_TOKEN_MAP[t]).filter((id): id is string => Boolean(id));
  }, [userVibeFit]);

  const ordered = React.useMemo(() => {
    if (recommendedIds.length === 0) return [...VIBES];
    const recommended = VIBES.filter((v) => recommendedIds.includes(v.id));
    const rest = VIBES.filter((v) => !recommendedIds.includes(v.id));
    return [...recommended, ...rest];
  }, [recommendedIds]);

  return (
    <div>
      <StepHeader
        title="Pick a visual style"
        subtitle={`How should ${brandName ?? "your brand"} look? Pick a starting point — Cofounder will paint the rest.`}
      />
      {recommendedIds.length > 0 && (
        <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--blue)]">
          · Recommended for {brandName}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        {ordered.map((v) => {
          const isRecommended = recommendedIds.includes(v.id);
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => chooseVibe(v.id)}
              className="group relative overflow-hidden rounded-[12px] bg-white text-left shadow-raised transition-shadow hover:shadow-deep"
            >
              {isRecommended && (
                <span
                  aria-hidden
                  className="absolute right-1.5 top-1.5 z-10 h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--blue)" }}
                />
              )}
              <div className="relative h-[80px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.board}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-2.5">
                <div className="font-display text-[13px] text-[var(--text)]">{v.name}</div>
                <div className="mt-0.5 flex items-center gap-1">
                  {v.palette.slice(0, 4).map((c) => (
                    <span
                      key={c}
                      className="h-2.5 w-2.5 rounded-[3px] ring-1 ring-black/5"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── Step 8: Painting ───────────────────────── */
export function StepPainting({ onb }: { onb: UseOnboarding }) {
  const vibe = vibeById(onb.vibeId);
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 1600);
    const t2 = setTimeout(() => setStep(2), 3200);
    const t3 = setTimeout(() => onb.markBrandReady(), 4800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onb]);
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div
        className="mb-4 h-[140px] w-full max-w-[400px] overflow-hidden rounded-[12px]"
        style={{ background: vibe?.palette[0] ?? "#eee" }}
      >
        {vibe && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vibe.board}
            alt=""
            className="h-full w-full animate-pulse object-cover opacity-70"
          />
        )}
      </div>
      <div className="font-display text-[22px] text-[var(--text)]">
        Painting your <span style={{ color: vibe?.palette[1] }}>brand kit…</span>
      </div>
      <p className="mx-auto mt-2 max-w-[40ch] font-display text-[13px] leading-relaxed text-[var(--text-50)]">
        The agent is mixing colors, choosing type, and laying out a board you can react to.
      </p>
      <div className="mx-auto mt-5 h-1 w-full max-w-[260px] overflow-hidden rounded-full bg-[var(--border-line)]">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${((step + 1) / 3) * 100}%`,
            background: vibe?.palette[1] ?? "var(--text)",
          }}
        />
      </div>
    </div>
  );
}

/* ───────────────────────── Step 9: Brand Kit ───────────────────────── */
export function StepBrandKit({ onb, onLaunch }: { onb: UseOnboarding; onLaunch: () => void }) {
  const vibe = vibeById(onb.vibeId);
  return (
    <div>
      <StepHeader
        title="Here's your brand kit"
        subtitle="Approve to launch the workspace, or go back to try another visual style."
      />
      {vibe && (
        <BrandKitCard vibe={vibe} brand={onb.brandName ?? "Untitled"} tagline={onb.tagline} image={onb.brandImage} />
      )}
      <div className="mt-4 flex flex-col items-start gap-2 text-[var(--text-50)]">
        <span className="font-mono text-[10px] uppercase tracking-[0.06em]">Next</span>
        <span className="font-display text-[13px]">
          Cofounder will spin up the agents for {onb.brandName} and load them onto the canvas.
        </span>
      </div>
      <button
        type="button"
        onClick={onLaunch}
        className="hidden"
        data-launch-accept
        aria-hidden
      />
    </div>
  );
}