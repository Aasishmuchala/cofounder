-- ============================================================================
-- 0001_hardening.sql — Row-Level Security (defense-in-depth) for Cofounder
-- ============================================================================
--
-- SECURITY MODEL — "service role + app filter":
--   The Cofounder server is the ONLY legitimate database client. It connects
--   with the Supabase SERVICE-ROLE key (SUPABASE_KEY), which BYPASSES RLS, and
--   does all per-workspace authorization in application code (see lib/auth.ts:
--   authorizeWrite + the per-workspace edit_key, and the unguessable-id
--   capability model for public reads).
--
--   RLS here is DEFENSE-IN-DEPTH, not the primary control. Its job is to ensure
--   that a LEAKED publishable / anon key (the kind that ships to browsers in
--   many Supabase apps) — or any direct `authenticated` connection — can NEITHER
--   READ NOR WRITE these tables. With RLS enabled and NO permissive policy for
--   those roles, every anon/authenticated query matches zero rows and every
--   write is rejected. The service role is unaffected and keeps working.
--
-- IDEMPOTENT: safe to run repeatedly. `ENABLE ROW LEVEL SECURITY` is naturally
--   idempotent; each policy is dropped-if-exists then recreated. Tables are
--   guarded with to_regclass so this file no-ops cleanly if a table is absent.
--
-- NOT APPLIED to any live database by this change — this is a SQL file only,
--   intended to be run via `supabase db push` / the SQL editor at deploy time.
-- ----------------------------------------------------------------------------

do $$
declare
  tbl text;
  tables text[] := array[
    'cofounder_workspaces',
    'cofounder_tasks',
    'cofounder_artifacts',
    'cofounder_skills'
  ];
begin
  foreach tbl in array tables loop
    -- Skip cleanly if the table doesn't exist in this database.
    if to_regclass('public.' || tbl) is null then
      raise notice 'skipping %, table does not exist', tbl;
      continue;
    end if;

    -- 1) Turn RLS on. With RLS enabled and no permissive policy, non-superuser /
    --    non-bypass roles (anon, authenticated) are denied by default.
    execute format('alter table public.%I enable row level security;', tbl);

    -- 2) FORCE RLS so it also applies to the table owner (belt-and-suspenders;
    --    the service role bypasses RLS via its role attribute regardless).
    execute format('alter table public.%I force row level security;', tbl);

    -- 3) Explicit deny-all policies for the client-exposed roles. These are
    --    redundant with the default-deny of an RLS-enabled table with no
    --    permissive policy, but they make the intent explicit and survive
    --    someone later adding a broad policy: a USING (false) / WITH CHECK
    --    (false) policy can never grant access. Dropped-then-created => idempotent.
    execute format('drop policy if exists %I on public.%I;', tbl || '_deny_anon', tbl);
    execute format(
      'create policy %I on public.%I as restrictive for all to anon using (false) with check (false);',
      tbl || '_deny_anon', tbl
    );

    execute format('drop policy if exists %I on public.%I;', tbl || '_deny_authenticated', tbl);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (false) with check (false);',
      tbl || '_deny_authenticated', tbl
    );
  end loop;
end $$;

-- Optional hardening: revoke direct table grants from the exposed roles so they
-- can't even attempt a query (RLS already blocks the rows, this removes the
-- privilege entirely). Wrapped in a guard so a missing table is a no-op.
do $$
declare
  tbl text;
  tables text[] := array[
    'cofounder_workspaces',
    'cofounder_tasks',
    'cofounder_artifacts',
    'cofounder_skills'
  ];
begin
  foreach tbl in array tables loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;
    execute format('revoke all on public.%I from anon;', tbl);
    execute format('revoke all on public.%I from authenticated;', tbl);
  end loop;
end $$;
