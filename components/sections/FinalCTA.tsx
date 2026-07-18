"use client";

import * as React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  SectionEyebrow,
  RevealOnView,
  MonoLabel,
  cx,
} from "@/components/ui/primitives";

/* Aurora blobs — drift across the section, tinted in the lighthouse palette */
type AuroraBlob = {
  color: string;
  size: string;
  style: React.CSSProperties;
};

const AURORA_BLOBS: AuroraBlob[] = [
  {
    color: "rgba(167, 139, 250, 0.55)", // violet (lighthouse beam)
    size: "60vw",
    style: { top: "-10%", left: "-10%" },
  },
  {
    color: "rgba(56, 189, 248, 0.45)", // cyan (water reflection)
    size: "50vw",
    style: { bottom: "-15%", right: "-5%" },
  },
  {
    color: "rgba(244, 114, 182, 0.40)", // pink (twilight sky)
    size: "40vw",
    style: { top: "30%", right: "20%" },
  },
  {
    color: "rgba(45, 212, 191, 0.35)", // teal accent
    size: "35vw",
    style: { bottom: "10%", left: "20%" },
  },
];

/* Magnetic CTA — translates a few pixels toward the cursor when over the
   section. Subtle (~6px max), enough to feel alive without distracting. */
function MagneticCTA({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = (e.clientX - cx) / r.width; // -0.5..0.5
    const dy = (e.clientY - cy) / r.height;
    setOffset({ x: dx * 12, y: dy * 12 });
  };
  const onLeave = () => setOffset({ x: 0, y: 0 });

  return (
    <motion.div
      ref={ref}
      animate={{ x: offset.x, y: offset.y }}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ display: "inline-block" }}
    >
      {children}
    </motion.div>
  );
}

export default function FinalCTA() {
  return (
    <section
      id="final-cta"
      className="relative overflow-hidden bg-[#0c0a18] py-24 text-white md:py-32"
    >
      {/* Aurora */}
      <div className="absolute inset-0" aria-hidden>
        {AURORA_BLOBS.map((b, i) => (
          <span
            key={i}
            className={cx("aurora-blob", i % 2 === 0 ? "anim-aurora" : "anim-aurora-slow")}
            style={{
              background: `radial-gradient(closest-side, ${b.color}, transparent 70%)`,
              width: b.size,
              height: b.size,
              ...b.style,
            }}
          />
        ))}
        {/* Soft fade-to-black at the bottom to merge with the footer */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0c0a18] to-transparent" />
      </div>

      <div className="container-1440 relative z-10 px-5 min-[476px]:px-8">
        <RevealOnView>
          <div className="mx-auto flex max-w-[820px] flex-col items-center text-center">
            <div className="flex items-center gap-3 text-white/55">
              <span className="font-mono text-[11px] font-medium tracking-[0.16em]">
                08
              </span>
              <span className="h-px w-6 bg-white/20" />
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em]">
                Run a company
              </span>
            </div>
            <h2 className="font-display mt-7 max-w-[18ch] text-[36px] leading-[1.05] tracking-[-0.02em] min-[760px]:text-[52px] min-[1100px]:text-[64px]">
              Run an entire company,{" "}
              <span className="bg-gradient-to-r from-white via-[#e9d8fd] to-white bg-clip-text text-transparent">
                end to end.
              </span>
            </h2>
            <p className="font-display mt-5 max-w-[52ch] text-[16px] leading-[1.55] text-white/70 md:text-[18px]">
              Engineering, sales, marketing, design, finance, and ops —
              orchestrated in one place. You set the strategy. Helm runs the
              company.
            </p>

            <div className="mt-10">
              <MagneticCTA>
                <Link
                  href="/app/companies"
                  className="group relative inline-flex h-[56px] items-center gap-3 overflow-hidden rounded-[12px] bg-white px-7 font-display text-[16px] font-medium text-[#0c0a18] shadow-[0_8px_30px_rgba(167,139,250,0.25)] transition-shadow hover:shadow-[0_12px_40px_rgba(167,139,250,0.4)]"
                >
                  Run a company
                  <span
                    className="grid h-7 w-7 place-items-center rounded-full bg-[#0c0a18] text-white transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {/* shimmer overlay */}
                  <span
                    className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                    aria-hidden
                  />
                </Link>
              </MagneticCTA>
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {[
                "Engineering",
                "Sales",
                "Marketing",
                "Design",
                "Finance",
                "Operations",
              ].map((d, i) => (
                <React.Fragment key={d}>
                  {i > 0 && <span className="text-white/25">·</span>}
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">
                    {d}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </RevealOnView>
      </div>
    </section>
  );
}