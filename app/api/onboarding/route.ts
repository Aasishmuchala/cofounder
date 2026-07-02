import type Anthropic from "@anthropic-ai/sdk";
import { coerceText } from "@/lib/agent-types";
import { tooLarge } from "@/lib/auth";
import { enforceAnonRateLimit } from "@/lib/request-guard";
import { withGenerationSlot, Saturated } from "@/lib/concurrency";
import { getAnthropic, aiConfigured, MODEL } from "@/lib/anthropic";
import {
  mockQuestions,
  mockPlan,
  parseQuestions,
  parsePlan,
  type AnsweredQuestion,
} from "@/lib/onboarding";

export const runtime = "nodejs";

const QUESTIONS_SYSTEM = `You are Cofounder's onboarding agent. Given a founder's company idea, ask 4–5 sharp, idea-SPECIFIC multiple-choice questions whose answers let you write a crisp business plan (value chain position, paying customer, geography, monetization, stage, wedge). Each question must have a clear prompt and 3–4 concrete options tailored to THIS specific idea — never generic placeholders.

Return ONLY a single fenced json block and nothing else:
\`\`\`json
{ "questions": [ { "id": "short_slug", "prompt": "…", "options": ["…","…","…"] } ] }
\`\`\``;

const PLAN_SYSTEM = `You are Cofounder's strategy agent. Given a founder's idea and their answers to onboarding questions, synthesize a tight, specific business plan. Be concrete and reference the actual idea + answers.

Return ONLY a single fenced json block and nothing else:
\`\`\`json
{
  "context": { "product": "one-sentence product description", "icp": "ideal customer", "model": "how it makes money" },
  "values": ["4 short company-value bullets"],
  "gtm": [
    { "label": "Wedge", "text": "…" },
    { "label": "Initial channel", "text": "…" },
    { "label": "Land and expand", "text": "…" },
    { "label": "Pricing model", "text": "…" }
  ]
}
\`\`\``;

interface Body {
  action?: string;
  idea?: string;
  answers?: { prompt?: unknown; answer?: unknown }[];
}

async function callClaude(system: string, userText: string): Promise<string | null> {
  const client = getAnthropic();
  if (!aiConfigured || !client) return null;
  try {
    // Hold a concurrency slot for the paid call so a burst can't fan out into N
    // simultaneous Opus calls (cost + provider 429s + socket exhaustion). Saturated
    // propagates so the route returns 503 rather than degrading to a mock silently.
    const response = await withGenerationSlot(() =>
      client.messages.create({
        model: MODEL,
        max_tokens: 2500,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userText }] as Anthropic.MessageParam[],
      }),
    );
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  } catch (e) {
    if (e instanceof Saturated) throw e; // let the route map it to 503
    return null;
  }
}

export async function POST(req: Request): Promise<Response> {
  if (tooLarge(req)) return Response.json({ error: "payload too large" }, { status: 413 });
  // UNKEYED paid route (no workspace) — the per-workspace limiter can't cover it.
  // Cap anonymous callers per-IP (prod only) so a loop can't drive unbounded spend.
  const limited = enforceAnonRateLimit(req, "onboarding");
  if (limited) return limited;
  let body: Body = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") body = parsed as Body;
  } catch {
    body = {};
  }

  const action = coerceText(body.action, 20);
  const idea = coerceText(body.idea, 600);

  try {
    if (action === "questions") {
      const text = await callClaude(QUESTIONS_SYSTEM, `Company idea: ${idea || "a new startup"}`);
      const questions = text ? parseQuestions(text) : null;
      return Response.json({
        questions: questions ?? mockQuestions(),
        mock: !questions,
      });
    }

    if (action === "plan") {
      const answers: AnsweredQuestion[] = Array.isArray(body.answers)
        ? body.answers
            .map((a) => ({ prompt: coerceText(a?.prompt, 240), answer: coerceText(a?.answer, 240) }))
            .filter((a) => a.prompt && a.answer)
        : [];
      const qa = answers.map((a) => `Q: ${a.prompt}\nA: ${a.answer}`).join("\n\n");
      const text = await callClaude(
        PLAN_SYSTEM,
        `Company idea: ${idea || "a new startup"}\n\nOnboarding answers:\n${qa || "(none)"}`,
      );
      const plan = text ? parsePlan(text) : null;
      return Response.json({
        plan: plan ?? mockPlan(idea, answers),
        mock: !plan,
      });
    }
  } catch (e) {
    if (e instanceof Saturated) {
      return Response.json(
        { error: "busy, retry shortly" },
        { status: 503, headers: { "Retry-After": String(e.retryAfterSec) } },
      );
    }
    throw e;
  }

  return Response.json({ error: "unknown action" }, { status: 400 });
}
