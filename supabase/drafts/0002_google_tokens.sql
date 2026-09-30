-- ============================================================================
-- DRAFT. NOT APPLIED. Needs review before running against any database.
--
-- Encrypted Google Calendar tokens, stored server-side only.
-- See .scratch/cadence-adhd-pivot/tickets/12-trust-and-transparency-model.md
-- (Resolution: "Google Calendar tokens move to the server ... encrypted").
--
-- Access model: clients (anon / authenticated) get NO access at all. Only the
-- server, using the service role key, reads and writes this table. Row-level
-- security is enabled with no policies, so every non-service-role request is
-- denied; the revoke below is belt and braces.
-- ============================================================================

create table if not exists public.cadence_google_tokens (
  -- One connection per user. Deleting the auth user deletes their tokens
  -- (unlike the graph tables in 0001, this one is server-written only, so a
  -- foreign key cannot reject an out-of-order client sync).
  user_id    uuid primary key references auth.users (id) on delete cascade,

  -- v1.<iv>.<tag>.<ciphertext>, all base64url. AES-256-GCM with the user id
  -- as additional authenticated data, so a blob copied to another user's row
  -- fails to decrypt. The plaintext is JSON: access token, refresh token,
  -- expiry and email. The key (CADENCE_TOKEN_KEY) lives only in server env.
  blob       text not null,

  -- Not secret; lets the settings screen show "Linked as ..." without
  -- decrypting anything.
  email      text,

  updated_at timestamptz not null default now()
);

alter table public.cadence_google_tokens enable row level security;

-- Intentionally NO policies: clients cannot select, insert, update or delete.
revoke all on public.cadence_google_tokens from anon, authenticated;
