import type Anthropic from "@anthropic-ai/sdk";
import type { ArtifactKind } from "@/lib/agent-types";
import { MODEL } from "@/lib/anthropic";

/** Deliverables scoring below this (0–10) trigger one automatic regeneration. */
export const QUALITY_BAR = 7;

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
  const system = `You are a ruthless senior reviewer grading a startup's deliverable before it ships. Be demanding and specific — reserve 9–10 only for genuinely excellent, distinctive, on-brand work; generic or templated output should score 5 or below. Grade each rubric dimension 0–10 and give an overall 0–10.\nReturn ONLY a single fenced json block:\n\`\`\`json\n{"score":0-10,"rubric":[{"label":"<dimension>","score":0-10}],"notes":"1-2 concrete sentences on the most important things to improve"}\n\`\`\``;
  const user = `Deliverable type: ${args.kind}\nCompany idea: ${args.idea || "a startup"}\nTask: ${args.task}\nRubric dimensions: ${dims.join("; ")}\n\nDeliverable to grade:\n<<<\n${args.content.slice(0, 7000)}\n>>>`;
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 900,
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
