"use client";

import { motion } from "framer-motion";
import { GlassButton, BlinkDot } from "@/components/ui/primitives";
import Link from "next/link";
import HeroScene from "@/components/sections/HeroScene";

const FLOATING = [
  { title: "Task Completed", sub: "New webpage", dot: "var(--green)", top: "8%" },
  { title: "Task running", sub: "Bug fix", dot: "#f6dca8", top: "30%" },
  { title: "Task Completed", sub: "SEO Optimization", dot: "var(--green)", top: "52%" },
];

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-[720px] md:h-screen md:min-h-[620px] w-full overflow-hidden"
    >
      {/* Original animated landscape (ours — no borrowed assets) */}
      <HeroScene />
      {/* subtle top gradient for nav legibility */}
      <div
        className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/15 to-transparent"
        aria-hidden
      />

      {/* Left content overlay */}
      <div className="container-1440 relative z-10 flex h-full flex-col justify-center px-5 min-[476px]:px-8 pt-40 md:pt-0">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1], delay: 0.1 }}
          className="font-display hero-title-fill max-w-[20ch] text-[34px] min-[500px]:text-[38px] min-[900px]:text-[46px] font-normal leading-[1.08]"
        >
          Run your whole company with agents
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1], delay: 0.3 }}
          className="font-display mt-5 max-w-[44ch] text-[16px] leading-[1.4] tracking-[0.15px] text-white/85 text-shadow-hero"
          style={{ fontWeight: 460 }}
        >
          Run engineering, sales, marketing, design, finance, and ops.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1], delay: 0.45 }}
          className="mt-8 flex flex-wrap items-center gap-3"
        >
          <Link href="/app">
            <span className="btn-light-surface font-display inline-flex h-[44px] items-center justify-center px-5 text-[15px] text-[var(--text-80)] tracking-[0.15px] cursor-pointer">
              Run a company
            </span>
          </Link>
          <GlassButton className="h-[44px] px-5">Check out the launch</GlassButton>
        </motion.div>
      </div>

      {/* Floating notification cards (right) */}
      <div className="pointer-events-none absolute right-6 top-0 z-10 hidden h-full w-[300px] lg:block">
        {FLOATING.map((f, i) => (
          <motion.div
            key={f.sub}
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              ease: [0.22, 1, 0.36, 1],
              delay: 0.7 + i * 0.25,
            }}
            className="absolute right-0 flex w-[260px] items-center gap-3 rounded-[12px] bg-white/90 px-3.5 py-3 shadow-deep backdrop-blur-sm"
            style={{ top: f.top, transform: "perspective(800px) rotateY(-8deg) rotateX(4deg)" }}
          >
            <BlinkDot color={f.dot} />
            <div className="min-w-0">
              <div className="font-display text-[13px] font-medium text-[var(--text-80)] leading-tight">
                {f.title}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-50)]">
                {f.sub}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Scroll arrow */}
      <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center">
        <svg
          className="anim-scroll-arrow text-white/80"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </section>
  );
}
