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
- [ ] **Residual: pre-workspace model calls aren't keyed.** `/api/onboarding` and the
      very first planning turn (no `workspaceId` yet) call the model without a
      per-workspace key, so the in-app limiter can't bound them. Front the deployment
      with an edge/WAF rate limiter to cover anonymous model-spend loops.
- [ ] **Caveat: it is per-instance / in-memory.** The counter lives in process memory,
      so the effective limit is `HELM_RATELIMIT_PER_MIN × instances`, and it resets on
      redeploy/restart. It blunts a single-instance abuse loop; it is **not** a global
      quota. Put a real edge/WAF rate limiter in front for hostile traffic, and prefer a
      single instance (see scale caveat) where the in-memory limit is exact.

---

## Known scale caveat — single instance recommended

- [ ] **Workspace `meta` is updated with a non-atomic read-modify-write, serialized by
      an in-process mutex only** (`withWorkspaceLock` in `lib/supabase-rest.ts`). The
      `meta` jsonb holds objectives, connector config, pending approvals, and the audit
      log; PostgREST can't do a server-side partial jsonb update, so the app reads,
      merges, and writes back under a per-workspace lock that exists **only within one
      Node process**. Across two instances, concurrent writers to the same workspace can
      lose an update (last-write-wins).
- [ ] **Run a single instance until a shared lock or optimistic-concurrency (OCC) /
      DB-side jsonb merge is added.** This also makes the in-memory rate limit exact.

---

## Assets & fonts — replace before any public deployment

- [ ] **Font:** the live site uses *TT Neoris* (a trial font); Helm substitutes
      **Hanken Grotesk** (free, variable). No action needed to ship, but if you license
      TT Neoris, swap it in.
- [ ] **Copyrighted artwork:** the pixel-art / icon PNGs in `public/` were **mirrored
      from the live site** for fidelity and are **copyrighted**. **Replace them with
      original artwork before any public deployment.**
- [x] **Honesty pass on copy:** the catalog ships **208 skills**. The Skills-tab search
      placeholder now renders the live count from `/api/skills` (the prior "1,500+"
      string was removed). Swept the rest of the UI + marketing copy — no other hardcoded
      catalog claim; the only count strings (`components/app/SkillsTab.tsx`) are both
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
| `COMPUTER_USE` / `CLAUDE_CODE` | **No — keep unset** | disabled (good) |
| Private uploads bucket + signed URLs | Recommended | public bucket |
| `HELM_RATELIMIT_PER_MIN` | Optional | 20 / min / workspace (per instance) |
| `HELM_ALLOW_OPEN_WRITES` | **Discouraged** | unset (writes stay protected) |
| Replace `public/` artwork & stale copy | **Yes** | copyrighted / overstated |
