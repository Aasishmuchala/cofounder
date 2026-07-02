-- ============================================================================
-- 0003_drop_legacy_anon_policies.sql — remove permissive anon/authenticated RLS
-- ============================================================================
--
-- Migration 0001 established the intended posture: RLS ENABLED with NO permissive
-- policy for anon/authenticated, so a leaked publishable/anon key can neither read
-- nor write these tables (the app uses the SERVICE-ROLE key, which bypasses RLS,
-- and does all per-workspace authorization in application code — see lib/auth.ts).
--
-- But the live database still carried LEGACY blanket policies from an earlier
-- setup — `<table>_anon_all` and `helm_anon_all`, each `FOR ALL TO anon,
-- authenticated USING (true) WITH CHECK (true)` — which defeat that entirely:
-- anyone holding the (semi-public) anon key could read/write every workspace,
-- task, artifact, and skill directly, bypassing the edit-key capability model.
--
-- This drops those policies. AFTER this migration the tables are RLS-enabled with
-- zero permissive policies → anon/authenticated match zero rows and every write
-- is rejected, while the service role (the app's only DB credential) is
-- unaffected (it bypasses RLS via its role attribute).
--
-- SAFETY: the application connects with the service-role key, so its access does
-- NOT depend on these policies — dropping them does not change app behavior. If
-- writes fail after this, the deployment is (mis)configured with the ANON key as
-- SUPABASE_KEY; fix that instead of re-adding the policies.
--
-- IDEMPOTENT: drop-if-exists; safe to run repeatedly and on databases that never
-- had the legacy policies.
-- ----------------------------------------------------------------------------

do $$
declare
  tbl text;
  pol text;
  tables text[] := array[
    'cofounder_workspaces',
    'cofounder_tasks',
    'cofounder_artifacts',
    'cofounder_skills'
  ];
  policies text[];
begin
  foreach tbl in array tables loop
    if to_regclass('public.' || tbl) is null then
      raise notice 'skipping %, table does not exist', tbl;
      continue;
    end if;
    -- Belt-and-suspenders: RLS must be on (0001 does this too).
    execute format('alter table public.%I enable row level security;', tbl);
    execute format('alter table public.%I force row level security;', tbl);
    -- Drop EVERY policy currently granting anon/authenticated access on the table
    -- (covers both the `<table>_anon_all` and shared `helm_anon_all` names, plus
    -- any other permissive policy targeting those roles that may have accrued).
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = tbl
        and (roles::text[] && array['anon', 'authenticated'])
    loop
      execute format('drop policy if exists %I on public.%I;', pol, tbl);
      raise notice 'dropped policy % on %', pol, tbl;
    end loop;
  end loop;
end $$;
