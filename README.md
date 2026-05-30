# Cofounder.co — pin-to-pin clone

A faithful replica of [cofounder.co](https://cofounder.co) (the multi-agent company-building
platform by The General Intelligence Company of NY), rebuilt in Next.js with a **functional
agent backend** — not just a static landing page.

> Built from a live design teardown of the real site (captured May 2026). Visual tokens,
> shadows, typography scale, and layout were reverse-engineered from the production CSS bundle.

## Stack
- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript**
- **Tailwind CSS v4** (CSS-first `@theme`, custom design tokens in `app/globals.css`)
- **Framer Motion** for scroll/entrance animation
- **@anthropic-ai/sdk** — the "superoptimizer" agent backend (Claude `opus-4-8`)

## What's included

### Marketing site (`/`) — pin-to-pin
- **Hero** — the pixel-art GIF, gradient-white headline, floating notification cards, scroll arrow
- **Orchestration band** — department chips + live product mock (breadcrumb, 60% progress ring, sidebar, task rows, chat input)
- **Value props** — Agentic departments / Human in the loop / Fully extensible
- **Chapters** — 4 book-cover guide cards (Start / Build / Sell / Scale)
- **Lifecycle** — animated product mocks: roadmap, engineering tasks, email campaign, analytics
- **Tools & systems**, **Build across industries** (word-search), **final CTA**, footer
- **`/pricing`** — 3 tiers + FAQ

### Functional app (`/app`) — the "dynamic workflow"
- **Canvas** (`/app`) — describe a company → the superoptimizer **spins up task agents** across
  Engineering / Sales / Marketing / Design / Support / Ops / Finance / Legal, rendered as live
  nodes with status (todo / running / needs-action / done) + a chat-driven conversation panel
- **Tasks** (`/app/tasks`) — tasks grouped by department
- **Roadmap** (`/app/roadmap`) — staged company roadmap (Idea → Initial → Identity)

The agent backend (`app/api/agent/route.ts`) calls Claude when `ANTHROPIC_API_KEY` is set and
falls back to a deterministic mock otherwise — **the UI always works with no key**.

### Real backend (not just a demo)
- **Persistence** — companies, task agents, and deliverables are stored in a **dedicated
  Supabase Postgres** project (`cofounder_workspaces` / `cofounder_tasks` / `cofounder_artifacts`).
  The workspace id is kept in `localStorage`, so **a refresh restores your company**. DB access is
  server-only via PostgREST `fetch` (no SDK dependency); the client only ever calls `/api/*`.
- **Executing agents** — `app/api/execute/route.ts` makes a running agent produce a *real*
  deliverable: the **Engineering** agent generates a complete HTML **landing page**, **Design**
  a brand spec, **Marketing/Sales** copy. Artifacts are persisted and viewable in-canvas
  (`View output`) or full-screen at `/app/preview/<id>`. Works with the Claude key, or a
  genuinely-usable templated fallback without one.

> Env: set `SUPABASE_URL` + `SUPABASE_KEY` (publishable) in `.env.local` to enable persistence.

## Run

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY for real agent generation
npm run dev                  # http://localhost:3000
```

## Design system
Tokens and reusable surfaces live in `app/globals.css`; primitives (`RaisedCard`, `LightButton`,
`GlassButton`, `BlinkDot`, `Chip`, `EtchedDivider`, `MonoLabel`) in `components/ui/primitives.tsx`.

## Notes / deviations
- **Font:** the real site uses *TT Neoris* (a trial font). Substituted **Hanken Grotesk** (free,
  variable, same friendly geometric character). Body = Inter, mono = IBM Plex Mono.
- **Assets:** pixel-art / icon PNGs in `public/` were mirrored from the live site for fidelity.
  Replace with original artwork before any public deployment (the originals are copyrighted).
