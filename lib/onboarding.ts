// Shared types + deterministic generators for the guided onboarding flow.
// Pure module (no server-only imports) so both the API route and the client
// hook can import the types. The mock generators guarantee the flow works with
// no API key, exactly like the rest of the app.

import { coerceText } from "@/lib/agent-types";

export interface OnboardingQuestion {
  id: string;
  prompt: string;
  options: string[];
}

export interface GTMItem {
  label: string;
  text: string;
}

export interface BusinessPlan {
  context: { product: string; icp: string; model: string };
  values: string[];
  gtm: GTMItem[];
}

export interface AnsweredQuestion {
  prompt: string;
  answer: string;
}

/* ───────────────────────── mock questions ───────────────────────── */

/**
 * Strong, universally-sensible clarifying questions. Stable ids let the mock
 * plan generator read specific answers; the Claude path uses free-form ids.
 */
export function mockQuestions(): OnboardingQuestion[] {
  return [
    {
      id: "customer",
      prompt: "Who is your primary paying customer?",
      options: [
        "Individual consumers (B2C)",
        "Small & medium businesses",
        "Enterprises",
        "Developers / technical teams",
      ],
    },
    {
      id: "geography",
      prompt: "Which geography are you launching in first?",
      options: ["United States", "India", "Europe", "Global / remote-first"],
    },
    {
      id: "model",
      prompt: "How does the company primarily make money?",
      options: [
        "Subscription (SaaS)",
        "One-time purchase",
        "Marketplace / transaction fee",
        "Usage-based pricing",
      ],
    },
    {
      id: "stage",
      prompt: "Where are you right now?",
      options: ["Just an idea", "Building the MVP", "MVP live, pre-revenue", "Early revenue"],
    },
    {
      id: "wedge",
      prompt: "What is your primary wedge or differentiation?",
      options: [
        "Better UX & design",
        "Lower price",
        "Speed & automation",
        "Deep vertical focus",
      ],
    },
  ];
}

/* ───────────────────────── mock business plan ───────────────────────── */

function find(answers: AnsweredQuestion[], idPart: string): string {
  const hit = answers.find((a) => a.prompt.toLowerCase().includes(idPart));
  return hit?.answer ?? "";
}

function shorten(s: string, n = 90): string {
  const t = coerceText(s);
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

export function mockPlan(idea: string, answers: AnsweredQuestion[]): BusinessPlan {
  const product = shorten(idea || "your product", 110);
  const customer = find(answers, "customer") || "early adopters";
  const geo = find(answers, "geograph") || "your first market";
  const model = find(answers, "money") || "Subscription (SaaS)";
  const wedge = find(answers, "wedge") || "Better UX & design";

  const channel = /developer/i.test(customer)
    ? "Developer community, docs, and open-source presence"
    : /enterprise/i.test(customer)
      ? "Direct outbound + design partners and pilots"
      : /business/i.test(customer)
        ? "Outbound to founders/ops leads and warm intros"
        : "Content, social, and community-led growth";

  const pricing = /one-time/i.test(model)
    ? "One-time purchase with optional upgrades"
    : /marketplace|transaction/i.test(model)
      ? "Take-rate on each transaction"
      : /usage/i.test(model)
        ? "Usage-based pricing that scales with value delivered"
        : "Per-seat or per-project SaaS subscription";

  return {
    context: {
      product,
      icp: `${customer} in ${geo}`,
      model,
    },
    values: [
      "Speed over perfection — help customers move fast and learn in public.",
      "Earn trust with transparency in product development and pricing.",
      `Win on ${wedge.toLowerCase()} rather than feature sprawl.`,
      `Build for ${geo}'s specific workflow and price sensitivity.`,
    ],
    gtm: [
      {
        label: "Wedge",
        text: `Land ${customer.toLowerCase()} who feel the pain most acutely, leading with ${wedge.toLowerCase()}.`,
      },
      { label: "Initial channel", text: channel + "." },
      {
        label: "Land and expand",
        text: "Start with one team or use-case, prove ROI, then expand across the account and adjacent jobs.",
      },
      { label: "Pricing model", text: pricing + "." },
    ],
  };
}

/* ───────────────────────── JSON parsing (Claude path) ───────────────────────── */

function fenced(text: string): string {
  const m = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/);
  return (m ? m[1] : text).trim();
}

export function parseQuestions(text: string): OnboardingQuestion[] | null {
  try {
    const parsed = JSON.parse(fenced(text));
    const arr = Array.isArray(parsed?.questions) ? parsed.questions : [];
    const out: OnboardingQuestion[] = arr
      .map((q: Record<string, unknown>, i: number) => ({
        id: typeof q?.id === "string" && q.id ? q.id : `q${i}`,
        prompt: coerceText(q?.prompt, 240),
        options: Array.isArray(q?.options)
          ? (q.options as unknown[]).map((o) => coerceText(o, 120)).filter(Boolean).slice(0, 5)
          : [],
      }))
      .filter((q: OnboardingQuestion) => q.prompt && q.options.length >= 2);
    return out.length ? out.slice(0, 6) : null;
  } catch {
    return null;
  }
}

export function parsePlan(text: string): BusinessPlan | null {
  try {
    const p = JSON.parse(fenced(text));
    const values = Array.isArray(p?.values)
      ? (p.values as unknown[]).map((v) => coerceText(v, 240)).filter(Boolean).slice(0, 6)
      : [];
    const gtm = Array.isArray(p?.gtm)
      ? (p.gtm as Record<string, unknown>[])
          .map((g) => ({ label: coerceText(g?.label, 40), text: coerceText(g?.text, 320) }))
          .filter((g) => g.label && g.text)
          .slice(0, 6)
      : [];
    if (!values.length || !gtm.length) return null;
    return {
      context: {
        product: coerceText(p?.context?.product, 240),
        icp: coerceText(p?.context?.icp, 160),
        model: coerceText(p?.context?.model, 120),
      },
      values,
      gtm,
    };
  } catch {
    return null;
  }
}
