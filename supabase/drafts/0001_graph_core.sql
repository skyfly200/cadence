-- =====================================================================
-- DRAFT — NOT APPLIED. Review before running anywhere.
--
-- Life graph core tables for Cadence: nodes, links, occurrences.
-- Source: .scratch/cadence-adhd-pivot/tickets/03 (model), 10 (architecture),
-- 12 (trust). Nothing in this repo runs this file; there is no migration
-- runner wired up. Do not apply it to the live Supabase project without a
-- human review of the points below.
--
-- Decisions carried from the tickets
--  * Nodes stay JSON rows in one table with a `kind` column, matching the
--    existing sync engine (one row = one entity: user_id, id, data, updated_at).
--  * Links and occurrences get real columns because they are queried and
--    filtered (occurrences are append-only).
--  * Row-level security on every table, keyed by user_id (ticket 12).
--  * "Start fresh": these are NEW tables (cadence_nodes/links/occurrences).
--    The existing cadence_* tables are left untouched; nothing is migrated.
--
-- Open points to confirm before applying
--  1. No foreign keys between links/occurrences and nodes: the sync engine
--     pushes rows independently and out of order, so an FK would reject
--     valid pushes. Orphans are tolerated and cleaned up in application code.
--  2. occurrences: append-only. There is deliberately NO update policy and a
--     trigger blocks UPDATE. DELETE is allowed for the owner only because
--     ticket 12 requires "delete any date range", "forget older than a year"
--     and "delete everything" (the 7-day soft-delete window is application
--     logic and is NOT modelled here).
--  3. `kind`, `type`, `origin` and `source` are text with CHECK constraints
--     (not enums) so values can be added without a type migration.
--  4. Nothing here stores Google tokens; that server-side, encrypted store
--     is a separate change (ticket 12) and is not drafted yet.
-- =====================================================================

-- ---------------------------------------------------------------------
-- cadence_nodes: Goal | Habit | Commitment | Idea | Thing (JSON in `data`)
-- ---------------------------------------------------------------------
create table if not exists public.cadence_nodes (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  id         text        not null,
  kind       text        not null check (kind in ('goal', 'habit', 'commitment', 'idea', 'thing')),
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists cadence_nodes_user_kind_idx on public.cadence_nodes (user_id, kind);

alter table public.cadence_nodes enable row level security;

create policy "cadence_nodes_select_own" on public.cadence_nodes
  for select using (auth.uid() = user_id);
create policy "cadence_nodes_insert_own" on public.cadence_nodes
  for insert with check (auth.uid() = user_id);
create policy "cadence_nodes_update_own" on public.cadence_nodes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cadence_nodes_delete_own" on public.cadence_nodes
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- cadence_links: typed relationships with origin, confidence, evidence
-- ---------------------------------------------------------------------
create table if not exists public.cadence_links (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  id         text        not null,
  type       text        not null check (type in ('requires', 'needs', 'part_of', 'at', 'with')),
  from_id    text        not null,
  to_id      text        not null,
  origin     text        not null check (origin in ('stated', 'proposed_accepted', 'inferred')),
  confidence real        not null default 1 check (confidence >= 0 and confidence <= 1),
  evidence   jsonb       not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists cadence_links_user_from_idx on public.cadence_links (user_id, from_id);
create index if not exists cadence_links_user_to_idx   on public.cadence_links (user_id, to_id);

alter table public.cadence_links enable row level security;

create policy "cadence_links_select_own" on public.cadence_links
  for select using (auth.uid() = user_id);
create policy "cadence_links_insert_own" on public.cadence_links
  for insert with check (auth.uid() = user_id);
create policy "cadence_links_update_own" on public.cadence_links
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cadence_links_delete_own" on public.cadence_links
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- cadence_occurrences: append-only log (done, skipped, parked, moved,
-- started, captured, logged, undone). Skipped and moved are neutral.
-- ---------------------------------------------------------------------
create table if not exists public.cadence_occurrences (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  id         text        not null,
  node_id    text        not null,
  type       text        not null check (type in ('done', 'skipped', 'parked', 'moved', 'started', 'captured', 'logged', 'undone')),
  at         timestamptz not null,
  source     text        not null check (source in ('app', 'claude', 'gemini', 'grok')),
  undoes     text,
  note       text,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  check (type <> 'undone' or undoes is not null)
);

create index if not exists cadence_occurrences_user_node_at_idx on public.cadence_occurrences (user_id, node_id, at);
create index if not exists cadence_occurrences_user_at_idx      on public.cadence_occurrences (user_id, at);

alter table public.cadence_occurrences enable row level security;

create policy "cadence_occurrences_select_own" on public.cadence_occurrences
  for select using (auth.uid() = user_id);
create policy "cadence_occurrences_insert_own" on public.cadence_occurrences
  for insert with check (auth.uid() = user_id);
-- No update policy: the log is append-only.
create policy "cadence_occurrences_delete_own" on public.cadence_occurrences
  for delete using (auth.uid() = user_id);

-- Belt and braces: even a service-role caller cannot rewrite history.
create or replace function public.cadence_occurrences_block_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'cadence_occurrences is append-only: append an "undone" row instead of updating';
end;
$$;

drop trigger if exists cadence_occurrences_no_update on public.cadence_occurrences;
create trigger cadence_occurrences_no_update
  before update on public.cadence_occurrences
  for each row execute function public.cadence_occurrences_block_update();
