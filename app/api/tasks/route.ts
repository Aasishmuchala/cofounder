import { listTasks, patchTask, dbConfigured } from "@/lib/supabase-rest";

export const runtime = "nodejs";

// GET /api/tasks?workspace=<id>  -> hydrate a workspace's task agents
export async function GET(req: Request) {
  if (!dbConfigured) return Response.json({ tasks: [], persisted: false });
  const url = new URL(req.url);
  const workspace = url.searchParams.get("workspace");
  if (!workspace) return Response.json({ tasks: [], persisted: true });
  try {
    const tasks = await listTasks(workspace);
    return Response.json({ tasks, persisted: true });
  } catch {
    return Response.json({ tasks: [], persisted: false });
  }
}

// PATCH /api/tasks  { id, status?, detail?, title?, department? }
export async function PATCH(req: Request) {
  if (!dbConfigured) return Response.json({ ok: false, persisted: false });
  try {
    const body = await req.json();
    const { id, ...patch } = body ?? {};
    if (!id) return Response.json({ ok: false, error: "missing id" }, { status: 400 });
    const allowed: Record<string, unknown> = {};
    for (const k of ["status", "detail", "title", "department"]) {
      if (patch[k] !== undefined) allowed[k] = patch[k];
    }
    const task = await patchTask(id, allowed);
    return Response.json({ ok: true, task, persisted: true });
  } catch {
    return Response.json({ ok: false, persisted: false });
  }
}
