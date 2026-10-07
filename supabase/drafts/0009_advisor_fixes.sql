-- ============================================================================
-- APPLIED 2026-10-07 to the cadence project as migration "cadence_advisor_fixes" (via the Supabase MCP).
-- From the Supabase security and performance advisors. Changes no data: policies keep the same meaning, two indexes are
-- added, and client roles lose table grants they never used.
--
-- 1. auth_rls_initplan (30 policies): `auth.uid()` in a policy is re-run for
--    every row. Wrapping it as `(select auth.uid())` runs it once per query.
--    ALTER POLICY keeps each policy's name, command and roles.
-- 2. unindexed_foreign_keys: oauth_codes.grant_id and oauth_grants.client_id
--    back ON DELETE CASCADE foreign keys with no index.
-- 3. rls_enabled_no_policy on oauth_clients, oauth_codes, oauth_tokens: these
--    are written only by the server with the service role
--    (server/utils/oauth.ts). RLS with no policy already refuses anon and
--    authenticated; revoking their grants matches cadence_google_tokens (0002)
--    so a policy added by mistake later cannot expose them.
-- ============================================================================

-- ---- 1. Evaluate auth.uid() once per query --------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'cadence_tasks', 'cadence_projects', 'cadence_time_blocks', 'cadence_timer_sessions',
    'cadence_capacity', 'cadence_gamification', 'cadence_trips', 'cadence_habits',
    'cadence_brain_dump', 'cadence_kv'
  ] loop
    execute format(
      'alter policy own_rows on public.%I using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t
    );
  end loop;
end
$$;

alter policy "cadence_nodes_select_own" on public.cadence_nodes using ((select auth.uid()) = user_id);
alter policy "cadence_nodes_insert_own" on public.cadence_nodes with check ((select auth.uid()) = user_id);
alter policy "cadence_nodes_update_own" on public.cadence_nodes using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "cadence_nodes_delete_own" on public.cadence_nodes using ((select auth.uid()) = user_id);

alter policy "cadence_links_select_own" on public.cadence_links using ((select auth.uid()) = user_id);
alter policy "cadence_links_insert_own" on public.cadence_links with check ((select auth.uid()) = user_id);
alter policy "cadence_links_update_own" on public.cadence_links using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "cadence_links_delete_own" on public.cadence_links using ((select auth.uid()) = user_id);

alter policy "cadence_occurrences_select_own" on public.cadence_occurrences using ((select auth.uid()) = user_id);
alter policy "cadence_occurrences_insert_own" on public.cadence_occurrences with check ((select auth.uid()) = user_id);
alter policy "cadence_occurrences_delete_own" on public.cadence_occurrences using ((select auth.uid()) = user_id);

alter policy "push_subscriptions_select_own" on public.push_subscriptions using ((select auth.uid()) = user_id);
alter policy "push_subscriptions_insert_own" on public.push_subscriptions with check ((select auth.uid()) = user_id);
alter policy "push_subscriptions_delete_own" on public.push_subscriptions using ((select auth.uid()) = user_id);

alter policy "nudge_queue_select_own" on public.nudge_queue using ((select auth.uid()) = user_id);
alter policy "nudge_queue_insert_own" on public.nudge_queue with check ((select auth.uid()) = user_id);

alter policy "ai_settings_select_own" on public.ai_settings using ((select auth.uid()) = user_id);
alter policy "ai_usage_select_own" on public.ai_usage using ((select auth.uid()) = user_id);
alter policy "deletion_requests_select_own" on public.deletion_requests using ((select auth.uid()) = user_id);
alter policy "oauth_grants_select_own" on public.oauth_grants using ((select auth.uid()) = user_id);

-- ---- 2. Index the cascading foreign keys -----------------------------------

create index if not exists oauth_codes_grant on public.oauth_codes (grant_id);
create index if not exists oauth_grants_client on public.oauth_grants (client_id);

-- ---- 3. Server-only OAuth tables: no client grants ------------------------

revoke all on public.oauth_clients, public.oauth_codes, public.oauth_tokens from anon, authenticated;
