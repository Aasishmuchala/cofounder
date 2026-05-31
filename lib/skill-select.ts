// Server-only: compare catalog skills for a task and pick the best one.
// Scoring is transparent (keyword overlap + department fit + kind + name match)
// so the Skills tab can show exactly WHY a skill won.

import { loadCatalog, type CatalogSkill } from "@/lib/skill-catalog";

export interface ScoredSkill extends CatalogSkill {
  score: number;
  reasons: string[];
}

export interface SkillComparison {
  chosen: ScoredSkill | null;
  candidates: ScoredSkill[];
}

const STOP = new Set([
  "the", "and", "for", "with", "your", "this", "that", "from", "into", "build",
  "create", "make", "draft", "write", "design", "company", "startup", "page",
]);

function words(s: string): string[] {
  return [...new Set((s || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)))];
}

/**
 * Pick the best skill OVERALL for a task — ranking the ENTIRE catalog (every
 * repo-imported skill AND every preloaded one, across all departments) so we
 * always land on the genuine best match, not the best within one silo.
 *
 * Department is a strong ranking SIGNAL, not a hard filter: same-department
 * skills get a meaningful edge (+6) and cross-cutting "General" skills a small
 * one (+2), but a skill from another department or source can still win if it
 * fits the task markedly better. Scoring is transparent so the Skills tab can
 * show exactly why the winner beat everything else.
 */
export function compareSkills(req: {
  department: string;
  kind?: string;
  title: string;
  detail?: string;
}): SkillComparison {
  const catalog = loadCatalog();
  if (catalog.length === 0) return { chosen: null, candidates: [] };

  const taskWords = words(`${req.title} ${req.detail ?? ""}`);
  const kindWords = (req.kind ?? "").split(/[_\s]+/).filter((w) => w.length > 2);

  const scored: ScoredSkill[] = catalog
    .map((s) => {
      const name = s.name.toLowerCase();
      const hay = `${name} ${s.description.toLowerCase()}`;
      let score = 0;
      const reasons: string[] = [];

      let hits = 0;
      for (const w of taskWords) {
        // stem tolerates morphology (animate/animation/animated, design/designer)
        const stem = w.length >= 6 ? w.slice(0, 5) : w;
        if (name.includes(w)) {
          score += 10; // an exact name hit is the strongest signal
          hits++;
        } else if (stem !== w && name.includes(stem)) {
          score += 7;
          hits++;
        } else if (hay.includes(w)) {
          score += 5;
          hits++;
        } else if (stem !== w && hay.includes(stem)) {
          score += 3;
          hits++;
        }
      }
      if (hits) reasons.push(`${hits} keyword match${hits > 1 ? "es" : ""}`);

      if (s.department === req.department) {
        score += 6;
        reasons.push("department fit");
      } else if (s.department === "General") {
        score += 2;
        reasons.push("cross-cutting");
      }
      for (const kw of kindWords) {
        if (hay.includes(kw)) {
          score += 5;
          reasons.push(`${kw} skill`);
        }
      }
      if (s.source?.startsWith("github:")) {
        score += 1; // trending-repo provenance
        reasons.push("from GitHub repo");
      } else if (s.source && s.source !== "community" && s.source !== "unknown") {
        score += 1; // curated/official source
      }
      return { ...s, score, reasons: [...new Set(reasons)] };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const chosen = scored[0] ?? null;
  // Make a cross-department winner explicit in the rationale.
  if (chosen && chosen.department !== req.department && chosen.department !== "General") {
    chosen.reasons = [...new Set([...chosen.reasons, `best overall — from ${chosen.department}`])];
  }
  return { chosen, candidates: scored.slice(0, 8) };
}
