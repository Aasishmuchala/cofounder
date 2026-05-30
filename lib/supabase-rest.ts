// Server-only Supabase access via PostgREST (no SDK dependency).
// Used exclusively from API route handlers — never imported into client code.

import type { Task, TaskStatus, Artifact, ArtifactKind } from "@/lib/agent-types";

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
export async function createWorkspace(name: string, idea: string): Promise<string> {
  const res = await rest("cofounder_workspaces", {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({ name: name.slice(0, 120), idea: idea.slice(0, 600) }),
  });
  if (!res.ok) throw new Error(`createWorkspace failed (${res.status})`);
  const rows = (await res.json()) as { id: string }[];
  return rows[0].id;
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
  created_at: string;
}

function rowToArtifact(r: DbArtifactRow): Artifact {
  return {
    id: r.id,
    taskId: r.task_id,
    kind: r.kind,
    title: r.title,
    content: r.content,
  };
}

/** Persist a generated deliverable. */
export async function insertArtifact(
  workspaceId: string,
  artifact: { taskId: string | null; kind: ArtifactKind; title: string; content: string },
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

/** Patch a single task (e.g. status change). */
export async function patchTask(
  id: string,
  patch: Partial<Pick<Task, "status" | "title" | "detail" | "department">>,
): Promise<Task | null> {
  const res = await rest(`cofounder_tasks?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`patchTask failed (${res.status})`);
  const rows = (await res.json()) as DbTaskRow[];
  return rows[0] ? rowToTask(rows[0]) : null;
}
