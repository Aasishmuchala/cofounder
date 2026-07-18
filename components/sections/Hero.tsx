"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { LightButton } from "@/components/ui/primitives";

const EASE = [0.23, 1, 0.32, 1] as const;

/**
 * Hero — full-bleed looping video of a pixel-art lighthouse, with the
 * first-frame JPG held until the video has buffered enough to play.
 *
 * Three gradients stack on top:
 *   - top scrim        — nav legibility
 *   - left scrim       — headline legibility
 *   - bottom fade      — blends into the cream `--background` of the next section
 *
 * Above-the-fold reveal staggers h1 → sub → CTA row via framer-motion.
 * `prefers-reduced-motion: reduce` hides the <video>; the poster remains.
 */
export default function Hero() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Default `false` — we don't know yet if the video can play. If autoplay
  // is blocked (some Safari setups) the poster stays forever, which is fine.
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onReady = () => setVideoReady(true);
    // `canplay` fires once the browser has buffered enough frames to play
    // through without stalling. `loadeddata` fires earlier but can stutter.
    v.addEventListener("canplay", onReady, { once: true });
    return () => v.removeEventListener("canplay", onReady);
  }, []);

  return (
    <section
      id="hero"
      className="relative h-[100svh] min-h-[640px] w-full overflow-hidden"
    >
      {/* ── Backdrop: poster + video + scrims ────────────────────────────── */}
      <div className="absolute inset-0" aria-hidden>
        {/* Poster — held until the video can play. Sits behind the <video>
            so it paints the very first frame, before JS hydrates. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/hf-poster.jpg"
          alt=""
          fetchPriority="high"
          className={
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out" +
            (videoReady ? " opacity-0" : " opacity-100")
          }
          style={{ objectPosition: "center 45%" }}
        />

        {/* Looping video. `motion-reduce:hidden` lets reduced-motion users
            see the static poster instead of the animated film. */}
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster="/assets/hf-poster.jpg"
          className="motion-reduce:hidden absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center 45%" }}
        >
          <source src="/assets/hf-lighthouse.mp4" type="video/mp4" />
        </video>

        {/* Top scrim — keeps the transparent nav legible over the dark sky */}
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/55 via-black/15 to-transparent" />

        {/* Left scrim — keeps the headline legible against the open water / sky */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-transparent" />

        {/* Bottom fade — the requested blend into the cream `--background` */}
        <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/75 to-transparent md:h-80" />
      </div>

      {/* ── Foreground content ──────────────────────────────────────────── */}
      <div className="container-1440 relative z-10 flex h-full flex-col justify-center px-5 min-[476px]:px-8 pb-32 md:pb-40">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
          className="font-display max-w-[18ch] text-[40px] min-[500px]:text-[48px] min-[760px]:text-[60px] min-[1100px]:text-[72px] font-normal leading-[1.02] tracking-[-0.02em] text-white"
        >
          Run your whole company with{" "}
          <span className="bg-gradient-to-r from-white via-[#e9d8fd] to-white bg-clip-text text-transparent">
            agents.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}
          className="font-display mt-6 max-w-[52ch] text-[17px] min-[760px]:text-[19px] leading-[1.45] tracking-[0.15px] text-white/85"
        >
          Helm is the agent orchestration platform for engineering, sales,
          marketing, design, finance, and ops. One company, run by people and
          AI, side by side.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.4 }}
          className="mt-8 flex flex-wrap items-center gap-3"
        >
          <LightButton
            as="a"
            href="/app/companies"
            className="h-[46px] px-6 text-[16px] font-medium"
          >
            Run a company
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path
                d="M5 12h14M13 6l6 6-6 6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </LightButton>

          <Link
            href="#value-props"
            className="inline-flex h-[46px] items-center gap-2 rounded-[10px] border border-white/25 bg-white/[0.04] px-5 font-display text-[16px] text-white/90 backdrop-blur-sm transition-colors hover:bg-white/[0.10] hover:border-white/40"
          >
            See how it works
          </Link>
        </motion.div>
      </div>

      {/* Scroll arrow — sits above the bottom fade so it stays visible */}
      <div className="absolute inset-x-0 bottom-6 z-10 hidden justify-center md:flex">
        <svg
          className="anim-scroll-arrow text-white/70"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path
            d="M6 9l6 6 6-6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </section>
  );
}