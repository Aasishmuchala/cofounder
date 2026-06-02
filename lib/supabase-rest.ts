// Server-only Supabase access via PostgREST (no SDK dependency).
// Used exclusively from API route handlers — never imported into client code.

import { randomBytes } from "node:crypto";
import type { Task, TaskStatus, Artifact, ArtifactKind, SkillRef, DeliverableEval, WorkspaceMeta } from "@/lib/agent-types";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY;

export const dbConfigured = Boolean(URL && KEY);

interface DbTaskRow {
  id: string;
  workspace_id: string;
  title: string;
  department: string;
  status: TaskStatus;
  detail: string;
  pos_x: number | null;
  pos_y: number | null;
  created_at: string;
}

function headers(extra?: Record<string, string>): HeadersInit {
  return {
    apikey: KEY as string,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/**
 * Orchestration metadata (deps + objectiveId) is encoded as a JSON envelope
 * PREFIX on the task's detail column — `cf:{...}|<original detail>` — so the
 * dependency graph persists with NO schema migration (the existing
 * cofounder_tasks table has no deps/executor columns). decodeDetail parses it
 * back; encodeDetail writes it. The prefix is server-side only and stripped
 * before the detail is shown to the user or sent to the model.
 *
 * SECURITY: the envelope is an IN-BAND, user-reachable channel (POST/PATCH
 * /api/tasks accept body.detail verbatim). It is NOT an authenticated control
 * channel, so decodeDetail must NOT let a user-typed detail forge a privileged
 * routing hint. In particular `executor` is validated against a strict
 * allowlist (only "claude-code") — any other value is dropped — and /api/tasks
 * strips a leading `cf:` from caller-supplied detail before storing (see
 * stripDetailEnvelope). Defense-in-depth: the runner ALSO gates the claude-code
 * branch on department, so a forged executor on a non-Engineering task is moot.
 */
const DETAIL_PREFIX = "cf:";
const DETAIL_SEP = "|";

/** Backstop on stripDetailEnvelope's peel loop. Each peel strips one envelope AND
 *  strictly shortens the string, so the loop always terminates on its own; this
 *  cap only bounds pathologically deep input. It comfortably exceeds the most
 *  envelope layers that fit the route's 1000-char detail cap (min layer
 *  `cf:{"deps":[""]}|` ≈ 17 chars -> ≤ 58 layers), so capped input always reaches
 *  the true fixed point before the cap; a fail-safe handles anything deeper. */
const MAX_ENVELOPE_PEELS = 64;

/** The only executor value the envelope may carry — anything else is dropped on
 *  decode so a user-typed `cf:{"executor":"…"}|` can't invent a routing hint. */
const ALLOWED_EXECUTORS = new Set(["claude-code"]);

interface DetailMeta {
  deps?: string[];
  objectiveId?: string | null;
  agentId?: string | null;
  executor?: string;
}

/** Parse the `cf:{...}|` envelope off a detail string. Returns the decoded meta
 *  plus the bare human-readable detail (envelope stripped). Never throws. */
export function decodeDetail(raw: string): { meta: DetailMeta; detail: string } {
  if (typeof raw !== "string" || !raw.startsWith(DETAIL_PREFIX)) {
    return { meta: {}, detail: typeof raw === "string" ? raw : "" };
  }
  const sep = raw.indexOf(DETAIL_SEP);
  if (sep === -1) return { meta: {}, detail: raw };
  const json = raw.slice(DETAIL_PREFIX.length, sep);
  const rest = raw.slice(sep + 1);
  try {
    const parsed = JSON.parse(json) as unknown;
    // Only treat it as our envelope if it's a plain object — a user-typed detail
    // like "cf:note|rest" parses to a string/number and must be left intact.
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { meta: {}, detail: raw };
    }
    const p = parsed as Record<string, unknown>;
    const meta: DetailMeta = {};
    if (Array.isArray(p.deps)) {
      meta.deps = p.deps.filter((d): d is string => typeof d === "string").slice(0, 48);
    }
    if (typeof p.objectiveId === "string") meta.objectiveId = p.objectiveId;
    // agentId is a specialist assignment (see lib/org.ts SPECIALISTS) — a short
    // kebab-case id; cap it like its siblings so an oversized user-typed envelope
    // value can't bloat the stored detail. Not a privileged routing hint (the
    // runner gates execution on department/executor), so no allowlist is needed.
    if (typeof p.agentId === "string") meta.agentId = p.agentId.slice(0, 40);
    // executor is a privileged routing hint — only honor an allowlisted value so
    // a user-typed `cf:{"executor":"claude-code"}|x` can't be the ONLY gate (the
    // runner still requires department + the claudeCodeActive double-gate too).
    if (typeof p.executor === "string" && ALLOWED_EXECUTORS.has(p.executor)) meta.executor = p.executor;
    return { meta, detail: rest };
  } catch {
    // Not valid JSON after the prefix -> not our envelope; keep the raw detail.
    return { meta: {}, detail: raw };
  }
}

/** Build a detail string with the orchestration envelope prefixed, only when
 *  there is something to encode (otherwise the bare detail is stored). */
export function encodeDetail(detail: string, meta: DetailMeta): string {
  const env: DetailMeta = {};
  if (meta.deps && meta.deps.length > 0) env.deps = meta.deps.slice(0, 48);
  if (meta.objectiveId) env.objectiveId = meta.objectiveId;
  if (meta.agentId) env.agentId = meta.agentId;
  if (meta.executor) env.executor = meta.executor;
  if (Object.keys(env).length === 0) return detail;
  return `${DETAIL_PREFIX}${JSON.stringify(env)}${DETAIL_SEP}${detail}`;
}

/**
 * Neutralize a USER-supplied detail so it can never be interpreted as a system
 * orchestration envelope. The `cf:{...}|` prefix is a server-only control
 * channel (deps/objectiveId/executor); a caller of POST/PATCH /api/tasks must
 * not be able to smuggle one in. Any detail that decodes to a non-empty envelope
 * has that prefix stripped (we keep the human-readable remainder). A plain
 * detail — even one that merely *starts* with "cf:" but isn't a real envelope —
 * is returned untouched, so normal text like "cf: see config" is preserved.
 */
export function stripDetailEnvelope(detail: string): string {
  if (typeof detail !== "string") return detail;
  // Strip to a FIXED POINT — a nested `cf:{...}|cf:{...}|text` must not smuggle a
  // privileged envelope (executor/deps/objectiveId) past the strip. ONE decode
  // pass peels only the OUTERMOST layer, and the bare remainder it returns can
  // itself be a still-live envelope that rowToTask -> decodeDetail would later
  // honor on read. Each peel strips one real envelope AND strictly shortens the
  // string, so this terminates on its own; MAX_ENVELOPE_PEELS is a backstop. A
  // plain detail that merely starts with "cf:" but isn't a real envelope (no
  // JSON object after the prefix) decodes to empty meta and is returned untouched.
  let cur = detail;
  for (let i = 0; i < MAX_ENVELOPE_PEELS && cur.startsWith(DETAIL_PREFIX); i++) {
    const { meta, detail: bare } = decodeDetail(cur);
    if (Object.keys(meta).length === 0) break; // not (or no longer) a real envelope
    cur = bare;
  }
  // Fail safe: if the backstop was exhausted while a live envelope still remains
  // (pathologically deep nesting from a direct caller, beyond the route's 1000-
  // char cap), break the leading prefix so the result can NEVER decode back to a
  // privileged hint. The trust boundary is the STORED column — it must be inert
  // by construction, NOT depend on decodeDetail re-stripping on read.
  if (cur.startsWith(DETAIL_PREFIX) && Object.keys(decodeDetail(cur).meta).length > 0) {
    cur = cur.slice(DETAIL_PREFIX.length);
  }
  return cur;
}

function rowToTask(r: DbTaskRow): Task {
  const { meta, detail } = decodeDetail(r.detail);
  const task: Task = {
    id: r.id,
    title: r.title,
    department: r.department,
    status: r.status,
    detail,
  };
  if (meta.deps && meta.deps.length > 0) task.dependsOn = meta.deps;
  if (meta.objectiveId !== undefined) task.objectiveId = meta.objectiveId;
  if (meta.agentId !== undefined) task.agentId = meta.agentId;
  if (meta.executor) task.executor = meta.executor;
  return task;
}

async function rest(path: string, init: RequestInit): Promise<Response> {
  if (!dbConfigured) throw new Error("Supabase not configured");
  return fetch(`${URL}/rest/v1/${path}`, init);
}

/**
 * Create a workspace (a company run). Mints a per-workspace edit key: the
 * creator gets it back (their proof of ownership for writes); anyone else with
 * just the workspace id can read but not write. Returns the id + the key.
 */
export async function createWorkspace(
  name: string,
  idea: string,
  meta: WorkspaceMeta = {},
): Promise<{ id: string; editKey: string }> {
  const editKey = randomBytes(24).toString("base64url");
  const res = await rest("cofounder_workspaces", {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({
      name: name.slice(0, 120),
      idea: idea.slice(0, 600),
      meta,
      edit_key: editKey,
    }),
  });
  if (!res.ok) throw new Error(`createWorkspace failed (${res.status})`);
  const rows = (await res.json()) as { id: string }[];
  return { id: rows[0].id, editKey };
}

/**
 * Permanently delete a workspace and ALL of its rows (artifacts, tasks, skills),
 * then the workspace itself. Children first, in case the FK has no ON DELETE
 * CASCADE; child failures are swallowed so a missing/empty table never blocks the
 * removal. The owner-token check happens in the route, BEFORE this runs.
 */
export async function deleteWorkspace(id: string): Promise<void> {
  const enc = encodeURIComponent(id);
  for (const table of ["cofounder_artifacts", "cofounder_tasks", "cofounder_skills"]) {
    await rest(`${table}?workspace_id=eq.${enc}`, { method: "DELETE", headers: headers() }).catch(() => {});
  }
  // Ask PostgREST to echo the deleted rows so a 0-row result (RLS silently
  // filtering the DELETE, or an already-gone workspace) is detectable rather than
  // looking like success.
  const res = await rest(`cofounder_workspaces?id=eq.${enc}`, {
    method: "DELETE",
    headers: headers({ Prefer: "return=representation" }),
  });
  if (!res.ok) throw new Error(`deleteWorkspace failed (${res.status})`);
  const rows = (await res.json().catch(() => [])) as unknown[];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("deleteWorkspace removed 0 rows (workspace already gone, or RLS blocks DELETE)");
  }
}

interface DbWorkspaceRow {
  id: string;
  name: string;
  idea: string | null;
  meta: WorkspaceMeta | null;
  edit_key: string | null;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  idea: string;
  meta: WorkspaceMeta;
  /** True once the workspace has an edit key — i.e. writes require it. */
  protected: boolean;
}

/** Fetch a workspace row. Returns `protected` (whether it has an edit key) but
 *  NEVER the key itself — reads are public, so the key must not leak here. */
export async function getWorkspace(id: string): Promise<WorkspaceRecord | null> {
  const res = await rest(
    `cofounder_workspaces?id=eq.${encodeURIComponent(id)}&select=id,name,idea,meta,edit_key&limit=1`,
    { method: "GET", headers: headers() },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as DbWorkspaceRow[];
  const r = rows[0];
  if (!r) return null;
  return { id: r.id, name: r.name, idea: r.idea ?? "", meta: r.meta ?? {}, protected: Boolean(r.edit_key) };
}

/**
 * Read a workspace's edit key for write authorization. Server-only; the result
 * is compared in constant time and never returned to a client. Throws on a
 * transport error so the caller can fail closed.
 */
export async function getWorkspaceEditKey(id: string): Promise<string | null> {
  const res = await rest(
    `cofounder_workspaces?id=eq.${encodeURIComponent(id)}&select=edit_key&limit=1`,
    { method: "GET", headers: headers() },
  );
  if (!res.ok) throw new Error(`getWorkspaceEditKey failed (${res.status})`);
  const rows = (await res.json()) as { edit_key: string | null }[];
  return rows[0]?.edit_key ?? null;
}

/* ──────────────────────────── per-workspace mutex ──────────────────────────── *
 * updateWorkspaceMeta is a read-modify-write on the meta jsonb (PostgREST can't
 * merge server-side), so two concurrent writers to the SAME workspace lost-update
 * (drop objectives, corrupt the spend ledger, double-record, resurrect approvals).
 * withWorkspaceLock serializes a multi-step RMW span (approval execute+record,
 * queued-approval append, plan materialize) per workspace WITHIN this process.
 * Single-process scope — a multi-instance deploy would also want DB-level
 * optimistic concurrency, but a self-hosted single server is the common case.
 * --------------------------------------------------------------------- */
const _wsLocks = new Map<string, Promise<unknown>>();
export function withWorkspaceLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = _wsLocks.get(id) ?? Promise.resolve();
  const run = prev.then(fn, fn); // run after the prior op regardless of its outcome
  const tail = run.then(() => undefined, () => undefined);
  _wsLocks.set(id, tail);
  // Drop the entry once settled (if still the tail) so the map can't grow unbounded.
  void tail.then(() => {
    if (_wsLocks.get(id) === tail) _wsLocks.delete(id);
  });
  return run;
}

/**
 * Shallow-merge a patch into a workspace's meta and persist it. Read-modify-write
 * (PostgREST can't do a partial jsonb merge in one PATCH); the patch wins on
 * conflicting top-level keys (e.g. the full customAgents array is replaced).
 *
 * Returns the merged meta when a row matched, or `null` when NO row matched (the
 * workspace id is valid-shaped but doesn't exist). We ask PostgREST for
 * `return=representation` and inspect the returned row array: an empty array means
 * 0 rows were affected, so a caller can report persisted:false / 404 instead of a
 * falsely-successful result. Throws only on a transport/HTTP error.
 */
export async function updateWorkspaceMeta(
  id: string,
  patch: WorkspaceMeta,
): Promise<WorkspaceMeta | null> {
  const current = (await getWorkspace(id))?.meta ?? {};
  const next: WorkspaceMeta = { ...current, ...patch };
  const res = await rest(`cofounder_workspaces?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    // return=representation makes PostgREST echo the updated row(s), so we can detect
    // a no-op PATCH against a non-existent workspace (empty array = 0 rows matched).
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({ meta: next }),
  });
  if (!res.ok) throw new Error(`updateWorkspaceMeta failed (${res.status})`);
  // PATCH ... return=representation responds with an ARRAY of the affected rows.
  const rows = (await res.json().catch(() => [])) as unknown;
  if (!Array.isArray(rows) || rows.length === 0) return null; // no such workspace
  return next;
}

/** Insert task agents for a workspace. Returns the persisted rows as Task[]. */
export async function insertTasks(
  workspaceId: string,
  tasks: Omit<Task, "id">[],
): Promise<Task[]> {
  if (tasks.length === 0) return [];
  const payload = tasks.map((t) => ({
    workspace_id: workspaceId,
    title: t.title,
    department: t.department,
    status: t.status,
    // Encode any orchestration metadata (deps/objectiveId/executor) into the
    // detail envelope — persisted without a schema migration; rowToTask decodes.
    detail: encodeDetail(t.detail, {
      deps: t.dependsOn,
      objectiveId: t.objectiveId ?? undefined,
      agentId: t.agentId ?? undefined,
      executor: t.executor,
    }),
  }));
  const res = await rest("cofounder_tasks", {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`insertTasks failed (${res.status})`);
  const rows = (await res.json()) as DbTaskRow[];
  return rows.map(rowToTask);
}

/** Distinct workspace ids that have at least one todo/running task — the set a
 *  cron tick should consider draining. Capped to keep one tick bounded. */
export async function listActiveWorkspaceIds(limit = 50): Promise<string[]> {
  const res = await rest(
    `cofounder_tasks?status=in.(todo,running)&select=workspace_id&limit=4000`,
    { method: "GET", headers: headers() },
  );
  if (!res.ok) return [];
  const rows = (await res.json()) as { workspace_id: string }[];
  const ids = [...new Set(rows.map((r) => r.workspace_id).filter(Boolean))];
  return ids.slice(0, limit);
}

/** Fetch all tasks for a workspace, oldest first. */
export async function listTasks(workspaceId: string): Promise<Task[]> {
  const res = await rest(
    `cofounder_tasks?workspace_id=eq.${encodeURIComponent(workspaceId)}&order=created_at.asc`,
    { method: "GET", headers: headers() },
  );
  if (!res.ok) throw new Error(`listTasks failed (${res.status})`);
  const rows = (await res.json()) as DbTaskRow[];
  return rows.map(rowToTask);
}

interface DbArtifactRow {
  id: string;
  workspace_id: string;
  task_id: string | null;
  kind: ArtifactKind;
  title: string;
  content: string;
  skill_name: string | null;
  skill_source: string | null;
  skill_url: string | null;
  eval: DeliverableEval | null;
  created_at: string;
}

function rowToArtifact(r: DbArtifactRow): Artifact {
  return {
    id: r.id,
    taskId: r.task_id,
    kind: r.kind,
    title: r.title,
    content: r.content,
    skill: r.skill_name
      ? { name: r.skill_name, source: r.skill_source ?? "", url: r.skill_url ?? "" }
      : null,
    eval: r.eval ?? null,
  };
}

/** Persist a generated deliverable. */
export async function insertArtifact(
  workspaceId: string,
  artifact: {
    taskId: string | null;
    kind: ArtifactKind;
    title: string;
    content: string;
    skill?: SkillRef | null;
    eval?: DeliverableEval | null;
  },
): Promise<Artifact | null> {
  const res = await rest("cofounder_artifacts", {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({
      workspace_id: workspaceId,
      task_id: artifact.taskId,
      kind: artifact.kind,
      title: artifact.title.slice(0, 200),
      content: artifact.content,
      skill_name: artifact.skill?.name?.slice(0, 200) ?? null,
      skill_source: artifact.skill?.source?.slice(0, 200) ?? null,
      skill_url: artifact.skill?.url?.slice(0, 400) ?? null,
      eval: artifact.eval ?? null,
    }),
  });
  if (!res.ok) throw new Error(`insertArtifact failed (${res.status})`);
  const rows = (await res.json()) as DbArtifactRow[];
  return rows[0] ? rowToArtifact(rows[0]) : null;
}

/** All artifacts for a workspace, newest first. */
export async function listArtifacts(workspaceId: string): Promise<Artifact[]> {
  const res = await rest(
    `cofounder_artifacts?workspace_id=eq.${encodeURIComponent(workspaceId)}&order=created_at.desc`,
    { method: "GET", headers: headers() },
  );
  if (!res.ok) throw new Error(`listArtifacts failed (${res.status})`);
  const rows = (await res.json()) as DbArtifactRow[];
  return rows.map(rowToArtifact);
}

/** An agent-authored skill stored in a workspace's own skill library. */
export interface StoredSkill {
  name: string;
  content: string;
  source: string;
}

/** Most-recent authored skill for a workspace + deliverable kind, if any. */
export async function findAuthoredSkill(
  workspaceId: string,
  kind: string,
): Promise<StoredSkill | null> {
  const res = await rest(
    `cofounder_skills?workspace_id=eq.${encodeURIComponent(workspaceId)}&kind=eq.${encodeURIComponent(kind)}&order=created_at.desc&limit=1`,
    { method: "GET", headers: headers() },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as { name: string; content: string; source: string }[];
  return rows[0] ?? null;
}

/** Persist a newly authored skill to the workspace's skill library. */
export async function insertAuthoredSkill(
  workspaceId: string,
  skill: { department: string; kind: string; name: string; content: string; source?: string },
): Promise<void> {
  await rest("cofounder_skills", {
    method: "POST",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({
      workspace_id: workspaceId,
      department: skill.department.slice(0, 60),
      kind: skill.kind,
      name: skill.name.slice(0, 200),
      content: skill.content.slice(0, 8000),
      source: skill.source ?? "authored",
    }),
  });
}

/**
 * A single artifact by id (used by the public preview/export routes).
 *
 * ACCESS MODEL — BY DESIGN: an artifact is fetched by its unguessable id alone,
 * with NO workspace scoping. The id IS the capability — possessing the URL is the
 * authorization to view/export the deliverable. This is intentional: the core
 * "share a deliverable" feature hands out exactly this public, login-free link.
 * Do NOT add workspace scoping here without changing that product behavior.
 * Database RLS (see supabase/migrations/0001_hardening.sql) is the
 * defense-in-depth layer that keeps a leaked anon key from reading rows directly.
 */
export async function getArtifact(id: string): Promise<Artifact | null> {
  const res = await rest(
    `cofounder_artifacts?id=eq.${encodeURIComponent(id)}&limit=1`,
    { method: "GET", headers: headers() },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as DbArtifactRow[];
  return rows[0] ? rowToArtifact(rows[0]) : null;
}

/**
 * Atomically claim a task for execution. Succeeds only if the task is still
 * actionable (todo/running) AND not currently leased by another runner —
 * claimed_at is null or older than `staleCutoffIso` (orphan recovery for a
 * runner that crashed mid-production). The conditional UPDATE is atomic at the
 * row level: two concurrent claimers (two browser tabs, or a client + a cron)
 * can never both win the same task — the loser's WHERE no longer matches once
 * the winner commits, so it updates 0 rows. Returns the claimed task, or null
 * if someone else got there first / it's no longer actionable.
 */
export async function claimTask(
  id: string,
  workspaceId: string,
  staleCutoffIso: string,
  nowIso: string,
): Promise<Task | null> {
  const filters =
    `id=eq.${encodeURIComponent(id)}` +
    `&workspace_id=eq.${encodeURIComponent(workspaceId)}` +
    `&status=in.(todo,running)` +
    `&or=(claimed_at.is.null,claimed_at.lt.${encodeURIComponent(staleCutoffIso)})`;
  const res = await rest(`cofounder_tasks?${filters}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({ status: "running", claimed_at: nowIso }),
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as DbTaskRow[];
  return rows[0] ? rowToTask(rows[0]) : null;
}

const UPLOAD_BUCKET = "cofounder-uploads";

/** Upload bytes to the public Library bucket; returns the public URL or null. */
export async function uploadToStorage(
  path: string,
  bytes: Buffer,
  contentType: string,
): Promise<string | null> {
  if (!dbConfigured) return null;
  const res = await fetch(`${URL}/storage/v1/object/${UPLOAD_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: KEY as string,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": contentType || "application/octet-stream",
      "x-upsert": "true",
    },
    body: new Uint8Array(bytes),
  });
  if (!res.ok) return null;
  return `${URL}/storage/v1/object/public/${UPLOAD_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Edit a deliverable's content/title in place (scoped to its workspace). */
export async function updateArtifact(
  id: string,
  patch: { content?: string; title?: string },
  workspaceId: string,
): Promise<Artifact | null> {
  const body: Record<string, unknown> = {};
  if (typeof patch.content === "string") body.content = patch.content;
  if (typeof patch.title === "string" && patch.title.trim()) body.title = patch.title.slice(0, 200);
  if (Object.keys(body).length === 0) return null;
  const res = await rest(
    `cofounder_artifacts?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${encodeURIComponent(workspaceId)}`,
    { method: "PATCH", headers: headers({ Prefer: "return=representation" }), body: JSON.stringify(body) },
  );
  if (!res.ok) throw new Error(`updateArtifact failed (${res.status})`);
  const rows = (await res.json()) as DbArtifactRow[];
  return rows[0] ? rowToArtifact(rows[0]) : null;
}

/** Patch a single task (e.g. status change), optionally scoped to a workspace. */
export async function patchTask(
  id: string,
  patch: Partial<Pick<Task, "status" | "title" | "detail" | "department">>,
  workspaceId?: string,
): Promise<Task | null> {
  // Scoping by workspace_id means a task can only be modified within its own
  // workspace — PostgREST updates 0 rows (returns null) on any mismatch.
  const scope = workspaceId
    ? `&workspace_id=eq.${encodeURIComponent(workspaceId)}`
    : "";
  const res = await rest(
    `cofounder_tasks?id=eq.${encodeURIComponent(id)}${scope}`,
    {
      method: "PATCH",
      headers: headers({ Prefer: "return=representation" }),
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) throw new Error(`patchTask failed (${res.status})`);
  const rows = (await res.json()) as DbTaskRow[];
  return rows[0] ? rowToTask(rows[0]) : null;
}
