-- ============================================================================
-- APPLIED 2026-10-01 to the cadence project as migration "cadence_nudges_push" (via the Supabase MCP).
-- The cron job needs the Vault secret (see the scheduler note at the bottom) before it can deliver.
--
-- Web push delivery infrastructure for nudges: subscriptions and the queue.
-- Source: .scratch/cadence-adhd-pivot/tickets/09 (nudges), 10 (architecture).
--
-- Decisions
--  * push_subscriptions: one row per (user_id, endpoint), since a user can
--    have multiple devices/browsers; deleting the endpoint on 404/410 is
--    application logic. No foreign key: a push subscription persists if the
--    user deletes their account and re-joins (by design).
--  * nudge_queue: the server's source of truth for what has been sent. A row
--    is never updated except by the dispatch job (via claim_due_nudges RPC);
--    a client cannot reset sent_at to resend. The id field is deterministic
--    from the nudge planner (lib/domain/nudges.ts), so the same nudge is
--    idempotent: if sent_at is already set, the queue claims step returns it
--    and dispatch skips it.
--  * kind is text with a CHECK constraint so nudge kinds can be added without
--    a migration.
--  * Row-level security: client can select/insert own rows only. The dispatch
--    job claims and marks rows sent via an RPC call, using the service role.
--  * No DELETE policy on nudge_queue: rows stay for the audit log. A "delete
--    old data" feature is application logic (the 7-day soft delete on captures
--    is already in the app; nudges are included there).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- push_subscriptions: the browsers and devices the user is subscribed on.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  endpoint   text        not null,
  -- PushSubscription.toJSON() keys: the p256dh and auth from the subscription.
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- No UPDATE: a client sends a new subscription if it changes.

-- ─────────────────────────────────────────────────────────────────────────
-- nudge_queue: the queue of nudges to send.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.nudge_queue (
  -- default auth.uid(): the client inserts rows without a user_id and RLS checks it.
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  kind       text        not null check (kind in ('leave_by', 'at_risk', 'transition', 'habit_summary')),
  title      text        not null,
  body       text        not null,
  tag        text        not null,
  fire_at    timestamptz not null,
  drop_after timestamptz not null,
  sent_at    timestamptz,
  primary key (user_id, id)
);

create index if not exists nudge_queue_fire_at_unsent_idx
  on public.nudge_queue (fire_at)
  where sent_at is null;

alter table public.nudge_queue enable row level security;

create policy "nudge_queue_select_own" on public.nudge_queue
  for select using (auth.uid() = user_id);
create policy "nudge_queue_insert_own" on public.nudge_queue
  for insert with check (auth.uid() = user_id);

-- No UPDATE and no DELETE policies: only the dispatch job modifies rows
-- (via claim_due_nudges RPC, using the service role).

-- ─────────────────────────────────────────────────────────────────────────
-- claim_due_nudges: atomic batch claim of rows to send.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.claim_due_nudges(batch int default 50)
returns table (
  user_id    uuid,
  id         text,
  kind       text,
  title      text,
  body       text,
  tag        text,
  fire_at    timestamptz,
  drop_after timestamptz
)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
begin
  return query
  with due as (
    select q.user_id, q.id
    from public.nudge_queue q
    where q.sent_at is null and q.fire_at <= now()
    order by q.fire_at
    limit batch
    for update skip locked
  )
  update public.nudge_queue n
  set sent_at = now()
  from due
  where n.user_id = due.user_id and n.id = due.id
  returning n.user_id, n.id, n.kind, n.title, n.body, n.tag, n.fire_at, n.drop_after;
end;
$$;

-- Only the server can call this; it bypasses RLS to claim rows across all users.
revoke execute on function public.claim_due_nudges(int) from public, anon, authenticated;
grant execute on function public.claim_due_nudges(int) to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- The scheduler: every minute, call the dispatch route with the shared secret.
-- The secret lives in Supabase Vault, never in this file. Store it once, with the
-- same value as NUDGE_CRON_SECRET in Vercel (run in the SQL editor):
--   select vault.create_secret('<the secret>', 'nudge_cron_secret');
-- Until it exists the job's calls are answered 401 and nothing is sent.
-- ─────────────────────────────────────────────────────────────────────────
select cron.schedule(
  'nudge_dispatch',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://cadence.skylerfly.com/api/nudges/dispatch',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-nudge-cron', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'nudge_cron_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 2000
  );
  $cron$
);
