"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";
import {
  SectionEyebrow,
  SectionHeadline,
  SectionLead,
  RevealOnView,
  RaisedCard,
  MonoLabel,
  BlinkDot,
  cx,
} from "@/components/ui/primitives";

const EASE = [0.23, 1, 0.32, 1] as const;

/* ── Sell: working email composer + live metrics ───────────────── */
const SEQUENCES: Array<{
  step: number;
  label: string;
  bg: string;
  fg: string;
}> = [
  { step: 0, label: "Draft", bg: "rgba(29,112,217,0.10)", fg: "var(--blue)" },
  { step: 1, label: "Sent", bg: "rgba(0,0,0,0.05)", fg: "var(--text-70)" },
  { step: 2, label: "Opened", bg: "var(--green-tint)", fg: "var(--green)" },
  { step: 3, label: "Replied", bg: "rgba(167,139,250,0.18)", fg: "#6d49c2" },
  { step: 4, label: "Booked", bg: "var(--green)", fg: "white" },
];

function EmailComposerMock() {
  const [step, setStep] = React.useState(0);
  // auto-advance every 2.4s, looping
  React.useEffect(() => {
    const t = window.setInterval(() => {
      setStep((s) => (s + 1) % SEQUENCES.length);
    }, 2400);
    return () => window.clearInterval(t);
  }, []);

  return (
    <RaisedCard deep className="overflow-hidden p-3.5">
      <div className="grid gap-3.5 md:grid-cols-[1fr_240px]">
        {/* Email preview */}
        <div className="rounded-[10px] bg-[var(--surface-raised)] p-4 shadow-raised">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-[6px] bg-[var(--blue)]/10 font-mono text-[11px] font-medium text-[var(--blue)]">
              @
            </span>
            <div className="min-w-0">
              <div className="font-display text-[13.5px] font-medium leading-tight text-[var(--text-80)]">
                Outreach draft
              </div>
              <MonoLabel>DRAFT · OUTREACH</MonoLabel>
            </div>
          </div>

          <div className="mt-3.5 space-y-1.5 text-[12.5px]">
            <div className="flex items-center gap-2">
              <span className="font-mono w-[40px] shrink-0 text-[10px] uppercase text-[var(--text-50)] tracking-[0.06em]">
                To
              </span>
              <span className="text-[var(--text-80)]">sarah@acme.com</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono w-[40px] shrink-0 text-[10px] uppercase text-[var(--text-50)] tracking-[0.06em]">
                From
              </span>
              <span className="text-[var(--text-80)]">founder@helm.run</span>
            </div>
            <div className="divider-etched my-2 w-full" />
            <div className="font-display text-[13.5px] font-medium leading-snug text-[var(--text)]">
              Thought you could use Helm for Acme
            </div>
            <p className="text-[12px] leading-[1.45] text-[var(--text-70)]">
              Hi Sarah — noticed Acme is scaling fast. Teams like yours are
              running go-to-market with autonomous agents now. Open to a
              5-minute walkthrough this week?
            </p>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors"
              style={{ background: SEQUENCES[step].bg, color: SEQUENCES[step].fg }}
            >
              <BlinkDot color={SEQUENCES[step].fg} />
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.06em]">
                {SEQUENCES[step].label}
              </span>
            </span>
            <MonoLabel>Step {step + 1} of {SEQUENCES.length}</MonoLabel>
          </div>
        </div>

        {/* Live metrics */}
        <div className="flex flex-col gap-2.5">
          {[
            { label: "Open rate", value: 64, suffix: "%", delta: "+12%" },
            { label: "Reply rate", value: 18, suffix: "%", delta: "+5%" },
            { label: "Meetings", value: 7, suffix: "", delta: "+3" },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-[8px] bg-white p-3 shadow-raised"
            >
              <MonoLabel>{m.label.toUpperCase()}</MonoLabel>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-display text-[22px] leading-none tabular-nums text-[var(--text)]">
                  {m.value}
                </span>
                <span className="font-display text-[12px] text-[var(--text-50)]">
                  {m.suffix}
                </span>
              </div>
              <div className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] font-medium text-[var(--green)]">
                <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
                  <path d="M6 2.5L9.5 7H2.5L6 2.5Z" />
                </svg>
                {m.delta}
              </div>
            </div>
          ))}
        </div>
      </div>
    </RaisedCard>
  );
}

/* ── Scale: animated SVG chart with live KPIs ─────────────────── */
function useCountUp(target: number, run: boolean, durationMs = 1100) {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    if (!run) return;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run, durationMs]);
  return n;
}

const SCALE_STATS = [
  { label: "SIGN UPS", value: 211, delta: "+34%" },
  { label: "DAU", value: 9262, delta: "+8%" },
  { label: "MAU", value: 44264, delta: "+37%" },
];

function ScaleMock() {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  /* Animated chart line — keeps a buffer of points and adds a new one every 1.2s */
  const W = 320;
  const H = 96;
  const [points, setPoints] = React.useState<Array<{ x: number; y: number }>>(
    () => [
      { x: 0, y: 78 },
      { x: 36, y: 70 },
      { x: 72, y: 60 },
      { x: 108, y: 64 },
      { x: 144, y: 50 },
      { x: 180, y: 38 },
      { x: 216, y: 44 },
      { x: 252, y: 30 },
      { x: 288, y: 24 },
      { x: 320, y: 18 },
    ],
  );
  React.useEffect(() => {
    if (!inView) return;
    const id = window.setInterval(() => {
      setPoints((prev) => {
        const next = [...prev.slice(1)];
        const lastY = prev[prev.length - 1].y;
        const delta = (Math.random() - 0.55) * 8;
        const newY = Math.max(8, Math.min(86, lastY + delta));
        next.push({ x: W, y: newY });
        // re-x
        return next.map((p, i) => ({ ...p, x: (i / (next.length - 1)) * W }));
      });
    }, 1200);
    return () => window.clearInterval(id);
  }, [inView]);

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`)
    .join(" ");
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;

  return (
    <div ref={ref}>
      <RaisedCard deep className="p-3.5">
        {/* header */}
        <div className="flex items-center justify-between">
          <div className="font-display text-[13px] font-medium text-[var(--text-80)]">
            Analytics
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--green-tint)] px-2.5 py-1">
            <BlinkDot color="var(--green)" />
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--green)]">
              Live · ticking
            </span>
          </span>
        </div>

        {/* KPI tiles with count-up */}
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {SCALE_STATS.map((s) => (
            <KpiTile key={s.label} {...s} run={inView} />
          ))}
        </div>

        {/* chart */}
        <div className="mt-3.5 rounded-[8px] bg-white p-3 shadow-raised">
          <div className="flex items-center justify-between">
            <MonoLabel>WEEKLY ACTIVE USERS</MonoLabel>
            <span className="font-mono text-[10px] font-medium text-[var(--green)]">
              ▲ trending up
            </span>
          </div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="mt-2 w-full"
            preserveAspectRatio="none"
            height={H}
          >
            <defs>
              <linearGradient id="scale-area-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--green)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#scale-area-fill)" />
            <motion.path
              d={line}
              fill="none"
              stroke="var(--green)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: EASE }}
            />
            {/* last-point pulse */}
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r="3.5"
              fill="var(--green)"
            />
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r="8"
              fill="none"
              stroke="var(--green)"
              strokeWidth="1"
              className="anim-pulse-ring"
              style={{ color: "var(--green)" }}
            />
          </svg>
        </div>
      </RaisedCard>
    </div>
  );
}

function KpiTile({
  label,
  value,
  delta,
  run,
}: {
  label: string;
  value: number;
  delta: string;
  run: boolean;
}) {
  const n = useCountUp(value, run);
  return (
    <div className="rounded-[8px] bg-white p-2.5 shadow-raised">
      <MonoLabel>{label}</MonoLabel>
      <div className="mt-1.5 font-display text-[19px] leading-none tabular-nums text-[var(--text)]">
        {n.toLocaleString()}
      </div>
      <div className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] font-medium text-[var(--green)]">
        <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
          <path d="M6 2.5L9.5 7H2.5L6 2.5Z" />
        </svg>
        {delta}
      </div>
    </div>
  );
}

/* ── Section ──────────────────────────────────────────────────── */
export default function LifecycleSellScale() {
  return (
    <section id="sell" className="py-20 md:py-28">
      <div className="container-1440 px-5 min-[476px]:px-8">
        <RevealOnView>
          <div className="mx-auto flex max-w-[820px] flex-col items-center text-center">
            <SectionEyebrow index="05">Sell · Scale</SectionEyebrow>
            <SectionHeadline accent="without lifting a finger." className="mt-6">
              Reach customers and grow,
            </SectionHeadline>
            <SectionLead className="mt-5">
              Outreach that drafts itself. Campaigns that reply on your behalf.
              Analytics that update while you make coffee.
            </SectionLead>
          </div>
        </RevealOnView>

        {/* Sell */}
        <div
          id="sell-block"
          className="mt-16 grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-14"
        >
          <RevealOnView className="flex flex-col justify-center">
            <MonoLabel>SELL</MonoLabel>
            <h3 className="font-display mt-3 text-[28px] font-normal leading-[1.12] tracking-[-0.02em] text-[var(--text)] md:text-[36px]">
              Outreach that drafts, sends, and follows up.
            </h3>
            <p className="mt-4 max-w-[44ch] text-[15px] leading-[1.55] text-[var(--text-70)]">
              Your agents write the email. They wait. They follow up. They book
              the meeting — and only ping you when there's a real decision to
              make.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="font-display inline-flex h-10 items-center gap-2 rounded-[8px] bg-[var(--text)] px-4 text-[13.5px] text-white">
                See outreach playbooks
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <MonoLabel>12 templates</MonoLabel>
            </div>
          </RevealOnView>
          <RevealOnView delay={0.1}>
            <EmailComposerMock />
          </RevealOnView>
        </div>

        {/* Scale */}
        <div
          id="scale-block"
          className="mt-20 grid items-center gap-10 md:mt-28 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-14"
        >
          <RevealOnView>
            <ScaleMock />
          </RevealOnView>
          <RevealOnView delay={0.1} className="flex flex-col justify-center">
            <MonoLabel>SCALE</MonoLabel>
            <h3 className="font-display mt-3 text-[28px] font-normal leading-[1.12] tracking-[-0.02em] text-[var(--text)] md:text-[36px]">
              Real-time analytics that{" "}
              <span className="bg-gradient-to-r from-[var(--text)] via-[var(--green)] to-[var(--text)] bg-clip-text text-transparent">
                breathe.
              </span>
            </h3>
            <p className="mt-4 max-w-[44ch] text-[15px] leading-[1.55] text-[var(--text-70)]">
              Watch your numbers move in real time. Sign-ups, daily actives,
              revenue — every chart ticks with fresh data, every tile counts up
              the moment you land on the page.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="font-display inline-flex h-10 items-center gap-2 rounded-[8px] bg-[var(--text)] px-4 text-[13.5px] text-white">
                Explore dashboards
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <MonoLabel>8 live dashboards</MonoLabel>
            </div>
          </RevealOnView>
        </div>
      </div>
    </section>
  );
}