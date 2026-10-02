-- ============================================================================
-- DRAFT, not applied. Review, then run in the Supabase SQL editor.
-- Needs 0004_ai_layer.sql first (the AI switch lives in its ai_settings table).
--
-- Delete everything with a 7-day undo window.
--
-- One row per user. requested_at starts the window; purged_at is stamped by the
-- server when it has deleted the user's data. The row stays after the purge so a
-- device that was offline for the whole window still wipes its old local cache the
-- next time it syncs (see lib/deletion.ts) instead of uploading it again.
--
-- The owner can READ the row (sync checks it before every pull and push); only the
-- server (service role) writes it, through POST /api/account/deletion. The sign-in
-- account (auth.users) is deliberately kept; only the data is deleted.
--
-- Tables the purge empties for the user (server/utils/privacy.ts USER_DATA_TABLES):
-- cadence_tasks, cadence_projects, cadence_time_blocks, cadence_timer_sessions,
-- cadence_capacity, cadence_gamification, cadence_trips, cadence_habits,
-- cadence_brain_dump, cadence_kv, cadence_nodes, cadence_links, cadence_occurrences,
-- cadence_google_tokens, push_subscriptions, nudge_queue, ai_usage, ai_settings.
-- Add any new user-owned table to that list when you create it.
-- ============================================================================

create table if not exists public.deletion_requests (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  purged_at    timestamptz
);

alter table public.deletion_requests enable row level security;

create policy "deletion_requests_select_own" on public.deletion_requests
  for select using (auth.uid() = user_id);
-- No insert, update or delete policy: only the service role writes this table.
