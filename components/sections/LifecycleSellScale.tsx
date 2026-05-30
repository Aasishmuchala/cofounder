"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { RaisedCard, EtchedDivider, BlinkDot, MonoLabel, cx } from "@/components/ui/primitives";

const EASE = [0.23, 1, 0.32, 1] as const;

/* ── shared text-side feature copy ────────────────────────────── */
function FeatureText({
  eyebrow,
  heading,
  body,
  link,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  link: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: EASE }}
      className="flex flex-col justify-center"
    >
      <MonoLabel>{eyebrow}</MonoLabel>
      <h3 className="font-display mt-3 text-[26px] md:text-[28px] font-normal leading-[1.15] text-[var(--text)]">
        {heading}
      </h3>
      <p className="mt-4 max-w-[40ch] text-[15px] leading-[1.5] text-[var(--text-70)]">
        {body}
      </p>
      <a
        href="#"
        className="font-display group mt-6 inline-flex w-fit items-center gap-1.5 text-[14px] text-[var(--text-80)] tracking-[0.15px] transition-colors hover:text-[var(--text)]"
      >
        {link}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        >
          <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    </motion.div>
  );
}

/* ── mock-side wrapper with entrance ──────────────────────────── */
function MockSide({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
    >
      {children}
    </motion.div>
  );
}

/* ── BLOCK: Sell ──────────────────────────────────────────────── */
function SellMock() {
  return (
    <RaisedCard deep className="overflow-hidden p-3.5">
      {/* (a) Email Preview */}
      <div className="rounded-[10px] bg-[var(--surface-raised)] p-3.5 shadow-raised">
        <div className="flex items-center gap-2.5">
          <Image
            src="/homepage/email-app-icon.svg"
            alt="Mail"
            width={26}
            height={26}
            className="rounded-[6px]"
          />
          <div className="min-w-0">
            <div className="font-display text-[13px] font-medium leading-tight text-[var(--text-80)]">
              Email Preview
            </div>
            <MonoLabel>DRAFT · OUTREACH</MonoLabel>
          </div>
        </div>

        <div className="mt-3.5 space-y-1.5">
          <div className="flex items-center gap-2 text-[12px]">
            <span className="font-mono w-[40px] shrink-0 uppercase text-[var(--text-50)] text-[10px] tracking-[0.06em]">
              To
            </span>
            <span className="text-[var(--text-80)]">Sarah Chen</span>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="font-mono w-[40px] shrink-0 uppercase text-[var(--text-50)] text-[10px] tracking-[0.06em]">
              From
            </span>
            <span className="text-[var(--text-80)]">Tanner Holloway</span>
          </div>
          <EtchedDivider className="my-2" />
          <div className="font-display text-[13px] font-medium leading-snug text-[var(--text)]">
            Thought you could use Helm for Acme
          </div>
          <p className="text-[12px] leading-[1.45] text-[var(--text-70)]">
            Hi Sarah — I noticed Acme is scaling fast and wanted to share how teams like
            yours are running go-to-market with autonomous agents. Would love to show you
            a 5-minute walkthrough…
          </p>
        </div>
      </div>

      {/* (b) Email Campaign Report */}
      <div className="mt-3.5 rounded-[10px] bg-[var(--surface-raised)] p-3.5 shadow-raised">
        <div className="flex items-center justify-between">
          <div className="font-display text-[13px] font-medium text-[var(--text-80)]">
            Email Campaign Report
          </div>
          <MonoLabel>LAST 7 DAYS</MonoLabel>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {/* Open Rate */}
          <div className="rounded-[8px] bg-white p-2.5 shadow-raised">
            <MonoLabel>OPEN RATE</MonoLabel>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="font-display text-[20px] leading-none text-[var(--text)]">
                12%
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1">
              <Image
                src="/homepage/email-arrow-up-green.svg"
                alt=""
                width={9}
                height={9}
                aria-hidden
              />
              <span className="font-mono text-[10px] font-medium text-[var(--green)]">
                +4%
              </span>
            </div>
          </div>
          {/* Opened */}
          <div className="rounded-[8px] bg-white p-2.5 shadow-raised">
            <MonoLabel>OPENED</MonoLabel>
            <div className="mt-1.5 font-display text-[20px] leading-none text-[var(--text)]">
              3
            </div>
            <div className="mt-1.5 font-mono text-[10px] text-[var(--text-50)]">
              messages
            </div>
          </div>
          {/* Unopened */}
          <div className="rounded-[8px] bg-white p-2.5 shadow-raised">
            <MonoLabel>UNOPENED</MonoLabel>
            <div className="mt-1.5 font-display text-[20px] leading-none text-[var(--text)]">
              6
            </div>
            <div className="mt-1.5 font-mono text-[10px] text-[var(--text-50)]">
              messages
            </div>
          </div>
        </div>
      </div>
    </RaisedCard>
  );
}

/* ── BLOCK: Scale ─────────────────────────────────────────────── */
const SCALE_STATS = [
  { label: "SIGN UPS", value: "211", delta: "+34%", up: true },
  { label: "DAU", value: "9,262", delta: "+8%", up: true },
  { label: "MAU", value: "44,264", delta: "+37%", up: true },
];

function StatArrow({ up }: { up: boolean }) {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d={up ? "M6 2.5L9.5 7H2.5L6 2.5Z" : "M6 9.5L2.5 5h7L6 9.5Z"}
        fill={up ? "var(--green)" : "var(--coral)"}
      />
    </svg>
  );
}

function ScaleMock() {
  // smooth area/line chart geometry
  const W = 300;
  const H = 92;
  const line =
    "M0 74 C 26 70, 40 58, 62 60 S 104 46, 128 40 S 176 50, 200 34 S 248 18, 272 22 S 296 12, 300 10";
  const area = `${line} L 300 ${H} L 0 ${H} Z`;

  return (
    <RaisedCard deep className="p-3.5">
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="font-display text-[13px] font-medium text-[var(--text-80)]">
          Analytics
        </div>
        {/* Live users pill */}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--green-tint)] px-2.5 py-1">
          <BlinkDot color="var(--green)" />
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--green)]">
            Live users 2,843
          </span>
        </span>
      </div>

      {/* stat tiles */}
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {SCALE_STATS.map((s) => (
          <div key={s.label} className="rounded-[8px] bg-white p-2.5 shadow-raised">
            <MonoLabel>{s.label}</MonoLabel>
            <div className="mt-1.5 font-display text-[19px] leading-none text-[var(--text)]">
              {s.value}
            </div>
            <div className="mt-1.5 flex items-center gap-1">
              <StatArrow up={s.up} />
              <span
                className={cx(
                  "font-mono text-[10px] font-medium",
                  s.up ? "text-[var(--green)]" : "text-[var(--coral)]"
                )}
              >
                {s.delta}
              </span>
            </div>
          </div>
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
              <stop offset="0%" stopColor="var(--green)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#scale-area-fill)" />
          <path
            d={line}
            fill="none"
            stroke="var(--green)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </RaisedCard>
  );
}

/* ── Section ──────────────────────────────────────────────────── */
export default function LifecycleSellScale() {
  return (
    <section className="pb-20 md:pb-28">
      <div className="container-1440 px-5 min-[476px]:px-8">
        {/* Sell — text left, mock right */}
        <div
          id="sell"
          className="grid scroll-mt-24 grid-cols-1 items-center gap-10 md:gap-16 min-[900px]:grid-cols-2"
        >
          <FeatureText
            eyebrow="SELL"
            heading="Reach customers and run go-to-market."
            body="Draft outreach, launch campaigns, and track every reply. Your agents handle the busywork while you keep your hand on the wheel."
            link="Learn how to sell"
          />
          <MockSide>
            <SellMock />
          </MockSide>
        </div>

        {/* Scale — mock left, text right (alternating) */}
        <div
          id="scale"
          className="mt-20 grid scroll-mt-24 grid-cols-1 items-center gap-10 md:mt-28 md:gap-16 min-[900px]:grid-cols-2"
        >
          <MockSide>
            <ScaleMock />
          </MockSide>
          <FeatureText
            eyebrow="SCALE"
            heading="Grow revenue, analytics, and support."
            body="Watch sign-ups, daily actives, and revenue climb in real time — with agents on call to handle support and surface what matters."
            link="Learn how to scale"
          />
        </div>
      </div>
    </section>
  );
}
