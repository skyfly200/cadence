-- ============================================================================
-- APPLIED 2026-10-01 to the cadence project as migration "cadence_ai_layer" (via the Supabase MCP).
--
-- The AI layer's server-side state: the per-user AI switch and the usage log
-- behind the daily call cap. Written only by the server (service role); a
-- client may read its own rows but not change them, so a browser cannot raise
-- its own cap or flip the switch behind the app's back.
-- ============================================================================

create table if not exists public.ai_settings (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  ai_enabled boolean     not null default true,
  updated_at timestamptz not null default now()
);

alter table public.ai_settings enable row level security;
create policy "ai_settings_select_own" on public.ai_settings
  for select using (auth.uid() = user_id);

create table if not exists public.ai_usage (
  id      bigint generated always as identity primary key,
  user_id uuid        not null references auth.users (id) on delete cascade,
  used_at timestamptz not null default now(),
  tier    text        not null check (tier in ('fast', 'strong'))
);

create index if not exists ai_usage_user_time on public.ai_usage (user_id, used_at desc);

alter table public.ai_usage enable row level security;
create policy "ai_usage_select_own" on public.ai_usage
  for select using (auth.uid() = user_id);
