"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { RaisedCard } from "@/components/ui/primitives";
import { VALUE_PROPS } from "@/lib/site-data";

const EASE = [0.23, 1, 0.32, 1] as const;

/* Simple inline glyphs drawn to match each value prop, stroke = var(--text-70) */
const GLYPHS: Record<string, React.ReactNode> = {
  // Agentic departments — grid
  "Agentic departments": (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  // Human in the loop — person + check
  "Human in the loop": (
    <>
      <circle cx="10" cy="7.5" r="3.25" />
      <path d="M4 20c0-3.5 2.7-6 6-6 1.3 0 2.5.4 3.5 1" strokeLinecap="round" />
      <path d="M14.5 17.5l2 2 4-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // Fully extensible — plug
  "Fully extensible": (
    <>
      <path d="M9 3.5v3.5M15 3.5v3.5" strokeLinecap="round" />
      <rect x="6.5" y="7" width="11" height="6.5" rx="2" />
      <path d="M12 13.5v3.5a3.5 3.5 0 01-3.5 3.5H8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

export default function ValueProps() {
  return (
    <section id="value-props" className="py-20 md:py-28">
      <div className="container-1440 px-5 min-[476px]:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="grid grid-cols-1 gap-5 md:grid-cols-3"
        >
          {VALUE_PROPS.map((prop, i) => (
            <motion.div
              key={prop.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: EASE, delay: i * 0.12 }}
            >
              <RaisedCard className="h-full p-6 md:p-7">
                <div className="surface-gradient-chip flex h-10 w-10 items-center justify-center rounded-[6.629px]">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-70)"
                    strokeWidth="1.5"
                    aria-hidden
                  >
                    {GLYPHS[prop.title]}
                  </svg>
                </div>

                <h3 className="font-display mt-5 text-[20px] font-normal leading-[1.2] text-[var(--text)]">
                  {prop.title}
                </h3>

                <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--text-70)]">
                  {prop.body}
                </p>
              </RaisedCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
