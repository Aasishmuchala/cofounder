"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SectionEyebrow,
  SectionHeadline,
  SectionLead,
  RevealOnView,
  RaisedCard,
  MonoLabel,
  BlinkDot,
  cx,
} from "@/components/ui/primitives";
import { CHAPTERS } from "@/lib/site-data";

/* Each chapter has its own micro word-search: a tiny grid with a
   few industry words hidden. Letters are placed in random positions;
   the user clicks letters in order to find the word.               */
type Cell = { letter: string; found: boolean; wordId?: number };

function buildChapterGrid(industry: string): Cell[][] {
  const ROWS = 6;
  const COLS = 7;
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const grid: Cell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      letter: ALPHABET[Math.floor(Math.random() * 26)],
      found: false,
    })),
  );
  // Place industry letters horizontally at row 1.
  const letters = industry.replace(/\s+/g, "").toUpperCase().slice(0, COLS);
  for (let c = 0; c < letters.length; c++) {
    grid[1][c] = { letter: letters[c], found: false, wordId: 1 };
  }
  return grid;
}

const CHAPTER_INDUSTRIES = [
  "PLATFORM",
  "CONTENT",
  "OUTREACH",
  "GROWTH",
];

const EASE = [0.23, 1, 0.32, 1] as const;

/* ── Word-search widget for one chapter ───────────────────────── */
function ChapterSearch({ industry }: { industry: string }) {
  const [grid, setGrid] = React.useState<Cell[][]>(() =>
    buildChapterGrid(industry),
  );
  const [found, setFound] = React.useState(false);

  const handlePick = (r: number, c: number) => {
    setGrid((prev) => {
      const next = prev.map((row) => row.slice());
      const cell = next[r][c];
      if (!cell.wordId) return prev;
      cell.found = !cell.found;
      return next;
    });
    setFound(true);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <MonoLabel>Word puzzle</MonoLabel>
        <MonoLabel>{found ? "1 / 1 found" : "0 / 1 found"}</MonoLabel>
      </div>
      <div
        className="grid gap-1.5 rounded-[10px] bg-[var(--surface-deep)] p-3 shadow-raised"
        style={{ gridTemplateColumns: `repeat(${grid[0].length}, minmax(0, 1fr))` }}
      >
        {grid.flatMap((row, r) =>
          row.map((cell, c) => (
            <button
              key={`${r}-${c}`}
              type="button"
              onClick={() => handlePick(r, c)}
              className={cx(
                "aspect-square rounded-[5px] font-mono text-[13px] font-medium uppercase transition-colors",
                cell.found
                  ? "surface-gradient-chip text-[var(--green)]"
                  : cell.wordId
                    ? "bg-white text-[var(--text)] shadow-raised hover:bg-[var(--surface-raised)]"
                    : "bg-[var(--text-30)]/10 text-[var(--text-30)]",
              )}
            >
              {cell.letter}
            </button>
          )),
        )}
      </div>
      <p className="mt-3 text-[12.5px] text-[var(--text-50)]">
        Find the industry word: <span className="font-mono uppercase tracking-wide text-[var(--text-80)]">{industry}</span>
      </p>
    </div>
  );
}

/* ── Chapter cover ────────────────────────────────────────────── */
function ChapterCover({ index }: { index: number }) {
  const cover = `/chapters/${["start", "build", "sell", "scale"][index]}.svg`;
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[10px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1100ms] ease-out group-hover:scale-[1.06]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
      <span
        className="font-display absolute right-4 top-4 text-[36px] font-normal leading-none text-white/80 [text-shadow:0_2px_6px_rgba(0,0,0,0.6)]"
        aria-hidden
      >
        {CHAPTERS[index].num}
      </span>
    </div>
  );
}

/* ── Section ──────────────────────────────────────────────────── */
export default function Chapters() {
  const [active, setActive] = React.useState(0);
  const chapter = CHAPTERS[active];

  return (
    <section id="chapters" className="py-20 md:py-28">
      <div className="container-1440 px-5 min-[476px]:px-8">
        {/* Heading */}
        <RevealOnView>
          <div className="mx-auto flex max-w-[820px] flex-col items-center text-center">
            <SectionEyebrow index="03">The handbook</SectionEyebrow>
            <SectionHeadline accent="in four chapters." className="mt-6">
              Learn to start a company,
            </SectionHeadline>
            <SectionLead className="mt-5">
              Everything Helm knows about bootstrapping a company, distilled
              into four short chapters. Read it cover-to-cover or jump to the
              part you need.
            </SectionLead>
          </div>
        </RevealOnView>

        {/* Two-column reader */}
        <div className="mt-16 grid items-start gap-10 md:grid-cols-[260px_minmax(0,1fr)] md:gap-12">
          {/* Sticky TOC */}
          <RevealOnView>
            <nav className="md:sticky md:top-28">
              <MonoLabel>Contents</MonoLabel>
              <ul className="mt-4 flex flex-col gap-1">
                {CHAPTERS.map((c, i) => {
                  const isActive = i === active;
                  return (
                    <li key={c.title}>
                      <button
                        type="button"
                        onClick={() => setActive(i)}
                        className={cx(
                          "group flex w-full items-center justify-between gap-3 rounded-[10px] px-3.5 py-3 text-left transition-colors",
                          isActive
                            ? "surface-gradient-chip"
                            : "hover:bg-[var(--surface-raised)]",
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className={cx(
                              "font-mono text-[11px] font-medium",
                              isActive ? "text-[var(--text)]" : "text-[var(--text-30)]",
                            )}
                          >
                            {c.num}
                          </span>
                          <span
                            className={cx(
                              "font-display text-[15px]",
                              isActive ? "text-[var(--text)]" : "text-[var(--text-70)]",
                            )}
                          >
                            {c.title}
                          </span>
                        </span>
                        {isActive && (
                          <BlinkDot color="var(--green)" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Progress bar */}
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <MonoLabel>Chapter {active + 1} of {CHAPTERS.length}</MonoLabel>
                  <MonoLabel>
                    {Math.round(((active + 1) / CHAPTERS.length) * 100)}%
                  </MonoLabel>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--border-line)]">
                  <motion.div
                    className="h-full bg-[var(--green)]"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${((active + 1) / CHAPTERS.length) * 100}%`,
                    }}
                    transition={{ duration: 0.6, ease: EASE }}
                  />
                </div>
              </div>
            </nav>
          </RevealOnView>

          {/* Reader pane */}
          <RevealOnView delay={0.1}>
            <AnimatePresence mode="wait">
              <motion.div
                key={chapter.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                <RaisedCard deep className="overflow-hidden p-0">
                  <div className="grid md:grid-cols-2">
                    <div className="group p-3">
                      <ChapterCover index={active} />
                    </div>
                    <div className="flex flex-col justify-center p-6 md:p-8">
                      <MonoLabel>CHAPTER {chapter.num}</MonoLabel>
                      <h3 className="font-display mt-3 text-[28px] font-normal leading-[1.1] tracking-[-0.02em] text-[var(--text)] md:text-[32px]">
                        {chapter.title}
                      </h3>
                      <p className="mt-3 max-w-[40ch] text-[15px] leading-[1.55] text-[var(--text-70)]">
                        {chapter.blurb}
                      </p>
                      <div className="mt-5 flex items-center gap-3">
                        <span className="font-display inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[var(--text)] px-4 text-[13.5px] text-white">
                          Read chapter
                          <svg
                            width="13"
                            height="13"
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
                        </span>
                        <MonoLabel>~ 6 min</MonoLabel>
                      </div>
                    </div>
                  </div>

                  <div className="divider-etched w-full" />

                  <div className="grid gap-6 p-6 md:grid-cols-[1.2fr_1fr] md:p-8">
                    <div>
                      <MonoLabel>WHAT YOU'LL LEARN</MonoLabel>
                      <ul className="mt-4 grid gap-3">
                        {[
                          ["Why starting is the easiest step", "Most founders skip this and lose a year."],
                          ["The four milestones that matter", "Incorporation, identity, product, go-to-market."],
                          ["What to delegate to agents on day one", "And what you should never delegate."],
                        ].map(([t, b]) => (
                          <li
                            key={t}
                            className="flex gap-3 rounded-[10px] bg-[var(--surface-deep)] p-3 shadow-raised"
                          >
                            <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--green-tint)]">
                              <svg
                                width="11"
                                height="11"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="var(--green)"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden
                              >
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                            <div>
                              <div className="font-display text-[14.5px] text-[var(--text)]">
                                {t}
                              </div>
                              <div className="font-display mt-0.5 text-[12.5px] text-[var(--text-70)]">
                                {b}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <ChapterSearch industry={CHAPTER_INDUSTRIES[active]} />
                    </div>
                  </div>
                </RaisedCard>
              </motion.div>
            </AnimatePresence>
          </RevealOnView>
        </div>

        {/* Bottom CTA */}
        <RevealOnView>
          <div className="mt-12 flex justify-center">
            <span className="font-display inline-flex h-11 items-center gap-2 rounded-[10px] border border-[var(--border-line)] bg-white px-5 text-[14px] text-[var(--text-80)] shadow-raised hover:bg-[var(--surface-raised)]">
              Download the full guide
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path
                  d="M12 4v12M5 11l7 7 7-7M4 21h16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </RevealOnView>
      </div>
    </section>
  );
}