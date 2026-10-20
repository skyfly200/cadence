-- ============================================================================
-- APPLIED 2026-10-20 to the cadence project by hand in the Supabase SQL editor
-- (the Supabase MCP had no access to the project), so it has no migration name.
-- The delete-everything purge list in server/utils/privacy.ts names this table.
-- Needs 0006_deletion_hold.sql first (refuse_while_deleting()).
--
-- Encrypted access tokens for outside services (GitHub now; Vercel and Netlify
-- next), stored server-side only. Same model as cadence_google_tokens (0002):
--  * One row per user per service. Clients get NO access; only the server,
--    with the service role key, reads and writes. RLS on with no policies.
--  * blob is v1.<iv>.<tag>.<ciphertext> (AES-256-GCM, key CADENCE_TOKEN_KEY),
--    with "<user id>:<service>" as additional authenticated data, so a blob
--    copied to another user's row or another service fails to decrypt.
--  * label is not secret (the account name, e.g. the GitHub login), so
--    Settings can say "Linked as ..." without decrypting anything.
-- ============================================================================

create table if not exists public.cadence_service_tokens (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  service    text        not null check (service in ('github', 'vercel', 'netlify')),
  blob       text        not null,
  label      text,
  updated_at timestamptz not null default now(),
  primary key (user_id, service)
);

alter table public.cadence_service_tokens enable row level security;

-- Intentionally NO policies: clients cannot select, insert, update or delete.
revoke all on public.cadence_service_tokens from anon, authenticated;

-- Same deletion hold as 0006: no new tokens while a delete-everything request is pending.
drop trigger if exists refuse_while_deleting on public.cadence_service_tokens;
create trigger refuse_while_deleting before insert or update on public.cadence_service_tokens
  for each row execute function public.refuse_while_deleting();
