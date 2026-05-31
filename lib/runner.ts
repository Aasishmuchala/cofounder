import type Anthropic from "@anthropic-ai/sdk";
import type { ArtifactKind, Artifact, DeliverableEval, SkillRef } from "@/lib/agent-types";
import { deliverableFor } from "@/lib/agent-types";
import {
  dbConfigured,
  insertArtifact,
  patchTask,
  findAuthoredSkill,
  insertAuthoredSkill,
} from "@/lib/supabase-rest";
import { getAnthropic, MODEL } from "@/lib/anthropic";
import { discoverSkill, buildSkillBlock, toSkillRef } from "@/lib/skills";
import { houseSkill, synthesizeSkill } from "@/lib/skill-foundry";
import { runChecks, judgeDeliverable, heuristicScore, QUALITY_BAR } from "@/lib/verify";

export interface RunnerTask {
  id: string;
  title: string;
  department: string;
  detail?: string;
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

You are a world-class frontend designer. BUILD a complete HTML5 marketing landing page for this company (one document; inline <style>; you MAY <link> Google Fonts; absolutely NO <script>).

First COMMIT to a bold aesthetic direction derived from THIS idea — pick and fully execute one extreme that genuinely fits the product (editorial, brutalist, retro/analog, luxury/refined, organic, playful, art-deco, industrial, soft/pastel…). Avoid generic AI slop at all costs; make it UNFORGETTABLE.

Non-negotiables:
- DISTINCTIVE typography via Google Fonts (<link> to fonts.googleapis.com). NEVER system fonts, Inter, Roboto, or Arial. Pair a characterful display face with a refined body face; fluid clamp() scale.
- A cohesive CSS-variable palette: a dominant color + sharp accents. NOT a timid even palette, and NEVER the cliché purple-gradient-on-white.
- An atmospheric background with depth (gradient mesh, grain/noise, geometric pattern, layered shadows) — not a flat fill.
- An orchestrated page load: staggered CSS reveal animations (animation-delay) + hover micro-interactions that surprise. Wrap motion in @media (prefers-reduced-motion: reduce).
- Real, specific, benefit-led copy for THIS idea (no lorem, no "revolutionary/cutting-edge").
- Rich structure: sticky nav, a striking hero with a memorable signature element, social proof, a 3+ feature section with inline-SVG icons, a stats or how-it-works band, a testimonial, a strong CTA band, and a real footer.
- Responsive (clamp + CSS grid, 360→1440px), AA contrast, semantic HTML.

Make it look like a funded startup's real site — distinctive, not a template. Output ONLY raw HTML starting with <!DOCTYPE html> — no markdown fences, no commentary.`;
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
): Promise<{ artifact: Artifact; mock: boolean }> {
  const { kind, noun } = deliverableFor(task.department);

  const house = houseSkill(kind);
  const discovered = await discoverSkill({ department: task.department, title: task.title, idea, kind });
  const authored =
    dbConfigured && workspaceId ? await findAuthoredSkill(workspaceId, kind).catch(() => null) : null;

  let headline: SkillRef = authored
    ? { name: authored.name, source: "authored", url: "" }
    : discovered
      ? toSkillRef(discovered)
      : { name: house.name, source: "house", url: "" };

  const basePrompt =
    genPrompt(kind, noun, task, idea) +
    `\n\nApply this house standard — your team's craft bar:\n${house.content}` +
    (authored ? `\n\nYour company's own authored skill — apply it:\n${authored.content}` : "") +
    (discovered ? buildSkillBlock(discovered) : "");

  let title = "";
  let content = "";
  let mock = true;

  const client = getAnthropic();
  if (client) {
    try {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        messages: [{ role: "user", content: basePrompt }],
      });
      content = cleanText(resp);
      title = `${(idea || "Company").slice(0, 50)} — ${noun}`;
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
          headline = { name: made.name, source: "authored", url: "" };
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

  // ---- Verification / quality loop ----
  let evaluation: DeliverableEval;
  if (!mock && client) {
    let judged = await judgeDeliverable(client, { kind, idea, task: task.title, content });
    let iterations = 1;
    if (judged && judged.score < QUALITY_BAR) {
      try {
        const retryPrompt = `${basePrompt}\n\nA strict reviewer scored your previous attempt ${judged.score}/10. The most important things to FIX: ${judged.notes}\nProduce a clearly better version that fully addresses this feedback. Use the exact same output format as before.`;
        const resp2 = await client.messages.create({
          model: MODEL,
          max_tokens: 8000,
          messages: [{ role: "user", content: retryPrompt }],
        });
        const content2 = cleanText(resp2);
        if (content2.length > 0) {
          const judged2 = await judgeDeliverable(client, { kind, idea, task: task.title, content: content2 });
          iterations = 2;
          if (judged2 && judged2.score >= judged.score) {
            content = content2;
            judged = judged2;
          }
        }
      } catch {
        /* keep the first attempt */
      }
    }
    const finalChecks = runChecks(kind, content);
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
    const checks = runChecks(kind, content);
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
        kind,
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
      kind,
      title,
      content,
      skill: headline,
      eval: evaluation,
    },
    mock,
  };
}
