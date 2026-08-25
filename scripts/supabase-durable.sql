-- Durable listings for Foresight Matchmaking (Vercel /tmp is only a cache).
-- Paste once into the Supabase SQL editor, then set SUPABASE_URL and
-- SUPABASE_SERVICE_ROLE_KEY on the Vercel project.
--
-- RLS is on with no policies: the anon key cannot read emails. The
-- service role (server-only) bypasses RLS.

create table if not exists public.durable_kv (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.durable_kv enable row level security;
