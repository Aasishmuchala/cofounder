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
 * Rank catalog skills for a task. Considers skills in the task's department plus
 * the cross-cutting "General" pool. Returns the chosen (top) skill + the ranked
 * shortlist with per-candidate scores and reasons.
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
  const pool = catalog.filter((s) => s.department === req.department || s.department === "General");

  const scored: ScoredSkill[] = pool
    .map((s) => {
      const name = s.name.toLowerCase();
      const hay = `${name} ${s.description.toLowerCase()}`;
      let score = 0;
      const reasons: string[] = [];

      let hits = 0;
      for (const w of taskWords) {
        if (name.includes(w)) {
          score += 10; // a name hit is the strongest signal
          hits++;
        } else if (hay.includes(w)) {
          score += 5;
          hits++;
        }
      }
      if (hits) reasons.push(`${hits} keyword match${hits > 1 ? "es" : ""}`);

      if (s.department === req.department) {
        score += 6;
        reasons.push("department fit");
      }
      for (const kw of kindWords) {
        if (hay.includes(kw)) {
          score += 5;
          reasons.push(`${kw} skill`);
        }
      }
      if (s.source && s.source !== "community" && s.source !== "unknown") {
        score += 1; // slight nudge for curated/official sources
      }
      return { ...s, score, reasons: [...new Set(reasons)] };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return { chosen: scored[0] ?? null, candidates: scored.slice(0, 8) };
}
