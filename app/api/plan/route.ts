import { coerceText } from "@/lib/agent-types";
import { authorizeWrite, tooLarge } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit-db";
import { enforceAnonRateLimit } from "@/lib/request-guard";
import { withGenerationSlot, Saturated } from "@/lib/concurrency";
import { dbConfigured, getWorkspace } from "@/lib/supabase-rest";
import { decomposeGoal, materializePlan } from "@/lib/orchestrator";
import { reviewPlan } from "@/lib/plan-review";

export const runtime = "nodejs";
// Goal decomposition is a single model call; keep a generous ceiling.
export const maxDuration = 60;

/**
 * Orchestration API.
 *
 *   POST /api/plan { workspaceId?, goal }
 *     -> { plan } : decompose the goal into a bounded objectives+tasks plan.
 *        COMPUTE-ONLY — NO DB writes — so it does NOT require authorizeWrite.
 *        Returned to the UI for HUMAN APPROVAL before anything is materialized.
 *
 *   PATCH /api/plan { workspaceId, workspaceSecret, action:"approve", plan }
 *     -> materialize the approved plan: write objectives to meta + insert the
 *        tasks (deps wired). authorizeWrite-gated. Degrades gracefully (no DB).
 */

export async function POST(req: Request): Promise<Response> {
  if (tooLarge(req)) return Response.json({ ok: false, error: "payload too large" }, { status: 413 });
  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }
  const workspaceId = coerceText(body.workspaceId, 100) || undefined;
  const goal = coerceText(body.goal, 600);
  if (!goal) {
    return Response.json({ ok: false, error: "no goal" }, { status: 400 });
  }

  // Rate limit the paid decompose call: per-workspace when keyed, per-IP when
  // anonymous (no workspace). Both PRODUCTION-ONLY; dev/keyless demo is unchanged.
  if (workspaceId) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      const rl = await enforceRateLimit(workspaceId);
      if (!rl.allowed) {
        return Response.json(
          { ok: false, error: "rate limited" },
          { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
        );
      }
    }
  } else {
    const limited = enforceAnonRateLimit(req, "plan");
    if (limited) return limited;
  }

  // Read the workspace meta to ground the decomposition (brand + plan). The
  // decompose itself writes nothing, so no authorization is needed here.
  const meta = workspaceId && dbConfigured ? (await getWorkspace(workspaceId).then((w) => w?.meta ?? null).catch(() => null)) : null;

  try {
    const raw = await withGenerationSlot(() => decomposeGoal(workspaceId, goal, meta));
    // GStack-style plan review: run deterministic quality gates over the decomposed
    // plan (coverage / sequencing / staffing / qa), apply safe auto-fixes, and return
    // the tightened plan plus the gate results — so the founder approves a reviewed
    // plan, not a raw first draft. Pure + instant; the runner path is untouched.
    const { plan, review } = reviewPlan(raw);
    // Surface the heuristic-fallback flag at the top level too (mirrors plan.fallback)
    // so the UI can warn the founder the plan is a generic template, not bespoke.
    return Response.json({ ok: true, plan, fallback: plan.fallback === true, review });
  } catch (e) {
    if (e instanceof Saturated) {
      return Response.json(
        { ok: false, error: "busy, retry shortly" },
        { status: 503, headers: { "Retry-After": String(e.retryAfterSec) } },
      );
    }
    return Response.json({ ok: false, error: "decomposition failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request): Promise<Response> {
  if (tooLarge(req)) return Response.json({ ok: false, error: "payload too large" }, { status: 413 });
  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }
  const workspaceId = coerceText(body.workspaceId, 100);
  const workspaceSecret = coerceText(body.workspaceSecret, 200) || undefined;
  const action = body.action === "approve" ? "approve" : null;

  if (!workspaceId) {
    return Response.json({ ok: false, error: "no workspace" }, { status: 400 });
  }
  if (action !== "approve") {
    return Response.json({ ok: false, error: "action must be approve" }, { status: 400 });
  }
  if (!(await authorizeWrite(workspaceId, workspaceSecret))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }
  if (!dbConfigured) {
    return Response.json({ ok: true, persisted: false });
  }

  try {
    const { objectives, taskCount } = await materializePlan(workspaceId, body.plan);
    return Response.json({ ok: true, persisted: true, objectives, taskCount });
  } catch {
    return Response.json({ ok: false, error: "materialize failed" }, { status: 500 });
  }
}
