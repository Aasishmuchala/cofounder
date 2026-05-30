"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  RaisedCard,
  EtchedDivider,
  BlinkDot,
  MonoLabel,
  cx,
} from "@/components/ui/primitives";
import { ROADMAP_STAGES, type RoadmapStatus } from "@/lib/site-data";

const EASE = [0.23, 1, 0.32, 1] as const;

/* ---- shared entrance wrapper ---- */
function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ---- text column ---- */
function FeatureCopy({
  eyebrow,
  heading,
  body,
  linkLabel,
  href,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  linkLabel: string;
  href: string;
}) {
  return (
    <div className="flex flex-col">
      <MonoLabel>{eyebrow}</MonoLabel>
      <h3 className="font-display mt-4 max-w-[15ch] text-[26px] min-[1000px]:text-[28px] font-normal leading-[1.15] text-[var(--text)]">
        {heading}
      </h3>
      <p className="font-body mt-4 max-w-[42ch] text-[15px] leading-[1.55] text-[var(--text-70)]">
        {body}
      </p>
      <Link
        href={href}
        className="font-display mt-6 inline-flex items-center gap-1.5 text-[14px] text-[var(--text-80)] transition-colors hover:text-[var(--text)]"
      >
        {linkLabel}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 12h14M13 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </div>
  );
}

/* ---- status badge derived from RoadmapStatus ---- */
function StatusBadge({ status }: { status: RoadmapStatus }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--green-tint)] px-2.5 py-1">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 13l4 4L19 7"
            stroke="var(--green)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--green)]">
          Done
        </span>
      </span>
    );
  }

  const map: Record<
    Exclude<RoadmapStatus, "done">,
    { label: string; bg: string; fg: string; dot?: string }
  > = {
    user: {
      label: "User task",
      bg: "var(--surface-deep)",
      fg: "var(--text-50)",
    },
    agent: {
      label: "Agent task",
      bg: "rgba(29,112,217,0.08)",
      fg: "var(--blue)",
      dot: "var(--blue)",
    },
    approval: {
      label: "Agent requires approval",
      bg: "rgba(242,183,5,0.12)",
      fg: "#9a7400",
      dot: "var(--amber)",
    },
    available: {
      label: "Available",
      bg: "var(--surface-deep)",
      fg: "var(--text-50)",
    },
    locked: {
      label: "Locked",
      bg: "var(--surface-deep)",
      fg: "var(--text-30)",
    },
  };

  const s = map[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{
        background: s.bg,
        boxShadow: "inset 0 0 0 0.7px rgba(0,0,0,0.08)",
      }}
    >
      {s.dot && <BlinkDot color={s.dot} />}
      <span
        className="font-mono text-[10px] uppercase tracking-[0.06em]"
        style={{ color: s.fg }}
      >
        {s.label}
      </span>
    </span>
  );
}

/* ---- roadmap mock (Start block) ---- */
function RoadmapMock() {
  return (
    <RaisedCard deep className="overflow-hidden p-4 min-[1000px]:p-5">
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="flex items-center gap-2">
          <BlinkDot color="var(--green)" />
          <MonoLabel>Company Roadmap</MonoLabel>
        </div>
        <MonoLabel>Live</MonoLabel>
      </div>

      <div className="flex flex-col gap-3">
        {ROADMAP_STAGES.map((stage) => (
          <div
            key={stage.stage}
            className="rounded-[10px] bg-[var(--surface-deep)] p-3"
            style={{ boxShadow: "inset 0 0 0 0.7px rgba(0,0,0,0.06)" }}
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="font-display text-[14px] text-[var(--text)]">
                {stage.stage}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-[var(--text-50)]">
                {stage.progress}
              </span>
            </div>

            <div className="flex flex-col">
              {stage.steps.map((step, i) => (
                <div key={step.label}>
                  {i > 0 && <EtchedDivider />}
                  <div className="flex items-center gap-3 py-2.5">
                    <Image
                      src={`/homepage/product-ui-1/icon-${step.icon}.png`}
                      alt=""
                      width={28}
                      height={28}
                      className="shrink-0 rounded-[6px]"
                    />
                    <span className="font-display flex-1 truncate text-[14px] text-[var(--text-80)]">
                      {step.label}
                    </span>
                    <StatusBadge status={step.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </RaisedCard>
  );
}

/* ---- build mock (Build block) ---- */
const BUILD_SUBTASKS = [
  { label: "Update hero copy and CTA", status: "done" as const },
  { label: "Wire up pricing section", status: "agent" as const },
  { label: "Deploy preview to staging", status: "approval" as const },
];

function BuildMock() {
  return (
    <RaisedCard deep className="overflow-hidden">
      {/* decorative pixel strip */}
      <div
        className="h-8 w-full"
        style={{
          backgroundImage: "url(/build-ui-bits/carousel-top.png)",
          backgroundRepeat: "repeat",
          backgroundSize: "auto 100%",
          opacity: 0.7,
        }}
        aria-hidden
      />

      <div className="p-4 min-[1000px]:p-5">
        {/* task header */}
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[rgba(29,112,217,0.08)]"
            style={{ boxShadow: "inset 0 0 0 0.7px rgba(0,0,0,0.06)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 7h16M4 12h16M4 17h10"
                stroke="var(--blue)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="font-display text-[15px] text-[var(--text)]">
              Landing Page
            </div>
            <div className="font-mono mt-0.5 text-[10px] uppercase tracking-[0.06em] text-[var(--text-50)]">
              Landing Page Updates · Engineer
            </div>
          </div>
        </div>

        {/* subtasks */}
        <div
          className="mt-4 rounded-[10px] bg-[var(--surface-deep)] p-2"
          style={{ boxShadow: "inset 0 0 0 0.7px rgba(0,0,0,0.06)" }}
        >
          {BUILD_SUBTASKS.map((t, i) => (
            <div key={t.label}>
              {i > 0 && <EtchedDivider />}
              <div className="flex items-center gap-3 px-1.5 py-2.5">
                <span
                  className={cx(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px]",
                    t.status === "done" && "bg-[var(--green)]"
                  )}
                  style={
                    t.status === "done"
                      ? undefined
                      : { boxShadow: "inset 0 0 0 1.4px rgba(0,0,0,0.18)" }
                  }
                >
                  {t.status === "done" && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M5 13l4 4L19 7"
                        stroke="#fff"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span
                  className={cx(
                    "font-display flex-1 truncate text-[14px]",
                    t.status === "done"
                      ? "text-[var(--text-50)] line-through"
                      : "text-[var(--text-80)]"
                  )}
                >
                  {t.label}
                </span>
                <StatusBadge status={t.status} />
              </div>
            </div>
          ))}
        </div>

        {/* input row */}
        <div
          className="mt-3 flex items-center gap-2 rounded-[10px] bg-[var(--surface-deep)] px-3 py-2.5"
          style={{ boxShadow: "inset 0 0 0 0.7px rgba(0,0,0,0.08)" }}
        >
          <BlinkDot color="var(--blue)" />
          <span className="font-body flex-1 text-[13px] text-[var(--text-30)]">
            Create a new task for Cofounder
          </span>
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] surface-gradient-chip"
            aria-hidden
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 19V5M5 12l7-7 7 7"
                stroke="var(--text-70)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>
    </RaisedCard>
  );
}

/* ============================================================ */
export default function LifecycleStartBuild() {
  return (
    <section className="py-20 md:py-28">
      <div className="container-1440 px-5 min-[476px]:px-8">
        {/* Section H2 */}
        <Reveal>
          <h2 className="font-display mx-auto max-w-[24ch] text-center text-[28px] md:text-[32px] min-[1000px]:text-[40px] font-normal leading-[1.15] text-[var(--text)]">
            Build a real company with the help of specialized agents
          </h2>
        </Reveal>

        {/* BLOCK: Start — text left, mock right */}
        <div
          id="start"
          className="mt-16 grid scroll-mt-24 items-center gap-10 md:mt-24 md:grid-cols-2 md:gap-14"
        >
          <Reveal>
            <FeatureCopy
              eyebrow="START"
              heading="A full roadmap tailored to your company."
              body="Cofounder lays out every milestone from idea to incorporation, then assigns each step to you or an agent — so nothing falls through the cracks as you stand up the business."
              linkLabel="Learn how to start"
              href="#start"
            />
          </Reveal>
          <Reveal delay={0.1}>
            <RoadmapMock />
          </Reveal>
        </div>

        {/* BLOCK: Build — mock left, text right (alternated) */}
        <div
          id="build"
          className="mt-16 grid scroll-mt-24 items-center gap-10 md:mt-28 md:grid-cols-2 md:gap-14"
        >
          <Reveal delay={0.1} className="md:order-2">
            <FeatureCopy
              eyebrow="BUILD"
              heading="Engineers that ship while you sleep."
              body="Hand off product work to engineering agents. Break a feature into tasks, watch them run in the background, and review the diff before anything goes live."
              linkLabel="Learn how to build"
              href="#build"
            />
          </Reveal>
          <Reveal className="md:order-1">
            <BuildMock />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
