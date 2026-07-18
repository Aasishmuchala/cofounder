"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  SectionEyebrow,
  SectionHeadline,
  SectionLead,
  RevealOnView,
  MonoLabel,
  cx,
} from "@/components/ui/primitives";

const EASE = [0.23, 1, 0.32, 1] as const;

const CHAT_PROMPTS = [
  "Ask Helm to spin up a new marketing agent.",
  "Ask Helm to draft the Q3 investor update.",
  "Ask Helm to schedule this week's standups.",
];

/* ── Inline icon set (1.5px stroke, 16px) ────────────────────────
   Bespoke minimal icons in the project's house style. Each one
   gets a tiny unique glyph — no more "ENG" or "MKTG" abbreviations. */
type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...rest}
    />
  );
}

const DeptIcons: Record<string, React.ReactNode> = {
  Engineering: (
    <Icon>
      <path d="M9 8l-4 4 4 4" />
      <path d="M15 8l4 4-4 4" />
      <path d="M13.5 6l-3 12" />
    </Icon>
  ),
  Sales: (
    <Icon>
      <path d="M3 17l5-5 4 4 8-8" />
      <path d="M14 8h6v6" />
    </Icon>
  ),
  Marketing: (
    <Icon>
      <path d="M3 11l14-6v14L3 13z" />
      <path d="M7 13v4" />
    </Icon>
  ),
  Design: (
    <Icon>
      <circle cx="9" cy="12" r="5" />
      <path d="M14 8l5-3" />
      <path d="M14 16l5 3" />
      <path d="M19 12l3 0" />
    </Icon>
  ),
  Support: (
    <Icon>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Icon>
  ),
  Operations: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Icon>
  ),
  Finance: (
    <Icon>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h3" />
    </Icon>
  ),
  Legal: (
    <Icon>
      <path d="M12 3v18" />
      <path d="M5 7h14" />
      <path d="M5 7l-2 5a4 4 0 0 0 8 0z" transform="translate(2 0)" />
      <path d="M19 7l-2 5a4 4 0 0 0 8 0z" transform="translate(-2 0)" />
    </Icon>
  ),
};

const DEPARTMENTS_LIST = [
  "Engineering",
  "Sales",
  "Marketing",
  "Design",
  "Support",
  "Operations",
  "Finance",
  "Legal",
] as const;

/* ── Activity timeline panel ──────────────────────────────────────
   The "OS mock" reimagined as a live activity feed. Each row is a
   real event: agent icon + name + what they just did + ago. New
   events stream in every 2.5s, oldest fade out. The bottom input
   typewriter is preserved — that's the part you said was working. */
type EventKind = "completed" | "running" | "approval" | "sent" | "drafted";
type ActivityRow = {
  id: string;
  dept: typeof DEPARTMENTS_LIST[number];
  kind: EventKind;
  title: string;
  detail: string;
  ageSeconds: number;
};

const KIND_META: Record<EventKind, { color: string; tag: string }> = {
  completed: { color: "var(--green)", tag: "completed" },
  running: { color: "var(--amber)", tag: "running" },
  approval: { color: "var(--coral)", tag: "needs approval" },
  sent: { color: "var(--green)", tag: "sent" },
  drafted: { color: "var(--text-70)", tag: "drafted" },
};

const ACTIVITY_SEED: Omit<ActivityRow, "id">[] = [
  { dept: "Engineering", kind: "running", title: "PR #142 — auth refactor", detail: "Reviewing 4 changed files", ageSeconds: 12 },
  { dept: "Marketing", kind: "drafted", title: "Q3 launch plan", detail: "Saved to /marketing/q3.md", ageSeconds: 48 },
  { dept: "Sales", kind: "sent", title: "Cold-outreach batch — 24 leads", detail: "3 replies already in queue", ageSeconds: 124 },
  { dept: "Support", kind: "completed", title: "Closed 3 tickets", detail: "Marked resolved · sent CSAT", ageSeconds: 220 },
  { dept: "Finance", kind: "approval", title: "Renew Stripe subscription", detail: "Awaiting you", ageSeconds: 380 },
];

const NEXT_EVENTS: Omit<ActivityRow, "id">[] = [
  { dept: "Marketing", kind: "drafted", title: "Launch tweet thread", detail: "5 posts queued for review", ageSeconds: 0 },
  { dept: "Engineering", kind: "running", title: "CI build #3148", detail: "Type-checking main branch", ageSeconds: 0 },
  { dept: "Sales", kind: "approval", title: "Send invoice to Acme", detail: "$24,000 · awaiting you", ageSeconds: 0 },
  { dept: "Operations", kind: "completed", title: "Backed up company docs", detail: "12.4 GB synced to S3", ageSeconds: 0 },
  { dept: "Legal", kind: "drafted", title: "MSA with Figma Inc.", detail: "Ready for your review", ageSeconds: 0 },
  { dept: "Design", kind: "running", title: "Refresh homepage hero", detail: "Trying 4 layout variants", ageSeconds: 0 },
];

let _actId = 0;
const nextActId = () => `a${++_actId}`;

function fmtAge(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

function ActivityPanel() {
  /* Activity feed — seeds with 5 rows, prepends a fresh one every 2.5s,
     keeps the visible list at 5. The first row carries the running-state
     so something always looks "alive" without animations. */
  const [rows, setRows] = React.useState<ActivityRow[]>(() =>
    ACTIVITY_SEED.map((r) => ({ ...r, id: nextActId() })),
  );
  const evtRef = React.useRef(0);
  const timeRef = React.useRef(0);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setRows((prev) => {
        // age the existing rows
        const aged = prev.map((r) => ({ ...r, ageSeconds: r.ageSeconds + 2 }));
        // prepend a new event
        const newRow: ActivityRow = {
          ...NEXT_EVENTS[evtRef.current % NEXT_EVENTS.length],
          id: nextActId(),
          ageSeconds: 0,
        };
        evtRef.current += 1;
        return [newRow, ...aged].slice(0, 5);
      });
      timeRef.current += 1;
    }, 2500);
    return () => window.clearInterval(id);
  }, []);

  /* Typewriter prompt at the bottom */
  const [promptIdx, setPromptIdx] = React.useState(0);
  const [typed, setTyped] = React.useState("");
  const [typing, setTyping] = React.useState(true);

  React.useEffect(() => {
    const target = CHAT_PROMPTS[promptIdx];
    if (typing) {
      if (typed.length < target.length) {
        const t = window.setTimeout(
          () => setTyped(target.slice(0, typed.length + 1)),
          38,
        );
        return () => window.clearTimeout(t);
      }
      const t = window.setTimeout(() => setTyping(false), 1500);
      return () => window.clearTimeout(t);
    }
    if (typed.length > 0) {
      const t = window.setTimeout(
        () => setTyped(target.slice(0, typed.length - 1)),
        18,
      );
      return () => window.clearTimeout(t);
    }
    setPromptIdx((i) => (i + 1) % CHAT_PROMPTS.length);
    setTyping(true);
  }, [typed, typing, promptIdx]);

  const running = rows.filter((r) => r.kind === "running").length;
  const needsApproval = rows.filter((r) => r.kind === "approval").length;

  return (
    <div className="relative">
      {/* Layer 0 — outer halo. Soft radial light that bleeds out from the
          card edge, making the panel feel like it's hovering in the cream. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 z-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 40%, rgba(255,255,255,0.85) 0%, rgba(245,245,242,0.4) 40%, rgba(245,245,242,0) 70%)",
          filter: "blur(20px)",
        }}
      />

      {/* Layer 1 — the card itself. Mask-image fades the inner edges so the
          surface feels like a window that softly dissolves into the page. */}
      <div
        className="relative z-10 flex flex-col overflow-hidden rounded-[18px]"
        style={{
          background: "rgba(255, 255, 255, 0.78)",
          backdropFilter: "blur(20px) saturate(1.1)",
          WebkitBackdropFilter: "blur(20px) saturate(1.1)",
          border: "1px solid rgba(255, 255, 255, 0.7)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.85) inset, 0 1px 0 rgba(0,0,0,0.04), 0 30px 60px -28px rgba(0,0,0,0.18), 0 8px 22px -10px rgba(0,0,0,0.08)",
          /* mask: gentle inner fade so the card edges feel soft, not stamped */
          maskImage:
            "linear-gradient(to bottom, black 0%, black 92%, rgba(0,0,0,0.85) 100%), linear-gradient(to right, rgba(0,0,0,0.92) 0%, black 4%, black 96%, rgba(0,0,0,0.92) 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, black 92%, rgba(0,0,0,0.85) 100%), linear-gradient(to right, rgba(0,0,0,0.92) 0%, black 4%, black 96%, rgba(0,0,0,0.92) 100%)",
          maskComposite: "source-in",
          WebkitMaskComposite: "source-in",
        }}
      >
        {/* inner highlight ring — a thin white hairline just inside the
            card edge for the "etched glass" feel */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[18px]"
          style={{
            boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.55)",
          }}
        />

      {/* Header bar */}
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-5"
        style={{ borderColor: "var(--border-soft)" }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[var(--text)]"
            style={{ background: "var(--text)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3l1.7 5.3 5.3.2-4 3.6 1.3 5.2-4.3-2.9L7.7 17l1.3-5.2-4-3.6 5.3-.2z" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="font-display text-[13.5px] font-medium leading-tight text-[var(--text)]">
              Helm console
            </div>
            <div className="font-mono text-[9.5px] tracking-[0.04em] text-[var(--text-50)]">
              your-company · 15 agents
            </div>
          </div>
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.06em]"
            style={{ background: "rgba(52,168,83,0.10)", color: "var(--green)" }}
          >
            <span className="block h-1.5 w-1.5 rounded-full" style={{ background: "var(--green)" }} />
            {running} live
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.06em]"
            style={{ background: "rgba(167,100,81,0.10)", color: "var(--coral)" }}
          >
            <span className="block h-1.5 w-1.5 rounded-full" style={{ background: "var(--coral)" }} />
            {needsApproval} you
          </span>
        </div>
      </div>

      {/* Activity timeline */}
      <div className="px-4 py-4 md:px-5">
        <div className="flex items-center justify-between">
          <MonoLabel>Activity</MonoLabel>
          <MonoLabel>just now</MonoLabel>
        </div>

        <ol className="relative mt-3">
          {/* SVG guide: a vertical hairline with two dots that flow down it.
              The path's length is animated via stroke-dasharray; small filled
              circles ride the same path with their own animation. */}
          <svg
            aria-hidden
            className="pointer-events-none absolute"
            style={{ left: 17, top: 0, height: "calc(100% - 0px)", width: 2 }}
            viewBox="0 0 2 600"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="line-fade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--border-line)" stopOpacity="0" />
                <stop offset="8%" stopColor="var(--border-line)" stopOpacity="1" />
                <stop offset="92%" stopColor="var(--border-line)" stopOpacity="1" />
                <stop offset="100%" stopColor="var(--border-line)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="1" y1="0" x2="1" y2="600" stroke="url(#line-fade)" strokeWidth="1" />
            {/* flowing dots */}
            <circle r="2.2" fill="var(--text-50)" cx="1" cy="0">
              <animate attributeName="cy" from="0" to="600" dur="3.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="3.6s" repeatCount="indefinite" />
            </circle>
            <circle r="1.6" fill="var(--text-30)" cx="1" cy="0">
              <animate attributeName="cy" from="0" to="600" dur="4.8s" begin="-2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.8;0.8;0" keyTimes="0;0.1;0.9;1" dur="4.8s" begin="-2.4s" repeatCount="indefinite" />
            </circle>
          </svg>

          {rows.map((r) => {
            const meta = KIND_META[r.kind];
            return (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="relative flex items-start gap-3 py-2.5 pr-1"
              >
                {/* dotted-border circle with icon — no text */}
                <span
                  className="relative z-[1] mt-0.5 grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-white"
                  style={{
                    border: `1.5px dashed ${meta.color}`,
                    background: "rgba(255,255,255,0.6)",
                    boxShadow:
                      r.kind === "running"
                        ? `0 0 0 3px color-mix(in srgb, ${meta.color} 14%, transparent)`
                        : undefined,
                  }}
                >
                  <span
                    className="grid h-[18px] w-[18px] place-items-center rounded-full"
                    style={{
                      background: r.kind === "running" ? meta.color : "white",
                      color: r.kind === "running" ? "white" : meta.color,
                      boxShadow:
                        r.kind === "running"
                          ? `inset 0 0 0 1px ${meta.color}`
                          : `inset 0 0 0 1px ${meta.color}`,
                    }}
                  >
                    {DeptIcons[r.dept]}
                  </span>
                </span>

                {/* content */}
                <div className="min-w-0 flex-1 pl-2">
                  <div
                    className="font-mono text-[9px] font-medium uppercase tracking-[0.08em]"
                    style={{ color: meta.color }}
                  >
                    {meta.tag}
                  </div>
                  <div
                    className="mt-0.5 truncate font-display text-[13.5px] leading-tight text-[var(--text)]"
                    style={{ fontWeight: 500 }}
                  >
                    {r.title}
                  </div>
                  <div className="mt-0.5 truncate text-[11.5px] text-[var(--text-50)]">
                    {r.detail}
                  </div>
                </div>

                <span className="shrink-0 self-start pt-1 font-mono text-[9.5px] tabular-nums text-[var(--text-30)]">
                  {fmtAge(r.ageSeconds)}
                </span>
              </motion.li>
            );
          })}
        </ol>
      </div>

      <div className="divider-etched w-full" />

      {/* Prompt input — typewriter */}
      <div className="px-4 py-3 md:px-5">
        <div className="flex items-center gap-2 rounded-[10px] border bg-white/85 px-3 py-2 transition-colors focus-within:border-[var(--text-50)]"
          style={{ borderColor: "var(--border-line)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.4)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-30)" strokeWidth="1.6" aria-hidden>
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          <span className="flex-1 truncate font-display text-[12.5px] text-[var(--text-70)]">
            {typed}
            <span className="ml-0.5 inline-block h-3 w-px translate-y-[1px] bg-[var(--text-70)]" style={{ animation: "caret-blink 1s step-end infinite" }} />
          </span>
          <button
            type="button"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] text-white"
            style={{ background: "var(--text)" }}
            aria-label="Send to Helm"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5" />
              <path d="M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

/* ── Left panel: real product surface ────────────────────────────
   A row of 8 department bubbles (the previous "chips" but rendered
   as proper icon cards), uniform neutral style — no active state, no
   blue tones. Below them: a thin activity feed + CTA. Static, SaaS. */
function LeftPanel() {
  return (
    <div className="flex flex-col gap-5">
      {/* Department bubble row */}
      <div className="flex flex-wrap gap-2">
        {DEPARTMENTS_LIST.map((d) => (
          <div
            key={d}
            className="surface-gradient-chip flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-[var(--text-80)] shadow-raised">
              {DeptIcons[d]}
            </span>
            <span className="font-display text-[13px] font-medium text-[var(--text)]">
              {d}
            </span>
          </div>
        ))}
      </div>

      {/* Lead + CTA */}
      <div>
        <p className="max-w-[44ch] text-[15px] leading-[1.55] text-[var(--text-70)]">
          Engineering, sales, marketing, design, finance, ops — each with its
          own manager agent, its own tools, its own backlog. They share
          context through Helm.
        </p>
        <a
          href="/app/companies"
          className="font-display mt-4 inline-flex h-9 items-center gap-1.5 rounded-[8px] surface-gradient-chip px-3.5 text-[13px] text-[var(--text-80)] hover:text-[var(--text)]"
        >
          Open the company
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </div>
  );
}

/* ── Section ───────────────────────────────────────────────────── */
export default function OrchestrationBand() {
  return (
    <section
      id="orchestration"
      className="relative w-full overflow-hidden pt-24 pb-24 md:pt-32 md:pb-32"
    >
      <div className="container-1440 relative z-10 px-5 min-[476px]:px-8">
        {/* Heading */}
        <RevealOnView>
          <div className="mx-auto flex max-w-[820px] flex-col items-center text-center">
            <SectionEyebrow index="01">Orchestration</SectionEyebrow>
            <SectionHeadline className="mt-6" accent="a real company">
              Helm is an agent OS built like
            </SectionHeadline>
            <SectionLead className="mt-5">
              Eight departments, working in parallel, with human approval gates where it matters.
              Watch what your company does while you sleep.
            </SectionLead>
          </div>
        </RevealOnView>

        {/* Two-column: rich left panel + glass OS mock on the right.
            The orbit lives between them, behind, masked. */}
        <div className="mt-16 grid items-center gap-8 md:mt-20 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:gap-12">
          <RevealOnView>
            <LeftPanel />
          </RevealOnView>
          <RevealOnView delay={0.1}>
            <ActivityPanel />
          </RevealOnView>
        </div>
      </div>
    </section>
  );
}