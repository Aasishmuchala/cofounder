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
import { getAnthropic, MODEL, NO_THINKING } from "@/lib/anthropic";
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
import { transitionsBlock } from "@/lib/transitions";
import { fetchMarketDesign } from "@/lib/market-design";
import { isMarketTemplate, DEFAULT_MARKET_TEMPLATE } from "@/lib/design-catalog";
import { compareSkills } from "@/lib/skill-select";
import { readSkillBody, catalogSkillUrl, loadCatalog } from "@/lib/skill-catalog";
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
- ONE self-contained file. You MAY define small helper components/consts above Page. NO framer-motion / shadcn. But GSAP + ScrollTrigger ARE pre-loaded and in scope as \`gsap\` and \`ScrollTrigger\` (already registered) — USE them for premium scroll choreography. (The <lottie-player> web component is also loaded if you genuinely have a real animation URL — otherwise prefer GSAP + animated SVG.)
- KEEP IT COMPLETE: use SIMPLE inline SVG icons (a few short stroke paths each, viewBox 0 0 24 24) — NEVER paste long brand-logo path data. Finish every tag, string, and brace. A complete, focused page beats an enormous truncated one.
- Style EVERYTHING with Tailwind CSS utility classes (Tailwind is available). Behavior uses ONLY React hooks (useState/useEffect/useRef — already in scope).

MOTION (required — TOP priority; aim for Awwwards / award-site polish):
- Drive scroll choreography with GSAP + ScrollTrigger inside a useEffect (guard \`if (!gsap || !ScrollTrigger) return;\`; wrap in \`const ctx = gsap.context(() => { ... }); return () => ctx.revert();\` for cleanup; call \`ScrollTrigger.refresh()\` after layout): staggered scroll-reveals as sections enter, a pinned or parallax hero/feature band, animated number counters on the stats, and a gentle parallax (yPercent) on the imagery.
- Also include a local <style> with @keyframes for an ALWAYS-ON atmospheric background — a slow-drifting multi-stop gradient mesh / aurora (NEVER a flat fill) — plus float/shimmer accents.
- Staggered entrance reveal on first paint; rich hover micro-interactions (transform + transition) on every button and card; an animated gradient or sliding underline on the primary CTA.
- Respect @media (prefers-reduced-motion: reduce): gate the GSAP timeline + decorative keyframes off.

IMAGERY (required — use the REAL pre-generated images provided below):
- Embed the EXACT pre-generated urls given below: HERO (16:9) in the hero, FEATURE (4:3) in a feature/showcase block, SECTION BG (16:9) as a full-bleed parallax band behind a section. Use <img className="... object-cover" loading="lazy" /> with width/height (or a CSS background-image for the band).
- Do NOT invent other image hosts, stock URLs, or gray placeholders — only those exact urls + inline SVG.

STRUCTURE: sticky translucent nav; a striking hero (headline derived from the idea, subhead, primary + secondary CTA, the generated hero image); a 3+ feature section with inline-SVG icons; a stats or how-it-works band; social proof / testimonial; a strong CTA band; a real footer. Real, specific, benefit-led copy for THIS idea — no lorem, no "revolutionary/cutting-edge". Commit to a bold, on-brand aesthetic (not generic AI slop).

DESIGN QUALITY (aim for Linear / Stripe / Vercel production quality): apply the grounding's EXACT palette and typography via Tailwind arbitrary values (e.g. bg-[#0B0B10], text-[#E8E8EF], font-[Sora]); a confident type scale with a huge hero headline (text-6xl→text-8xl, tight tracking); generous vertical rhythm and section padding; consistent radii/shadows; and one memorable signature element. Every section must feel intentional and finished. These display fonts are LOADED — pick from them via Tailwind font-[Name]: Sora, "Space Grotesk", Manrope, "Plus Jakarta Sans", Outfit, "DM Sans", Inter.

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
  if (kind === "pitch_deck") {
    return `${ctx}

You are a world-class startup storyteller + presentation designer. BUILD a complete investor PITCH DECK for this company as a single, self-contained HTML document.

OUTPUT CONTRACT (the live preview renders this HTML directly — follow EXACTLY):
- Output ONLY the HTML. No markdown fences, no prose, no commentary.
- The FIRST line must be <!DOCTYPE html>, and emit ONE complete <html>…</html> document.
- ALL styling in a single inline <style> tag. You MAY <link> Google Fonts. NO <script> and NO external JS (it renders in a script-sandboxed iframe) — every bit of motion/layout is pure CSS.
- Finish every tag and rule. A complete, focused 8–10 slide deck beats a truncated longer one.

DECK STRUCTURE — one <section class="slide"> per slide, ~8–10 slides, one idea each:
1. Title — company name + a one-line positioning + a subtle brand mark.
2. Problem — the painful status quo, made concrete.
3. Solution — what you do in one crisp sentence + 3 supporting points.
4. How it works — the product in 3 steps (ideally with a visual).
5. Market — a credible TAM/SAM/SOM or sizing.
6. Business model — how you make money.
7. Why now / traction — the timing insight or momentum.
8. Competition — a simple comparison or 2×2.
9. Team — the roles this company needs.
10. The ask — the raise + use of funds + a contact CTA.

SLIDE SYSTEM (pure CSS): a full-viewport vertical deck with scroll-snap — html{scroll-snap-type:y mandatory} and each .slide{min-height:100vh;scroll-snap-align:start;display:flex;…} as a full-bleed composition. A persistent slide-number/progress affordance, a generous fluid type scale (clamp), and a huge title slide.

IMAGERY (optional, encouraged): call the generate_image tool for a cover/section visual matching the brand and embed the returned URL in <img>. If unavailable, you MAY embed https://image.pollinations.ai/prompt/<URL-ENCODED vivid description>?width=1280&height=720&nologo=true&model=flux

DESIGN QUALITY: commit to a bold, on-brand aesthetic using the grounding's palette + typography. Real, specific, benefit-led copy for THIS idea — no lorem, no "revolutionary/cutting-edge" filler. Make it look like a deck a funded startup would actually present. Responsive, AA contrast, semantic <section> slides. Output ONLY the HTML document, starting with <!DOCTYPE html>.`;
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
  if (kind === "pitch_deck") {
    const safeName = escapeHtml(name);
    const safeIdea = escapeHtml(idea) || "a bold new company";
    return {
      title: `${name} — pitch deck`,
      content: `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${safeName} — pitch deck</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#0a0a12;--ink:#f4f4f7;--mut:rgba(244,244,247,.66);--line:rgba(255,255,255,.1);--grad:linear-gradient(105deg,#6d6bff,#b06bff 60%,#ff7ab0)}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-snap-type:y mandatory;scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
h1,h2,.brand,.stat{font-family:Sora,sans-serif;letter-spacing:-.03em;line-height:1.05}
.slide{position:relative;min-height:100vh;scroll-snap-align:start;display:flex;flex-direction:column;justify-content:center;padding:clamp(40px,7vw,110px);border-bottom:1px solid var(--line);overflow:hidden}
.kicker{font-family:Sora;font-size:13px;text-transform:uppercase;letter-spacing:.18em;color:#b06bff;margin-bottom:18px;font-weight:600}
.num{position:absolute;top:28px;right:34px;font-family:Sora;font-size:13px;color:var(--mut)}
.dot{width:30px;height:30px;border-radius:9px;background:var(--grad);display:inline-block;vertical-align:middle;margin-right:12px}
h1{font-size:clamp(40px,8vw,92px)}
h1 .g{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
h2{font-size:clamp(30px,5vw,56px);margin-bottom:22px;max-width:20ch}
.lead{font-size:clamp(18px,2.4vw,25px);color:var(--mut);max-width:48ch}
.grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));margin-top:42px}
.card{border:1px solid var(--line);border-radius:16px;padding:26px;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01))}
.card h3{font-family:Sora;font-size:18px;margin-bottom:8px}.card p{color:var(--mut);font-size:15px}
.stat{font-size:clamp(34px,5vw,56px);background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.aurora{position:absolute;inset:-30% -10% auto;height:60vh;z-index:0;filter:blur(100px);opacity:.5;background:radial-gradient(40% 50% at 30% 30%,#6d6bff66,transparent),radial-gradient(40% 50% at 70% 40%,#b06bff55,transparent)}
.slide>*{position:relative;z-index:1}
.cta{display:inline-flex;margin-top:30px;padding:14px 26px;border-radius:12px;background:var(--grad);color:#0a0a12;font-family:Sora;font-weight:700;text-decoration:none}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style></head><body>
<section class="slide"><div class="aurora"></div><span class="num">01 / 08</span>
<div class="kicker"><span class="dot"></span>Pitch deck</div>
<h1>${safeName},<br><span class="g">${safeIdea}</span></h1>
<p class="lead" style="margin-top:26px">The company that turns an idea into a running business — built, launched, and grown by autonomous agents, with a founder at the helm.</p></section>
<section class="slide"><span class="num">02 / 08</span><div class="kicker">Problem</div>
<h2>Starting a company is too slow and too fragmented.</h2>
<p class="lead">Founders lose months stitching together tools, hiring, and busywork before they ever reach a customer. Most ideas die in setup — not in the market.</p></section>
<section class="slide"><span class="num">03 / 08</span><div class="kicker">Solution</div>
<h2>${safeName} runs the whole company with agents.</h2>
<div class="grid">
<div class="card"><h3>Every department</h3><p>Engineering, design, sales, marketing, ops — specialized agents working in parallel.</p></div>
<div class="card"><h3>Real deliverables</h3><p>Not chat — shipped landing pages, brand specs, campaigns, and decks.</p></div>
<div class="card"><h3>Human in the loop</h3><p>You approve anything risky. The founder always stays at the helm.</p></div></div></section>
<section class="slide"><span class="num">04 / 08</span><div class="kicker">How it works</div>
<h2>Idea → company in three steps.</h2>
<div class="grid">
<div class="card"><h3>1 · Describe</h3><p>Tell ${safeName} what you're building.</p></div>
<div class="card"><h3>2 · Spin up</h3><p>The C-suite plans and spawns exactly the agents you need.</p></div>
<div class="card"><h3>3 · Ship</h3><p>Agents produce real work, you approve, it goes live.</p></div></div></section>
<section class="slide"><span class="num">05 / 08</span><div class="kicker">Market</div>
<h2>A massive, urgent opportunity.</h2>
<div class="grid">
<div class="card"><div class="stat">$300B+</div><p>spent yearly on the work agents can now do.</p></div>
<div class="card"><div class="stat">70M+</div><p>new businesses started worldwide each year.</p></div>
<div class="card"><div class="stat">Now</div><p>frontier models finally make autonomous work real.</p></div></div></section>
<section class="slide"><span class="num">06 / 08</span><div class="kicker">Business model</div>
<h2>Simple revenue that expands with usage.</h2>
<div class="grid">
<div class="card"><h3>Subscription</h3><p>Monthly seats per active company.</p></div>
<div class="card"><h3>Usage</h3><p>Metered agent runs beyond the included tier.</p></div>
<div class="card"><h3>Marketplace</h3><p>Premium skills + connectors revenue share.</p></div></div></section>
<section class="slide"><span class="num">07 / 08</span><div class="kicker">Why now</div>
<h2>Momentum is on our side.</h2>
<p class="lead">Agent capability is compounding monthly, the tooling ecosystem is exploding, and founders are ready to delegate. ${safeName} sits at exactly this inflection point.</p></section>
<section class="slide"><div class="aurora"></div><span class="num">08 / 08</span><div class="kicker">The ask</div>
<h2>Join us at the helm.</h2>
<p class="lead">We're raising to expand the agent platform and reach the next 10,000 founders. Let's talk.</p>
<a class="cta" href="#">Request the full deck →</a></section>
</body></html>`,
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
          enum: ["landing_page", "brand_spec", "markdown", "email", "pitch_deck"],
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
    // Opt out of the proxy's forced extended thinking (see NO_THINKING): keeps
    // the full token budget for the deliverable and the call inside its timeout.
    thinking: NO_THINKING,
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
  const { kind, noun } = deliverableFor(task.department, task.title, task.detail);

  const house = houseSkill(kind);
  // Read the company's meta (brand + plan). Skill craft now comes from the LOCAL
  // curated catalog (compareSkills below) — reliable + relevant. Flaky live GitHub
  // discovery is a LAST RESORT only when the catalog is empty (a deploy with no
  // skills/ dir), so we never substitute a random trending repo for a real match.
  const meta =
    dbConfigured && workspaceId
      ? await getWorkspace(workspaceId)
          .then((w) => w?.meta ?? null)
          .catch(() => null)
      : null;
  const discovered =
    loadCatalog().length === 0
      ? await discoverSkill({ department: task.department, title: task.title, idea, kind }).catch(() => null)
      : null;
  const vibeId = meta?.vibeId ?? null;
  // Founder design direction for this task: a per-task choice, else the workspace
  // default. Overrides the auto-selected open-design style/layout and injects a
  // highest-priority brief into the prompt.
  const designChoice = (meta?.designChoices?.[task.id] ?? meta?.designDefault) ?? null;
  // The Design gate's PRIMARY pick: one of the top design SKILL.md files in the
  // market (lib/market-design fetches it live, cached + injection-sanitized). When
  // chosen, it IS this deliverable's craft + headline skill. When none is chosen
  // (Auto) — or the fetch fails — we fall back to open-design below, as intended.
  // "Beautiful by default": an explicit market pick wins; an explicit open-design layout
  // takes the open-design path (marketId null); and when the founder picks Auto (no
  // template), landing pages DEFAULT to the flagship market skill so even un-directed
  // pages ship award-tier UI. Open-design stays the deeper fallback (failed fetch / Auto
  // on kinds with no default).
  const chosenTemplate = designChoice?.template ?? null;
  const marketId = chosenTemplate
    ? isMarketTemplate(chosenTemplate)
      ? chosenTemplate
      : null
    : (DEFAULT_MARKET_TEMPLATE[kind] ?? null);
  const market = marketId ? await fetchMarketDesign(marketId).catch(() => null) : null;
  const authored =
    dbConfigured && workspaceId ? await findAuthoredSkill(workspaceId, kind).catch(() => null) : null;

  // Connector layer: resolve the workspace's enabled connectors and expose their
  // tools to the model in the tool-use loop. SAFE tools auto-run; SENSITIVE tools
  // are intercepted + queued for human approval (handled in generateWithTools).
  const connectorRegistry = getConnectorRegistry(meta?.connectors);
  const connectorTools = buildConnectorToolDescriptors(connectorRegistry);

  // The best curated catalog skill for this task — now the PRIMARY craft source for
  // EVERY deliverable (text AND landing pages), drawn from the 1400+ local SKILL.md
  // library. Equip whenever there's a genuine match: score >= 12 clears either a
  // same-department skill (+12) or a real keyword/kind hit, and compareSkills already
  // drops off-topic cross-department skills. Its full craft is injected (below) so
  // the output actually reflects the skill instead of a generic house style.
  let catalog: { name: string; source: string; body: string } | null = null;
  try {
    const cmp = compareSkills({ department: task.department, kind, title: task.title, detail: task.detail });
    if (cmp.chosen && cmp.chosen.score >= 12) {
      catalog = { name: cmp.chosen.name, source: cmp.chosen.source || "skill", body: readSkillBody(cmp.chosen.dir, 4500) };
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
  // Premium landing pages ship 3 real, art-directed AI images (hero + feature +
  // section background), generated IN PARALLEL — no external stock/CDN (Unsplash
  // source is dead, Pollinations is paywalled, Lottie/Giphy need keys).
  let heroUrl = "";
  let featureUrl = "";
  let sectionUrl = "";
  if (kind === "landing_page") {
    const look = `${vibeId ?? "modern"} brand aesthetic, for "${idea || "a startup"}"; high detail, professional, cohesive palette, crisp, no text, no watermark, no logo`;
    const [h, f, s] = await Promise.all([
      generateImageUrl(`cinematic wide hero establishing shot; ${look}`, "16:9").catch(() => ""),
      generateImageUrl(`product / feature close-up, clean studio composition, soft light; ${look}`, "4:3").catch(() => ""),
      generateImageUrl(`abstract atmospheric background texture with depth and gradient light; ${look}`, "16:9").catch(() => ""),
    ]);
    heroUrl = h;
    featureUrl = f;
    sectionUrl = s;
  }

  // Ground the deliverable in open-design: the SKILL chosen for this request +
  // the DESIGN.md system chosen for the brand vibe. Becomes the headline skill.
  // Open-design is the FALLBACK — only fetched when no market skill resolved. A chosen
  // market template id is NOT a valid open-design layout, so it's never passed as one
  // (only the style carries over for the design system).
  const openDesign = market
    ? null
    : await fetchOpenDesign(
        selectOpenDesign(
          {
            department: task.department,
            kind,
            title: task.title,
            detail: task.detail,
            vibeId,
          },
          designChoice
            ? { system: designChoice.style, template: marketId ? null : designChoice.template }
            : undefined,
        ),
      ).catch(() => null);

  const catalogRef: SkillRef | null = catalog
    ? { name: catalog.name, source: catalog.source, url: catalogSkillUrl(catalog.source, catalog.name), metric: "curated" }
    : null;
  const authoredRef: SkillRef | null = authored ? { name: authored.name, source: "authored", url: "" } : null;
  // Discovery only badges when the catalog was empty (it's null otherwise); house is
  // the final floor. Landing pages badge the open-design SYSTEM (its design grounding
  // is the headline craft); every other deliverable badges its equipped curated skill.
  const lastResort: SkillRef = discovered ? toSkillRef(discovered) : { name: house.name, source: "house", url: "" };
  // A founder-chosen top-market design skill is the headline badge (highest priority).
  let headline: SkillRef = market
    ? market.skill
    : kind === "landing_page"
      ? (openDesign?.skill ?? catalogRef ?? authoredRef ?? lastResort)
      : (catalogRef ?? openDesign?.skill ?? authoredRef ?? lastResort);

  const basePrompt =
    genPrompt(kind, noun, task, idea) +
    brief +
    `\n\nApply this house standard — your team's craft bar:\n${house.content}` +
    // Auto-equipped catalog skill — SKIPPED when the founder explicitly chose a market
    // design skill (below), so the two never give conflicting craft.
    (catalog?.body && !market
      ? `\n\n=== EQUIPPED SKILL: "${catalog.name}" (your playbook for THIS deliverable) ===\nApply this skill's craft, structure, patterns, section ordering, and quality bar throughout — it is how an expert does this exact task, not optional reference. Match its standard:\n${catalog.body}`
      : "") +
    (authored ? `\n\nYour company's own authored skill — apply it:\n${authored.content}` : "") +
    // Founder-chosen market design skill wins; else open-design grounding; else the
    // generically-discovered skill.
    (market ? market.content : openDesign ? openDesign.content : discovered ? buildSkillBlock(discovered) : "") +
    ([heroUrl, featureUrl, sectionUrl].some(Boolean)
      ? `\n\nPRE-GENERATED IMAGES — embed these EXACT urls (do NOT use any other image host or placeholder):${heroUrl ? `\n- HERO (16:9): ${heroUrl}` : ""}${featureUrl ? `\n- FEATURE (4:3): ${featureUrl}` : ""}${sectionUrl ? `\n- SECTION BG (16:9): ${sectionUrl}` : ""}`
      : "") +
    // MOTION SYSTEM — make animated deliverables (landing pages + pitch decks) use the
    // transitions.dev vocabulary (t-* classes, semantic tokens, reduced-motion guards).
    // Returns "" for non-HTML kinds, so text deliverables are untouched.
    transitionsBlock(kind) +
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
        // A full React page or a multi-slide HTML pitch deck needs real headroom or
        // it truncates mid-document. With thinking DISABLED the whole budget goes to
        // output (no thinking tax); a complete premium page/deck runs ~13–14k tokens
        // — 12k truncated real pages at the footer. 16k fits a full page/deck with
        // margin and, at the measured ~66 tok/s, still streams in ~4–5 min, well
        // inside the 480s client timeout.
        kind === "landing_page" || kind === "pitch_deck" ? 16000 : 8000,
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
    if (judged && judged.score < QUALITY_BAR && kind !== "landing_page" && kind !== "pitch_deck" && !claudeCodeHandled) {
      try {
        const retryPrompt = `${basePrompt}\n\nA strict reviewer scored your previous attempt ${judged.score}/10. The most important things to FIX: ${judged.notes}\nProduce a clearly better version that fully addresses this feedback. Use the exact same output format as before.`;
        const resp2 = await client.messages.create({
          model: MODEL,
          max_tokens: 8000,
          thinking: NO_THINKING,
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
