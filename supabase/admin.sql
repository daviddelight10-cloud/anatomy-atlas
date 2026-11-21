-- Anatomy Atlas — admin dashboard support.
-- Run ONCE in the Supabase SQL editor, AFTER schema.sql.
--
-- Adds admin-only RPCs used by the standalone admin.html page. Each function
-- verifies the caller's email against ADMIN_EMAIL before doing anything.
-- Change ADMIN_EMAIL if the admin account ever changes.

create or replace function public._is_admin()
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'daviddelight10@gmail.com';
$$;

-- One row per registered user: identity + aggregated subscription state.
create or replace function public.admin_overview()
returns table (
  user_id         uuid,
  email           text,
  provider        text,
  signed_up       timestamptz,
  last_sign_in    timestamptz,
  purchases       bigint,
  total_paid_ngn  numeric,
  latest_expiry   timestamptz,
  days_left       integer,
  status          text
)
language plpgsql security definer
set search_path = public, auth
as $$
begin
  if not public._is_admin() then raise exception 'not admin'; end if;
  return query
    select
      u.id,
      u.email::text,
      coalesce(u.raw_app_meta_data ->> 'provider', 'email')::text,
      u.created_at,
      u.last_sign_in_at,
      count(s.id),
      (coalesce(sum(s.amount_kobo), 0) / 100)::numeric,
      max(s.expires_at),
      greatest(0, ceil(extract(epoch from (max(s.expires_at) - now())) / 86400))::int,
      case
        when max(s.expires_at) > now() then 'ACTIVE'
        when count(s.id) > 0           then 'expired'
        else 'free'
      end
    from auth.users u
    left join public.subscriptions s on s.user_id = u.id
    group by u.id
    order by max(s.expires_at) desc nulls last, u.created_at desc;
end;
$$;

-- Manually activate/extend a user's Premium by N days (stacks onto live expiry).
create or replace function public.admin_grant(p_user_id uuid, p_days integer default 30)
returns timestamptz
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_base timestamptz;
  v_exp  timestamptz;
begin
  if not public._is_admin() then raise exception 'not admin'; end if;
  if p_days is null or p_days < 1 or p_days > 3660 then
    raise exception 'invalid days (1-3660)';
  end if;
  select coalesce(max(s.expires_at), now()) into v_base
    from public.subscriptions s where s.user_id = p_user_id;
  v_base := greatest(v_base, now());
  v_exp  := v_base + make_interval(days => p_days);
  insert into public.subscriptions (user_id, plan, paystack_ref, amount_kobo, expires_at)
    values (p_user_id, 'manual', 'ADMIN-' || gen_random_uuid()::text, 0, v_exp);
  return v_exp;
end;
$$;

-- Deactivate a user's Premium now (expires all live rows; history is kept).
create or replace function public.admin_revoke(p_user_id uuid)
returns integer
language plpgsql security definer
set search_path = public, auth
as $$
declare n integer;
begin
  if not public._is_admin() then raise exception 'not admin'; end if;
  update public.subscriptions set expires_at = now()
    where user_id = p_user_id and expires_at > now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Allow the manual 'manual' plan written by admin_grant.
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('monthly','semester','yearly','manual'));

-- Only signed-in users may even call these; _is_admin() gates the data.
revoke execute on function public._is_admin() from public, anon;
revoke execute on function public.admin_overview() from public, anon;
revoke execute on function public.admin_grant(uuid, integer) from public, anon;
revoke execute on function public.admin_revoke(uuid) from public, anon;
grant execute on function public._is_admin() to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_grant(uuid, integer) to authenticated;
grant execute on function public.admin_revoke(uuid) to authenticated;

-- Every purchase row joined to the buyer's email; searchable by email or
-- paystack_ref substring. Powers the Transactions tab + purchase history.
create or replace function public.admin_transactions(p_search text default '')
returns table (
  id           uuid,
  user_id      uuid,
  email        text,
  plan         text,
  paystack_ref text,
  amount_kobo  integer,
  purchased_at timestamptz,
  expires_at   timestamptz
)
language plpgsql security definer
set search_path = public, auth
as $$
begin
  if not public._is_admin() then raise exception 'not admin'; end if;
  return query
    select s.id, s.user_id, u.email::text, s.plan, s.paystack_ref,
           s.amount_kobo, s.purchased_at, s.expires_at
    from public.subscriptions s
    join auth.users u on u.id = s.user_id
    where p_search = ''
       or u.email ilike '%' || p_search || '%'
       or s.paystack_ref ilike '%' || p_search || '%'
    order by s.purchased_at desc
    limit 500;
end;
$$;

revoke execute on function public.admin_transactions(text) from public, anon;
grant execute on function public.admin_transactions(text) to authenticated;
