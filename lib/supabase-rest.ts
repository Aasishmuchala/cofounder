// Server-only Supabase access via PostgREST (no SDK dependency).
// Used exclusively from API route handlers — never imported into client code.

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

function rowToTask(r: DbTaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    department: r.department,
    status: r.status,
    detail: r.detail,
  };
}

async function rest(path: string, init: RequestInit): Promise<Response> {
  if (!dbConfigured) throw new Error("Supabase not configured");
  return fetch(`${URL}/rest/v1/${path}`, init);
}

/** Create a workspace (a company run). Returns its id. */
export async function createWorkspace(
  name: string,
  idea: string,
  meta: WorkspaceMeta = {},
): Promise<string> {
  const res = await rest("cofounder_workspaces", {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({ name: name.slice(0, 120), idea: idea.slice(0, 600), meta }),
  });
  if (!res.ok) throw new Error(`createWorkspace failed (${res.status})`);
  const rows = (await res.json()) as { id: string }[];
  return rows[0].id;
}

interface DbWorkspaceRow {
  id: string;
  name: string;
  idea: string | null;
  meta: WorkspaceMeta | null;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  idea: string;
  meta: WorkspaceMeta;
}

/** Fetch a workspace row (name + idea + the durable meta blob). */
export async function getWorkspace(id: string): Promise<WorkspaceRecord | null> {
  const res = await rest(
    `cofounder_workspaces?id=eq.${encodeURIComponent(id)}&select=id,name,idea,meta&limit=1`,
    { method: "GET", headers: headers() },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as DbWorkspaceRow[];
  const r = rows[0];
  if (!r) return null;
  return { id: r.id, name: r.name, idea: r.idea ?? "", meta: r.meta ?? {} };
}

/**
 * Shallow-merge a patch into a workspace's meta and persist it. Read-modify-write
 * (PostgREST can't do a partial jsonb merge in one PATCH); the patch wins on
 * conflicting top-level keys (e.g. the full customAgents array is replaced).
 * Returns the merged meta.
 */
export async function updateWorkspaceMeta(
  id: string,
  patch: WorkspaceMeta,
): Promise<WorkspaceMeta> {
  const current = (await getWorkspace(id))?.meta ?? {};
  const next: WorkspaceMeta = { ...current, ...patch };
  const res = await rest(`cofounder_workspaces?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({ meta: next }),
  });
  if (!res.ok) throw new Error(`updateWorkspaceMeta failed (${res.status})`);
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
    detail: t.detail,
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

/** A single artifact by id (used by the public preview route). */
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
