-- ============================================================================
-- 0002_occ_rate_limit.sql — multi-instance safety for Cofounder/Helm
-- ============================================================================
--
-- Fixes the two documented single-instance caveats (see LAUNCH.md):
--
--   1. OPTIMISTIC CONCURRENCY for workspace meta. The meta jsonb is updated by
--      a read-modify-write serialized only by an in-process mutex
--      (withWorkspaceLock), so across two instances concurrent writers could
--      lose updates (last-write-wins). `meta_version` gives the app a compare-
--      and-swap: PATCH ... ?meta_version=eq.<seen> with meta_version=<seen>+1
--      matches 0 rows on conflict, and the app re-reads + retries.
--
--   2. DISTRIBUTED RATE LIMITING. The in-memory sliding window is per-instance
--      (limit multiplies with instance count; resets on deploy). The
--      `cofounder_rate_limit` RPC is an ATOMIC fixed-window counter in
--      Postgres shared by every instance. The app calls it AFTER the local
--      limiter (cheap first line) and fails open if the RPC is absent/erroring
--      — the local limiter still applies.
--
-- IDEMPOTENT: safe to run repeatedly. Backward/forward compatible: the app
-- feature-detects both (missing column / missing function ⇒ legacy behavior),
-- so deploys and databases can migrate in either order.
-- ----------------------------------------------------------------------------

-- 1) OCC version column ------------------------------------------------------
do $$
begin
  if to_regclass('public.cofounder_workspaces') is null then
    raise notice 'skipping meta_version, cofounder_workspaces does not exist';
  else
    execute 'alter table public.cofounder_workspaces add column if not exists meta_version bigint not null default 0';
  end if;
end $$;

-- 2) Shared rate-limit state --------------------------------------------------
create table if not exists public.cofounder_rate_limits (
  key          text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (key, window_start)
);

alter table public.cofounder_rate_limits enable row level security;
alter table public.cofounder_rate_limits force row level security;
-- No policies on purpose: anon/authenticated match nothing; the service role
-- (the app's only credential) bypasses RLS. Mirrors 0001_hardening.sql.
revoke all on public.cofounder_rate_limits from anon, authenticated;

-- Atomic fixed-window check-and-increment. Returns the row's post-increment
-- state so the app can compute `allowed` and Retry-After without a race:
--   allowed  := hits <= p_limit
--   retry_ms := ms until the current window ends (when blocked)
-- Fixed-window (vs sliding) is deliberate: one upsert, no fan-out reads, and
-- the app's local sliding-window limiter already smooths the boundary case.
create or replace function public.cofounder_rate_limit(
  p_key       text,
  p_limit     integer,
  p_window_ms bigint
) returns table (allowed boolean, hits integer, retry_after_ms bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_hits integer;
begin
  -- Quantize now() onto the window grid so every instance agrees on the bucket.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) * 1000 / p_window_ms) * p_window_ms / 1000.0
  );

  insert into public.cofounder_rate_limits as rl (key, window_start, hits)
  values (p_key, v_window_start, 1)
  on conflict (key, window_start)
  do update set hits = rl.hits + 1
  returning rl.hits into v_hits;

  -- Opportunistic GC: drop this key's expired windows (bounded, index-assisted).
  delete from public.cofounder_rate_limits
  where key = p_key and window_start < v_window_start;

  return query select
    v_hits <= p_limit,
    v_hits,
    case when v_hits <= p_limit then 0::bigint
         else greatest(0, (extract(epoch from v_window_start) * 1000)::bigint + p_window_ms
                          - (extract(epoch from now()) * 1000)::bigint)
    end;
end;
$$;

-- The RPC runs as its owner (security definer); keep it off the public roles.
revoke all on function public.cofounder_rate_limit(text, integer, bigint) from public, anon, authenticated;
