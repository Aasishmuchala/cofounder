// Server-only: the preloaded skill catalog. Scans the FIRST-PARTY skill library
// vendored into this repo (skills/ — 100 curated, department-tagged SKILL.md
// files authored for Helm) plus any local Claude/Cursor skill library
// (~/.claude/skills, ~/.cursor/skills-cursor), classifies each into a
// department, and caches the index. The full SKILL.md body is read lazily when
// a skill is equipped.
//
// Department resolution: an explicit `department:` frontmatter field (validated
// against the org's department list) WINS; skills without one (e.g. home-dir
// community skills) fall back to the keyword classifier below.
//
// Graceful: if the dirs don't exist (e.g. a deploy without the library), the
// catalog is empty and callers fall back to open-design + live discovery.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface CatalogSkill {
  name: string;
  description: string;
  department: string;
  source: string;
  dir: string;
}

const HOME = process.env.SKILLS_HOME || os.homedir();
// Scan the FIRST-PARTY catalog vendored into this repo (skills/ — 100 curated
// skills, source: helm) AND the user's local skill library. The repo copy is
// listed FIRST so it wins the by-name dedupe in loadCatalog(): a first-party
// skill always beats a same-named home-dir copy, making the shipped catalog
// reproducible on any machine / deploy.
const ROOTS = [
  path.join(process.cwd(), "skills"),
  path.join(HOME, ".claude", "skills"),
  path.join(HOME, ".cursor", "skills-cursor"),
];

/** The org's department vocabulary — the only values an explicit `department:`
 *  frontmatter field may take (mirrors DEPARTMENTS in lib/agent-types.ts;
 *  duplicated as a plain set here to keep this module dependency-free). */
const VALID_DEPARTMENTS = new Set([
  "Engineering", "Product", "Design", "Marketing", "Sales", "Finance",
  "People", "Operations", "Support", "Data", "Legal", "Security",
]);

// Keyword FALLBACK for skills with no explicit `department:` frontmatter (the
// first-party catalog always declares one). First matching rule wins — specific
// departments before the broad Engineering catch-all, so e.g. a "sales
// dashboard" skill lands in Sales, not Engineering.
const DEPT_RULES: [string, RegExp][] = [
  ["Legal", /\b(legal|advogad|leiloeiro|juridic|contract|complian|gdpr|privacy|incorporat|patent|trademark|licen[sc]e|regulat|hipaa|pci|soc ?2)/i],
  ["Finance", /\b(financ|invoice|accounting|quant|trading|stripe|billing|valuation|fundrais|payment|paypal|revenue|\bdcf\b|\btax\b|budget|payroll|bookkeep|cfo)/i],
  ["Sales", /\b(sales|outbound|cold[- ]?email|\bcrm\b|lead gen|pipeline|hubspot|salesforce|pipedrive|prospect|outreach|sales-?automat)/i],
  ["Support", /\b(support|help ?desk|zendesk|freshdesk|freshservice|intercom|customer success|\bfaq\b|ticket|helpdesk|churn)/i],
  ["People", /\b(hiring|recruit|onboarding|offer letter|job descript|performance review|compensation|leveling|\bhr\b|people ops|employer brand|culture)/i],
  ["Security", /\b(security|threat model|pentest|vulnerab|appsec|infosec|breach|phishing|zero[- ]?trust|\bsso\b|\bmfa\b)/i],
  ["Data", /\b(analytics|\bsql\b|data (pipeline|warehouse|model)|\betl\b|\belt\b|dashboard|experiment analysis|cohort|forecast|\bbi\b|metabase|looker|dbt|research (brief|synthesis))/i],
  ["Product", /\b(product (manager|discovery|metric|launch|strategy)|\bprd\b|roadmap|backlog|user stor|\bmvp\b|feature spec|prioriti[sz]ation|jobs[- ]to[- ]be[- ]done)/i],
  ["Marketing", /\b(marketing|\bseo\b|growth|content|copywrit|\bads\b|campaign|blog|newsletter|email[- ]?marketing|influencer|viral|positioning|gtm|go-?to-?market|social-?(media|content|carousel))/i],
  ["Design", /\b(design|\bui\b|\bux\b|brand|figma|\bcss\b|tailwind|animation|landing[- ]?page|theme|color|typograph|awwwards|\bgsap\b|motion|wireframe|prototype|illustrat|\blogo\b|visual|aesthetic|shader|canvas)/i],
  ["Operations", /\b(automation|workflow|\bn8n\b|zapier|\bops\b|runbook|logistics|inventory|scheduling|project manage|\bjira\b|asana|monday|trello|notion|slack|calendar|procurement|supply chain|incident|on-?call|deploy|terraform|kubernetes|\bk8s\b|docker|devops|gitops|cicd|ci\/cd)/i],
  ["Engineering", /\b(react|next\.?js|node|typescript|javascript|python|rust|golang|\bgo\b|java|c\+\+|backend|frontend|fullstack|\bapi\b|database|postgres|graphql|fastapi|django|\bsdk\b|webpack|vite|\bbun\b|deno|firmware|embedded|game|unity|godot|mobile|\bios\b|android|flutter|electron|webgl|three\.?js|\bcode\b|build|test|debug|refactor|architect|microservice|engineer)/i],
];

export function classifyDepartment(name: string, description: string): string {
  const hay = `${name} ${description}`;
  for (const [dept, re] of DEPT_RULES) if (re.test(hay)) return dept;
  return "General";
}

/** Read just the head of a file (enough for frontmatter) without loading it all. */
function readHead(p: string, bytes = 4096): string {
  const fd = fs.openSync(p, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const n = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.toString("utf8", 0, n);
  } finally {
    fs.closeSync(fd);
  }
}

function frontmatter(head: string): { name?: string; description?: string; source?: string; department?: string } {
  const m = head.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = m[1];
  const get = (k: string) => {
    const r = fm.match(new RegExp(`^${k}:\\s*(.+)$`, "m"));
    return r ? r[1].trim().replace(/^["']|["']$/g, "") : undefined;
  };
  return { name: get("name"), description: get("description"), source: get("source"), department: get("department") };
}

let cache: CatalogSkill[] | null = null;

/** Build (once) + return the full classified catalog. */
export function loadCatalog(): CatalogSkill[] {
  if (cache) return cache;
  const out: CatalogSkill[] = [];
  const seen = new Set<string>();
  for (const root of ROOTS) {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue; // dir absent — skip
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const file = path.join(root, e.name, "SKILL.md");
      let fm: { name?: string; description?: string; source?: string };
      try {
        fm = frontmatter(readHead(file));
      } catch {
        continue; // no SKILL.md
      }
      const name = (fm.name || e.name).trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const description = (fm.description || "").replace(/\s+/g, " ").trim().slice(0, 280);
      // Explicit, validated `department:` frontmatter wins; keyword fallback
      // covers community skills that don't declare one.
      const declared = (fm.department || "").trim();
      out.push({
        name,
        description,
        department: VALID_DEPARTMENTS.has(declared) ? declared : classifyDepartment(name, description),
        source: (fm.source || "community").slice(0, 40),
        dir: path.join(root, e.name),
      });
    }
  }
  cache = out.sort((a, b) => a.name.localeCompare(b.name));
  return cache;
}

/** Department -> count, for the catalog overview. */
export function departmentCounts(): { department: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of loadCatalog()) counts.set(s.department, (counts.get(s.department) ?? 0) + 1);
  return [...counts.entries()].map(([department, count]) => ({ department, count })).sort((a, b) => b.count - a.count);
}

/** The SKILL.md body (frontmatter stripped), capped, for prompt grounding. */
export function readSkillBody(dir: string, cap = 6000): string {
  try {
    const text = fs.readFileSync(path.join(dir, "SKILL.md"), "utf8");
    return text.replace(/^---[\s\S]*?\n---\n?/, "").trim().slice(0, cap);
  } catch {
    return "";
  }
}

/** Look up a catalog skill by exact name. */
export function skillByName(name: string): CatalogSkill | null {
  return loadCatalog().find((s) => s.name === name) ?? null;
}

/**
 * Public URL for a catalog skill, derived from its provenance `source`.
 * First-party skills carry `source: helm` and link to their SKILL.md in this
 * repo. Imported skills carry `source: github:owner/repo` (a bare `owner/repo`
 * also works); anything without repo provenance falls back to a GitHub search —
 * so an equipped catalog skill ALWAYS exposes a live, clickable link.
 */
export function catalogSkillUrl(source: string | undefined, name: string): string {
  const s = (source || "").trim();
  if (s === "helm") {
    return `https://github.com/Aasishmuchala/cofounder/tree/main/skills/${encodeURIComponent(name)}`;
  }
  const m = s.match(/^(?:github:)?([\w.-]+\/[\w.-]+)$/i);
  if (m) return `https://github.com/${m[1]}`;
  return `https://github.com/search?q=${encodeURIComponent(`${name} skill`)}&type=repositories`;
}
