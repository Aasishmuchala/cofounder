# Design System — powered by open-design

Cofounder's agents don't invent design from scratch. Every visual / design
deliverable is **grounded in [nexu-io/open-design](https://github.com/nexu-io/open-design)**
(Apache‑2.0) — a library of **110+ design SKILLs** and **150+ `DESIGN.md` design
systems** — and the right one is **selected per request**.

open-design's model is: a **SKILL** (`design-templates/<name>/SKILL.md`, a
workflow for one output type, tagged with trigger keywords) applied on top of an
active **`DESIGN.md`** (`design-systems/<name>/DESIGN.md` — color, typography,
spacing, layout, and component tokens). Cofounder mirrors that exactly.

## How it works

`lib/open-design.ts`
- **`selectOpenDesign(request)`** — picks a SKILL from the request (deliverable
  kind + department + task keywords) and a `DESIGN.md` from the company's brand
  vibe (or an explicit style keyword in the request).
- **`fetchOpenDesign(selection)`** — fetches the chosen `SKILL.md` + `DESIGN.md`
  live from GitHub (cached 1h), sanitizes them, and returns a grounding block +
  a `SkillRef` badge.

`lib/runner.ts` → `produceDeliverable`
- Injects the `DESIGN.md` tokens + the SKILL workflow into the agent's prompt and
  surfaces the chosen skill as the deliverable's badge
  (e.g. `open-design: saas-landing · glassmorphism`). open-design is the headline
  design source; the generic live-discovered skill is the fallback.

## Selection map

**Request → SKILL** (first keyword match wins; otherwise the default)

| Deliverable | Default SKILL | Keyword overrides |
|---|---|---|
| Landing page (Engineering) | `saas-landing` | `pricing/plans/tiers`→`pricing-page`, `waitlist/early access`→`waitlist-page` |
| Brand spec (Design) | _(the `DESIGN.md` system itself)_ | — |
| Email (Sales) | `email-marketing` | — |
| Markdown · Marketing | `blog-post` | `email/newsletter`→`email-marketing`, `social/carousel`→`social-carousel` |
| Markdown · Operations | `weekly-update` | `meeting`→`meeting-notes`, `kanban/sprint`→`kanban-board`, `okr/goals`→`team-okrs` |
| Markdown · Finance | `finance-report` | `invoice`→`invoice`, `dcf/valuation`→`dcf-valuation`, `pitch book`→`ib-pitch-book` |
| Markdown · Support / Legal | `docs-page` | — |

**Brand vibe → `DESIGN.md` system**

| Vibe | Design system |
|---|---|
| `editorial-mint` | `editorial` |
| `saturated-tech` | `linear-app` |
| `soft-pop` | `friendly` |
| `brutalist-grid` | `brutalism` |
| `pastel-utility` | `minimal` |
| `house-of-glass` | `glassmorphism` |
| _(none)_ | `modern` |

An explicit style keyword in the request overrides the vibe — e.g. "luxury"→
`luxury`, "brutalist"→`brutalism`, "glass"→`glassmorphism`, "apple"→`apple`,
"editorial"→`editorial`, "minimal"→`minimal`, "retro"→`retro`, "corporate"→
`corporate`, "futuristic/cyber"→`futuristic`, "playful/colorful"→`colorful`.

## Security

Fetched markdown is **untrusted third‑party content**. It is length‑capped,
scanned for prompt‑injection markers (`lib/skills.ts` `sanitizeSkill`), and
injected inside an explicit *"reference data only"* envelope that tells the model
to extract the design craft but ignore any meta‑instructions, file reads, links,
or prompt‑reveal attempts inside it. Only `raw.githubusercontent.com` is
contacted.

## Extending

Add entries to `TEMPLATES_BY_KIND`, `MARKDOWN_BY_DEPT`, `VIBE_SYSTEM`, or
`SYSTEM_KEYWORDS` in `lib/open-design.ts`. Any name from open-design's
`design-templates/` or `design-systems/` works.

## Attribution

Design skills and systems © their authors, via
[nexu-io/open-design](https://github.com/nexu-io/open-design) under the
**Apache‑2.0** license. Cofounder references them at generation time for
grounding; it does not redistribute the repository.
