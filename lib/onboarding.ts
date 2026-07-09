// Shared types + deterministic generators for the guided onboarding flow.
// Pure module (no server-only imports) so both the API route and the client
// hook can import the types. The mock generators guarantee the flow works with
// no API key, exactly like the rest of the app.

import { coerceText } from "@/lib/agent-types";
import { coreExtract } from "@/lib/cofounder-data";

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

/* ───────────────────────── Brand: profile + names + taglines ───────────────────────── */

export type VibeFit = "minimal" | "bold" | "playful" | "premium" | "technical";

export interface ProductProfile {
  oneLiner: string;
  icp: string;
  wedge: string;
  valueProp: string;
}

export interface NameCandidate {
  name: string;
  tagline?: string;
  rationale: string;
  vibeFit: VibeFit[];
}

export interface TaglineCandidate {
  text: string;
  tone: string;
}

export interface BrandBundle {
  profile: ProductProfile;
  names: NameCandidate[];
  taglines: TaglineCandidate[];
}

const VIBE_FITS: ReadonlySet<VibeFit> = new Set([
  "minimal",
  "bold",
  "playful",
  "premium",
  "technical",
]);

/** Infer which vibe a token best maps to for an inferred name. Pure / deterministic. */
function inferVibeFit(idea: string): VibeFit[] {
  const l = idea.toLowerCase();
  const out: VibeFit[] = [];
  if (/developer|api|code|technical|engineer|stack/.test(l)) out.push("technical");
  if (/enterprise|corporate|luxury|premium|high-end|studio/.test(l)) out.push("premium");
  if (/friendly|community|social|fun|warm|playful|casual/.test(l)) out.push("playful");
  if (/minimal|lean|simple|clean|strip/.test(l)) out.push("minimal");
  if (/bold|loud|confident|power|fast|brut/.test(l)) out.push("bold");
  if (out.length === 0) out.push("minimal");
  return Array.from(new Set(out)).slice(0, 3);
}

/**
 * Generate 6 brand-name candidates from the founding idea + onboarding
 * answers. Deterministic (no randomness) — same input always gives the
 * same output, so SSR + hydration stay stable.
 */
function buildNames(seed: string, idea: string): NameCandidate[] {
  const cap = seed.charAt(0).toUpperCase() + seed.slice(1);
  if (!cap || cap === "Untitled") {
    // No meaningful word extracted — fall back to stable "Founder" theme.
    return [
      { name: "Foundry", tagline: "Where ideas become companies.", rationale: "A short, sturdy word that suggests building from first principles.", vibeFit: ["bold", "minimal"] },
      { name: "Foundryly", tagline: "Lightweight company-building, rooted.", rationale: "A friendlier spin on Foundry with a soft -ly suffix.", vibeFit: ["playful"] },
      { name: "Helmwise", tagline: "Run your company with helm.", rationale: "Pairs with the platform name for friendly continuity.", vibeFit: ["minimal"] },
      { name: "Helmstack", tagline: "The stack behind your startup.", rationale: "Technical, slightly premium tone for engineering teams.", vibeFit: ["technical", "premium"] },
      { name: "Helmlabs", tagline: "Where founders build together.", rationale: "Community-leaning, evokes co-working and craft.", vibeFit: ["playful"] },
      { name: "Helmhq", tagline: "Headquarters for your company.", rationale: "Bold and confident, with a clear premium tilt.", vibeFit: ["bold", "premium"] },
    ];
  }
  const vibeFit = inferVibeFit(idea);
  const variants = [
    { name: cap, tagline: `Run your ${seed.toLowerCase()} like clockwork.`, rationale: `The most descriptive option — clearly tells a visitor what you're building around "${seed}".`, vibeFit: ["minimal" as VibeFit, ...vibeFit].slice(0, 3) as VibeFit[] },
    { name: `${cap}ly`, tagline: `${cap}ly made simple.`, rationale: `Adds a soft, friendly -ly ending — feels modern and product-led without losing the core idea.`, vibeFit: ["playful" as VibeFit, ...vibeFit].slice(0, 3) as VibeFit[] },
    { name: `${cap}hq`, tagline: `Your ${seed.toLowerCase()} headquarters.`, rationale: `A "headquarters" framing — confident and operations-driven.`, vibeFit: ["bold" as VibeFit, ...vibeFit].slice(0, 3) as VibeFit[] },
    { name: `${cap}lab`, tagline: `The lab for ${seed.toLowerCase()}.`, rationale: `Signals craftsmanship + experimentation; great for technical or premium brands.`, vibeFit: ["technical" as VibeFit, ...vibeFit].slice(0, 3) as VibeFit[] },
    { name: `Get${cap}`, tagline: `Get ${seed.toLowerCase()}, fast.`, rationale: `Action-oriented; pairs a verb with the noun to lean into speed.`, vibeFit: ["bold" as VibeFit] },
    { name: `Try${cap}`, tagline: `Try ${seed.toLowerCase()} on for size.`, rationale: `Invitation-style — friendly and exploratory, soft sell.`, vibeFit: ["playful" as VibeFit, "minimal" as VibeFit].slice(0, 3) as VibeFit[] },
  ];
  return variants;
}

function buildTaglines(seed: string, answers: AnsweredQuestion[]): TaglineCandidate[] {
  const customer = find(answers, "customer") || "your customers";
  const geo = find(answers, "geograph") || "your market";
  const s = seed.toLowerCase();
  return [
    { text: `Run your ${s} like clockwork.`, tone: "Approachable" },
    { text: `${cap(seed)}, on autopilot.`, tone: "Confident" },
    { text: `${s.charAt(0).toUpperCase() + s.slice(1)} ops, refined for ${geo}.`, tone: "Concise" },
  ];
}

/**
 * Deterministic brand bundle generator. Used both client-side as a fast
 * preview and server-side as the mock fallback when no AI key is configured.
 */
export function mockBrand(idea: string, answers: AnsweredQuestion[] = []): BrandBundle {
  const seed = coreExtract(idea);
  const product = shorten(idea || "your product", 110);
  const customer = find(answers, "customer") || "your customers";
  const geo = find(answers, "geograph") || "your first market";
  const wedge = find(answers, "wedge") || "your wedge";

  const profile: ProductProfile = {
    oneLiner: product,
    icp: `${customer} in ${geo}`,
    wedge,
    valueProp: `Helps ${customer.toLowerCase()} ship faster on ${wedge.toLowerCase()}.`,
  };

  return {
    profile,
    names: buildNames(seed, idea || ""),
    taglines: buildTaglines(seed, answers),
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Parse the AI's fenced JSON response into a BrandBundle. Pure / deterministic. */
export function parseBrand(text: string): BrandBundle | null {
  try {
    const p = JSON.parse(fenced(text)) as Record<string, unknown>;
    const prof = (p?.profile && typeof p.profile === "object" ? p.profile : {}) as Record<string, unknown>;
    const profile: ProductProfile | null = prof.oneLiner
      ? {
          oneLiner: coerceText(prof.oneLiner, 240),
          icp: coerceText(prof.icp, 160),
          wedge: coerceText(prof.wedge, 240),
          valueProp: coerceText(prof.valueProp, 240),
        }
      : null;
    if (!profile) return null;

    const rawNames = Array.isArray(p?.names) ? (p.names as Record<string, unknown>[]) : [];
    const names: NameCandidate[] = rawNames
      .map((n) => {
        const fit: VibeFit[] = Array.isArray(n?.vibeFit)
          ? (n.vibeFit as unknown[])
              .filter((f): f is VibeFit => typeof f === "string" && VIBE_FITS.has(f as VibeFit))
              .slice(0, 4)
          : [];
        return {
          name: coerceText(n?.name, 40),
          tagline: typeof n?.tagline === "string" ? coerceText(n.tagline, 80) : undefined,
          rationale: coerceText(n?.rationale, 240),
          vibeFit: fit,
        };
      })
      .filter((n) => n.name.length > 0 && n.rationale.length > 0)
      .slice(0, 6);
    if (!names.length) return null;

    const rawTaglines = Array.isArray(p?.taglines) ? (p.taglines as Record<string, unknown>[]) : [];
    const taglines: TaglineCandidate[] = rawTaglines
      .map((t) => ({ text: coerceText(t?.text, 80), tone: coerceText(t?.tone, 24) }))
      .filter((t) => t.text.length > 0 && t.tone.length > 0)
      .slice(0, 4);
    if (!taglines.length) return null;

    return { profile, names, taglines };
  } catch {
    return null;
  }
}
