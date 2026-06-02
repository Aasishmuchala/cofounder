import type Anthropic from "@anthropic-ai/sdk";
import type { ArtifactKind, Artifact, DeliverableEval, SkillRef } from "@/lib/agent-types";
import { deliverableFor } from "@/lib/agent-types";
import {
  dbConfigured,
  insertArtifact,
  patchTask,
  findAuthoredSkill,
  insertAuthoredSkill,
  listArtifacts,
  getWorkspace,
  updateWorkspaceMeta,
  withWorkspaceLock,
} from "@/lib/supabase-rest";
import {
  getConnectorRegistry,
  classifyTool,
  isContentProhibited,
  buildConnectorToolDescriptors,
  dispatchConnectorTool,
  type ConnectorDef,
} from "@/lib/connectors";
import type { PendingApproval } from "@/lib/agent-types";
import { getAnthropic, MODEL } from "@/lib/anthropic";
// Server-only Claude Code local-delegation executor (Feature 2). runner.ts is
// already server-only, so a static import is fine here (it keeps node:child_process
// LAZY internally). Used by the executor-routing branch in produceDeliverable.
import { claudeCodeActive, runClaudeCode } from "@/lib/claude-code";

/** Departments the local Claude Code executor may run for. MUST mirror the
 *  orchestrator's CLAUDE_CODE_DEPARTMENTS — kept here as a defense-in-depth gate
 *  so a FORGED executor='claude-code' on a non-Engineering task (e.g. smuggled
 *  through the detail envelope) is ignored, not routed to local code execution. */
const CLAUDE_CODE_DEPARTMENTS = new Set(["Engineering"]);
import { discoverSkill, buildSkillBlock, toSkillRef } from "@/lib/skills";
import { selectOpenDesign, fetchOpenDesign } from "@/lib/open-design";
import { compareSkills } from "@/lib/skill-select";
import { readSkillBody, catalogSkillUrl } from "@/lib/skill-catalog";
import { houseSkill, synthesizeSkill } from "@/lib/skill-foundry";
import { generateImageUrl } from "@/lib/images";
import { runChecks, judgeDeliverable, heuristicScore, QUALITY_BAR } from "@/lib/verify";

export interface RunnerTask {
  id: string;
  title: string;
  department: string;
  detail?: string;
  /** Prerequisite task ids (dependency gating happens in the run-route filters). */
  deps?: string[];
  /** Owning objective id (orchestration layer), or null. */
  objectiveId?: string | null;
  /** Routing hint — reserved for local delegation (e.g. "claude-code"). */
  executor?: string;
}

/** A frozen sensitive tool call from the model's turn, awaiting the taskId stamp
 *  + persistence by produceDeliverable. Args already have sensitive keys redacted. */
export interface QueuedApproval {
  connectorId: string;
  toolName: string;
  args: Record<string, unknown>;
}

/** Live-progress callbacks for streaming generation (SSE). All optional. */
export interface StreamHooks {
  /** A new generation hop began — the client should reset its live buffer. */
  onHop?: () => void;
  /** A text delta from the model. */
  onText?: (delta: string) => void;
  /** The agent called context tools (e.g. reading a prior deliverable). */
  onTool?: (names: string[]) => void;
  /** A coarse phase change ("writing" | "reviewing"). */
  onPhase?: (phase: string) => void;
}

/** Escape user-controlled text before interpolating into generated HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip fences/whitespace from a model reply down to the raw deliverable. */
function cleanText(resp: Anthropic.Message): string {
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function genPrompt(
  kind: ArtifactKind,
  noun: string,
  task: { title: string; department: string; detail?: string },
  idea: string,
): string {
  const ctx = `Company idea: "${idea || "a new startup"}".
Task: "${task.title}" (department: ${task.department}). ${task.detail ?? ""}`.trim();

  if (kind === "landing_page") {
    return `${ctx}

You are a world-class product designer + senior Next.js/React engineer. BUILD a complete, single-file Next.js page component for this company's marketing landing page.

OUTPUT CONTRACT (the live preview compiles this directly — follow EXACTLY):
- Output ONLY the component code. No markdown fences, no prose, no commentary.
- First line: "use client"; — then a default export named EXACTLY Page: export default function Page() { ... }
- ONE self-contained file. You MAY define small helper components/consts above Page. NO external UI/animation libraries (no framer-motion, no shadcn) — React + Tailwind only.
- KEEP IT COMPLETE: use SIMPLE inline SVG icons (a few short stroke paths each, viewBox 0 0 24 24) — NEVER paste long brand-logo path data. Finish every tag, string, and brace. A complete, focused page beats an enormous truncated one.
- Style EVERYTHING with Tailwind CSS utility classes (Tailwind is available). Behavior uses ONLY React hooks (useState/useEffect/useRef — already in scope).

ANIMATIONS (required — make it feel alive, this is a key goal):
- Include a local <style> tag (rendered inside the component) with @keyframes — e.g. an aurora/gradient drift, float, shimmer, and fade-up — and apply them via inline style or Tailwind arbitrary values.
- Staggered entrance reveals on load (per-element animation-delay).
- Scroll-triggered reveals: a useEffect with IntersectionObserver that toggles a reveal class on sections as they enter the viewport.
- Hover micro-interactions (transition + hover:/group-hover:) on buttons and cards; an atmospheric ANIMATED background (moving gradient mesh / aurora / grain), not a flat fill.
- Disable motion under @media (prefers-reduced-motion: reduce).

IMAGERY (required — generate real images):
- Call the generate_image tool to create the visuals this page needs (at minimum a hero image; optionally a feature/section image). Give it a vivid, art-directed prompt matching the brand, and embed the returned URL in <img className="... object-cover" /> with width/height.
- If the tool is unavailable, embed images of the form: https://image.pollinations.ai/prompt/<URL-ENCODED vivid description>?width=1280&height=720&nologo=true&model=flux

STRUCTURE: sticky translucent nav; a striking hero (headline derived from the idea, subhead, primary + secondary CTA, the generated hero image); a 3+ feature section with inline-SVG icons; a stats or how-it-works band; social proof / testimonial; a strong CTA band; a real footer. Real, specific, benefit-led copy for THIS idea — no lorem, no "revolutionary/cutting-edge". Commit to a bold, on-brand aesthetic (not generic AI slop).

DESIGN QUALITY (aim for Linear / Stripe / Vercel production quality): apply the grounding's EXACT palette and typography via Tailwind arbitrary values (e.g. bg-[#0B0B10], text-[#E8E8EF], font-[Sora]); a confident type scale with a huge hero headline (text-6xl→text-8xl, tight tracking); generous vertical rhythm and section padding; consistent radii/shadows; and one memorable signature element. Every section must feel intentional and finished.

Responsive (mobile→desktop with Tailwind), AA contrast, semantic elements. Make it look like a funded startup's real site. Output ONLY the component code, starting with: "use client";`;
  }
  if (kind === "brand_spec") {
    return `${ctx}

You are the Design agent. Produce a real brand spec in Markdown: a one-line brand essence, a 5-color palette (with hex codes and usage), typography recommendation (heading + body), tone of voice (3 adjectives + a do/don't), and a logo concept description. Output ONLY Markdown.`;
  }
  if (kind === "email") {
    return `${ctx}

You are the Sales agent. Write a real, ready-to-send cold outbound email (subject line + body, <140 words, warm and specific, one clear CTA). Output ONLY Markdown with the subject on the first line as **Subject:** ...`;
  }
  return `${ctx}

You are the ${task.department} agent. Produce the actual ${noun} as concise, useful Markdown a founder could act on immediately. Output ONLY Markdown.`;
}

/* Deterministic, genuinely-usable fallback content (no API key needed). */
function mockArtifact(
  kind: ArtifactKind,
  noun: string,
  task: { title: string; department: string },
  idea: string,
): { title: string; content: string } {
  const name = (idea || "Your Company").slice(0, 60);
  if (kind === "landing_page") {
    const safeName = escapeHtml(name);
    const safeIdea = escapeHtml(idea);
    const tagline = safeIdea || "The fastest way to launch and grow your business.";
    return {
      title: `${name} — landing page`,
      content: `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${safeName} — built by autonomous agents</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Sora:wght@500;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#08080b;--surface:#101017;--line:rgba(255,255,255,.08);--line2:rgba(255,255,255,.14);--ink:#f4f4f7;--mut:rgba(244,244,247,.62);--a1:#6d6bff;--a2:#b06bff;--grad:linear-gradient(105deg,#6d6bff,#b06bff 60%,#ff7ab0)}
*{margin:0;padding:0;box-sizing:border-box}html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:inherit;text-decoration:none}.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
h1,h2,.brand{font-family:Sora,sans-serif}
.btn{display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:15px;padding:12px 22px;border-radius:11px;transition:transform .18s ease}
.btn-p{background:var(--grad);color:#0a0a12}.btn-p:hover{transform:translateY(-2px)}
.btn-g{border:1px solid var(--line2)}
nav{position:sticky;top:0;z-index:50;backdrop-filter:blur(14px);background:rgba(8,8,11,.7);border-bottom:1px solid var(--line)}
nav .wrap{display:flex;align-items:center;justify-content:space-between;height:64px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:17px}.dot{width:22px;height:22px;border-radius:7px;background:var(--grad)}
.hero{position:relative;text-align:center;padding:clamp(80px,13vw,160px) 0 clamp(56px,8vw,96px)}
.aurora{position:absolute;inset:-20% -10% auto;height:560px;z-index:-1;filter:blur(90px);opacity:.55;background:radial-gradient(40% 50% at 30% 30%,#6d6bff66,transparent),radial-gradient(40% 50% at 70% 40%,#b06bff55,transparent)}
h1{font-size:clamp(40px,7vw,76px);line-height:1.04;letter-spacing:-.035em;margin:22px auto 0;max-width:16ch}
h1 .g{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{margin:22px auto 0;max-width:60ch;color:var(--mut);font-size:clamp(16px,2.2vw,20px)}
.cta-row{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:34px}
section.band{padding:clamp(64px,10vw,128px) 0}.h2{text-align:center;font-size:clamp(28px,4.4vw,44px);letter-spacing:-.03em;margin-top:12px}
.grid3{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-top:48px}
.card{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid var(--line);border-radius:18px;padding:28px}
.card h3{font-size:18px}.card p{color:var(--mut);font-size:14.5px;margin-top:8px}
footer{border-top:1px solid var(--line);padding:48px 0 40px;color:var(--mut);font-size:13px}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head>
<body>
<nav><div class="wrap"><span class="brand"><span class="dot"></span>${safeName}</span><a class="btn btn-p" href="#cta" style="padding:9px 18px">Get started</a></div></nav>
<header class="hero"><div class="aurora"></div><div class="wrap">
<h1>${safeName}, <span class="g">live in a day</span></h1>
<p class="sub">${tagline} Built, launched, and grown by a team of AI agents — with you approving every step.</p>
<div class="cta-row"><a class="btn btn-p" href="#cta">Start free →</a><a class="btn btn-g" href="#features">See how it works</a></div>
</div></header>
<section class="band" id="features"><div class="wrap"><h2 class="h2">Everything you need, on autopilot</h2>
<div class="grid3">
<div class="card"><h3>Idea → product in a day</h3><p>Engineering agents scaffold, build, and deploy a working product while you watch.</p></div>
<div class="card"><h3>Human in the loop</h3><p>Nothing risky ships without your sign-off. Approve, edit, or redirect any agent.</p></div>
<div class="card"><h3>Grows while you sleep</h3><p>Marketing, sales, and ops agents run the busywork across every department, 24/7.</p></div>
</div></div></section>
<section class="band" id="cta"><div class="wrap" style="text-align:center"><h2 class="h2">Run your whole company with agents</h2>
<div class="cta-row"><a class="btn btn-p" href="#">Start free →</a></div></div></section>
<footer><div class="wrap">© 2026 ${safeName}. Built by the Cofounder Engineering agent.</div></footer>
</body></html>`,
    };
  }
  if (kind === "brand_spec") {
    return {
      title: `${name} — brand spec`,
      content: `# ${name} — Brand Spec

**Essence:** Confident, modern, builder-friendly.

## Palette
| Role | Hex |
|---|---|
| Background | \`#0B0B10\` |
| Surface | \`#16161F\` |
| Primary | \`#6C5CE7\` |
| Accent | \`#34A853\` |
| Text | \`#E8E8EF\` |

## Typography
- **Headings:** Sora / geometric grotesque, tight tracking.
- **Body:** Inter, 15–16px, 1.5 line-height.

## Tone of voice
Direct · Optimistic · Precise.
- **Do:** speak to outcomes ("ship in a day").
- **Don't:** hedge or use corporate filler.

## Logo concept
A pixel-grid wordmark — rectilinear letterforms that read as a friendly operating system for running a company.`,
    };
  }
  if (kind === "email") {
    return {
      title: `${name} — outbound email`,
      content: `**Subject:** Thought ${name} could help you ship faster

Hi {{first_name}},

I noticed {{company}} is moving fast — most teams your size lose weeks on setup, GTM, and the busywork between. ${name} runs those as autonomous agents so a founder can go from idea to a working company in a day, with approval gates on anything risky.

Worth a 15-min look? I can spin up a live demo on your exact use case.

— {{sender}}`,
    };
  }
  return {
    title: `${name} — ${noun}`,
    content: `# ${task.title}

_${task.department} agent deliverable for ${name}._

- ✅ Step 1 — scoped and ready
- ✅ Step 2 — drafted
- ⏳ Step 3 — pending your approval

This is a generated starting point you can act on immediately.`,
  };
}

/* ─────────────────────────── agent tools ───────────────────────────── *
 * Department agents call these (server-side, against the DB) so a deliverable
 * is grounded in the real company: its plan, brand, and the work other agents
 * have already shipped. This is what makes outputs consistent instead of each
 * agent inventing its own facts.
 * --------------------------------------------------------------------- */
export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_company_brief",
    description:
      "Get this company's core brief — the founding idea, the business plan (product, ICP, model, values, GTM), and the chosen brand identity. Call this FIRST to ground your deliverable in the real company.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_deliverables",
    description:
      "List the deliverables other department agents have already produced for this company (type + title). Use it to stay consistent with existing work and avoid contradicting it.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "read_deliverable",
    description:
      "Read the full text of a prior deliverable by type, so you can reference its details, voice, and decisions and build on them.",
    input_schema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["landing_page", "brand_spec", "markdown", "email"],
          description: "Which deliverable type to read.",
        },
      },
      required: ["kind"],
    },
  },
  {
    name: "generate_image",
    description:
      "Generate a real image for the design (hero, section background, OG card, etc.) and get back a ready-to-embed image URL. Call it for the visuals your deliverable needs — pass a vivid, art-directed prompt (subject, style, mood, palette, lighting).",
    input_schema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Vivid, specific art-direction for the image.",
        },
        aspect_ratio: {
          type: "string",
          enum: ["16:9", "1:1", "4:3", "3:2", "9:16", "4:5"],
          description: "Aspect ratio (default 16:9).",
        },
      },
      required: ["prompt"],
    },
  },
];

/** Execute one agent tool call against the workspace's data. Returns a string
 *  (the tool_result content). Bounded in size to keep the context lean. */
export async function runAgentTool(
  name: string,
  input: Record<string, unknown>,
  workspaceId: string,
  idea: string,
): Promise<string> {
  try {
    if (name === "get_company_brief") {
      const ws = await getWorkspace(workspaceId).catch(() => null);
      const plan = ws?.meta?.plan ?? null;
      return JSON.stringify({
        idea: idea || ws?.idea || "",
        brandVibe: ws?.meta?.vibeId ?? null,
        plan: plan
          ? {
              product: plan.context?.product,
              icp: plan.context?.icp,
              model: plan.context?.model,
              values: plan.values?.slice(0, 4),
              gtm: plan.gtm?.map((g) => `${g.label}: ${g.text}`),
            }
          : null,
      }).slice(0, 1800);
    }
    if (name === "list_deliverables") {
      const arts = await listArtifacts(workspaceId).catch(() => []);
      if (!arts.length) return "No deliverables have been produced yet.";
      return JSON.stringify(arts.map((a) => ({ kind: a.kind, title: a.title }))).slice(0, 1500);
    }
    if (name === "read_deliverable") {
      const kind = typeof input.kind === "string" ? input.kind : "";
      const arts = await listArtifacts(workspaceId).catch(() => []);
      const hit = arts.find((a) => a.kind === kind);
      if (!hit) return `No ${kind || "matching"} deliverable exists yet.`;
      return hit.content.slice(0, 4000);
    }
    if (name === "generate_image") {
      const prompt = typeof input.prompt === "string" ? input.prompt : "";
      const aspect = typeof input.aspect_ratio === "string" ? input.aspect_ratio : "16:9";
      return await generateImageUrl(prompt, aspect);
    }
  } catch {
    return "Tool error.";
  }
  return "Unknown tool.";
}

/** One model turn. Streams text deltas through `hooks` when present (SSE),
 *  otherwise a plain request. Returns the full message for tool-loop handling. */
async function runHop(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
  useTools: boolean,
  hooks?: StreamHooks,
  maxTokens = 8000,
  extraTools?: Anthropic.Tool[],
): Promise<Anthropic.Message> {
  const params = {
    model: MODEL,
    max_tokens: maxTokens,
    messages,
    // Connector tools are merged per-hop (without mutating the module-level
    // AGENT_TOOLS const) so the model can call enabled connectors.
    ...(useTools ? { tools: AGENT_TOOLS.concat(extraTools ?? []) } : {}),
  };
  if (hooks) {
    hooks.onHop?.();
    const stream = client.messages.stream(params);
    if (hooks.onText) stream.on("text", (t: string) => hooks.onText!(t));
    return await stream.finalMessage();
  }
  return await client.messages.create(params);
}

/**
 * Generate the deliverable text. When the workspace is DB-backed, the agent is
 * given context tools (above) and may call them before producing its final
 * answer — a tool_use loop. Without a workspace it's a single straight call.
 * Pass `hooks` to stream the generation live (SSE).
 */
export async function generateWithTools(
  client: Anthropic,
  basePrompt: string,
  workspaceId: string | undefined,
  idea: string,
  hooks?: StreamHooks,
  allowTools = true,
  maxTokens = 8000,
  registry?: ConnectorDef[],
  extraTools?: Anthropic.Tool[],
): Promise<{ content: string; queuedApprovals: QueuedApproval[] }> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: basePrompt }];
  // No tools -> a single (optionally streamed) generation. Used for large
  // deliverables (landing pages) where extra round-trips blow the time budget.
  if (!allowTools || !dbConfigured || !workspaceId) {
    return { content: cleanText(await runHop(client, messages, false, hooks, maxTokens)), queuedApprovals: [] };
  }
  const reg = registry ?? [];
  // Frozen { tool, args } snapshots for any SENSITIVE call the model made. The
  // caller (produceDeliverable) stamps the taskId, persists them to meta, and
  // flips the task to needs_action.
  const queuedApprovals: QueuedApproval[] = [];

  for (let hop = 0; hop < 4; hop++) {
    const resp = await runHop(client, messages, true, hooks, maxTokens, extraTools);
    if (resp.stop_reason !== "tool_use") return { content: cleanText(resp), queuedApprovals };
    hooks?.onTool?.(
      resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use").map((b) => b.name),
    );
    messages.push({ role: "assistant", content: resp.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of resp.content) {
      if (block.type !== "tool_use") continue;
      const input = (block.input ?? {}) as Record<string, unknown>;
      const risk = classifyTool(block.name, reg);
      let out: string;
      if (risk === "prohibited") {
        // Never executed, never queued — the human must do it themselves.
        out =
          "ACTION_BLOCKED: This action is prohibited by policy and cannot be automated. The human must perform it manually if appropriate.";
      } else if (risk === "sensitive" && isContentProhibited(block.name, input)) {
        // CONTENT-level prohibition (e.g. a destructive / secret-referencing
        // run_shell): refuse OUTRIGHT — never queue it for approval, so a human
        // can't be tricked into approving an obfuscated `rm -rf` / `cat ~/.ssh/…`.
        // The executor re-checks the same denylist at execution time too.
        out =
          "ACTION_BLOCKED: This command is prohibited by policy (destructive or references a credential path) and cannot be queued or executed. The human must perform it manually if appropriate.";
      } else if (risk === "sensitive") {
        // Freeze the concrete { connector, tool, args } for deterministic
        // system-side execution on approval. The args are kept UNREDACTED here so
        // the human approves — and the executor later runs — the exact reviewed
        // values; redaction happens only when persisting/displaying (the meta
        // sanitizer redacts on write; the audit log redacts on record). Redacting
        // here would execute the approved action with literal "[redacted]" values.
        const hit = reg.find((c) => c.tools.some((t) => t.name === block.name));
        queuedApprovals.push({ connectorId: hit?.id ?? "", toolName: block.name, args: input });
        out =
          `ACTION_QUEUED: ${block.name} has been queued for human approval. Do not retry this tool call. ` +
          "Continue composing your response as if this action will be completed shortly.";
      } else if (risk === "safe") {
        // Auto-execute; output is injection-scanned + capped inside dispatch.
        // Pass workspaceId as the session key so the computer connector's browser
        // context is isolated per workspace (cross-tenant page bleed guard).
        out = await dispatchConnectorTool(block.name, input, reg, workspaceId);
      } else {
        // Not a connector tool — a built-in runner context tool.
        out = await runAgentTool(block.name, input, workspaceId, idea);
      }
      results.push({ type: "tool_result", tool_use_id: block.id, content: out });
    }
    messages.push({ role: "user", content: results });
  }
  // Still calling tools after the hop budget — force a final, tool-free answer.
  const final = await runHop(
    client,
    [
      ...messages,
      { role: "user", content: "Output the final deliverable now, in the required format. Do not call any more tools." },
    ],
    false,
    hooks,
    maxTokens,
  );
  return { content: cleanText(final), queuedApprovals };
}

/**
 * Produce one deliverable for a task: resolve skills → generate (or mock) →
 * verify (checks + LLM judge, regenerate once below the bar) → persist the
 * artifact (with its eval) and mark the task done. Shared by /api/execute and
 * /api/run. No auth here — callers verify the workspace token first.
 */
export async function produceDeliverable(
  workspaceId: string | undefined,
  task: RunnerTask,
  idea: string,
  hooks?: StreamHooks,
): Promise<{ artifact: Artifact; mock: boolean }> {
  const { kind, noun } = deliverableFor(task.department);

  const house = houseSkill(kind);
  // Discover a generic craft skill + read the company's meta (brand + plan) in parallel.
  const [discovered, meta] = await Promise.all([
    discoverSkill({ department: task.department, title: task.title, idea, kind }),
    dbConfigured && workspaceId
      ? getWorkspace(workspaceId)
          .then((w) => w?.meta ?? null)
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  const vibeId = meta?.vibeId ?? null;
  // Founder design direction for this task: a per-task choice, else the workspace
  // default. Overrides the auto-selected open-design style/layout and injects a
  // highest-priority brief into the prompt.
  const designChoice = (meta?.designChoices?.[task.id] ?? meta?.designDefault) ?? null;
  const authored =
    dbConfigured && workspaceId ? await findAuthoredSkill(workspaceId, kind).catch(() => null) : null;

  // Connector layer: resolve the workspace's enabled connectors and expose their
  // tools to the model in the tool-use loop. SAFE tools auto-run; SENSITIVE tools
  // are intercepted + queued for human approval (handled in generateWithTools).
  const connectorRegistry = getConnectorRegistry(meta?.connectors);
  const connectorTools = buildConnectorToolDescriptors(connectorRegistry);

  // The best preloaded catalog skill for this task (the comparison the Skills tab
  // shows). For text deliverables it becomes the agent's equipped skill — its
  // SKILL.md craft is injected. Landing pages keep open-design as the primary
  // (its grounding is verified), so we don't disturb them here.
  let catalog: { name: string; source: string; body: string } | null = null;
  try {
    const cmp = compareSkills({ department: task.department, kind, title: task.title, detail: task.detail });
    // Equip only a GENUINELY relevant skill — department fit alone isn't enough.
    // Threshold 16 = department fit (12) PLUS a real content signal (a keyword/kind
    // hit), so a generic same-department skill with no topical overlap isn't equipped.
    // (Tracks the raised department-fit weight in compareSkills — was 10 when dept
    // fit was +6; now +12.)
    if (cmp.chosen && cmp.chosen.score >= 16 && kind !== "landing_page") {
      catalog = { name: cmp.chosen.name, source: cmp.chosen.source || "skill", body: readSkillBody(cmp.chosen.dir, 2800) };
    }
  } catch {
    catalog = null;
  }

  // A compact company brief injected straight into the prompt — so agents rarely
  // need a get_company_brief round-trip (faster, esp. for landing pages).
  const plan = meta?.plan ?? null;
  const brief = plan
    ? `\n\nCompany brief — product: ${(plan.context?.product ?? idea ?? "").slice(0, 160)}; ICP: ${plan.context?.icp ?? "—"}; model: ${plan.context?.model ?? "—"}; brand vibe: ${vibeId ?? "modern"}.`
    : vibeId
      ? `\n\nBrand vibe: ${vibeId}.`
      : "";

  // Landing pages skip the tool loop for speed; pre-generate a hero image so the
  // page still ships real generated imagery without a generate_image round-trip.
  const heroUrl =
    kind === "landing_page"
      ? await generateImageUrl(
          `cinematic hero image for ${idea || "a startup"}; ${vibeId ?? "modern"} brand aesthetic; high detail, professional, no text`,
          "16:9",
        ).catch(() => "")
      : "";

  // Ground the deliverable in open-design: the SKILL chosen for this request +
  // the DESIGN.md system chosen for the brand vibe. Becomes the headline skill.
  const openDesign = await fetchOpenDesign(
    selectOpenDesign(
      {
        department: task.department,
        kind,
        title: task.title,
        detail: task.detail,
        vibeId,
      },
      designChoice ? { system: designChoice.style, template: designChoice.template } : undefined,
    ),
  ).catch(() => null);

  let headline: SkillRef = catalog
    ? { name: catalog.name, source: catalog.source, url: catalogSkillUrl(catalog.source, catalog.name), metric: "curated" }
    : openDesign
      ? openDesign.skill
      : authored
        ? { name: authored.name, source: "authored", url: "" }
        : discovered
          ? toSkillRef(discovered)
          : { name: house.name, source: "house", url: "" };

  const basePrompt =
    genPrompt(kind, noun, task, idea) +
    brief +
    `\n\nApply this house standard — your team's craft bar:\n${house.content}` +
    (catalog?.body
      ? `\n\nYou are equipped with the "${catalog.name}" skill (chosen as the best match for this task). Apply its craft, structure, and best practices:\n${catalog.body}`
      : "") +
    (authored ? `\n\nYour company's own authored skill — apply it:\n${authored.content}` : "") +
    // Prefer open-design grounding; fall back to the generically-discovered skill.
    (openDesign ? openDesign.content : discovered ? buildSkillBlock(discovered) : "") +
    (heroUrl ? `\n\nPRE-GENERATED HERO IMAGE — embed this EXACT url in the hero <img src>: ${heroUrl}` : "") +
    // FOUNDER DESIGN DIRECTION — last + explicitly highest priority, so it overrides
    // any conflicting guidance from the house standard or the open-design grounding.
    (designChoice?.brief?.trim()
      ? `\n\n=== FOUNDER DESIGN DIRECTION (HIGHEST PRIORITY — follow this exactly; it overrides any conflicting guidance above) ===\n${designChoice.brief.trim().slice(0, 2000)}\n=== END FOUNDER DESIGN DIRECTION ===`
      : "");

  let title = "";
  let content = "";
  let mock = true;

  // ── Feature 2: Claude Code local-delegation routing branch ──────────────
  // A task the orchestrator flagged executor='claude-code' (Engineering / code
  // work) is routed to a REAL local Claude Code session inside an isolated git
  // worktree instead of single-shot generation. Gated by the SAME double-gate as
  // computer-use (claudeCodeActive). The executor degrades gracefully when the CLI
  // is absent ({status:'claude_code_unavailable'}) or the gate is off
  // ({status:'disabled'}), in which case we FALL THROUGH to the normal Anthropic
  // path below — a missing CLI never fails a task. On success the summary + a diff
  // preview becomes the deliverable content, and the existing verify+persist
  // pipeline (below) runs unchanged for both code paths.
  let claudeCodeHandled = false;
  // Triple gate: executor hint AND an allowlisted department (defense-in-depth
  // against a forged envelope) AND the claudeCodeActive() env/workspace double-gate.
  if (
    task.executor === "claude-code" &&
    CLAUDE_CODE_DEPARTMENTS.has(task.department) &&
    claudeCodeActive()
  ) {
    try {
      const cc = await runClaudeCode(
        { id: task.id, title: task.title, department: task.department, detail: task.detail },
        { idea, planSummary: plan?.context?.product ?? undefined },
      );
      if (cc.status === "ok" || cc.status === "error") {
        // Compose the deliverable: a summary, then the diff as a fenced code block
        // (so the markdown preview renders it). Output is already sanitized by the
        // executor; the control-char strip below applies to both paths.
        const diffBlock = cc.diff ? `\n\n## Changes (git diff)\n\n\`\`\`diff\n${cc.diff}\n\`\`\`` : "";
        const banner =
          cc.status === "error"
            ? "_Claude Code reported an error during this run; review the summary + diff below._\n\n"
            : "";
        content = `${banner}${cc.summary}${diffBlock}`.trim();
        title = `${(idea || "Company").slice(0, 50)} — ${noun} (Claude Code)`;
        mock = false;
        claudeCodeHandled = content.length > 0;
      }
      // status 'disabled' | 'claude_code_unavailable' -> fall through to Anthropic.
    } catch {
      // Any unexpected failure -> graceful fallback to the normal generation path.
      claudeCodeHandled = false;
    }
  }

  // A Claude Code deliverable is a run summary + git diff in MARKDOWN — not a React
  // page — so it must be stored, checked, judged, and previewed AS markdown (an
  // Engineering task's natural kind is landing_page, which would otherwise try to
  // compile this prose as a component and fail). For every other path the kind is
  // unchanged. (Per the blueprint's claudeCode design: kind='markdown' for the
  // summary + diff preview.)
  const effectiveKind: ArtifactKind = claudeCodeHandled ? "markdown" : kind;

  const client = getAnthropic();
  if (!claudeCodeHandled && client) {
    try {
      // Landing pages: single fast generation (no tool round-trips). Others: the
      // full tool-use loop for cross-deliverable context.
      const gen = await generateWithTools(
        client,
        basePrompt,
        workspaceId,
        idea,
        hooks,
        kind !== "landing_page",
        // A full React page (JSX + inline SVG + Tailwind) needs more headroom than
        // text deliverables, or it truncates mid-component and won't compile — but
        // 16k tokens is a LOT to stream through a slow proxy (a big chunk of the
        // per-deliverable wall-clock). 12k still fits a complete page with margin.
        kind === "landing_page" ? 12000 : 8000,
        connectorRegistry,
        connectorTools,
      );
      content = gen.content;
      title = `${(idea || "Company").slice(0, 50)} — ${noun}`;

      // A SENSITIVE connector action was queued: persist the frozen approvals
      // (stamped with this task's id) to meta, flag the task needs_action, and
      // return WITHOUT inserting an artifact. The human approves the concrete
      // { tool, args } in the Inbox; the system executes it deterministically.
      if (gen.queuedApprovals.length > 0 && dbConfigured && workspaceId) {
        const fresh: PendingApproval[] = gen.queuedApprovals.map((q) => ({
          id: `ap_${Math.random().toString(36).slice(2, 12)}`,
          taskId: task.id,
          connectorId: q.connectorId,
          toolName: q.toolName,
          args: q.args,
          ts: Date.now(),
        }));
        // Serialize the read-modify-write per workspace so a concurrent producer
        // can't lost-update meta.pendingApprovals (drop another task's queued action).
        await withWorkspaceLock(workspaceId, async () => {
          const existing = (await getWorkspace(workspaceId).then((w) => w?.meta?.pendingApprovals ?? []).catch(() => [])) as PendingApproval[];
          await updateWorkspaceMeta(workspaceId, {
            pendingApprovals: [...existing, ...fresh].slice(-50),
          });
        }).catch(() => {});
        await patchTask(task.id, { status: "needs_action" }, workspaceId).catch(() => {});
        return {
          artifact: {
            id: `a_${Math.random().toString(36).slice(2, 10)}`,
            taskId: task.id,
            kind,
            title: "Pending approval",
            content: gen.content || "",
            skill: headline,
            eval: null,
          },
          mock: false,
        };
      }

      mock = content.length === 0;

      if (!mock && !authored && dbConfigured && workspaceId) {
        const made = await synthesizeSkill(client, {
          department: task.department,
          title: task.title,
          kind,
          houseContent: house.content,
          referenceContent: discovered?.content,
        });
        if (made) {
          await insertAuthoredSkill(workspaceId, {
            department: task.department,
            kind,
            name: made.name,
            content: made.content,
            source: "authored",
          }).catch(() => {});
          // Keep the equipped catalog skill / open-design as the surfaced badge
          // when present; otherwise show the company's freshly-authored skill.
          if (!openDesign && !catalog) headline = { name: made.name, source: "authored", url: "" };
        }
      }
    } catch {
      mock = true;
    }
  }

  if (mock || !content) {
    const m = mockArtifact(kind, noun, task, idea);
    title = m.title;
    content = m.content;
    mock = true;
  }

  // Strip control/NUL chars (keep tab/newline/return) — Postgres `text`
  // rejects them, else insertArtifact throws and the deliverable fails to persist.
  content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  // ---- Verification / quality loop ----
  hooks?.onPhase?.("reviewing");
  let evaluation: DeliverableEval;
  if (!mock && client) {
    let judged = await judgeDeliverable(client, { kind: effectiveKind, idea, task: task.title, content });
    let iterations = 1;
    // Regenerating a full React page (after tool-use + image gen) is too slow to
    // fit serverless limits, so landing pages are judged once with no auto-retry.
    // Cheaper text deliverables still get the regenerate-once-below-bar pass.
    // A Claude Code deliverable is NEVER regenerated via the model — its content is
    // a real run summary + git diff; replacing it with a fresh model generation
    // would discard the actual code change. It is judged once (informational only).
    if (judged && judged.score < QUALITY_BAR && kind !== "landing_page" && !claudeCodeHandled) {
      try {
        const retryPrompt = `${basePrompt}\n\nA strict reviewer scored your previous attempt ${judged.score}/10. The most important things to FIX: ${judged.notes}\nProduce a clearly better version that fully addresses this feedback. Use the exact same output format as before.`;
        const resp2 = await client.messages.create({
          model: MODEL,
          max_tokens: 8000,
          messages: [{ role: "user", content: retryPrompt }],
        });
        const content2 = cleanText(resp2);
        if (content2.length > 0) {
          const judged2 = await judgeDeliverable(client, { kind: effectiveKind, idea, task: task.title, content: content2 });
          iterations = 2;
          if (judged2 && judged2.score >= judged.score) {
            // Strip control chars here too — the regenerated content bypasses the
            // earlier strip and would otherwise fail to persist.
            content = content2.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
            judged = judged2;
          }
        }
      } catch {
        /* keep the first attempt */
      }
    }
    const finalChecks = runChecks(effectiveKind, content);
    evaluation = judged
      ? { score: judged.score, rubric: judged.rubric, checks: finalChecks, notes: judged.notes, iterations, judged: true }
      : {
          score: heuristicScore(finalChecks),
          rubric: [],
          checks: finalChecks,
          notes: "Automated checks only — the AI judge was unavailable.",
          iterations,
          judged: false,
        };
  } else {
    const checks = runChecks(effectiveKind, content);
    evaluation = {
      score: heuristicScore(checks),
      rubric: [],
      checks,
      notes: "Heuristic checks (mock mode — no AI judge).",
      iterations: 1,
      judged: false,
    };
  }

  let artifactId: string | null = null;
  if (dbConfigured && workspaceId) {
    try {
      const art = await insertArtifact(workspaceId, {
        taskId: task.id,
        kind: effectiveKind,
        title,
        content,
        skill: headline,
        eval: evaluation,
      });
      artifactId = art?.id ?? null;
      await patchTask(task.id, { status: "done" }, workspaceId);
    } catch {
      /* fall through — still return the artifact */
    }
  }

  return {
    artifact: {
      id: artifactId ?? `a_${Math.random().toString(36).slice(2, 10)}`,
      taskId: task.id,
      kind: effectiveKind,
      title,
      content,
      skill: headline,
      eval: evaluation,
    },
    mock,
  };
}
