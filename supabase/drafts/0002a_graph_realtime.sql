-- ============================================================================
-- APPLIED 2026-10-01 to the cadence project as migration "cadence_graph_realtime".
-- Backfilled into the repo on 2026-10-07, copied from
-- supabase_migrations.schema_migrations. Needs 0001_graph_core.sql first.
-- ============================================================================

-- Let other devices be woken by changes to the graph tables (same as the existing cadence_* sync tables).
alter publication supabase_realtime add table public.cadence_nodes, public.cadence_links, public.cadence_occurrences;
