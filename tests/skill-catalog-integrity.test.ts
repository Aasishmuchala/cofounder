import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { INJECTION } from "@/lib/skills";
import { classifyDepartment, catalogSkillUrl } from "@/lib/skill-catalog";

// The first-party catalog contract: exactly 100 curated skills vendored in
// skills/, every one department-tagged, injection-clean, and substantial.
// This test reads the repo dir DIRECTLY (not loadCatalog()) so a developer's
// ~/.claude/skills library can never affect the result.

const SKILLS_DIR = path.join(process.cwd(), "skills");
const DEPARTMENTS = [
  "Engineering", "Product", "Design", "Marketing", "Sales", "Finance",
  "People", "Operations", "Support", "Data", "Legal", "Security",
];

interface RepoSkill {
  dir: string;
  name: string;
  description: string;
  department: string;
  source: string;
  body: string;
}

function readRepoSkills(): RepoSkill[] {
  const out: RepoSkill[] = [];
  for (const e of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const raw = fs.readFileSync(path.join(SKILLS_DIR, e.name, "SKILL.md"), "utf8");
    const fm = raw.match(/^---\s*\n([\s\S]*?)\n---/);
    const get = (k: string) => fm?.[1].match(new RegExp(`^${k}:\\s*(.+)$`, "m"))?.[1].trim() ?? "";
    out.push({
      dir: e.name,
      name: get("name"),
      description: get("description"),
      department: get("department"),
      source: get("source"),
      body: raw.replace(/^---[\s\S]*?\n---\n?/, ""),
    });
  }
  return out;
}

describe("first-party skill catalog — integrity", () => {
  const skills = readRepoSkills();

  it("ships exactly 100 skills", () => {
    expect(skills.length).toBe(100);
  });

  it("every skill has frontmatter: name matching its dir, description, valid department, source helm", () => {
    for (const s of skills) {
      expect(s.name, s.dir).toBe(s.dir);
      expect(s.description.length, s.dir).toBeGreaterThan(60);
      expect(DEPARTMENTS, `${s.dir} department "${s.department}"`).toContain(s.department);
      expect(s.source, s.dir).toBe("helm");
    }
  });

  it("covers all 12 org departments, weighted toward design/finance/legal/data", () => {
    const counts = new Map<string, number>();
    for (const s of skills) counts.set(s.department, (counts.get(s.department) ?? 0) + 1);
    for (const d of DEPARTMENTS) expect(counts.get(d) ?? 0, d).toBeGreaterThanOrEqual(5);
    expect(counts.get("Design")).toBeGreaterThanOrEqual(10);
    for (const d of ["Finance", "Legal", "Data"]) expect(counts.get(d) ?? 0, d).toBeGreaterThanOrEqual(9);
  });

  it("every body is substantial and passes the prompt-injection scan", () => {
    for (const s of skills) {
      expect(s.body.length, s.dir).toBeGreaterThan(1500);
      // The runner grounds prompts in skill bodies; a body tripping the shared
      // INJECTION regex would be blocked at equip time — catch it at build time.
      expect(INJECTION.test(s.body), `${s.dir} trips INJECTION`).toBe(false);
      expect(INJECTION.test(s.description), `${s.dir} description trips INJECTION`).toBe(false);
    }
  });

  it("explicit department frontmatter wins over the keyword classifier", () => {
    // e.g. bi-dashboard-design says "design" everywhere but is declared Data.
    const s = skills.find((x) => x.name === "bi-dashboard-design");
    expect(s?.department).toBe("Data");
  });

  it("classifyDepartment still covers all 12 departments for undeclared community skills", () => {
    expect(classifyDepartment("gdpr-helper", "privacy compliance")).toBe("Legal");
    expect(classifyDepartment("hiring-kit", "recruiting and onboarding")).toBe("People");
    expect(classifyDepartment("pentest-kit", "vulnerability scanning")).toBe("Security");
    expect(classifyDepartment("prd-helper", "roadmap and backlog grooming")).toBe("Product");
    expect(classifyDepartment("sql-toolkit", "analytics dashboards")).toBe("Data");
  });

  it("first-party skills link to their SKILL.md in this repo", () => {
    expect(catalogSkillUrl("helm", "landing-page-design")).toBe(
      "https://github.com/Aasishmuchala/cofounder/tree/main/skills/landing-page-design",
    );
  });
});
