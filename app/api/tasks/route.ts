import { listTasks, patchTask, dbConfigured } from "@/lib/supabase-rest";
import { coerceText, VALID_STATUSES, matchDepartment } from "@/lib/agent-types";
import { verifyWorkspaceToken } from "@/lib/auth";

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

// PATCH /api/tasks  { id, workspaceId, workspaceSecret, status?, detail?, title?, department? }
export async function PATCH(req: Request) {
  try {
    const raw = await req.json();
    const body = (raw && typeof raw === "object" ? raw : {}) as Record<
      string,
      unknown
    >;
    const {
      id,
      workspaceId: wsRaw,
      workspaceSecret,
      ...patch
    } = body;
    if (!id || typeof id !== "string") {
      return Response.json({ ok: false, error: "missing id" }, { status: 400 });
    }
    const workspaceId = coerceText(wsRaw, 100) || undefined;

    // Modifying a task requires its workspace's capability token.
    if (!verifyWorkspaceToken(workspaceId, workspaceSecret)) {
      return Response.json(
        { ok: false, error: "unauthorized" },
        { status: 403 },
      );
    }

    if (!dbConfigured) return Response.json({ ok: false, persisted: false });

    // Validate VALUES, not just keys: an out-of-range status or unknown
    // department is dropped rather than written through to the database.
    const allowed: Record<string, unknown> = {};
    if (
      typeof patch.status === "string" &&
      (VALID_STATUSES as readonly string[]).includes(patch.status)
    ) {
      allowed.status = patch.status;
    }
    const dep = matchDepartment(patch.department);
    if (dep) allowed.department = dep;
    if (patch.title !== undefined) {
      const t = coerceText(patch.title, 200);
      if (t) allowed.title = t;
    }
    if (patch.detail !== undefined) {
      allowed.detail = coerceText(patch.detail, 1000);
    }
    if (Object.keys(allowed).length === 0) {
      return Response.json(
        { ok: false, error: "no valid fields" },
        { status: 400 },
      );
    }
    const task = await patchTask(id, allowed, workspaceId);
    return Response.json({ ok: true, task, persisted: true });
  } catch {
    return Response.json({ ok: false, persisted: false });
  }
}
