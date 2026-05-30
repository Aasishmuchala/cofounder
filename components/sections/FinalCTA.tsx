"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { LightButton, RaisedCard } from "@/components/ui/primitives";

const EASE = [0.23, 1, 0.32, 1] as const;

export default function FinalCTA() {
  return (
    <section id="final-cta" className="py-20 md:py-28">
      <div className="container-1440 px-5 min-[476px]:px-8">
        <RaisedCard
          deep
          className="relative overflow-hidden px-6 py-20 md:px-12 md:py-28"
        >
          {/* Decorative clouds */}
          <Image
            src="/build-ui-bits/clouds-left.png"
            alt=""
            aria-hidden
            width={420}
            height={280}
            className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 w-[200px] opacity-25 select-none md:w-[340px]"
          />
          <Image
            src="/build-ui-bits/clouds-right.png"
            alt=""
            aria-hidden
            width={420}
            height={280}
            className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-[200px] opacity-25 select-none md:w-[340px]"
          />

          <div className="relative z-10 mx-auto flex max-w-[40ch] flex-col items-center text-center">
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: EASE }}
              className="font-display text-[30px] font-normal leading-[1.12] text-[var(--text)] md:text-[40px]"
            >
              Run an entire company with AI agents
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.12 }}
              className="font-display mt-4 max-w-[36ch] text-[16px] leading-[1.45] text-[var(--text-70)]"
            >
              Engineering, sales, marketing, design, finance, and ops — all in one place.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.24 }}
              className="mt-8"
            >
              <Link href="/app">
                <LightButton as="span" className="h-[44px] px-6 text-[15px]">
                  Run a company
                </LightButton>
              </Link>
            </motion.div>
          </div>
        </RaisedCard>
      </div>
    </section>
  );
}
