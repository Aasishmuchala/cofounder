"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  SectionEyebrow,
  SectionHeadline,
  SectionLead,
  RevealOnView,
  RaisedCard,
  MonoLabel,
  cx,
} from "@/components/ui/primitives";
import { INDUSTRIES } from "@/lib/site-data";

const EASE = [0.23, 1, 0.32, 1] as const;

const COLS = 11;
const ROWS = 8;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type Cell = { letter: string; wordIdx: number | null };

type PlacedWord = {
  word: string;
  startRow: number;
  startCol: number;
  deltaRow: number;
  deltaCol: number;
};

const DIRS: Array<[number, number]> = [
  [0, 1], // →
  [1, 0], // ↓
  [1, 1], // ↘
  [-1, 1], // ↗
];

/* Place each word on the grid in a random direction from a random
   starting cell. Returns a fully populated grid + the placements. */
function buildPuzzle(words: string[]): { grid: Cell[][]; placed: PlacedWord[] } {
  const grid: Cell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      letter: ALPHABET[Math.floor(Math.random() * 26)],
      wordIdx: null,
    })),
  );

  const placed: PlacedWord[] = [];

  words.forEach((raw, idx) => {
    const word = raw.replace(/\s+/g, "").toUpperCase();
    if (!word) return;
    const candidates: Array<[number, number, number, number]> = [];

    // collect all candidate placements that fit
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        for (const [dr, dc] of DIRS) {
          const endR = r + dr * (word.length - 1);
          const endC = c + dc * (word.length - 1);
          if (endR < 0 || endR >= ROWS || endC < 0 || endC >= COLS) continue;
          candidates.push([r, c, dr, dc]);
        }
      }
    }

    // shuffle candidates deterministically by word+idx
    candidates.sort((a, b) => {
      const sa = (a[0] * 31 + a[1] * 17 + a[2] * 7 + a[3]) ^ (idx * 13);
      const sb = (b[0] * 31 + b[1] * 17 + b[2] * 7 + b[3]) ^ (idx * 13);
      return sa - sb;
    });

    for (const [r, c, dr, dc] of candidates) {
      let collides = false;
      // check existing wordIdx match for overlap
      for (let i = 0; i < word.length; i++) {
        const rr = r + dr * i;
        const cc = c + dc * i;
        const cell = grid[rr][cc];
        if (cell.wordIdx !== null && cell.letter !== word[i]) {
          collides = true;
          break;
        }
      }
      if (collides) continue;

      for (let i = 0; i < word.length; i++) {
        const rr = r + dr * i;
        const cc = c + dc * i;
        grid[rr][cc] = { letter: word[i], wordIdx: idx };
      }
      placed.push({
        word,
        startRow: r,
        startCol: c,
        deltaRow: dr,
        deltaCol: dc,
      });
      break;
    }
  });

  return { grid, placed };
}

/* ── Selection state ───────────────────────────────────────────── */
type Selection = Array<{ row: number; col: number }>;

function selectionMatchesWord(
  sel: Selection,
  word: PlacedWord,
): boolean {
  if (sel.length !== word.word.length) return false;
  const dr = sel.length > 1 ? Math.sign(sel[1].row - sel[0].row) : 0;
  const dc = sel.length > 1 ? Math.sign(sel[1].col - sel[0].col) : 0;
  for (let i = 0; i < word.word.length; i++) {
    const r = word.startRow + word.deltaRow * i;
    const c = word.startCol + word.deltaCol * i;
    const want = { row: r, col: c };
    const got = sel[i];
    if (!got || got.row !== want.row || got.col !== want.col) return false;
  }
  return true;
}

function cellsForWord(word: PlacedWord): Array<{ row: number; col: number }> {
  return Array.from({ length: word.word.length }, (_, i) => ({
    row: word.startRow + word.deltaRow * i,
    col: word.startCol + word.deltaCol * i,
  }));
}

export default function Industries() {
  const [puzzleSeed, setPuzzleSeed] = React.useState(0);
  const { grid, placed } = React.useMemo(
    () => buildPuzzle(INDUSTRIES),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [puzzleSeed],
  );
  const [found, setFound] = React.useState<Set<number>>(new Set());
  const [dragStart, setDragStart] = React.useState<{
    row: number;
    col: number;
  } | null>(null);
  const [dragEnd, setDragEnd] = React.useState<{
    row: number;
    col: number;
  } | null>(null);

  // Derive cells on the line between dragStart and dragEnd
  const dragPath = React.useMemo<Selection>(() => {
    if (!dragStart) return [];
    if (!dragEnd) return [dragStart];
    const dr = dragEnd.row - dragStart.row;
    const dc = dragEnd.col - dragStart.col;
    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    if (steps === 0) return [dragStart];
    const sr = Math.sign(dr);
    const sc = Math.sign(dc);
    const path: Selection = [];
    for (let i = 0; i <= steps; i++) {
      path.push({
        row: dragStart.row + sr * i,
        col: dragStart.col + sc * i,
      });
    }
    return path;
  }, [dragStart, dragEnd]);

  const pathKey = (s: Selection) =>
    s.map((c) => `${c.row},${c.col}`).join("|");

  // On every dragEnd, check if any unfound word matches the path.
  React.useEffect(() => {
    if (!dragEnd || !dragStart) return;
    for (let i = 0; i < placed.length; i++) {
      if (found.has(i)) continue;
      if (selectionMatchesWord(dragPath, placed[i])) {
        setFound((prev) => new Set([...Array.from(prev), i]));
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragEnd]);

  const onCellPointerDown = (r: number, c: number) => {
    setDragStart({ row: r, col: c });
    setDragEnd({ row: r, col: c });
  };
  const onCellPointerEnter = (r: number, c: number) => {
    if (!dragStart) return;
    setDragEnd({ row: r, col: c });
  };
  const onPointerUp = () => {
    setDragStart(null);
    setDragEnd(null);
  };

  const isOnPath = (r: number, c: number) =>
    dragPath.some((p) => p.row === r && p.col === c);

  const isFoundCell = (r: number, c: number) => {
    for (let i = 0; i < placed.length; i++) {
      if (!found.has(i)) continue;
      if (cellsForWord(placed[i]).some((p) => p.row === r && p.col === c)) {
        return true;
      }
    }
    return false;
  };

  const reset = () => {
    setFound(new Set());
    setPuzzleSeed((s) => s + 1);
  };

  return (
    <section
      id="industries"
      className="py-20 md:py-28"
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div className="container-1440 px-5 min-[476px]:px-8">
        <RevealOnView>
          <div className="mx-auto flex max-w-[820px] flex-col items-center text-center">
            <SectionEyebrow index="07">Industries</SectionEyebrow>
            <SectionHeadline accent="anywhere." className="mt-6">
              Build a company
            </SectionHeadline>
            <SectionLead className="mt-5">
              Find the hidden industry. Click and drag across letters to
              select a word — release on the last letter to lock it in.
            </SectionLead>
          </div>
        </RevealOnView>

        <div className="mt-14 grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {/* Word search */}
          <RevealOnView>
            <RaisedCard deep className="select-none p-5 md:p-7">
              <div className="mb-4 flex items-center justify-between">
                <MonoLabel>Word search</MonoLabel>
                <div className="flex items-center gap-3">
                  <MonoLabel>
                    {found.size} / {placed.length} found
                  </MonoLabel>
                  <button
                    type="button"
                    onClick={reset}
                    className="font-display inline-flex h-7 items-center gap-1.5 rounded-[6px] border border-[var(--border-line)] bg-white px-2.5 text-[11.5px] text-[var(--text-70)] hover:bg-[var(--surface-raised)]"
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      aria-hidden
                    >
                      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
                      <path d="M21 3v5h-5" />
                    </svg>
                    New puzzle
                  </button>
                </div>
              </div>
              <div
                className="grid gap-1.5"
                style={{
                  gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
                  touchAction: "none",
                }}
              >
                {grid.flatMap((row, r) =>
                  row.map((cell, c) => {
                    const onPath = isOnPath(r, c);
                    const found = isFoundCell(r, c);
                    return (
                      <button
                        key={`${r}-${c}`}
                        type="button"
                        onPointerDown={() => onCellPointerDown(r, c)}
                        onPointerEnter={() => onCellPointerEnter(r, c)}
                        className={cx(
                          "relative aspect-square select-none rounded-[5px] font-mono text-[13px] font-medium uppercase transition-colors",
                          found
                            ? "surface-gradient-chip text-[var(--green)]"
                            : onPath
                              ? "bg-[var(--text)] text-white"
                              : "bg-[var(--surface-deep)] text-[var(--text-80)] shadow-raised hover:bg-[var(--surface-raised)]",
                        )}
                      >
                        {cell.letter}
                        {found && (
                          <motion.span
                            className="absolute inset-0 rounded-[5px] border border-[var(--green)]"
                            initial={{ opacity: 0.8, scale: 1 }}
                            animate={{ opacity: 0, scale: 1.4 }}
                            transition={{ duration: 0.8, ease: EASE }}
                            aria-hidden
                          />
                        )}
                      </button>
                    );
                  }),
                )}
              </div>
              <div className="mt-4 flex items-center gap-3 text-[11.5px] text-[var(--text-50)]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="block h-3 w-3 rounded-[3px] bg-[var(--text)]" />
                  Selecting
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="block h-3 w-3 rounded-[3px] bg-[var(--green-tint)] ring-1 ring-[var(--green)]" />
                  Found
                </span>
              </div>
            </RaisedCard>
          </RevealOnView>

          {/* Industry chips with found state */}
          <RevealOnView delay={0.08}>
            <div className="flex flex-col gap-5">
              <div>
                <MonoLabel>SPOTTED IN THE GRID</MonoLabel>
                <div className="mt-3 flex flex-wrap gap-2">
                  {INDUSTRIES.map((industry, i) => {
                    const isFound = found.has(i);
                    return (
                      <motion.span
                        key={industry}
                        animate={{
                          backgroundColor: isFound
                            ? "rgba(52, 168, 83, 0.12)"
                            : "rgba(0, 0, 0, 0)",
                          color: isFound
                            ? "var(--green)"
                            : "var(--text-70)",
                          scale: isFound ? 1.02 : 1,
                        }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className={cx(
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-[13px]",
                          !isFound && "surface-gradient-chip",
                          isFound && "ring-1 ring-[var(--green)]",
                        )}
                      >
                        {isFound ? (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path
                              d="M5 13l4 4L19 7"
                              stroke="var(--green)"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          <span
                            className="block h-1.5 w-1.5 rounded-full"
                            style={{ background: "var(--text-30)" }}
                          />
                        )}
                        <span className={isFound ? "line-through" : ""}>
                          {industry}
                        </span>
                      </motion.span>
                    );
                  })}
                </div>
              </div>

              {/* Stats */}
              <RaisedCard className="p-5">
                <MonoLabel>STATUS</MonoLabel>
                <div className="mt-3 grid grid-cols-3 gap-2.5">
                  {[
                    { k: "FOUND", v: found.size },
                    { k: "HIDDEN", v: placed.length - found.size },
                    { k: "GRID", v: `${COLS}×${ROWS}` },
                  ].map((s) => (
                    <div
                      key={s.k}
                      className="rounded-[8px] bg-white p-3 shadow-raised"
                    >
                      <MonoLabel>{s.k}</MonoLabel>
                      <div className="font-display mt-1.5 text-[20px] leading-none tabular-nums text-[var(--text)]">
                        {s.v}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 font-display text-[12.5px] text-[var(--text-70)]">
                  {found.size === placed.length
                    ? "All industries found. Helm runs in all of them."
                    : found.size === 0
                      ? "Drag across the grid to find a hidden industry."
                      : `${placed.length - found.size} more to go.`}
                </div>
              </RaisedCard>
            </div>
          </RevealOnView>
        </div>
      </div>
    </section>
  );
}