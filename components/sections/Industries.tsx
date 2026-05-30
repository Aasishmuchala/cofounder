"use client";

import { motion } from "framer-motion";
import { RaisedCard, Chip, MonoLabel } from "@/components/ui/primitives";
import { INDUSTRIES } from "@/lib/site-data";

const EASE = [0.23, 1, 0.32, 1] as const;

const COLS = 12;
const ROWS = 9;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/* Deterministic pseudo-random so server + client render identically. */
function seeded(r: number, c: number) {
  const n = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

type Cell = { letter: string; found: boolean };

function buildGrid(): Cell[][] {
  // Fill with deterministic random letters.
  const grid: Cell[][] = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => ({
      letter: ALPHABET[Math.floor(seeded(r, c) * 26)],
      found: false,
    }))
  );

  // Place each industry word on its own row, starting at col 0,
  // uppercased, spaces stripped, truncated to grid width.
  INDUSTRIES.forEach((word, idx) => {
    if (idx >= ROWS) return;
    const letters = word.replace(/\s+/g, "").toUpperCase().slice(0, COLS);
    for (let c = 0; c < letters.length; c++) {
      grid[idx][c] = { letter: letters[c], found: true };
    }
  });

  return grid;
}

const GRID = buildGrid();

export default function Industries() {
  return (
    <section id="industries" className="py-20 md:py-28">
      <div className="container-1440 px-5 min-[476px]:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="font-display mx-auto max-w-[16ch] text-center text-[28px] font-normal leading-[1.15] text-[var(--text)] md:text-[32px] min-[1000px]:text-[40px]"
        >
          Build across industries
        </motion.h2>

        <div className="mt-12 grid gap-6 md:mt-16 lg:grid-cols-[1.5fr_1fr] lg:items-center">
          {/* Word-search grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <RaisedCard className="p-5 md:p-7">
              <div className="mb-4 flex items-center justify-between">
                <MonoLabel>Word search</MonoLabel>
                <MonoLabel>{`${INDUSTRIES.length} found`}</MonoLabel>
              </div>
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
                aria-hidden
              >
                {GRID.flatMap((row, r) =>
                  row.map((cell, c) => (
                    <div
                      key={`${r}-${c}`}
                      className={
                        cell.found
                          ? "surface-gradient-chip flex aspect-square items-center justify-center rounded-[4px] font-mono text-[14px] uppercase text-[var(--text)]"
                          : "flex aspect-square items-center justify-center font-mono text-[14px] uppercase text-[var(--text-30)]"
                      }
                    >
                      {cell.letter}
                    </div>
                  ))
                )}
              </div>
            </RaisedCard>
          </motion.div>

          {/* Industry chips */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          >
            <MonoLabel>Spotted in the grid</MonoLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              {INDUSTRIES.map((industry) => (
                <Chip key={industry}>{industry}</Chip>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
