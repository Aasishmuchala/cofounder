# Production launch checklist

Helm runs **keyless out of the box** (deterministic mock mode, open writes) so the
local demo "just works". A real, internet-facing deployment is a different posture:
several dangerous defaults flip, and a few secrets become **mandatory**. Work top to
bottom — the items in **Required environment** and **Database** are blockers; the rest
are strongly recommended hardening.

> Production is detected as `NODE_ENV=production` **or** any `VERCEL` env var being
> set. Every production-only behavior below is gated on that condition, so nothing
> here changes the keyless local experience.

---

## Required environment (blockers)

Set every one of these before serving public traffic.

- [ ] **`APP_SECRET`** — **mandatory in production.** It is the server secret behind
      the per-workspace capability token (`HMAC-SHA256(APP_SECRET, workspaceId)`) that
      authorizes every write. In production, writes **fail closed** when it is unset:
      with no DB-backed edit key and no `APP_SECRET`, write routes refuse rather than
      run open. (The keyless local demo still allows open writes because it is not
      production.) Generate a long random value:
      ```bash
      node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
      ```
      Do **not** use `HELM_ALLOW_OPEN_WRITES=1` to skip this — see the escape-hatch note
      below. It is discouraged and defeats tenant isolation.

- [ ] **`ANTHROPIC_API_KEY`** (official API) **or** a proxy base URL + token. For an
      Anthropic-compatible proxy (e.g. claudeopus.pro) set `ANTHROPIC_BASE_URL` +
      `ANTHROPIC_AUTH_TOKEN`. If the host shell already exports those (common with the
      Claude Code CLI), use the `HELM_ANTHROPIC_*` variants instead — they take
      precedence over the `.env`-vs-shell collision. Without any key the app still
      serves the deterministic mock; that is **not** what you want in production.

- [ ] **`SUPABASE_URL` + `SUPABASE_KEY`** — both required to persist companies, tasks,
      and artifacts across refreshes. Without them the app silently runs in
      no-persistence mode (every reload starts fresh).

- [ ] **`CRON_SECRET`** — **fails closed in production.** `/api/cron` drains one
      actionable task per active workspace each tick (so companies advance with no tab
      open). On a real deployment, an **unset `CRON_SECRET` disables the endpoint**
      (returns `401`) so there is no unauthenticated AI-cost amplification. Set a long
      random value; `vercel.json` schedules the tick and Vercel sends the value as a
      `Bearer` token. (In dev the endpoint stays open for convenience.)

---

## Database — run the hardening migration

- [ ] **Apply `supabase/migrations/0001_hardening.sql` before going live.** It enables
      row-level security as **defense in depth**.
- [ ] **Apply `supabase/migrations/0002_occ_rate_limit.sql`.** It adds (a) the
      `meta_version` column powering optimistic-concurrency on workspace `meta`
      (compare-and-swap PATCH + retry — concurrent writers on different instances can no
      longer silently drop each other's updates), and (b) the `cofounder_rate_limit`
      RPC — a shared, atomic per-workspace rate window enforced across all instances.
      Both are feature-detected: a pre-migration database keeps the exact legacy
      single-instance behavior.
- [ ] Understand the trust model: the app talks to Postgres with the **Supabase
      service key, server-side only** (via PostgREST `fetch`; the browser never holds a
      key and only ever calls `/api/*`). The **primary tenant boundary is the
      application-code `workspace_id` filter** on every read and write — the RLS
      migration is a second line of defense, not the only one. Keep the service key
      server-side and never expose it to the client bundle.

---

## Dangerous capabilities — keep OFF in production

Two connectors can act on the host machine. Both **refuse to run in production** even
when their server env flag is set, unless you *also* set their explicit
`*_ALLOW_PROD=1` override. Leave them unset.

- [ ] **`COMPUTER_USE`** (Local Computer connector — filesystem / shell / git / headless
      browser on the server) stays **unset**. Even with `COMPUTER_USE=1`, production
      keeps it disabled unless `COMPUTER_USE_ALLOW_PROD=1` is also set. Do not set the
      override on any multi-tenant or internet-facing host — it exposes a shell. See
      `docs/COMPUTER-USE.md`.
- [ ] **`CLAUDE_CODE`** (Claude Code connector) stays **unset**; same production
      refusal, overridden only by `CLAUDE_CODE_ALLOW_PROD=1`. Same advice: don't.
- [ ] **Human-approval gate is the primary control.** Every side-effectful connector
      tool (send email, post update, `write_file`, `run_shell`, mutating git, etc.) is
      classified **sensitive**: it is *not* executed by the model. A frozen
      `{tool, args}` snapshot is queued to the workspace Inbox and the task is set to
      `needs_action`; a human approves the **exact** action, and only then does the
      system run the frozen snapshot deterministically (the model is never re-invoked).
      **Prohibited** actions (money movement, credential/payment entry, permanent
      deletes, account creation, permission changes) never execute, even on approval.
      A `run_shell` approval is equivalent to running the command yourself — read it
      before approving.

---

## Storage

- [ ] **The uploads bucket (`cofounder-uploads`) is currently public.** Anyone with an
      object URL can fetch it. For a public deployment, switch to a **private bucket +
      short-lived signed URLs** so uploads are not world-readable by guessable URL.
- [ ] **Upload content-type allowlist.** `/api/upload` enforces a content-type
      allowlist (in addition to the existing 10 MB size cap, filename sanitization, and
      `authorizeWrite` check), so an unexpected MIME type is rejected rather than stored
      and re-served. Review the allowlist matches the file kinds your product actually
      accepts.

---

## Rate limiting

- [ ] **Per-workspace 429 throttle.** The generation routes — `/api/run`,
      `/api/execute`, `/api/stream`, and the planner `/api/agent` + `/api/plan` (the
      latter two when a `workspaceId` is present) — apply a per-workspace request cap
      that returns HTTP `429` when exceeded. Tune it with **`HELM_RATELIMIT_PER_MIN`**
      (default **20** requests/minute per workspace).
- [x] **Anonymous (pre-workspace) model calls are per-IP rate limited.** The unkeyed
      paid entry points — `/api/onboarding`, and the first turn of `/api/agent` /
      `/api/plan` / `/api/execute` (no `workspaceId` yet) — are capped **per client IP**
      (from `x-forwarded-for`) so an anonymous loop can't drive unbounded model spend or
      unbounded workspace creation. Tune with **`HELM_ANON_RATELIMIT_PER_MIN`** (default
      **10**/min/IP). Gated to production, like the keyed limiter. NOTE: the IP is taken
      from the proxy header, so a fronting edge/WAF that sets a trustworthy
      `x-forwarded-for` is still recommended — it's the authority on client identity and
      the cheapest place to shed a flood.
- [x] **Concurrency ceiling on generations.** A per-instance semaphore caps how many
      model-backed requests run at once (**`HELM_MAX_CONCURRENT_GENERATIONS`**, default
      **6**) with a bounded wait queue (**`HELM_MAX_GENERATION_QUEUE`**, default **12**);
      past that the route sheds load with **HTTP 503 + Retry-After** instead of fanning
      out into N simultaneous Opus calls or exhausting the event loop. Set these to match
      your provider rate limits and instance size.
- [ ] **Two-layer enforcement.** Layer 1 is per-instance/in-memory (free, always on).
      Layer 2 — after migration `0002` — is the shared `cofounder_rate_limit` Postgres
      window, atomic across every instance, so the cap no longer multiplies with the
      instance count. The DB layer **fails open** (local layer still applies) if the RPC
      is absent or erroring, so the limiter can never take generation down with it. An
      edge/WAF limiter in front is still recommended for hostile traffic (it's cheaper
      than reaching the app at all).
- [ ] **Set a hard spend cap + billing alert on the Anthropic key.** The in-app limits
      are the first line; a provider-side monthly cap is the backstop that bounds the
      worst case regardless of any app bug. Do this before exposing a real key publicly.
- [ ] **Front with a load balancer / edge for raw connection floods.** The app-level
      guards return clean `429`/`503`, but a burst of hundreds of *simultaneous* TCP
      connections to a single Node process can still exceed the OS accept backlog (raw
      `ECONNRESET`) before any handler runs. A fronting LB/CDN (Vercel provides this)
      absorbs that; a bare self-hosted `next start` should sit behind nginx/Caddy.

---

## Scale posture — multi-instance safe after migration 0002

- [x] **Workspace `meta` writes are optimistic-concurrency protected.** With
      `meta_version` present (migration `0002`), `updateWorkspaceMeta` is a
      compare-and-swap: the PATCH is filtered on the version it read and bumps it;
      a lost race matches 0 rows and the app re-reads + retries (up to 4×). The
      in-process `withWorkspaceLock` remains as the cheap first line within one
      instance. On a pre-migration database the legacy last-write-wins behavior is
      kept (single-instance semantics) — apply the migration before scaling out.
- [x] **The per-workspace rate limit holds across instances** via the shared
      `cofounder_rate_limit` window (same migration; fails open to the local layer).

---

## Assets & fonts — replace before any public deployment

- [ ] **Font:** the live site uses *TT Neoris* (a trial font); Helm substitutes
      **Hanken Grotesk** (free, variable). No action needed to ship, but if you license
      TT Neoris, swap it in.
- [ ] **Copyrighted artwork:** the pixel-art / icon PNGs in `public/` were **mirrored
      from the live site** for fidelity and are **copyrighted**. **Replace them with
      original artwork before any public deployment.**
- [x] **Honesty pass on copy:** the catalog ships **100 first-party skills** (authored
      in-repo, `source: helm` — no imported third-party skill text, so no upstream
      attribution obligations). The Skills-tab search placeholder renders the live count
      from `/api/skills`; the only count strings (`components/app/SkillsTab.tsx`) are
      live-computed from `overview.total`.

---

## Pre-flight summary

| Item | Required? | Default if unset (prod) |
| --- | --- | --- |
| `APP_SECRET` | **Yes** | writes fail closed |
| `ANTHROPIC_API_KEY` / proxy | **Yes** (for real output) | deterministic mock |
| `SUPABASE_URL` + `SUPABASE_KEY` | **Yes** (for persistence) | no persistence |
| `CRON_SECRET` | **Yes** (if cron used) | `/api/cron` disabled (401) |
| `0001_hardening.sql` migration | **Yes** | RLS off (app filter only) |
| `0002_occ_rate_limit.sql` migration | **Yes (before scaling out)** | legacy single-instance semantics |
| `COMPUTER_USE` / `CLAUDE_CODE` | **No — keep unset** | disabled (good) |
| Private uploads bucket + signed URLs | Recommended | public bucket |
| `HELM_RATELIMIT_PER_MIN` | Optional | 20 / min / workspace (per instance) |
| `HELM_ANON_RATELIMIT_PER_MIN` | Optional | 10 / min / IP on unkeyed model routes |
| `HELM_MAX_CONCURRENT_GENERATIONS` | Optional | 6 concurrent (503 past queue) |
| `HELM_MAX_GENERATION_QUEUE` | Optional | 12 waiting |
| Anthropic key spend cap + alert | **Recommended** | none (uncapped bill) |
| Fronting LB/edge (or nginx/Caddy) | **Recommended** | raw socket floods reach Node |
| `HELM_ALLOW_OPEN_WRITES` | **Discouraged** | unset (writes stay protected) |
| Replace `public/` artwork & stale copy | **Yes** | copyrighted / overstated |
