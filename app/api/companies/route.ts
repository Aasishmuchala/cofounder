import { coerceText, sanitizeWorkspaceMeta, type CustomAgentSpec, type WorkspaceMeta } from "@/lib/agent-types";
import { authorizeWrite, tooLarge } from "@/lib/auth";
import { enforceAnonRateLimit } from "@/lib/request-guard";
import {
  dbConfigured,
  createWorkspace,
  getWorkspace,
  updateWorkspaceMeta,
  insertTasks,
  listTasks,
  withWorkspaceLock,
} from "@/lib/supabase-rest";
import { makeZip } from "@/lib/zip";
import {
  parseCompanyPackage,
  companyToWorkspaceSeed,
  workspaceToCompany,
  serializeCompanyPackage,
  type CompanyFile,
  type AgentCompany,
} from "@/lib/agent-companies";

export const runtime = "nodejs";
// A package import fetches a handful of small markdown files from GitHub's CDN.
export const maxDuration = 60;

/**
 * Agent Companies interop (the companies.sh open standard).
 *
 *   POST /api/companies
 *     { source: "owner/repo/path" | github tree URL }   — fetch a package from GitHub
 *     { files: [{ path, content }] }                     — OR pass the package inline
 *     { target?: "new" | "existing", workspaceId?, workspaceSecret?, dryRun? }
 *   -> parse the package, map it to a Helm workspace (agents -> customAgents,
 *      tasks -> tasks), and create a NEW workspace or import INTO an existing one
 *      (edit-key-gated). dryRun previews the mapping without writing. Graceful no-DB.
 *
 *   GET /api/companies?workspace=<id>
 *   -> export the workspace as a standard-compliant package (.zip). Public read by
 *      the unguessable workspace id, matching /api/tasks and the artifact export.
 */

/* ------------------------------ GitHub source ----------------------------- */

interface GhSource { owner: string; repo: string; path: string; ref?: string }

/** A github owner/repo/ref segment: starts + ends alphanumeric (rejects "."/".."). */
const GH_SEGMENT = /^[A-Za-z0-9](?:[\w.-]*[A-Za-z0-9])?$/;

/** Parse a source into a github.com coordinate. ONLY github.com is accepted (no
 *  arbitrary host), and owner/repo/ref/path segments are validated so a traversal
 *  source ("../../etc") is rejected outright — this can never become an SSRF or a
 *  path-traversal fetch primitive. */
function parseSource(source: string): GhSource | null {
  const s = source.trim();
  let owner = "", repo = "", ref: string | undefined, path = "";
  const url = s.match(/^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/tree\/([\w.\-/]+)$/i);
  if (url) {
    const parts = url[3].split("/");
    ref = parts.shift() || "main";
    owner = url[1];
    repo = url[2];
    path = parts.join("/");
  } else {
    const sh = s.match(/^([\w.-]+)\/([\w.-]+)(?:\/(.+))?$/);
    if (!sh) return null;
    owner = sh[1];
    repo = sh[2];
    path = (sh[3] ?? "").replace(/\/+$/, "");
  }
  if (!GH_SEGMENT.test(owner) || !GH_SEGMENT.test(repo)) return null;
  if (ref !== undefined && !GH_SEGMENT.test(ref)) return null;
  if (path.split("/").some((seg) => seg === "." || seg === "..")) return null;
  return { owner, repo, ref, path };
}

const GH_HEADERS = { "user-agent": "helm-agent-companies", accept: "application/vnd.github+json" };

async function fetchWithTimeout(url: string, headers: Record<string, string>, ms = 12000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Only the standard package files matter — skip images/LICENSE/README/.paperclip.yaml. */
function isWantedFile(p: string): boolean {
  return /(^|\/)(COMPANY|AGENTS|SKILL|TASK|PROJECT)\.md$/i.test(p);
}

/** Fetch a company package from GitHub: the tree via the API (1–2 calls), then each
 *  wanted file from the raw CDN (not API-rate-limited). Bounded + timeout-guarded. */
async function fetchPackageFromGitHub(src: GhSource): Promise<CompanyFile[]> {
  let ref = src.ref;
  if (!ref) {
    const repoRes = await fetchWithTimeout(`https://api.github.com/repos/${src.owner}/${src.repo}`, GH_HEADERS).catch(() => null);
    ref = (repoRes && repoRes.ok ? ((await repoRes.json().catch(() => ({}))) as { default_branch?: string }).default_branch : "") || "main";
  }
  const treeRes = await fetchWithTimeout(
    `https://api.github.com/repos/${src.owner}/${src.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    GH_HEADERS,
  );
  if (!treeRes.ok) throw new Error(`github tree ${treeRes.status}`);
  const tree = (await treeRes.json()) as { tree?: { path: string; type: string }[]; truncated?: boolean };
  const base = src.path ? `${src.path.replace(/\/+$/, "")}/` : "";
  const wanted = (tree.tree ?? [])
    .filter((n) => n.type === "blob" && n.path.startsWith(base) && isWantedFile(n.path))
    .map((n) => n.path)
    .slice(0, 150);
  const files = await Promise.all(
    wanted.map(async (full) => {
      const raw = await fetchWithTimeout(
        `https://raw.githubusercontent.com/${src.owner}/${src.repo}/${encodeURIComponent(ref!)}/${full.split("/").map(encodeURIComponent).join("/")}`,
        { "user-agent": GH_HEADERS["user-agent"] },
      ).catch(() => null);
      if (!raw || !raw.ok) return null;
      const content = (await raw.text().catch(() => "")).slice(0, 200_000);
      return content ? { path: full.slice(base.length), content } : null;
    }),
  );
  return files.filter((f): f is CompanyFile => f !== null);
}

/** Client-safe summary of a parsed company (no skill bodies). */
function summarize(company: AgentCompany) {
  return {
    name: company.name,
    slug: company.slug,
    schema: company.schema,
    version: company.version,
    license: company.license,
    description: company.description,
    goals: company.goals,
    agents: company.agents.map((a) => ({ name: a.name, title: a.title, department: a.department, reportsTo: a.reportsTo })),
    skills: company.skills.map((s) => ({ name: s.name, department: s.department })),
    taskCount: company.tasks.length,
    departments: [...new Set(company.agents.map((a) => a.department))],
  };
}

/* --------------------------------- import --------------------------------- */

export async function POST(req: Request): Promise<Response> {
  if (tooLarge(req, 2 * 1024 * 1024)) return Response.json({ ok: false, error: "payload too large" }, { status: 413 });
  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }

  const source = coerceText(body.source, 300);
  const inlineFiles = Array.isArray(body.files) ? (body.files as unknown[]) : null;
  const target = body.target === "existing" ? "existing" : "new";
  const workspaceId = coerceText(body.workspaceId, 100) || undefined;
  const workspaceSecret = coerceText(body.workspaceSecret, 200) || undefined;
  const dryRun = body.dryRun === true;

  // Resolve the package files: inline (local/testing) OR fetched from GitHub.
  let files: CompanyFile[] = [];
  if (inlineFiles) {
    files = inlineFiles
      .slice(0, 200)
      .map((f) => {
        const o = (f && typeof f === "object" ? f : {}) as Record<string, unknown>;
        return { path: coerceText(o.path, 300), content: coerceText(o.content, 200_000) };
      })
      .filter((f) => f.path && f.content);
  } else if (source) {
    const src = parseSource(source);
    if (!src) return Response.json({ ok: false, error: "source must be a github.com owner/repo/path or tree URL" }, { status: 400 });
    // Unkeyed create path does a GitHub fetch + a DB write — per-IP throttle it
    // (production-only), mirroring the other unauthenticated entry points.
    if (target === "new" || !workspaceId) {
      const limited = enforceAnonRateLimit(req, "companies");
      if (limited) return limited;
    }
    try {
      files = await fetchPackageFromGitHub(src);
    } catch {
      return Response.json({ ok: false, error: "could not fetch that package from GitHub" }, { status: 502 });
    }
  } else {
    return Response.json({ ok: false, error: "provide a source or files" }, { status: 400 });
  }

  if (files.length === 0) return Response.json({ ok: false, error: "no company package found" }, { status: 400 });

  const company = parseCompanyPackage(files);
  const seed = companyToWorkspaceSeed(company);

  // Preview only — never writes.
  if (dryRun) {
    return Response.json({ ok: true, dryRun: true, company: summarize(company), taskCount: seed.tasks.length });
  }

  // Importing INTO an existing workspace requires its edit key — verified BEFORE the
  // no-DB shortcut so a forged/missing token is ALWAYS rejected (mirrors /api/plan),
  // never answered with a cheerful persisted:false.
  if (target === "existing") {
    if (!workspaceId) return Response.json({ ok: false, error: "workspaceId required for target=existing" }, { status: 400 });
    if (!(await authorizeWrite(workspaceId, workspaceSecret))) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
    }
  }

  // No DB configured: the mapping still works, it just isn't persisted.
  if (!dbConfigured) {
    return Response.json({ ok: true, persisted: false, company: summarize(company), seed: { name: seed.name, taskCount: seed.tasks.length } });
  }

  // Persist into the (already-authorized) existing workspace: merge agents + add tasks.
  if (target === "existing" && workspaceId) {
    try {
      const merged = await withWorkspaceLock(workspaceId, async () => {
        const existing: WorkspaceMeta = (await getWorkspace(workspaceId).then((w) => w?.meta ?? null).catch(() => null)) ?? {};
        const agents: CustomAgentSpec[] = [...(existing.customAgents ?? []), ...(seed.meta.customAgents ?? [])];
        const depts = [...new Set([...(existing.activeDepartments ?? []), ...(seed.meta.activeDepartments ?? [])])];
        const nextMeta = sanitizeWorkspaceMeta({ ...existing, customAgents: agents, activeDepartments: depts });
        await updateWorkspaceMeta(workspaceId, { customAgents: nextMeta.customAgents ?? [], activeDepartments: nextMeta.activeDepartments ?? [] });
        return nextMeta;
      });
      const tasks = seed.tasks.length ? await insertTasks(workspaceId, seed.tasks).catch(() => []) : [];
      return Response.json({
        ok: true,
        persisted: true,
        workspaceId,
        company: summarize(company),
        importedAgents: merged.customAgents?.length ?? 0,
        importedTasks: tasks.length,
      });
    } catch {
      return Response.json({ ok: false, error: "import failed" }, { status: 500 });
    }
  }

  // Create a NEW workspace from the package (anyone may create their own).
  try {
    const created = await createWorkspace(seed.name, seed.idea, seed.meta);
    const tasks = seed.tasks.length ? await insertTasks(created.id, seed.tasks).catch(() => []) : [];
    return Response.json({
      ok: true,
      persisted: true,
      workspaceId: created.id,
      // The creator receives the capability token ONCE (same contract as /api/agent).
      workspaceSecret: created.editKey,
      company: summarize(company),
      importedAgents: seed.meta.customAgents?.length ?? 0,
      importedTasks: tasks.length,
    });
  } catch {
    return Response.json({ ok: false, error: "import failed" }, { status: 500 });
  }
}

/* --------------------------------- export --------------------------------- */

export async function GET(req: Request): Promise<Response> {
  const workspaceId = coerceText(new URL(req.url).searchParams.get("workspace"), 100);
  if (!workspaceId) return Response.json({ ok: false, error: "missing workspace" }, { status: 400 });
  if (!dbConfigured) return Response.json({ ok: false, error: "no database" }, { status: 400 });

  const ws = await getWorkspace(workspaceId).catch(() => null);
  if (!ws) return Response.json({ ok: false, error: "not found" }, { status: 404 });
  const tasks = await listTasks(workspaceId).catch(() => []);

  const company = workspaceToCompany({
    name: ws.name || ws.idea || "Company",
    idea: ws.idea || "",
    meta: ws.meta ?? null,
    tasks: tasks.map((t) => ({ title: t.title, department: t.department, detail: t.detail, status: t.status })),
  });
  // makeZip keys files by `name`; the package uses `path` — map across.
  const zip = makeZip(serializeCompanyPackage(company).map((f) => ({ name: f.path, content: f.content })));
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${company.slug}-agent-company.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
