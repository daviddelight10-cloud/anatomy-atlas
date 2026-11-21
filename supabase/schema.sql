-- Anatomy Atlas — Premium subscriptions
-- Run once in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- Model: one row per successful Paystack purchase. A user is premium when
-- any of their rows has expires_at in the future. Rows are readable only by
-- their owner; only the verify-payment Edge Function (service role) writes.

create table if not exists public.subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  plan         text not null check (plan in ('monthly','semester','yearly')),
  paystack_ref text not null unique,
  amount_kobo  integer not null,
  purchased_at timestamptz not null default now(),
  expires_at   timestamptz not null
);

alter table public.subscriptions enable row level security;

-- Users may read their own purchases…
drop policy if exists "own rows" on public.subscriptions;
create policy "own rows" on public.subscriptions
  for select using (auth.uid() = user_id);

-- …but no insert/update/delete policies — only the service role can write.

create index if not exists subscriptions_user_idx
  on public.subscriptions (user_id, expires_at desc);

-- Table privileges — RLS policies alone are not enough; the API roles also
-- need grants or they get "permission denied for table subscriptions" (42501).
grant usage on schema public to service_role, authenticated;
grant select, insert, update, delete on public.subscriptions to service_role;
grant select on public.subscriptions to authenticated;
