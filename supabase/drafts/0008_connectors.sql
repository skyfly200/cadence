-- ============================================================================
-- DRAFT, not applied. Review, then run in the Supabase SQL editor.
-- Needs 0005_privacy.sql and 0006_deletion_hold.sql first (deletion_pending(), refuse_while_deleting()).
--
-- Assistant connectors (ticket 11): the OAuth server's state. Read the rules once:
--  * Tokens and codes are stored only as SHA-256 hashes; the secret is shown once, at issue.
--  * Everything is written by the server (service role). A signed-in user may READ their own
--    grants (so Settings could list them directly) and nothing else; there is no client write
--    policy on any table, so a browser cannot mint or revive a token.
--  * oauth_clients holds dynamic registrations (a name and the allowed redirect addresses). They
--    belong to no user, so they are not part of "delete everything".
--  * oauth_grants / oauth_codes / oauth_tokens are user data: they are in the deletion purge list
--    (server/utils/privacy.ts USER_DATA_TABLES) and get the same deletion-hold trigger as 0006.
--  * One grant per approval. Revoking sets revoked_at; every token check looks at it, so a
--    revoked connection stops working at once, refresh included.
-- ============================================================================

create table if not exists public.oauth_clients (
  client_id     text        primary key,
  client_name   text        not null,
  redirect_uris text[]      not null,
  created_at    timestamptz not null default now()
);
alter table public.oauth_clients enable row level security;
-- No policies: only the service role touches this table.

create table if not exists public.oauth_grants (
  id           text        primary key,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  client_id    text        not null references public.oauth_clients (client_id) on delete cascade,
  client_name  text        not null,
  scope        text        not null check (scope in ('read', 'write', 'read write')),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index if not exists oauth_grants_user on public.oauth_grants (user_id, created_at desc);
alter table public.oauth_grants enable row level security;
create policy "oauth_grants_select_own" on public.oauth_grants
  for select using (auth.uid() = user_id);

create table if not exists public.oauth_codes (
  code_hash    text        primary key,
  grant_id     text        not null references public.oauth_grants (id) on delete cascade,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  client_id    text        not null,
  redirect_uri text        not null,
  challenge    text        not null,
  scope        text        not null,
  expires_at   timestamptz not null,
  used_at      timestamptz
);
create index if not exists oauth_codes_user on public.oauth_codes (user_id);
alter table public.oauth_codes enable row level security;
-- No policies: server only.

create table if not exists public.oauth_tokens (
  token_hash  text        primary key,
  kind        text        not null check (kind in ('access', 'refresh')),
  grant_id    text        not null references public.oauth_grants (id) on delete cascade,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  expires_at  timestamptz not null,
  replaced_at timestamptz
);
create index if not exists oauth_tokens_user on public.oauth_tokens (user_id);
create index if not exists oauth_tokens_grant on public.oauth_tokens (grant_id);
alter table public.oauth_tokens enable row level security;
-- No policies: server only.

-- ─────────────────────────────────────────────────────────────────────────
-- Same deletion hold as 0006: while a delete-everything request is pending, no new grants,
-- codes or tokens can be written for that user.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['oauth_grants', 'oauth_codes', 'oauth_tokens'] loop
    execute format('drop trigger if exists refuse_while_deleting on public.%I', t);
    execute format(
      'create trigger refuse_while_deleting before insert or update on public.%I for each row execute function public.refuse_while_deleting()',
      t
    );
  end loop;
end
$$;

-- Housekeeping, optional: expired codes and tokens can be deleted any time, e.g. nightly.
--   delete from public.oauth_codes  where expires_at < now() - interval '1 day';
--   delete from public.oauth_tokens where expires_at < now() - interval '1 day';
