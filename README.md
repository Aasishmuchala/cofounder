# Helm — run your whole company with agents

Helm is a multi-agent company-building platform built in Next.js with a **functional
agent backend** — not just a landing page. Describe a company and Helm spins up
specialized agents across every department; they search the skill ecosystem, author
their own skills, produce real deliverables, and keep you **at the helm** with approval gates.

## Stack
- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript**
- **Tailwind CSS v4** (CSS-first `@theme`, custom design tokens in `app/globals.css`)
- **Framer Motion** for scroll/entrance animation
- **@anthropic-ai/sdk** — the Helm agent backend (Claude)

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
- **Canvas** (`/app`) — describe a company → Helm **spins up task agents** across
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

### Write authorization
Workspaces are anonymous (no login), so writes are protected by a per-workspace
**capability token** — a stateless `HMAC-SHA256(APP_SECRET, workspaceId)` handed to
the client when a workspace is created. Creating tasks in an existing workspace,
executing a task, and patching a task all require it; forged or missing tokens get
`403`, and a task can only be mutated within its own workspace.

**In production, writes fail CLOSED:** `APP_SECRET` is **mandatory** — with no
secret set (and no DB-backed edit key) a production deployment refuses writes rather
than running open. Locally it stays fail-open so the keyless demo runs unchanged
(production is `NODE_ENV=production` or any `VERCEL` var). The `HELM_ALLOW_OPEN_WRITES=1`
escape hatch restores open writes in production but is **discouraged** — it defeats
tenant isolation. See **[`LAUNCH.md`](LAUNCH.md)** for the full launch checklist.

The generation routes (`/api/run`, `/api/execute`, `/api/stream`, plus the planner
`/api/agent` and `/api/plan` when a workspace is known) are rate-limited per workspace,
returning `429` past `HELM_RATELIMIT_PER_MIN` requests/minute (default 20). The limiter
is two-layer: an in-memory sliding window per instance, PLUS — once migration
`0002_occ_rate_limit.sql` is applied — a shared atomic Postgres window
(`cofounder_rate_limit` RPC) that holds the cap across every serverless instance
(feature-detected; fails open to the local layer). Pre-workspace model calls (`/api/onboarding`, the very first
planning turn) aren't workspace-keyed — front them with an edge/WAF limiter. Uploads to
`/api/upload` are bounded by a 10 MB size cap **and a
content-type allowlist** (plus filename sanitization), so an unexpected MIME type is
rejected. All untrusted request fields are coerced + length-capped before reaching the
model or the database, and user input is HTML-escaped in generated artifacts (which are
additionally rendered in a script-less `<iframe sandbox>`). Conservative security
headers (CSP `frame-ancestors`/`base-uri`/`object-src`/`form-action`, `nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`) ship on every
response. A self-contained adversarial harness lives in `stress.mjs` (+ `stress-auth.mjs`).

## Run

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY for real agent generation
npm run dev                  # http://localhost:3000
```

Deploying to production? Follow **[`LAUNCH.md`](LAUNCH.md)** — it covers the env that
becomes mandatory (`APP_SECRET`, `CRON_SECRET`), the two migrations (RLS hardening +
multi-instance safety), and the dangerous capabilities that must stay off. CI
(`.github/workflows/ci.yml`) runs lint + the full vitest suite + a production build on
every push and PR.

## Design system
Tokens and reusable surfaces live in `app/globals.css`; primitives (`RaisedCard`, `LightButton`,
`GlassButton`, `BlinkDot`, `Chip`, `EtchedDivider`, `MonoLabel`) in `components/ui/primitives.tsx`.

## Notes / deviations
- **Font:** the real site uses *TT Neoris* (a trial font). Substituted **Hanken Grotesk** (free,
  variable, same friendly geometric character). Body = Inter, mono = IBM Plex Mono.
- **Assets:** all artwork in `public/` is **original SVG**, generated by
  `scripts/gen-art.mjs` (`npm run art:gen`) — hero, chapter covers, department + vibe
  cards, product icons, decorative bits. No rasters ship; nothing is copyrighted.
- **Skill catalog:** the bundled catalog is **100 first-party skills** (`skills/`), authored
  for Helm and department-tagged (`department:` frontmatter) across all 12 org departments —
  no imported third-party skill content, so there are no upstream license/attribution strings
  attached. The Skills-tab search placeholder shows the live catalog count from `/api/skills`.

## License
MIT (see [`LICENSE`](LICENSE)) — covers the code, the first-party skill catalog
(`skills/`), and the original SVG artwork (`public/`, generated by `scripts/gen-art.mjs`).
Everything in the repo is authored for it.
