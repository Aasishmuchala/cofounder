import type Anthropic from "@anthropic-ai/sdk";
import type { ArtifactKind } from "@/lib/agent-types";
import { MODEL, NO_THINKING } from "@/lib/anthropic";

/** Required quality bar (0–10). A deliverable scoring below this is regenerated
 *  (up to maxQualityAttempts) and, if it still can't reach the bar, REJECTED — the
 *  task is left needs_action, not marked done. Default 9 ("only ship excellent
 *  work" — a literal 10 from an honest judge is near-unattainable and rejects even
 *  work it calls exceptional); tune with HELM_QUALITY_BAR (10 = purist, rejects
 *  almost everything). Read at call time so it tracks the live env + is test-controllable. */
export function qualityBar(): number {
  return envIntClamped("HELM_QUALITY_BAR", 9, 1, 10);
}

/** How many total generation attempts a deliverable gets to reach the bar (1 =
 *  no retry). Bounds cost/latency of the regenerate loop. Default 3; override with
 *  HELM_MAX_QUALITY_ATTEMPTS. Landing pages/decks are slow, so keep this modest. */
export function maxQualityAttempts(): number {
  return envIntClamped("HELM_MAX_QUALITY_ATTEMPTS", 3, 1, 6);
}

function envIntClamped(name: string, def: number, min: number, max: number): number {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

/** Rubric dimensions the judge grades, per deliverable kind. */
const DIMENSIONS: Record<string, string[]> = {
  landing_page: [
    "Visual design & polish",
    "Information hierarchy",
    "On-brand & specific (not generic AI slop)",
    "Conversion focus (clear, compelling CTA)",
  ],
  brand_spec: ["Distinctiveness", "Internal coherence", "Actionability"],
  email: ["Clarity & concision", "Personalization & specificity", "Compelling CTA", "Professional tone"],
  markdown: ["Specificity (no fluff)", "Completeness", "Actionability"],
  pitch_deck: ["Narrative arc & clarity", "Visual design & polish", "Specific, credible content", "Investor persuasiveness"],
};

export interface JudgeResult {
  score: number;
  rubric: { label: string; score: number }[];
  notes: string;
}

/** Deterministic, fast quality checks — no model needed. */
export function runChecks(kind: ArtifactKind, content: string): { name: string; pass: boolean }[] {
  const len = content.trim().length;
  const noNoise = !/\[object Object\]|lorem ipsum|undefined<|TODO:/i.test(content);
  if (kind === "landing_page") {
    return [
      {
        name: "React/Next page component",
        pass: /export\s+default\s+(function\s+Page|Page\b)/.test(content) && /return\s*\(/.test(content),
      },
      { name: "Tailwind styling", pass: /className=/.test(content) },
      {
        name: "Animations present",
        pass: /@keyframes|IntersectionObserver|animation|animate-|transition/i.test(content),
      },
      {
        name: "Generated imagery",
        pass: /<img[\s>]|image\.pollinations\.ai|https?:\/\/\S+\.(png|jpe?g|webp|avif)/i.test(content),
      },
      { name: "Substantial build (>1.5KB)", pass: len > 1500 },
      { name: "No template noise", pass: noNoise },
    ];
  }
  if (kind === "pitch_deck") {
    const slides = (content.match(/<section[\s>]/gi) || []).length || (content.match(/class="[^"]*\bslide\b/gi) || []).length;
    return [
      { name: "Self-contained HTML document", pass: /^\s*(?:﻿)?<!doctype html/i.test(content) && /<\/html>/i.test(content) },
      { name: "Styled (inline <style>)", pass: /<style[\s>]/i.test(content) },
      { name: "Multiple slides (>=4)", pass: slides >= 4 },
      { name: "Sandbox-safe (no <script>)", pass: !/<script[\s>]/i.test(content) },
      { name: "Substantial build (>1.5KB)", pass: len > 1500 },
      { name: "No template noise", pass: noNoise },
    ];
  }
  const checks = [
    { name: "Non-trivial length", pass: len > 140 },
    { name: "Has structure", pass: /(^|\n)\s*([#\-*]|\d+\.)|\*\*/.test(content) },
    { name: "No template noise", pass: noNoise },
  ];
  if (kind === "email") checks.push({ name: "Has subject line", pass: /subject/i.test(content) });
  if (kind === "brand_spec") checks.push({ name: "Has hex palette", pass: /#[0-9a-fA-F]{6}/.test(content) });
  return checks;
}

/** Score (0–10) derived from passed checks — used when no LLM judge is available. */
export function heuristicScore(checks: { pass: boolean }[]): number {
  if (!checks.length) return 6;
  const ratio = checks.filter((c) => c.pass).length / checks.length;
  return Math.round((5 + ratio * 4.5) * 10) / 10; // 5.0 → 9.5
}

function fenced(text: string): string {
  const m = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/);
  return (m ? m[1] : text).trim();
}

/** LLM judge: grade the deliverable against its rubric. Returns null on failure. */
export async function judgeDeliverable(
  client: Anthropic,
  args: { kind: ArtifactKind; idea: string; task: string; content: string },
): Promise<JudgeResult | null> {
  const dims = DIMENSIONS[args.kind] ?? DIMENSIONS.markdown;
  // Landing pages + pitch decks are big HTML deliverables — give the judge the
  // WHOLE thing (grading a truncated quarter was unfairly tanking scores).
  const cap = args.kind === "landing_page" || args.kind === "pitch_deck" ? 18000 : 7000;
  const kindNote =
    args.kind === "landing_page"
      ? `\n\nNOTE: This deliverable is a React/Next.js page component (Tailwind classes + inline <style> animations). Judge the DESIGN it describes — color/typography/spacing choices in the classes, animation richness (@keyframes / IntersectionObserver / transitions), section completeness (hero, features, social proof, CTA, footer), copy specificity, responsiveness, and use of real generated <img> imagery. Do NOT penalize it for being code or for not being raw HTML. A complete, on-brand, animated page with specific copy and real imagery is excellent — reach 9–10.`
      : args.kind === "pitch_deck"
        ? `\n\nNOTE: This deliverable is a self-contained HTML pitch deck — full-viewport scroll-snap <section> slides styled with one inline <style> (pure CSS, no script). Judge the NARRATIVE arc (problem→solution→market→model→ask), the visual design (palette/typography/hierarchy/spacing in the CSS), slide completeness (~8–10 focused slides), and copy specificity. Do NOT penalize it for being one HTML file or for using CSS instead of a slide library. A complete, on-brand deck with a clear story and specific copy is excellent — reach 9–10.`
        : "";
  const system = `You are a demanding senior reviewer grading a startup's deliverable before it ships. Award 10 ONLY for flawless, ship-ready, genuinely excellent, distinctive, on-brand work with no material weakness; award 9 for excellent work with a single minor nit; 7–8 for solid work with real gaps; generic or templated output scores 5 or below. Do NOT withhold a deserved 10, and do NOT inflate. Grade each rubric dimension 0–10 and give an overall 0–10.${kindNote}\nReturn ONLY a single fenced json block:\n\`\`\`json\n{"score":0-10,"rubric":[{"label":"<dimension>","score":0-10}],"notes":"1-2 concrete sentences on the most important things to improve (or, if already a 10, why it clears the bar)"}\n\`\`\``;
  const user = `Deliverable type: ${args.kind}\nCompany idea: ${args.idea || "a startup"}\nTask: ${args.task}\nRubric dimensions: ${dims.join("; ")}\n\nDeliverable to grade:\n<<<\n${args.content.slice(0, cap)}\n>>>`;
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 900,
      thinking: NO_THINKING,
      system: [{ type: "text", text: system }],
      messages: [{ role: "user", content: user }],
    });
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const p = JSON.parse(fenced(text));
    const score = Number(p?.score);
    if (!Number.isFinite(score)) return null;
    const rubric = Array.isArray(p?.rubric)
      ? p.rubric
          .map((r: Record<string, unknown>) => ({
            label: String(r?.label ?? "").slice(0, 44),
            score: Math.max(0, Math.min(10, Number(r?.score) || 0)),
          }))
          .filter((r: { label: string }) => r.label)
          .slice(0, 6)
      : [];
    return {
      score: Math.round(Math.max(0, Math.min(10, score)) * 10) / 10,
      rubric,
      notes: String(p?.notes ?? "").slice(0, 400),
    };
  } catch {
    return null;
  }
}
