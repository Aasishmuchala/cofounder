#!/usr/bin/env node
// One-shot importer: pull SKILL.md files from trending GitHub skill repos into
// the local catalog (~/.claude/skills/<slug>/SKILL.md), which lib/skill-catalog.ts
// scans + classifies + serves to the Skills tab and the per-task comparison pool.
//
//   node scripts/import-skills.mjs                      # discover trending repos + import
//   node scripts/import-skills.mjs --dry-run            # show the plan, write nothing
//   node scripts/import-skills.mjs --repos a/b,c/d      # import only these repos
//   node scripts/import-skills.mjs --query "rust skill" # add a discovery query
//   node scripts/import-skills.mjs --max-skills 120     # cap total imported (default 200)
//   node scripts/import-skills.mjs --clean              # remove everything this tool imported
//
// SECURITY: SKILL.md bodies are UNTRUSTED third-party content. They are never
// executed. Each is scanned for prompt-injection markers (skipped if tripped),
// length-capped, and stamped with `source: github:owner/repo` for provenance.
// The runner already injects skill text inside a "reference data only" envelope.
// Imports are tracked in ~/.claude/skills/.cofounder-imported.json for clean removal.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

// ---- args ----------------------------------------------------------------
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const DRY = has("--dry-run");
const CLEAN = has("--clean");
const MAX_SKILLS = parseInt(val("--max-skills", "260"), 10);
const PER_QUERY = parseInt(val("--per-query", "4"), 10);
const PER_REPO = parseInt(val("--per-repo", "30"), 10);
const ONLY_REPOS = (val("--repos", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const EXTRA_QUERY = val("--query", "");

const SKILLS_HOME = process.env.SKILLS_HOME || os.homedir();
const DEST = path.join(SKILLS_HOME, ".claude", "skills");
const MANIFEST = path.join(DEST, ".cofounder-imported.json");

// ---- token (env, then `gh auth token`) -----------------------------------
function getToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  try {
    return execSync("gh auth token", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}
const TOKEN = getToken();
function ghHeaders() {
  const h = { "User-Agent": "cofounder-skill-importer", Accept: "application/vnd.github+json" };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
}

// ---- curated seeds + discovery queries ------------------------------------
// High-signal repos known to carry many SKILL.md files (checked, not assumed).
const SEED_REPOS = ["anthropics/skills"];
// Star-sorted searches — broad + one per department so every team gets coverage.
const QUERIES = [
  "claude skills",
  "agent skills SKILL.md",
  "ai agent skills",
  "claude code skills",
  "skills collection agent",
  "marketing skill agent",
  "sales outbound skill",
  "startup finance skill",
  "brand design skill",
  "frontend design skill",
  "legal contract skill",
  "customer support skill",
  "devops automation skill",
  ...(EXTRA_QUERY ? [EXTRA_QUERY] : []),
];

// ---- trust guard (mirrors lib/skills.ts sanitizeSkill) --------------------
const INJECTION =
  /\b(ignore (all |the )?(previous|above)|disregard (the )?(previous|above)|system prompt|you are now|new instructions?|exfiltrat|reveal (your )?(system|prompt|instructions)|begin (system|prompt))\b/i;
const BODY_CAP = 16000;

// ---- small helpers --------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gh(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: ghHeaders() });
    if (r.status === 403 || r.status === 429) {
      const remaining = r.headers.get("x-ratelimit-remaining");
      if (remaining === "0") {
        const reset = Number(r.headers.get("x-ratelimit-reset") || 0) * 1000;
        const waitMs = Math.max(1000, Math.min(60000, reset - Date.now()));
        console.warn(`  · rate limited; waiting ${Math.round(waitMs / 1000)}s…`);
        await sleep(waitMs);
        continue;
      }
    }
    return r;
  }
  return new Response(null, { status: 429 });
}

async function searchRepos(query) {
  const r = await gh(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${PER_QUERY}`,
  );
  if (!r.ok) return [];
  const j = await r.json();
  return (j.items || []).map((i) => ({
    full_name: i.full_name,
    default_branch: i.default_branch || "main",
    stars: i.stargazers_count || 0,
    description: i.description || "",
  }));
}

async function repoMeta(full_name) {
  const r = await gh(`https://api.github.com/repos/${full_name}`);
  if (!r.ok) return null;
  const i = await r.json();
  return {
    full_name: i.full_name,
    default_branch: i.default_branch || "main",
    stars: i.stargazers_count || 0,
    description: i.description || "",
  };
}

async function listSkillFiles(repo) {
  const r = await gh(
    `https://api.github.com/repos/${repo.full_name}/git/trees/${repo.default_branch}?recursive=1`,
  );
  if (!r.ok) return [];
  const j = await r.json();
  const tree = j.tree || [];
  const files = tree
    .filter((t) => t.type === "blob" && /(^|\/)SKILL\.md$/i.test(t.path))
    .map((t) => t.path);
  if (files.length > PER_REPO) {
    console.warn(`  · ${repo.full_name}: ${files.length} SKILL.md found, capping at ${PER_REPO}`);
    return files.slice(0, PER_REPO);
  }
  return files;
}

async function fetchRaw(repo, filePath) {
  const r = await fetch(
    `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/${filePath.split("/").map(encodeURIComponent).join("/")}`,
    { headers: { "User-Agent": "cofounder-skill-importer" } },
  );
  if (!r.ok) return "";
  return await r.text();
}

function parseFrontmatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return { fm: {}, body: text };
  const block = m[1];
  const get = (k) => {
    const r = block.match(new RegExp(`^${k}:\\s*(.+)$`, "m"));
    return r ? r[1].trim().replace(/^["']|["']$/g, "") : undefined;
  };
  return {
    fm: { name: get("name"), description: get("description"), source: get("source") },
    body: text.slice(m[0].length).replace(/^\s*\n/, ""),
  };
}

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function firstSentence(body) {
  const line = body
    .replace(/```[\s\S]*?```/g, " ")
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .find((l) => l.length > 20 && !l.startsWith("<") && !l.startsWith("|"));
  return (line || "").replace(/\s+/g, " ").slice(0, 240);
}

// derive the skill's display name from its containing folder, else frontmatter, else repo
function deriveName(repo, filePath, fm) {
  const dir = path.dirname(filePath);
  const folder = dir === "." ? repo.full_name.split("/")[1] : path.basename(dir);
  return (fm.name || folder || repo.full_name.split("/")[1] || "skill").trim();
}

function loadManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch {
    return { imported: [] };
  }
}

// ---- clean mode -----------------------------------------------------------
if (CLEAN) {
  const man = loadManifest();
  let removed = 0;
  for (const e of man.imported) {
    const dir = path.join(DEST, e.slug);
    try {
      if (fs.existsSync(path.join(dir, ".cofounder-source"))) {
        fs.rmSync(dir, { recursive: true, force: true });
        removed++;
      }
    } catch {}
  }
  if (!DRY) fs.rmSync(MANIFEST, { force: true });
  console.log(`Removed ${removed} imported skill(s).`);
  process.exit(0);
}

// ---- discover -------------------------------------------------------------
console.log(`Skill importer → ${DEST}`);
console.log(`Auth: ${TOKEN ? "GitHub token present" : "UNAUTHENTICATED (low rate limits)"}${DRY ? " · DRY RUN" : ""}`);

const repos = new Map(); // full_name -> repo
async function addRepo(full_name, known) {
  if (repos.has(full_name)) return;
  const meta = known || (await repoMeta(full_name));
  if (meta) repos.set(full_name, meta);
}

if (ONLY_REPOS.length) {
  console.log(`\nResolving ${ONLY_REPOS.length} explicit repo(s)…`);
  for (const r of ONLY_REPOS) await addRepo(r);
} else {
  console.log(`\nSeeding ${SEED_REPOS.length} curated repo(s)…`);
  for (const r of SEED_REPOS) await addRepo(r);
  console.log(`Discovering trending repos across ${QUERIES.length} queries…`);
  for (const q of QUERIES) {
    const found = await searchRepos(q);
    for (const repo of found) await addRepo(repo.full_name, repo);
    await sleep(800); // stay under the 10 req/min search limit
  }
}

const sortedRepos = [...repos.values()].sort((a, b) => b.stars - a.stars);
console.log(`\n${sortedRepos.length} candidate repo(s):`);
for (const r of sortedRepos.slice(0, 25)) console.log(`  ${r.stars.toString().padStart(7)}★  ${r.full_name}`);
if (sortedRepos.length > 25) console.log(`  … +${sortedRepos.length - 25} more`);

// ---- collect SKILL.md candidates (breadth-first) --------------------------
// Gather each repo's file list, then interleave round-robin so a single mega-repo
// can't drain the budget before the curated department repos contribute.
const perRepoFiles = [];
for (const repo of sortedRepos) {
  const files = await listSkillFiles(repo);
  if (files.length) perRepoFiles.push({ repo, files });
}
const candidates = []; // { repo, filePath }
for (let round = 0; candidates.length < MAX_SKILLS; round++) {
  let added = false;
  for (const pr of perRepoFiles) {
    if (round >= pr.files.length) continue;
    if (candidates.length >= MAX_SKILLS) break;
    candidates.push({ repo: pr.repo, filePath: pr.files[round] });
    added = true;
  }
  if (!added) break; // every repo exhausted
}
if (candidates.length >= MAX_SKILLS) console.warn(`  · reached --max-skills ${MAX_SKILLS}`);
console.log(`\n${candidates.length} SKILL.md candidate(s) across ${perRepoFiles.length} repo(s) carrying skills.`);

// ---- download, sanitize, write -------------------------------------------
const manifest = loadManifest();
const already = new Set(manifest.imported.map((e) => e.slug));
let imported = 0,
  skippedDupe = 0,
  skippedUnsafe = 0,
  skippedThin = 0,
  failed = 0;
const usedSlugs = new Set();
const samples = [];

for (const c of candidates) {
  let raw = "";
  try {
    raw = await fetchRaw(c.repo, c.filePath);
  } catch {
    failed++;
    continue;
  }
  if (!raw || raw.length < 120) {
    skippedThin++;
    continue;
  }
  if (INJECTION.test(raw.slice(0, 9000))) {
    skippedUnsafe++;
    continue;
  }
  const { fm, body } = parseFrontmatter(raw);
  const name = deriveName(c.repo, c.filePath, fm);
  let slug = slugify(name);
  if (!slug) {
    skippedThin++;
    continue;
  }
  // dedupe: skip if this slug dir already exists (user's own skill or a prior import)
  if (already.has(slug) || fs.existsSync(path.join(DEST, slug)) || usedSlugs.has(slug)) {
    skippedDupe++;
    continue;
  }
  usedSlugs.add(slug);

  const description = (fm.description || firstSentence(body) || `Skill from ${c.repo.full_name}`).slice(0, 240);
  const source = `github:${c.repo.full_name}`;
  const cappedBody = body.slice(0, BODY_CAP).trim();
  const out = `---\nname: ${name}\ndescription: ${description.replace(/\n/g, " ")}\nsource: ${source}\n---\n\n${cappedBody}\n`;

  if (samples.length < 12) samples.push({ name, source, file: c.filePath });

  if (!DRY) {
    const dir = path.join(DEST, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), out, "utf8");
    fs.writeFileSync(path.join(dir, ".cofounder-source"), `${source}#${c.filePath}\n`, "utf8");
    manifest.imported.push({ slug, name, source, file: c.filePath, at: new Date().toISOString() });
  }
  imported++;
}

if (!DRY) {
  fs.mkdirSync(DEST, { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), "utf8");
}

// ---- report ---------------------------------------------------------------
console.log(`\n${DRY ? "[dry run] would import" : "Imported"} ${imported} skill(s).`);
console.log(`  skipped: ${skippedDupe} duplicate · ${skippedUnsafe} injection-flagged · ${skippedThin} too-thin · ${failed} fetch-failed`);
if (samples.length) {
  console.log(`\nSample:`);
  for (const s of samples) console.log(`  • ${s.name}  (${s.source})`);
}
if (!DRY) console.log(`\nManifest: ${MANIFEST}  ·  undo with: npm run skills:import -- --clean`);
