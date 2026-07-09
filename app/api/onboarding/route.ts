import type Anthropic from "@anthropic-ai/sdk";
import { coerceText } from "@/lib/agent-types";
import { tooLarge } from "@/lib/auth";
import { enforceAnonRateLimit } from "@/lib/request-guard";
import { withGenerationSlot, Saturated } from "@/lib/concurrency";
import { getAnthropic, aiConfigured, MODEL } from "@/lib/anthropic";
import {
  mockQuestions,
  mockPlan,
  mockBrand,
  parseQuestions,
  parsePlan,
  parseBrand,
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

const BRAND_SYSTEM = `You are Cofounder's brand-naming agent. Given the founder's idea and onboarding answers, generate a Product Profile (the source of truth for all later brand artifacts), 5 brand-name candidates, and 3 tagline options.

Product Profile (mandatory):
- oneLiner: a single specific sentence describing what the product does and for whom — no boilerplate ("revolutionize", "empower", "all-in-one" are forbidden)
- icp: ideal customer profile (specific role/segment, not "businesses")
- wedge: 8-20 word differentiator grounded in the onboarding answers
- valueProp: how the product changes the customer's day concretely

Brand names (5 candidates):
- Each name SPECIFIC to the idea's domain — never generic startup-template words
- Range from descriptive (e.g. "Coffeely") to more abstract/positioned ("Roastly", "Beanly")
- vibeFit: array subset of ["minimal", "bold", "playful", "premium", "technical"] naming which visual styles fit the name's voice
- rationale: 1-2 sentences explaining why the name fits the idea and what it signals
- tagline: one short phrase tuned to the name's voice (≤10 words)

Taglines (3 candidates): vary tone — pick three different emotional registers from ["Approachable", "Confident", "Concise", "Warm", "Sharp"].

Return ONLY a single fenced json block and nothing else:
\`\`\`json
{
  "profile": { "oneLiner": "...", "icp": "...", "wedge": "...", "valueProp": "..." },
  "names": [
    { "name": "...", "tagline": "...", "rationale": "...", "vibeFit": ["minimal", "premium"] }
  ],
  "taglines": [
    { "text": "...", "tone": "Approachable" }
  ]
}
\`\`\``;

interface Body {
  action?: string;
  idea?: string;
  answers?: { prompt?: unknown; answer?: unknown }[];
}

async function callClaude(system: string, userText: string, maxTokens = 2500): Promise<string | null> {
  const client = getAnthropic();
  if (!aiConfigured || !client) return null;
  try {
    // Hold a concurrency slot for the paid call so a burst can't fan out into N
    // simultaneous Opus calls (cost + provider 429s + socket exhaustion). Saturated
    // propagates so the route returns 503 rather than degrading to a mock silently.
    const response = await withGenerationSlot(() =>
      client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
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

    if (action === "nameOptions") {
      const answers: AnsweredQuestion[] = Array.isArray(body.answers)
        ? body.answers
            .map((a) => ({ prompt: coerceText(a?.prompt, 240), answer: coerceText(a?.answer, 240) }))
            .filter((a) => a.prompt && a.answer)
        : [];
      const qa = answers.map((a) => `Q: ${a.prompt}\nA: ${a.answer}`).join("\n\n");
      const userText =
        `Company idea: ${idea || "a new startup"}\n\n` +
        `Onboarding answers:\n${qa || "(none)"}\n\n` +
        `Generate a Product Profile, 5 brand-name candidates, and 3 tagline options. Names and taglines must be specific to the idea.`;
      const text = await callClaude(BRAND_SYSTEM, userText, 4000);
      const brand = text ? parseBrand(text) : null;
      // Always return a usable bundle — if the AI failed, mock the missing fields
      // so the UI never gets a half-empty response.
      const fallback = mockBrand(idea, answers);
      return Response.json({
        profile: brand?.profile ?? fallback.profile,
        names: brand?.names ?? fallback.names,
        taglines: brand?.taglines ?? fallback.taglines,
        mock: !brand,
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
