-- ============================================================================
-- DRAFT, not applied. Review, then run in the Supabase SQL editor.
-- Needs 0003 (pg_cron, pg_net and the nudge_cron_secret Vault secret), 0004 and 0005 first.
--
-- 1. A server-side hold on "Delete everything". While a user's deletion request is
--    pending (a deletion_requests row with purged_at null), any INSERT or UPDATE on a
--    user-owned table is refused by the database itself. A trigger rather than row-level
--    security, because it must also stop the server's own service-role writes (capture,
--    push subscribe, AI usage, Google tokens), which RLS does not apply to. DELETE stays
--    allowed so the purge (and the owner's own deletes) can still empty the tables.
--    The client still stops pushing on its own (lib/sync.ts); this is the backstop for an
--    old client or a direct API call. A refused write surfaces as the error
--    'deletion_pending'; the routes already answer a failed write with a calm 503.
--
-- 2. The purge gets its own scheduler job and route (POST /api/account/purge), so it no
--    longer rides on the nudge dispatch call: it has its own time budget and works with
--    web push unconfigured. It purges a small batch per call (PURGE_BATCH).
--
-- Tables guarded = server/utils/privacy.ts USER_DATA_TABLES. Add any new user-owned
-- table to that list and to the array below.
-- ============================================================================

create or replace function public.deletion_pending(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.deletion_requests where user_id = uid and purged_at is null);
$$;

create or replace function public.refuse_while_deleting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.deletion_pending(new.user_id) then
    raise exception 'deletion_pending' using hint = 'This account has a delete-everything request waiting; writes resume if it is cancelled.';
  end if;
  return new;
end;
$$;

-- Not callable from the API: only the triggers use these.
revoke all on function public.deletion_pending(uuid) from public, anon, authenticated;
revoke all on function public.refuse_while_deleting() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'cadence_tasks', 'cadence_projects', 'cadence_time_blocks', 'cadence_timer_sessions',
    'cadence_capacity', 'cadence_gamification', 'cadence_trips', 'cadence_habits', 'cadence_brain_dump', 'cadence_kv',
    'cadence_nodes', 'cadence_links', 'cadence_occurrences',
    'cadence_google_tokens', 'push_subscriptions', 'nudge_queue',
    'ai_usage', 'ai_settings'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists refuse_while_deleting on public.%I', t);
      execute format(
        'create trigger refuse_while_deleting before insert or update on public.%I for each row execute function public.refuse_while_deleting()',
        t
      );
    end if;
  end loop;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- The purge job: every minute, same shared secret as the nudge job.
-- ─────────────────────────────────────────────────────────────────────────
select cron.schedule(
  'account_purge',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://cadence.skylerfly.com/api/account/purge',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-nudge-cron', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'nudge_cron_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
  $cron$
);
