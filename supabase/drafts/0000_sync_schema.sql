-- ============================================================================
-- APPLIED 2026-08-21 and 2026-08-22 to the cadence project as migrations
-- "cadence_sync_schema" and "harden_touch_search_path". Backfilled into the repo
-- on 2026-10-07, copied from supabase_migrations.schema_migrations, so a fresh
-- project can be rebuilt from this folder. Runs before 0001.
--
-- The original sync tables: one row per entity, payload in jsonb, RLS per user,
-- and Realtime so other devices see changes.
-- ============================================================================

-- ---- cadence_sync_schema ---------------------------------------------------

-- Shared updated_at trigger
create or replace function public.cadence_touch() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Per-collection tables: one row per entity, payload in jsonb, RLS per user.
do $$
declare t text;
declare tables text[] := array['tasks','projects','time_blocks','timer_sessions','capacity','gamification','trips','habits','brain_dump'];
begin
  foreach t in array tables loop
    execute format('create table if not exists public.cadence_%s (user_id uuid not null references auth.users(id) on delete cascade, id text not null, data jsonb not null, updated_at timestamptz not null default now(), primary key (user_id, id))', t);
    execute format('alter table public.cadence_%s enable row level security', t);
    execute format('drop policy if exists own_rows on public.cadence_%s', t);
    execute format('create policy own_rows on public.cadence_%s for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('drop trigger if exists touch on public.cadence_%s', t);
    execute format('create trigger touch before insert or update on public.cadence_%s for each row execute function public.cadence_touch()', t);
  end loop;
end $$;

-- Singletons (settings, planning_streak, notification_prefs) keyed by (user_id, key)
create table if not exists public.cadence_kv (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.cadence_kv enable row level security;
drop policy if exists own_rows on public.cadence_kv;
create policy own_rows on public.cadence_kv for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists touch on public.cadence_kv;
create trigger touch before insert or update on public.cadence_kv for each row execute function public.cadence_touch();

-- Enable Realtime for cross-device live updates
do $$
declare t text;
declare tables text[] := array['tasks','projects','time_blocks','timer_sessions','capacity','gamification','trips','habits','brain_dump','kv'];
begin
  foreach t in array tables loop
    begin
      execute format('alter publication supabase_realtime add table public.cadence_%s', t);
    exception when others then null;
    end;
  end loop;
end $$;

-- ---- harden_touch_search_path ----------------------------------------------

alter function public.cadence_touch() set search_path = '';
