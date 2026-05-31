import type Anthropic from "@anthropic-ai/sdk";
import type { ArtifactKind, DeliverableEval } from "@/lib/agent-types";
import { deliverableFor, coerceText } from "@/lib/agent-types";
import { runChecks, judgeDeliverable, heuristicScore, QUALITY_BAR } from "@/lib/verify";
import {
  dbConfigured,
  insertArtifact,
  patchTask,
  findAuthoredSkill,
  insertAuthoredSkill,
} from "@/lib/supabase-rest";
import { getAnthropic, MODEL } from "@/lib/anthropic";
import { verifyWorkspaceToken } from "@/lib/auth";
import { discoverSkill, buildSkillBlock, toSkillRef } from "@/lib/skills";
import { houseSkill, synthesizeSkill } from "@/lib/skill-foundry";
import type { SkillRef } from "@/lib/agent-types";

export const runtime = "nodejs";

interface ExecBody {
  workspaceId?: string;
  workspaceSecret?: string;
  idea?: string;
  task?: { id: string; title: string; department: string; detail?: string };
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

/** Escape user-controlled text before interpolating into generated HTML. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  const name = coerceText(idea, 60) || "Your Company";
  if (kind === "landing_page") {
    // Escape interpolated user input so the mock can never emit injected markup
    // (defense-in-depth — the preview iframe is also script-sandboxed).
    const safeName = escapeHtml(name);
    const safeIdea = escapeHtml(idea);
    const tagline = safeIdea || "The fastest way to launch and grow your business.";
    return {
      title: `${name} — landing page`,
      content: `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${safeName} — built by autonomous agents</title>
<style>
:root{--bg:#08080b;--surface:#101017;--line:rgba(255,255,255,.08);--line2:rgba(255,255,255,.14);--ink:#f4f4f7;--mut:rgba(244,244,247,.62);--mut2:rgba(244,244,247,.42);--a1:#6d6bff;--a2:#b06bff;--grad:linear-gradient(105deg,#6d6bff,#b06bff 60%,#ff7ab0)}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Inter,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:inherit;text-decoration:none}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);border:1px solid var(--line);background:rgba(255,255,255,.03);padding:6px 12px;border-radius:999px}
.eyebrow b{color:var(--a2);font-weight:600}
.btn{display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:15px;padding:12px 22px;border-radius:11px;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
.btn-p{background:var(--grad);color:#0a0a12;box-shadow:0 8px 30px rgba(125,107,255,.35)}
.btn-p:hover{transform:translateY(-2px);box-shadow:0 14px 40px rgba(125,107,255,.5)}
.btn-g{border:1px solid var(--line2);color:var(--ink)}
.btn-g:hover{transform:translateY(-2px);border-color:var(--a1)}
nav{position:sticky;top:0;z-index:50;backdrop-filter:saturate(160%) blur(14px);background:rgba(8,8,11,.7);border-bottom:1px solid var(--line)}
nav .wrap{display:flex;align-items:center;justify-content:space-between;height:64px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:-.02em;font-size:17px}
.dot{width:22px;height:22px;border-radius:7px;background:var(--grad);box-shadow:0 4px 14px rgba(125,107,255,.5)}
.navlinks{display:flex;gap:28px;font-size:14px;color:var(--mut)}
.navlinks a:hover{color:var(--ink)}
.hero{position:relative;text-align:center;padding:clamp(80px,13vw,160px) 0 clamp(56px,8vw,96px)}
.aurora{position:absolute;inset:-20% -10% auto;height:560px;z-index:-1;filter:blur(90px);opacity:.55;background:radial-gradient(40% 50% at 30% 30%,#6d6bff66,transparent),radial-gradient(40% 50% at 70% 40%,#b06bff55,transparent),radial-gradient(40% 50% at 50% 70%,#ff7ab044,transparent);animation:drift 16s ease-in-out infinite alternate}
@keyframes drift{from{transform:translate3d(-4%,0,0) scale(1)}to{transform:translate3d(4%,3%,0) scale(1.12)}}
h1{font-size:clamp(40px,7vw,76px);line-height:1.04;letter-spacing:-.035em;font-weight:700;margin:22px auto 0;max-width:16ch}
h1 .g{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{margin:22px auto 0;max-width:60ch;color:var(--mut);font-size:clamp(16px,2.2vw,20px)}
.cta-row{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:34px}
.proof{margin-top:30px;display:flex;gap:18px;justify-content:center;align-items:center;flex-wrap:wrap;color:var(--mut2);font-size:13px}
.stars{color:#ffd479;letter-spacing:2px}
.cloud{display:flex;gap:clamp(24px,5vw,56px);justify-content:center;align-items:center;flex-wrap:wrap;padding:14px 0 8px;opacity:.5;font-weight:600;letter-spacing:-.01em}
.cloud span{font-size:18px;color:var(--mut)}
section.band{padding:clamp(64px,10vw,128px) 0}
.kicker{text-align:center;color:var(--a2);font-size:13px;letter-spacing:.1em;text-transform:uppercase;font-weight:600}
.h2{text-align:center;font-size:clamp(28px,4.4vw,44px);letter-spacing:-.03em;line-height:1.1;margin-top:12px}
.grid3{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-top:48px}
.card{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid var(--line);border-radius:18px;padding:28px;transition:transform .18s ease,border-color .18s ease}
.card:hover{transform:translateY(-3px);border-color:var(--line2)}
.ic{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:rgba(125,107,255,.12);border:1px solid var(--line);color:var(--a2);margin-bottom:16px}
.card h3{font-size:18px;letter-spacing:-.01em}
.card p{color:var(--mut);font-size:14.5px;margin-top:8px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:44px 0}
.stat{text-align:center}
.stat b{display:block;font-size:clamp(32px,5vw,52px);letter-spacing:-.03em;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.stat span{color:var(--mut);font-size:13px}
.quote{max-width:760px;margin:0 auto;text-align:center}
.quote p{font-size:clamp(20px,3vw,30px);letter-spacing:-.02em;line-height:1.35}
.quote .by{margin-top:22px;color:var(--mut);font-size:14px}
.ctaband{position:relative;text-align:center;border:1px solid var(--line);border-radius:24px;padding:clamp(48px,7vw,80px) 24px;overflow:hidden;background:radial-gradient(80% 140% at 50% 0%,rgba(125,107,255,.18),transparent)}
footer{border-top:1px solid var(--line);padding:48px 0 40px;color:var(--mut2);font-size:13px}
.fcols{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:24px;margin-bottom:32px}
.fcols h4{color:var(--ink);font-size:13px;margin-bottom:12px}
.fcols a{display:block;color:var(--mut);padding:4px 0}
.fcols a:hover{color:var(--ink)}
@media(max-width:720px){.navlinks{display:none}.stats{grid-template-columns:1fr;gap:28px}.fcols{grid-template-columns:1fr 1fr}}
@media(prefers-reduced-motion:reduce){.aurora{animation:none}*{transition:none!important}}
</style></head>
<body>
<nav><div class="wrap"><span class="brand"><span class="dot"></span>${safeName}</span>
<span class="navlinks"><a href="#features">Product</a><a href="#stats">Why us</a><a href="#cta">Pricing</a><a href="#cta">Docs</a></span>
<a class="btn btn-p" href="#cta" style="padding:9px 18px">Get started</a></div></nav>
<header class="hero"><div class="aurora"></div><div class="wrap">
<span class="eyebrow"><b>New</b> · shipped by autonomous agents</span>
<h1>${safeName}, <span class="g">live in a day</span></h1>
<p class="sub">${tagline} Built, launched, and grown by a team of AI agents — with you approving every step.</p>
<div class="cta-row"><a class="btn btn-p" href="#cta">Start free →</a><a class="btn btn-g" href="#features">See how it works</a></div>
<div class="proof"><span class="stars">★★★★★</span><span>Loved by 2,000+ founders</span><span>·</span><span>SOC2 ready</span><span>·</span><span>No credit card</span></div>
</div></header>
<div class="wrap cloud"><span>Acme</span><span>Northwind</span><span>Globex</span><span>Initech</span><span>Umbra</span></div>
<section class="band" id="features"><div class="wrap">
<p class="kicker">Built to ship</p><h2 class="h2">Everything you need, on autopilot</h2>
<div class="grid3">
<div class="card"><div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h7l-1 8 10-12h-7z" stroke-linejoin="round"/></svg></div><h3>Idea → product in a day</h3><p>Engineering agents scaffold, build, and deploy a working product while you watch it take shape.</p></div>
<div class="card"><div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" stroke-linejoin="round"/></svg></div><h3>Human in the loop</h3><p>Nothing risky ships without your sign-off. Approve, edit, or redirect any agent at any time.</p></div>
<div class="card"><div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 7-7" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 8h7v7" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h3>Grows while you sleep</h3><p>Marketing, sales, and ops agents run the busywork across every department, 24/7.</p></div>
</div></div></section>
<section class="band" id="stats" style="padding-top:0"><div class="wrap"><div class="stats">
<div class="stat"><b>1 day</b><span>idea to launched product</span></div>
<div class="stat"><b>8</b><span>departments staffed by agents</span></div>
<div class="stat"><b>100%</b><span>of decisions stay yours</span></div>
</div></div></section>
<section class="band" style="padding-top:0"><div class="wrap quote">
<p>“We launched ${safeName} in an afternoon. It felt like hiring a whole founding team that never sleeps.”</p>
<div class="by">— Early customer, seed-stage founder</div>
</div></section>
<section class="band" id="cta"><div class="wrap"><div class="ctaband">
<h2 class="h2" style="max-width:18ch;margin-inline:auto">Run your whole company with agents</h2>
<p class="sub" style="margin-top:14px">Start free. Spin up your first agents in minutes.</p>
<div class="cta-row"><a class="btn btn-p" href="#">Start free →</a><a class="btn btn-g" href="#">Book a demo</a></div>
</div></div></section>
<footer><div class="wrap">
<div class="fcols">
<div><span class="brand"><span class="dot"></span>${safeName}</span><p style="margin-top:12px;max-width:34ch">${tagline}</p></div>
<div><h4>Product</h4><a href="#">Overview</a><a href="#">Agents</a><a href="#">Pricing</a></div>
<div><h4>Company</h4><a href="#">About</a><a href="#">Careers</a><a href="#">Blog</a></div>
<div><h4>Legal</h4><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Security</a></div>
</div>
<div>© 2026 ${safeName}. Built by the Helm Engineering agent.</div>
</div></footer>
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
- **Headings:** Hanken Grotesk / geometric grotesque, tight tracking.
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

export async function POST(req: Request): Promise<Response> {
  let body: ExecBody = {};
  try {
    const parsed = await req.json();
    // A valid JSON body of `null`/`42` must not crash `body.task`.
    if (parsed && typeof parsed === "object") body = parsed as ExecBody;
  } catch {
    body = {};
  }
  const rawTask = body.task;
  if (!rawTask?.id || !rawTask?.title) {
    return Response.json({ ok: false, error: "missing task" }, { status: 400 });
  }
  // Normalize every untrusted field to a safe, length-bounded string.
  const task = {
    id: String(rawTask.id),
    title: coerceText(rawTask.title, 200) || "Untitled task",
    department: coerceText(rawTask.department, 60),
    detail: coerceText(rawTask.detail, 1000),
  };
  const idea = coerceText(body.idea, 4000);
  const workspaceId = coerceText(body.workspaceId, 100);
  const workspaceSecret = coerceText(body.workspaceSecret, 200) || undefined;

  // Persisting a deliverable into a workspace requires its capability token.
  // (No workspaceId => anonymous one-off generation, returned but not stored.)
  if (workspaceId && !verifyWorkspaceToken(workspaceId, workspaceSecret)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  const { kind, noun } = deliverableFor(task.department);

  // ---- Skill resolution: the agent's OWN skills first, then the world. ----
  // house = built-in best-in-market standard (always on, the quality backbone)
  // authored = a skill this company previously wrote for itself (reuse/learn)
  // discovered = best live match from the open ecosystem (untrusted reference)
  const house = houseSkill(kind);
  const discovered = await discoverSkill({
    department: task.department,
    title: task.title,
    idea,
    kind,
  });
  const authored =
    dbConfigured && workspaceId
      ? await findAuthoredSkill(workspaceId, kind).catch(() => null)
      : null;

  // Headline skill shown on the deliverable (a freshly-authored one wins below).
  let headline: SkillRef = authored
    ? { name: authored.name, source: "authored", url: "" }
    : discovered
      ? toSkillRef(discovered)
      : { name: house.name, source: "house", url: "" };

  let title = "";
  let content = "";
  let mock = true;

  // Ground the generation: house standard + authored skill (both trusted), plus
  // the discovered skill wrapped as untrusted reference data. Reused for retries.
  const basePrompt =
    genPrompt(kind, noun, task, idea) +
    `\n\nApply this house standard — your team's craft bar:\n${house.content}` +
    (authored ? `\n\nYour company's own authored skill — apply it:\n${authored.content}` : "") +
    (discovered ? buildSkillBlock(discovered) : "");

  const client = getAnthropic();
  if (client) {
    try {
      const resp = await client.messages.create({
        model: MODEL,
        // Headroom for extended thinking + a full landing-page HTML deliverable.
        max_tokens: 8000,
        messages: [{ role: "user", content: basePrompt }],
      });
      content = cleanText(resp);
      title = `${(idea || "Company").slice(0, 50)} — ${noun}`;
      mock = content.length === 0;

      // The agent AUTHORS a reusable skill for next time (the company learns),
      // if it doesn't already own one for this deliverable kind.
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

  // ---- Verification / quality loop ----------------------------------------
  // Grade the deliverable (deterministic checks + an LLM judge). If it scores
  // below the bar, regenerate ONCE with the judge's feedback and keep the
  // better version. The score is attached to the artifact so the UI can show it.
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
          // Keep the regeneration only if it scored at least as high.
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

  // Persist the artifact + mark the task done.
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
      // Scope the status write to this workspace (defense-in-depth alongside
      // the token check) so a task can only be flipped within its own workspace.
      await patchTask(task.id, { status: "done" }, workspaceId);
    } catch {
      /* fall through — still return the artifact to the client */
    }
  }

  return Response.json({
    ok: true,
    mock,
    artifact: {
      // Always non-null so the client can key/open it even when not persisted.
      id: artifactId ?? `a_${Math.random().toString(36).slice(2, 10)}`,
      taskId: task.id,
      kind,
      title,
      content,
      skill: headline,
      eval: evaluation,
    },
  });
}
