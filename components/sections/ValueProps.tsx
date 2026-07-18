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

/* ─────────────────────────────────────────────────────────────
   Block 1 — Department graph
   Radial layout: CEO agent hub in the centre, departments orbiting.
   Edges are drawn with `anim-draw-line` for a one-shot reveal.
   ───────────────────────────────────────────────────────────── */
function DepartmentGraph() {
  // 8 nodes around a centre hub; positions at radius 130 in a 320 box.
  const cx = 160;
  const cy = 160;
  const r = 130;
  const labels = [
    "Eng",
    "Sales",
    "Mkt",
    "Design",
    "Support",
    "Ops",
    "Fin",
    "Legal",
  ];
  const ringColors = [
    "var(--green)",
    "var(--blue)",
    "var(--amber)",
    "var(--coral)",
    "var(--green)",
    "var(--blue)",
    "var(--amber)",
    "var(--coral)",
  ];
  return (
    <div className="relative aspect-square w-full max-w-[420px] mx-auto">
      <svg viewBox="0 0 320 320" className="h-full w-full">
        {/* edges */}
        {labels.map((_, i) => {
          const a = (i / labels.length) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="var(--border-line)"
              strokeWidth="1.2"
              strokeDasharray="4 4"
              className="anim-draw-line-loop"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          );
        })}
        {/* department nodes */}
        {labels.map((l, i) => {
          const a = (i / labels.length) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          return (
            <g key={l} transform={`translate(${x},${y})`}>
              <circle r="22" fill="white" stroke={ringColors[i]} strokeWidth="1.5" />
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--text)"
                style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.2 }}
              >
                {l}
              </text>
            </g>
          );
        })}
        {/* CEO agent hub */}
        <g transform={`translate(${cx},${cy})`}>
          <circle r="34" fill="var(--text)" />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.5 }}
          >
            CEO AGENT
          </text>
          <circle
            r="44"
            fill="none"
            stroke="var(--green)"
            strokeWidth="1.2"
            className="anim-pulse-ring"
            style={{ color: "var(--green)" }}
          />
        </g>
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Block 2 — Approval timeline
   4 stages; as the user scrolls into the block, the highlight
   bar widens from stage 1 to 4. Driven by IntersectionObserver.
   ───────────────────────────────────────────────────────────── */
function ApprovalTimeline() {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        // progress: 0 when block top is at 80% of viewport, 1 when block bottom hits 30% of viewport
        const start = vh * 0.8;
        const end = vh * 0.3;
        const t = (start - r.top) / (start - end + r.height);
        setProgress(Math.max(0, Math.min(1, t)));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const stages = [
    { label: "Draft", actor: "Agent" },
    { label: "Review", actor: "You" },
    { label: "Approve", actor: "You" },
    { label: "Ship", actor: "Agent" },
  ];
  const activeCount = Math.max(1, Math.ceil(progress * stages.length));
  return (
    <div ref={ref} className="w-full max-w-[460px]">
      <div className="relative">
        {/* track */}
        <div className="h-1.5 w-full rounded-full bg-[var(--border-line)]" />
        {/* fill */}
        <div
          className="absolute left-0 top-0 h-1.5 rounded-full"
          style={{
            width: `${progress * 100}%`,
            background: "var(--green)",
            transition: "width 300ms ease-out",
          }}
        />
        {/* nodes */}
        <div className="absolute inset-x-0 -top-2.5 flex justify-between">
          {stages.map((s, i) => (
            <div key={s.label} className="flex flex-col items-center">
              <span
                className={cx(
                  "block h-6 w-6 rounded-full border-2 transition-colors",
                  i < activeCount
                    ? "border-[var(--green)] bg-white"
                    : "border-[var(--border-line)] bg-white",
                )}
                style={
                  i === activeCount - 1
                    ? {
                        boxShadow:
                          "0 0 0 4px color-mix(in srgb, var(--green) 20%, transparent)",
                      }
                    : undefined
                }
              />
              <div className="mt-3 text-center">
                <div className="font-display text-[12.5px] text-[var(--text)]">
                  {s.label}
                </div>
                <MonoLabel>{s.actor}</MonoLabel>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-24 rounded-[10px] bg-white p-4 shadow-raised">
        <MonoLabel>LATEST</MonoLabel>
        <div className="mt-2 font-display text-[14px] text-[var(--text-80)]">
          {progress < 0.5
            ? "Agent drafting Q3 outreach…"
            : progress < 0.75
              ? "Awaiting your approval on 2 campaigns"
              : "Approved — sending now"}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Block 3 — Connector marquee
   A horizontally scrolling row of connector badges.
   ───────────────────────────────────────────────────────────── */
const CONNECTORS = [
  "MCP",
  "Slack",
  "Linear",
  "Notion",
  "Stripe",
  "GitHub",
  "HubSpot",
  "Gmail",
  "Discord",
  "Twilio",
  "Figma",
  "Airtable",
];

function ConnectorMarquee() {
  // duplicate for seamless wrap
  const items = [...CONNECTORS, ...CONNECTORS];
  return (
    <div className="relative w-full overflow-hidden rounded-[12px] bg-[var(--surface-deep)] py-6 shadow-raised">
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[var(--surface-deep)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[var(--surface-deep)] to-transparent" />
      <div
        className="anim-marquee flex gap-3 whitespace-nowrap will-change-transform"
        style={{ width: "max-content" }}
      >
        {items.map((c, i) => (
          <span
            key={`${c}-${i}`}
            className="surface-gradient-chip inline-flex h-11 items-center gap-2 rounded-full px-5 font-display text-[13.5px] text-[var(--text-80)]"
          >
            <span className="grid h-5 w-5 place-items-center rounded-[5px] bg-[var(--text)] font-mono text-[8px] font-medium text-white">
              {c.slice(0, 1)}
            </span>
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Container — three editorial blocks alternating sides
   ───────────────────────────────────────────────────────────── */
function FeatureRow({
  index,
  title,
  body,
  visual,
  reverse,
}: {
  index: string;
  title: React.ReactNode;
  body: React.ReactNode;
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div
      className={cx(
        "grid items-center gap-10 py-12 md:grid-cols-2 md:gap-16 md:py-20",
      )}
    >
      <div className={cx("flex flex-col", reverse && "md:order-2")}>
        <MonoLabel>{index}</MonoLabel>
        <h3 className="font-display mt-4 text-[28px] font-normal leading-[1.12] tracking-[-0.02em] text-[var(--text)] md:text-[36px] min-[1100px]:text-[40px]">
          {title}
        </h3>
        <p className="mt-4 max-w-[44ch] text-[15.5px] leading-[1.55] text-[var(--text-70)]">
          {body}
        </p>
      </div>
      <div className={cx("flex justify-center", reverse && "md:order-1")}>
        {index === "02 — HUMAN IN THE LOOP" ? (
          <ApprovalTimeline />
        ) : (
          visual
        )}
      </div>
    </div>
  );
}

export default function ValueProps() {
  return (
    <section id="value-props" className="py-20 md:py-28">
      <div className="container-1440 px-5 min-[476px]:px-8">
        {/* Heading */}
        <RevealOnView>
          <div className="mx-auto flex max-w-[820px] flex-col items-center text-center">
            <SectionEyebrow index="02">Why Helm</SectionEyebrow>
            <SectionHeadline accent="not a chatbot." className="mt-6">
              Built like a company,
            </SectionHeadline>
            <SectionLead className="mt-5">
              Three principles shape every part of Helm. Departments instead of
              prompts. Humans in the loop. Extensible to whatever stack you
              already run.
            </SectionLead>
          </div>
        </RevealOnView>

        {/* 01 — Departments */}
        <RevealOnView>
          <FeatureRow
            index="01 — DEPARTMENTS"
            title={
              <>
                Eight teams that run themselves.
                <br />
                <span className="text-[var(--text-50)]">One shared brain.</span>
              </>
            }
            body="Engineering, sales, marketing, design, finance, ops — each with its own manager agent, its own tools, its own backlog. They share context through Helm, so a roadmap change in Eng ripples to Marketing in seconds."
            visual={<DepartmentGraph />}
          />
        </RevealOnView>

        {/* 02 — Approval timeline */}
        <RevealOnView>
          <FeatureRow
            index="02 — HUMAN IN THE LOOP"
            reverse
            title={
              <>
                Anything risky pauses for{" "}
                <span className="bg-gradient-to-r from-[var(--text)] via-[var(--green)] to-[var(--text)] bg-clip-text text-transparent">
                  you.
                </span>
              </>
            }
            body="Agents draft, you approve. Sending an email? Buying a domain? Spending money? Helm stops there and waits for you. Approval gates are the default — not an afterthought."
            visual={null}
          />
        </RevealOnView>

        {/* 03 — Connectors */}
        <RevealOnView>
          <FeatureRow
            index="03 — FULLY EXTENSIBLE"
            title={
              <>
                Plug into{" "}
                <span className="bg-gradient-to-r from-[var(--text)] via-[var(--blue)] to-[var(--text)] bg-clip-text text-transparent">
                  anything.
                </span>
              </>
            }
            body="MCP servers, custom APIs, internal tools, your existing stack. Helm speaks to all of it through a single skills interface — and your agents pick them up automatically."
            visual={<ConnectorMarquee />}
          />
        </RevealOnView>
      </div>
    </section>
  );
}