import { coerceText } from "@/lib/agent-types";
import { loadCatalog, departmentCounts } from "@/lib/skill-catalog";
import { compareSkills } from "@/lib/skill-select";

export const runtime = "nodejs";

/**
 * Skill catalog API (read-only).
 *   GET /api/skills                                    -> overview { total, departments }
 *   GET /api/skills?department=Engineering[&q=react]   -> { skills } for a department
 *   GET /api/skills?q=stripe                           -> search across all
 *   GET /api/skills?compare=1&department=&kind=&title=&detail=
 *                                                      -> { chosen, candidates } comparison
 */
export async function GET(req: Request): Promise<Response> {
  const u = new URL(req.url);
  const department = coerceText(u.searchParams.get("department"), 40);
  const q = coerceText(u.searchParams.get("q"), 80).toLowerCase();

  // Comparison mode — rank skills for a task and pick the best.
  if (u.searchParams.get("compare")) {
    const cmp = compareSkills({
      department: department || "General",
      kind: coerceText(u.searchParams.get("kind"), 40),
      title: coerceText(u.searchParams.get("title"), 200),
      detail: coerceText(u.searchParams.get("detail"), 400),
    });
    const slim = (s: { name: string; description: string; department: string; source: string; score: number; reasons: string[] }) => ({
      name: s.name, description: s.description, department: s.department, source: s.source, score: s.score, reasons: s.reasons,
    });
    return Response.json({
      chosen: cmp.chosen ? slim(cmp.chosen) : null,
      candidates: cmp.candidates.map(slim),
    });
  }

  const catalog = loadCatalog();

  // Overview — totals + per-department counts.
  if (!department && !q) {
    return Response.json({ total: catalog.length, departments: departmentCounts() });
  }

  // List / search.
  let list = catalog;
  if (department) list = list.filter((s) => s.department === department);
  if (q) list = list.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
  return Response.json({
    total: list.length,
    skills: list.slice(0, 240).map((s) => ({ name: s.name, description: s.description, department: s.department, source: s.source })),
  });
}
