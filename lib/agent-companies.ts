// Interop with the companies.sh "Agent Companies" open standard (schema
// `agentcompanies/v1`): map a portable markdown company package <-> a Helm
// workspace. PURE — no network, no DB, no model. The route wires it to GitHub +
// persistence; this module only parses, maps, and serializes, so it is unit-tested
// directly (tests/agent-companies.test.ts).
//
// Package layout (https://companies.sh/docs):
//   COMPANY.md              — frontmatter: name, description, slug, schema,
//                             version, license, authors[], goals[]  + markdown body
//   agents/<slug>/AGENTS.md — frontmatter: name, title, reportsTo (slug|null),
//                             skills[]  + the agent's system-prompt body
//   skills/<slug>/SKILL.md  — frontmatter: name, description(, department)  + body
//   TASK.md (optional)      — pre-loaded tasks/assignments (markdown checklist)
//
// Helm mapping (import):
//   COMPANY.md  -> workspace name/idea + goals
//   AGENTS.md   -> meta.customAgents[] (name+blurb+inferred department) + the
//                  reportsTo graph, unioned into meta.activeDepartments[]
//   SKILL.md    -> AgentCompanySkill[] (Helm's own catalog is already this shape)
//   TASK.md     -> Omit<Task,"id">[]  (title + department + detail + status)
//
// Everything is bounded through the SAME coercers a hand-built workspace uses
// (coerceText / coerceDepartment / coerceStatus / sanitizeWorkspaceMeta), so an
// imported package can never exceed Helm's existing caps.

import {
  coerceText,
  coerceStatus,
  coerceDepartment,
  sanitizeWorkspaceMeta,
  DEPARTMENTS,
  ORCH_MAX_TASKS,
  type Task,
  type TaskStatus,
  type WorkspaceMeta,
  type CustomAgentSpec,
} from "@/lib/agent-types";

/** The current standard schema id this module reads/writes. */
export const AGENT_COMPANIES_SCHEMA = "agentcompanies/v1";

/* ----------------------------- normalized model ---------------------------- */

export interface AgentCompanyAgent {
  /** Display name from frontmatter (e.g. "CTO"). */
  name: string;
  /** Long title (e.g. "Chief Technology Officer"), else "". */
  title: string;
  /** Helm department this role maps to (inferred — AGENTS.md has no department field). */
  department: string;
  /** Slug of the agent this one reports to (the org-chart edge), or null for the root. */
  reportsTo: string | null;
  /** Names of the skills this agent is equipped with. */
  skills: string[];
  /** First paragraph of the agent's system prompt — used as the customAgent blurb. */
  blurb: string;
}

export interface AgentCompanySkill {
  name: string;
  description: string;
  department: string;
  /** SKILL.md body (frontmatter stripped), capped. */
  body: string;
}

export interface AgentCompanyTask {
  title: string;
  department: string;
  detail: string;
  status: TaskStatus;
}

export interface AgentCompany {
  name: string;
  slug: string;
  description: string;
  version: string;
  license: string;
  schema: string;
  authors: string[];
  goals: string[];
  agents: AgentCompanyAgent[];
  skills: AgentCompanySkill[];
  tasks: AgentCompanyTask[];
}

/** One file of a company package (path is POSIX-relative to the company root). */
export interface CompanyFile {
  path: string;
  content: string;
}

/* Caps — mirror the workspace/orchestration limits so a package can't bloat meta. */
const MAX_AGENTS = 50; // matches sanitizeWorkspaceMeta customAgents cap
const MAX_SKILLS = 200;
const MAX_GOALS = 12;

/* ------------------------------- frontmatter ------------------------------- */

interface Frontmatter {
  scalars: Record<string, string>;
  lists: Record<string, string[]>;
}

const stripQuotes = (s: string) => s.trim().replace(/^["']|["']$/g, "").trim();

/**
 * Parse a YAML-subset frontmatter block: scalars (`key: value`), inline lists
 * (`key: [a, b]`), and block lists (`key:` then `  - item` lines). A block list of
 * objects (`authors:` then `  - name: Dotta`) is captured as raw item strings —
 * callers that only need one field (e.g. the author name) post-process. Returns the
 * body (everything after the closing `---`). Tolerant: no frontmatter -> empty maps.
 */
export function parseFrontmatter(md: string): { fm: Frontmatter; body: string } {
  const text = md.replace(/^﻿/, "");
  // Frontmatter = an opening '---' line, content, then a CLOSING '---' at a line
  // start. Multiline (`^`) so a '---' appearing mid-value is NOT a delimiter; this
  // also handles empty frontmatter (`---\n---`) and CRLF line endings.
  const m = text.match(/^---[ \t]*\r?\n([\s\S]*?)^---[ \t]*\r?\n?([\s\S]*)$/m);
  if (!m) return { fm: { scalars: {}, lists: {} }, body: text.trim() };
  const scalars: Record<string, string> = {};
  const lists: Record<string, string[]> = {};
  let curList: string | null = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (line.trim() === "" || /^\s*#/.test(line)) continue;
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && curList) {
      lists[curList].push(stripQuotes(item[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1].trim();
    const val = kv[2].trim();
    if (val === "") {
      curList = key;
      lists[key] = [];
    } else if (/^\[.*\]$/.test(val)) {
      lists[key] = val.slice(1, -1).split(",").map(stripQuotes).filter(Boolean);
      curList = null;
    } else {
      scalars[key] = stripQuotes(val);
      curList = null;
    }
  }
  return { fm: { scalars, lists }, body: m[2].trim() };
}

const fmStr = (fm: Frontmatter, key: string) => fm.scalars[key] ?? "";
const fmList = (fm: Frontmatter, key: string) => fm.lists[key] ?? [];
/** Frontmatter `null`/`~`/empty -> real null (for reportsTo). */
const fmNullable = (fm: Frontmatter, key: string): string | null => {
  const v = (fm.scalars[key] ?? "").trim();
  return v === "" || v === "null" || v === "~" ? null : v;
};

/** First non-empty, non-heading paragraph of a markdown body, capped. */
function firstParagraph(body: string, cap = 300): string {
  for (const block of body.split(/\n\s*\n/)) {
    const t = block.replace(/^#.*$/gm, "").trim();
    if (t) return coerceText(t.replace(/\s+/g, " "), cap);
  }
  return "";
}

/* --------------------------- department inference -------------------------- */

// AGENTS.md carries no `department:` field (its identity is a role/title), so we
// infer the Helm department from role keywords. First match wins; leadership /
// unknown falls back to Operations (matching coerceDepartment's default). Used for
// agents and for skills that don't declare a department.
const ROLE_DEPT: [RegExp, string][] = [
  [/\bcto\b|chief tech|(software |staff |release |qa |backend |frontend |platform )?engineer|developer|devops|\bsre\b|reliability/i, "Engineering"],
  [/\bcfo\b|chief financ|\bfinance\b|account(ing|ant)|treasur|fundrais/i, "Finance"],
  [/\bcmo\b|chief marketing|\bmarketing\b|growth|brand marketing|content strateg/i, "Marketing"],
  [/\bcpo\b|chief product|product (manager|owner|lead)|\bprd\b/i, "Product"],
  [/\bcdo\b|chief design|\bdesign(er)?\b|creative director|\bux\b|\bui\b/i, "Design"],
  [/\bcro\b|chief revenue|\bsales\b|account exec|\bsdr\b|\bbdr\b|business develop/i, "Sales"],
  [/\bciso\b|chief security|\bsecurity\b|appsec|infosec|threat/i, "Security"],
  [/chief data|data (scien|analy|engineer)|\banalyst\b|analytics|machine learning/i, "Data"],
  [/\bchro\b|chief people|\bpeople\b|human resource|\bhr\b|recruit|talent/i, "People"],
  [/\blegal\b|counsel|compliance|attorney|lawyer/i, "Legal"],
  [/\bsupport\b|customer success|help ?desk|\bcx\b/i, "Support"],
  [/\bcoo\b|chief operating|operations|\bops\b|logistics|program manage/i, "Operations"],
];

/** Infer a Helm department from an agent's role text (name + title + skills). */
export function inferDepartment(text: string): string {
  for (const [re, dept] of ROLE_DEPT) if (re.test(text)) return dept;
  return "Operations";
}

/* -------------------------------- parsing --------------------------------- */

/** Normalize an owner-supplied path to POSIX + strip a leading company-dir prefix so
 *  both `agents/ceo/AGENTS.md` and `gstack/agents/ceo/AGENTS.md` resolve the same. */
function relPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.?\//, "");
}

/**
 * Parse a company package (its files) into the normalized AgentCompany. Files may
 * carry the company-dir prefix or not. Missing COMPANY.md -> a minimal company from
 * whatever agents/skills/tasks are present (so a partial package still imports).
 */
export function parseCompanyPackage(files: CompanyFile[]): AgentCompany {
  const byName = (suffix: string) =>
    files.filter((f) => relPath(f.path).toLowerCase().endsWith(suffix.toLowerCase()));

  // COMPANY.md (nearest the root wins — shortest path).
  const companyFile = byName("COMPANY.md").sort((a, b) => a.path.length - b.path.length)[0];
  const { fm: cfm, body: cbody } = parseFrontmatter(companyFile?.content ?? "");
  const name = coerceText(fmStr(cfm, "name"), 120) || "Imported company";
  const slug = coerceText(fmStr(cfm, "slug"), 80) || slugify(name);
  const authors = fmList(cfm, "authors")
    .map((a) => coerceText(a.replace(/^name:\s*/i, ""), 80))
    .filter(Boolean)
    .slice(0, 20);
  const goals = fmList(cfm, "goals").map((g) => coerceText(g, 300)).filter(Boolean).slice(0, MAX_GOALS);
  const description = coerceText(fmStr(cfm, "description"), 600) || firstParagraph(cbody, 600);

  // agents/*/AGENTS.md — the org chart.
  const agents: AgentCompanyAgent[] = byName("AGENTS.md")
    .slice(0, MAX_AGENTS)
    .map((f) => {
      const { fm, body } = parseFrontmatter(f.content);
      const aName = coerceText(fmStr(fm, "name"), 80) || slugFromPath(f.path, "AGENTS.md");
      const title = coerceText(fmStr(fm, "title"), 120);
      const skills = fmList(fm, "skills").map((s) => coerceText(s, 80)).filter(Boolean).slice(0, 40);
      return {
        name: aName,
        title,
        department: inferDepartment(`${aName} ${title} ${skills.join(" ")}`),
        reportsTo: fmNullable(fm, "reportsTo") ?? fmNullable(fm, "reports_to"),
        skills,
        blurb: firstParagraph(body, 300),
      };
    });

  // A skill declared in an agent's skills[] belongs to that agent's department — a
  // stronger, org-aware signal than keyword-guessing the skill name (e.g. GStack's
  // "plan-eng-review" is claimed by the CTO -> Engineering). First claimer wins.
  const skillDept = new Map<string, string>();
  for (const a of agents) for (const sk of a.skills) if (!skillDept.has(sk)) skillDept.set(sk, a.department);

  // skills/*/SKILL.md — reusable craft (Helm's own catalog is the same shape).
  const skills: AgentCompanySkill[] = byName("SKILL.md")
    .filter((f) => /(^|\/)skills\//i.test(relPath(f.path))) // only package skills, not agent files
    .slice(0, MAX_SKILLS)
    .map((f) => {
      const { fm, body } = parseFrontmatter(f.content);
      const sName = coerceText(fmStr(fm, "name"), 100) || slugFromPath(f.path, "SKILL.md");
      const sDesc = coerceText(fmStr(fm, "description"), 400);
      const declared = coerceText(fmStr(fm, "department"), 40);
      return {
        name: sName,
        description: sDesc,
        // Precedence: explicit frontmatter -> owning agent's department -> keyword guess.
        department: matchDept(declared) ?? skillDept.get(sName) ?? inferDepartment(`${sName} ${sDesc}`),
        body: coerceText(body, 6000),
      };
    });

  // TASK.md (optional) — a markdown checklist / list of pre-loaded tasks.
  const taskFile = byName("TASK.md").sort((a, b) => a.path.length - b.path.length)[0];
  const tasks = parseTasks(taskFile?.content ?? "").slice(0, ORCH_MAX_TASKS);

  return {
    name,
    slug,
    description,
    version: coerceText(fmStr(cfm, "version"), 20) || "1.0.0",
    license: coerceText(fmStr(cfm, "license"), 40) || "",
    schema: coerceText(fmStr(cfm, "schema"), 40) || AGENT_COMPANIES_SCHEMA,
    authors,
    goals,
    agents,
    skills,
    tasks,
  };
}

/** Parse TASK.md into tasks. Accepts checklist rows (`- [ ] Title`), plain bullets,
 *  or `### Title` headings; an inline `(Department)` or `— Department` tag sets the
 *  department, else Operations. Best-effort: tasks are optional in the standard. */
export function parseTasks(md: string): AgentCompanyTask[] {
  const { body } = parseFrontmatter(md);
  const out: AgentCompanyTask[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    const m =
      line.match(/^[-*]\s+\[[ xX]?\]\s+(.*)$/) || // - [ ] Task
      line.match(/^[-*]\s+(.*)$/) || //             - Task
      line.match(/^#{2,4}\s+(.*)$/); //             ## Task
    if (!m) continue;
    let title = m[1].trim();
    if (!title) continue;
    // Department tag: "(Engineering)" or "— Engineering" / "- Engineering" suffix.
    let department = "Operations";
    const tag = title.match(/\((\w[\w /-]*)\)\s*$/) || title.match(/[—-]\s*([A-Za-z]+)\s*$/);
    if (tag) {
      const d = matchDept(tag[1].trim());
      if (d) {
        department = d;
        title = title.slice(0, tag.index).trim();
      }
    }
    if (!title) continue; // a bullet that was ONLY a department tag -> not a task
    out.push({
      title: coerceText(title, 200),
      department,
      detail: "",
      status: coerceStatus("todo"),
    });
    if (out.length >= ORCH_MAX_TASKS) break;
  }
  return out;
}

/* ------------------------- map: company -> workspace ----------------------- */

export interface WorkspaceSeed {
  name: string;
  idea: string;
  meta: WorkspaceMeta;
  tasks: Omit<Task, "id">[];
}

/**
 * Map a parsed company to a Helm workspace seed: idea from the description/goals,
 * meta.customAgents from the agents (blurb carries title + reporting), and
 * meta.activeDepartments from every department that has an agent or task. Tasks
 * become todo Task rows. Everything is run through sanitizeWorkspaceMeta so the caps
 * (customAgents<=50, etc.) hold exactly as for a hand-built workspace.
 */
export function companyToWorkspaceSeed(company: AgentCompany): WorkspaceSeed {
  const idea =
    company.description ||
    (company.goals.length ? company.goals.join("; ") : "") ||
    company.name;

  const customAgents: CustomAgentSpec[] = company.agents.map((a) => {
    const reporting = a.reportsTo ? ` · reports to ${a.reportsTo}` : " · leadership";
    const blurb = coerceText(
      [a.title, a.blurb].filter(Boolean).join(" — ") + reporting,
      300,
    );
    return { name: a.name, department: a.department, blurb };
  });

  const deptSet = new Set<string>();
  for (const a of company.agents) deptSet.add(a.department);
  for (const t of company.tasks) deptSet.add(t.department);
  const valid = new Set<string>(DEPARTMENTS);
  const activeDepartments = [...deptSet].filter((d) => valid.has(d));

  // Bound via the SAME sanitizer a normal workspace uses (caps + shape).
  const meta = sanitizeWorkspaceMeta({ customAgents, activeDepartments });

  const tasks: Omit<Task, "id">[] = company.tasks.map((t) => ({
    title: coerceText(t.title, 200) || "Untitled task",
    department: coerceDepartment(t.department),
    status: t.status,
    detail: coerceText(t.detail, 1000),
  }));

  return { name: coerceText(company.name, 120) || "Imported company", idea: coerceText(idea, 4000), meta, tasks };
}

/* ------------------------- map: workspace -> company ----------------------- */

/**
 * Serialize a Helm workspace into a normalized AgentCompany (the export direction —
 * so a Helm-built company is portable back into the Agent Companies directory).
 * Derives agents from meta.customAgents (else one lead per active department), goals
 * from the objectives, and tasks from the live task list.
 */
export function workspaceToCompany(input: {
  name: string;
  idea: string;
  meta: WorkspaceMeta | null;
  tasks: Pick<Task, "title" | "department" | "detail" | "status">[];
  skills?: AgentCompanySkill[];
}): AgentCompany {
  const meta = input.meta ?? {};
  const active = (meta.activeDepartments ?? []).filter((d) => (DEPARTMENTS as readonly string[]).includes(d));

  let agents: AgentCompanyAgent[] = (meta.customAgents ?? []).map((a) => ({
    name: a.name,
    title: "",
    department: coerceDepartment(a.department),
    reportsTo: "ceo",
    skills: [],
    blurb: coerceText(a.blurb, 300),
  }));
  // No custom agents -> synthesize one lead per active department under a CEO, so the
  // exported package always has a usable org chart.
  if (agents.length === 0) {
    agents = [{ name: "CEO", title: "Chief Executive Officer", department: "Operations", reportsTo: null, skills: [], blurb: "Sets direction and approves plans." }];
    for (const d of active) {
      if (d === "Operations") continue;
      agents.push({ name: `${d} Lead`, title: `Head of ${d}`, department: d, reportsTo: "ceo", skills: [], blurb: `Owns ${d} for the company.` });
    }
  }

  const goals = (meta.objectives ?? []).map((o) => coerceText(o.title, 300)).filter(Boolean).slice(0, MAX_GOALS);

  const tasks: AgentCompanyTask[] = input.tasks.map((t) => ({
    title: coerceText(t.title, 200),
    department: coerceDepartment(t.department),
    detail: coerceText(t.detail, 1000),
    status: coerceStatus(t.status),
  }));

  return {
    name: coerceText(input.name, 120) || "Company",
    slug: slugify(input.name || "company"),
    description: coerceText(input.idea, 600),
    version: "1.0.0",
    license: "MIT",
    schema: AGENT_COMPANIES_SCHEMA,
    authors: [],
    goals,
    agents,
    skills: input.skills ?? [],
    tasks,
  };
}

/** Serialize an AgentCompany into standard-compliant markdown files (for a .zip). */
export function serializeCompanyPackage(company: AgentCompany): CompanyFile[] {
  const files: CompanyFile[] = [];
  const fmList = (key: string, items: string[]) =>
    items.length ? `${key}:\n${items.map((i) => `  - ${i}`).join("\n")}\n` : "";

  files.push({
    path: "COMPANY.md",
    content:
      `---\n` +
      `name: ${company.name}\n` +
      `description: ${company.description}\n` +
      `slug: ${company.slug}\n` +
      `schema: ${company.schema}\n` +
      `version: ${company.version}\n` +
      (company.license ? `license: ${company.license}\n` : "") +
      fmList("authors", company.authors) +
      fmList("goals", company.goals) +
      `---\n\n${company.name} — exported from Helm.\n`,
  });

  for (const a of company.agents) {
    files.push({
      path: `agents/${slugify(a.name)}/AGENTS.md`,
      content:
        `---\n` +
        `name: ${a.name}\n` +
        (a.title ? `title: ${a.title}\n` : "") +
        `department: ${a.department}\n` +
        `reportsTo: ${a.reportsTo ?? "null"}\n` +
        fmList("skills", a.skills) +
        `---\n\n${a.blurb || `${a.name} for the company.`}\n`,
    });
  }

  for (const s of company.skills) {
    files.push({
      path: `skills/${slugify(s.name)}/SKILL.md`,
      content:
        `---\nname: ${s.name}\ndescription: ${s.description}\ndepartment: ${s.department}\n---\n\n${s.body || s.description}\n`,
    });
  }

  if (company.tasks.length) {
    files.push({
      path: "TASK.md",
      content:
        `# Tasks\n\n` +
        company.tasks
          .map((t) => `- [${t.status === "done" ? "x" : " "}] ${t.title} (${t.department})${t.detail ? ` — ${t.detail}` : ""}`)
          .join("\n") +
        "\n",
    });
  }

  return files;
}

/* -------------------------------- helpers --------------------------------- */

function slugify(s: string): string {
  return (
    coerceText(s, 80)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "item"
  );
}

/** The directory name that owns a nested file (e.g. `agents/ceo/AGENTS.md` -> `ceo`). */
function slugFromPath(p: string, file: string): string {
  const parts = relPath(p).split("/");
  const i = parts.lastIndexOf(file);
  return (i > 0 ? parts[i - 1] : parts[0]) || "item";
}

/** Case-insensitive exact match to a canonical department (null if none). */
function matchDept(value: string): string | null {
  const v = value.trim().toLowerCase();
  return (DEPARTMENTS as readonly string[]).find((d) => d.toLowerCase() === v) ?? null;
}
