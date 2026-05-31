"use client";

import { motion } from "framer-motion";
import { RaisedCard, LightButton } from "@/components/ui/primitives";
import { CHAPTERS } from "@/lib/site-data";

const SPINE_COLORS = [
  "var(--green)",
  "var(--blue)",
  "var(--amber)",
  "var(--coral)",
];

const CHAPTER_IMAGES = [
  "/chapters/start.jpg",
  "/chapters/build.jpg",
  "/chapters/sell.jpg",
  "/chapters/scale.jpg",
];

const EASE = [0.23, 1, 0.32, 1] as const;

export default function Chapters() {
  return (
    <section id="chapters" className="py-20 md:py-28">
      <div className="container-1440 px-5 min-[476px]:px-8">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="flex flex-col items-center text-center"
        >
          <span className="font-mono uppercase text-[var(--text-50)] tracking-[0.14em] text-[10px]">
            By Helm, 2026
          </span>
          <h2 className="font-display mt-3 text-[28px] md:text-[32px] min-[1000px]:text-[40px] font-normal leading-[1.15] text-[var(--text)]">
            Learn how to start a company
          </h2>
        </motion.div>

        {/* Chapter cards */}
        <div className="mt-12 grid grid-cols-2 gap-4 md:mt-14 md:grid-cols-4 md:gap-5">
          {CHAPTERS.map((chapter, i) => (
            <motion.div
              key={chapter.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease: EASE, delay: i * 0.1 }}
            >
              <RaisedCard className="group relative flex aspect-[3/4] flex-col overflow-hidden">
                {/* Chapter cover image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={CHAPTER_IMAGES[i % CHAPTER_IMAGES.length]}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.05]"
                />
                {/* Legibility scrim — cream from the bottom for the title block */}
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-[var(--surface-raised)] via-[var(--surface-raised)]/80 to-transparent"
                />

                {/* Spine accent */}
                <span
                  aria-hidden
                  className="absolute left-0 top-0 z-[1] h-full w-[6px]"
                  style={{ background: SPINE_COLORS[i % SPINE_COLORS.length] }}
                />

                {/* Roman numeral */}
                <span className="font-display absolute right-4 top-3 z-[1] text-[40px] font-normal leading-none text-[var(--text-30)] [text-shadow:0_1px_3px_rgba(255,255,255,0.65)] select-none">
                  {chapter.num}
                </span>

                {/* Bottom content */}
                <div className="relative z-[1] mt-auto p-5 pl-6">
                  <h3 className="font-display text-[22px] font-normal leading-[1.1] text-[var(--text)]">
                    {chapter.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-[1.4] text-[var(--text-70)]">
                    {chapter.blurb}
                  </p>
                  <span className="font-mono mt-4 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-[var(--text-50)] transition-colors group-hover:text-[var(--text-80)]">
                    Read this chapter
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      className="transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    >
                      <path
                        d="M5 12h14M13 6l6 6-6 6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
              </RaisedCard>
            </motion.div>
          ))}
        </div>

        {/* Download CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
          className="mt-10 flex justify-center md:mt-12"
        >
          <LightButton>Download full guide</LightButton>
        </motion.div>
      </div>
    </section>
  );
}
