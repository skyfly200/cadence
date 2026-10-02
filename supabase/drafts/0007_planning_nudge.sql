-- ============================================================================
-- APPLIED 2026-10-02 to the cadence project as migration "cadence_planning_nudge" (via the Supabase MCP).
-- Needs 0003_nudges.sql first (it creates nudge_queue).
--
-- The weekly Planning session invitation is a new nudge kind, 'planning', sent
-- through the same nudge_queue and Web Push path as the others. nudge_queue.kind
-- has a CHECK constraint (0003) that only allows the four older kinds, so an
-- insert of a 'planning' row would be refused. This swaps the constraint for one
-- that includes it. Existing rows are unaffected.
--
-- The constraint was created inline in 0003, so Postgres named it
-- nudge_queue_kind_check; the drop uses "if exists" and a lookup by definition so
-- it also works if the name differs.
-- ============================================================================

do $$
declare
  c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.nudge_queue'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%habit_summary%'
  loop
    execute format('alter table public.nudge_queue drop constraint %I', c);
  end loop;
end
$$;

alter table public.nudge_queue
  add constraint nudge_queue_kind_check
  check (kind in ('leave_by', 'at_risk', 'transition', 'habit_summary', 'planning'));
