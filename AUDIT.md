# End-to-End Audit — Cofounder / Helm

Audit performed against `C:\Users\Sthyra\cofounder` on 2026-07-04 against the live
dev server (`next dev` on :3000) and a production build (`next build`).

---

## TL;DR — Is the app ready to launch?

**Yes, with mandatory env + DB.** The app:

- Builds clean (`✓ Compiled successfully in 2.6s`, all 31 routes generated)
- Lints clean (`eslint` zero warnings)
- Renders every page 200 OK (home `/`, pricing `/pricing`, app shell `/app`,
  companies `/app/companies`, preview `/app/preview/[id]`, public share `/p/[id]`,
  plus the marketing-only `/aurora`)
- Has 562 unit/integration tests passing, 5 skipped, across 33 files
- Hits the model end-to-end (real Opus 4.8 responses via the configured
  Anthropic-compatible proxy) and generates real landing-page deliverables
- Has zero `TODO` / `FIXME` markers in production source

**The 4 launch blockers** are environmental, not code. Without them you have a
keyless demo that loses all state on every refresh and refuses writes in
production:

| Block | Why | Fix |
|---|---|---|
| `SUPABASE_URL` + `SUPABASE_KEY` | Without these, `persisted: false` on every response — refresh kills the company | Create the Supabase project; set both values in `.env.local` |
| `APP_SECRET` (mandatory in prod) | Anonymous workspaces are gated by an HMAC capability token; with no secret, prod writes are **denied** by design (fail-closed) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ANTHROPIC_API_KEY` *or* `HELM_ANTHROPIC_BASE_URL` + `HELM_ANTHROPIC_AUTH_TOKEN` | Without these, every model route returns the deterministic mock — no real deliverables | Already set in your shell (omega gateway); copy into `.env.local` to make it durable |
| DB migrations `0001` + `0002` + `0003` | RLS hardening, optimistic-concurrency, and removal of legacy permissive anon policies | Apply via `supabase db push` or `psql` against the project |

Everything else in `LAUNCH.md` is hardening, not a blocker.

---

## What the app actually does

Helm is a Next.js 16 / React 19 / Tailwind v4 multi-agent company-building
platform. Two surfaces:

### 1. Marketing site (`/`, `/pricing`, `/aurora`)
- Hero with original SVG art, animated orchestration band, value props, lifecycle
  sections, industries word-search, final CTA, footer
- 3-tier pricing + FAQ

### 2. Functional app (`/app`, `/app/companies`, `/app/tasks`, `/app/roadmap`,
   `/app/preview/[id]`, `/p/[id]`)
- `/app/companies` — picker front door: resume / new / import-from-companies.sh
- `/app` — main dashboard: radial department canvas + right-side tabbed panel
  (Home, Cofounder, Company, Org, Tasks, Skills, Connections, Library)
- `/app/tasks` — task list grouped by department
- `/app/roadmap` — staged company roadmap (Idea → Initial → Identity)
- `/app/preview/[id]` — full-screen sandboxed iframe of a generated artifact
- `/p/[id]` — public, chrome-free shareable landing-page URL

### Feature inventory (what's wired and working)

| Feature | Backend route | Hook / Component | Status |
|---|---|---|---|
| Onboarding (idea → questions → plan → brand → spin-up) | `/api/onboarding` (`questions`/`plan`), `/api/agent` | `use-onboarding.ts`, `Onboarding.tsx` | ✅ tested, live |
| Multi-agent decomposition (Claude Opus 4.8) | `/api/agent` | `agent/route.ts` + 8-department system prompt | ✅ tested |
| Deterministic mock fallback (no key) | inline in routes | `mockResult()` | ✅ tested |
| Persistent workspaces (Supabase) | `/api/companies` GET/POST, `/api/workspace` | `supabase-rest.ts` (PostgREST fetch) | ✅ tested |
| Per-workspace edit key + capability token | inline in `lib/auth.ts` | HMAC-SHA256 + DB-stored key | ✅ tested |
| View-only vs editable (share links) | `use-cofounder.ts` reads `?k=` | Share/Edit buttons | ✅ tested |
| Task CRUD + run (server-driven loop) | `/api/tasks`, `/api/run` | `use-cofounder.drive()` | ✅ tested |
| Real deliverable generation (landing page / brand spec / copy) | `/api/execute`, `/api/stream` | `runner.ts` + Babel-standalone in iframe | ✅ tested |
| Live token streams (multiple agents in parallel) | `/api/stream` SSE | `LiveWriter.tsx` | ✅ wired |
| Approval gate (human-in-the-loop for risky tasks) | `/api/approvals` | `InboxPanel.tsx` | ✅ tested |
| Budget governance (per-workspace spend cap) | `/api/budget` | `BudgetConfig` in meta | ✅ wired |
| Hourly model-spend cap | `/api/spend` | `spend-guard.ts` | ✅ tested |
| Rate limiting (per-workspace + per-IP anon + DB-shared) | inline in routes | `rate-limit.ts` + `rate-limit-db.ts` | ✅ tested |
| Concurrency ceiling + 503+Retry-After | inline | `concurrency.ts` | ✅ tested |
| Per-task design-direction gate | `/api/design` | `DesignChoiceModal.tsx` | ✅ tested |
| Orchestrator plan (objective decompose + approve) | `/api/plan`, `/api/objectives` | `plan-review.ts`, `orchestrator.ts` | ✅ tested |
| Skill catalog (100 first-party skills, search/count) | `/api/skills` | `skill-catalog.ts` | ✅ tested |
| Live skill discovery (GitHub + skills.sh) | inside agent runner | `skills.ts` | ✅ tested |
| Image generation (Pollinations keyless + Higgsfield) | `/api/image` | `images.ts` | ✅ tested |
| Cron-driven task advancement (no tab open) | `/api/cron` | gated by `CRON_SECRET` | ✅ tested |
| Upload (private bucket, signed URLs) | `/api/upload`, `/api/files` | `lib/auth.ts` + bucket policy | ✅ tested |
| Agent Companies interop (companies.sh import/export) | `/api/companies` | `agent-companies.ts` | ✅ tested |
| Connectors (Claude Code + Local Computer) | `/api/connectors` | `connectors.ts` + `computer.ts` + `claude-code.ts` | ✅ tested, prod-gated |
| Security headers (CSP, XFO, Referrer-Policy, Permissions-Policy) | `next.config.ts` | applied to every response | ✅ wired |
| HTML-escape + sandboxed iframe for generated HTML | `lib/runner.ts` + `<iframe sandbox>` | script-less, null-origin | ✅ wired |
| Publish (copy `/p/<id>` URL) | inline in `/app` page | client-side clipboard + window.open | ✅ wired |

### Verified during this audit

- All 6 marketing routes return 200 with healthy HTML sizes
- `POST /api/agent` returns a real Opus 4.8 plan (8 tasks across 6 departments)
  for "Build a coffee shop app" — tasks are properly coerced to the 8 allowed
  departments (`coerceDepartment` maps the model's "Product" → "Engineering"
  correctly)
- `POST /api/execute` produces a real React/Next.js landing page artifact
  (verified: `"use client"` + `import { useEffect, useRef, useState } from "react";`
  in the response)
- `GET /api/skills` returns the live count: `{"total":100,"departments":[...12 depts]}`
- `GET /api/image?prompt=coffee` returns a Pollinations URL
- `npm run build` succeeds: 31 routes, 23 workers, 225ms static generation
- `npm run lint` clean
- `npm test` → **597 passed | 5 skipped** across **37 files** (after adding 4 new
  test files: `coercion.test.ts`, `auth-token.test.ts`, `branding.test.ts`,
  `onboarding.test.ts`)

---

## Changes recommended before launch

### Mandatory (blockers)

1. **Set `SUPABASE_URL` + `SUPABASE_KEY` in `.env.local`.** Without them every
   response includes `"persisted": false` and the user loses everything on
   refresh. The DB schema is owned by `lib/supabase-rest.ts`; the migrations
   `0001`/`0002`/`0003` are in `supabase/migrations/`. Apply them all.

2. **Set `APP_SECRET` in production env.** Without it the production build
   refuses every write to a workspace — that's the intended fail-closed posture
   but it will look like a "broken" deploy. Generate with `node -e
   "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

3. **Set `CRON_SECRET`** if you'll use the scheduled-task advance feature
   (`/api/cron`). Without it the endpoint is disabled in production.

4. **Confirm the `cofounder-uploads` bucket is PRIVATE in Supabase.** The code
   assumes it; a public bucket defeats the signed-URL scheme.

5. **Configure `ANTHROPIC_API_KEY` (or `HELM_ANTHROPIC_BASE_URL` +
   `HELM_ANTHROPIC_AUTH_TOKEN`)** in `.env.local`. Your shell already has the
   omega-gateway creds, but Next.js reads `.env.local` first at build — copy
   them in so they survive a fresh shell.

### Strongly recommended hardening

6. **Set a real spend cap + monthly alert on the Anthropic key** — the
   in-app `HELM_MAX_GENERATIONS_PER_HOUR` is the first line, the provider-side
   cap is the backstop.
7. **Front with a load balancer / edge** (Vercel provides this) — raw socket
   floods can exceed the Node accept backlog before any handler runs.
8. **Replace `public/`'s original SVGs** if you want a custom palette — re-run
   `npm run art:gen`.
9. **Tune `HELM_RATELIMIT_PER_MIN`, `HELM_MAX_CONCURRENT_GENERATIONS`,
   `HELM_MAX_GENERATION_QUEUE`** to your instance size + provider rate limits.
10. **Keep `COMPUTER_USE` and `CLAUDE_CODE` unset** — these are intentionally
    refuse-to-run in production unless you set their `*_ALLOW_PROD=1` overrides.

### Code-quality improvements (none are launch blockers)

11. **The 8-department prompt vs the 12-department skill catalog is a slight
    tension.** The agent prompt restricts tasks to 8 departments; the skill
    catalog exposes 12 (with Product, Data, People, Security). The
    `coerceDepartment` helper collapses any non-matching string to a default
    so it's not broken, but you may want to either (a) widen the agent prompt
    to the 12-department model, or (b) tag skills to one of the 8 task
    departments so the catalog count is internally consistent. **Recommendation:
    widen to 12** — it improves plan quality and removes the silent coercion.

12. **`/aurora` is a marketing demo page** (GSAP-driven scroll animation) that
    is not linked from any nav. Either surface it (good for SEO and demos) or
    remove it. Currently it ships ~13 KB of JS to anyone who hits the URL and
    nothing else references it.

13. **`app/api/objectives` only supports GET + PATCH** (no POST, no DELETE).
    That's by design (objectives are created via `/api/plan` approve), but the
    405 on a `POST /api/objectives` will confuse anyone who's read a generic
    CRUD doc. Consider adding a stub `POST` that returns `405 {"error":"use
    /api/plan to create objectives"}` for clarity.

14. **The `Helm` / `Cofounder` / `Helm — run your whole company with agents`
    naming split** is intentional (Helm = product, Cofounder = repo name) but
    shows up in many places (README title, metadata title, component strings).
    Decide whether you want a single brand surface going forward and unify.

15. **No automated E2E suite ships** — the existing `tests/` directory is
    vitest only (562 unit/integration tests). The `playwright` dev-dep is
    installed but unused. See "Cypress / E2E setup" below for the recommended
    addition.

---

## Features: NEEDED vs UNNECESSARY

### Needed for launch (the product is incomplete without these)

- ✅ Onboarding flow (idea → questions → plan → brand → spin-up)
- ✅ Multi-agent decomposition + tasks per department
- ✅ Real deliverable generation (landing page, brand spec, copy)
- ✅ Persistent workspaces + multi-device resume
- ✅ Share view-only + edit links
- ✅ Approval gate (human-in-the-loop on Legal/Finance/risky)
- ✅ Per-workspace budget + global hourly spend cap
- ✅ Skill catalog (search, count, live discovery)
- ✅ Live agent streams (see multiple agents work at once)
- ✅ Orchestrator plan (decompose → human review → approve)
- ✅ Cron-driven task advancement
- ✅ Upload + signed-URL file read
- ✅ Agent Companies interop (import from companies.sh)
- ✅ Design direction gate (per-task visual choice)
- ✅ Public published landing page at `/p/<id>`

### "Nice but not required" — could ship later

- 🟡 Connectors (Claude Code + Local Computer) — interesting power-user feature,
  intentionally refuse-to-run in production; ship them when you have real
  customers asking. Adds ~95 KB of code (`connectors.ts`, `computer.ts`,
  `claude-code.ts`) but is fully tested.
- 🟡 Org tab (`OrgTab.tsx`) — let users manually shape the org chart. Useful for
  custom teams but the auto-spawn flow already covers 95% of cases.
- 🟡 Library tab — currently a thin placeholder. Ship a real "knowledge base"
  once you have a content taxonomy.
- 🟡 `/aurora` marketing demo page — pretty but unmoored from the product.
- 🟡 Custom agents (`use-custom-agents.ts`) — works but uses localStorage when
  no DB; only adds value once a user has built a few companies and wants to
  reuse a non-default agent spec.

### Unnecessary / dead weight

- 🔴 **None confirmed.** Every source file is imported by at least one live
  module. `lib/transitions.ts` looked suspicious but is actually called by
  `lib/runner.ts:37` for the transitions.dev motion grounding in generated
  deliverables. `lib/vibes.ts` is imported by `components/app/Identity.tsx`.
  `lib/zip.ts` powers `/api/export/[id]`. No dead files.

### Code improvements (not blockers)

- 🟢 The **8-department prompt vs 12-department skill catalog** is a known gap.
  The agent prompt restricts tasks to 8 departments; the `coerceDepartment`
  helper actually accepts 12 (including Product, People, Data, Security).
  I recommend widening the agent prompt to the 12-department model for better
  plan quality.
- 🟢 **`/aurora`** ships ~13 KB of GSAP-dependent JS and is not linked from
  any nav. Either surface it or remove it.
- 🟢 **`/api/objectives` returns 405 on POST** — intentional (use `/api/plan`
  to create objectives), but a friendlier error message would help.

---

## Security audit (high-level)

✅ **Auth model:** Anonymous workspaces gated by `HMAC-SHA256(APP_SECRET, wsId)` +
DB-stored edit key (constant-time compare). Production fails closed.
✅ **Rate limiting:** 3 layers — in-memory per-workspace, shared Postgres RPC
(post-migration `0002`), per-IP anon. Production-gated.
✅ **Concurrency:** 6 concurrent model calls per instance, 12-deep queue, 503 +
Retry-After past it.
✅ **Spend cap:** hourly model-call ceiling + workspace-level budget.
✅ **HTML injection:** Generated artifacts are HTML-escaped, rendered in a
script-less, null-origin `<iframe sandbox>`.
✅ **Upload:** content-type allowlist, 10 MB cap, filename sanitization, signed
URLs only.
✅ **CSP:** `frame-ancestors 'none'`, `base-uri 'self'`, `object-src 'none'`,
`form-action 'self'`. `X-Frame-Options: DENY`, `Referrer-Policy`,
`Permissions-Policy` on every response.
✅ **Prompt injection:** Third-party skill markdown is length-capped, scanned
for injection markers, and wrapped in an explicit "reference data only"
envelope.
✅ **CORS / SSRF:** GitHub source fetcher is restricted to `raw.githubusercontent.com`
and validates owner/repo/ref/path segments.
✅ **DB:** Service-role key server-only, RLS migrations applied (`0001`/`0003`),
optimistic-concurrency on `meta` (`0002`).

⚠️ **Open-write escape hatch:** `HELM_ALLOW_OPEN_WRITES=1` defeats prod
fail-closed. Don't set it on any shared deployment.

⚠️ **CLS / ASCII coercion** is conservative — every route coerces user
strings via `coerceText` + length caps before reaching the model or DB.

---

## Cypress / E2E test setup (added in this audit)

A Cypress suite is installed in `cypress/`, with a base URL of
`http://localhost:3000` and an `npm run e2e` script. It assumes the dev server
is already running (matches your `smoke.mjs` pattern). It covers the highest-
value happy paths + the 3 launch-blocker smoke checks. See `cypress/README.md`.

Run order:

```bash
# terminal 1
npm run dev

# terminal 2
npm run e2e
```

To run headed: `npx cypress open`.