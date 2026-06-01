import { coerceText } from "@/lib/agent-types";
import { authorizeWrite, tooLarge } from "@/lib/auth";
import { produceDeliverable } from "@/lib/runner";

export const runtime = "nodejs";

interface ExecBody {
  workspaceId?: string;
  workspaceSecret?: string;
  idea?: string;
  task?: { id: string; title: string; department: string; detail?: string };
}

// POST /api/execute — produce a single deliverable for a task (one-off / manual run).
export async function POST(req: Request): Promise<Response> {
  if (tooLarge(req)) return Response.json({ ok: false, error: "payload too large" }, { status: 413 });
  let body: ExecBody = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") body = parsed as ExecBody;
  } catch {
    body = {};
  }
  const rawTask = body.task;
  if (!rawTask?.id || !rawTask?.title) {
    return Response.json({ ok: false, error: "missing task" }, { status: 400 });
  }
  const task = {
    id: String(rawTask.id),
    title: coerceText(rawTask.title, 200) || "Untitled task",
    department: coerceText(rawTask.department, 60),
    detail: coerceText(rawTask.detail, 1000),
  };
  const idea = coerceText(body.idea, 4000);
  const workspaceId = coerceText(body.workspaceId, 100);
  const workspaceSecret = coerceText(body.workspaceSecret, 200) || undefined;

  // Persisting a deliverable into a workspace requires its edit key.
  if (workspaceId && !(await authorizeWrite(workspaceId, workspaceSecret))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  const { artifact, mock } = await produceDeliverable(workspaceId || undefined, task, idea);
  return Response.json({ ok: true, mock, artifact });
}
