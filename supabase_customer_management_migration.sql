-- Let admins list existing customer profiles and activate/deactivate accounts.
-- Run this in Supabase SQL Editor after the base schema.

alter table public.user_accounts
  add column if not exists is_active boolean not null default true;

drop function if exists public.admin_list_existing_customer_accounts();
create function public.admin_list_existing_customer_accounts()
returns table (
  id uuid,
  full_name text,
  email text,
  contact_number text,
  created_at timestamptz,
  email_confirmed boolean,
  is_active boolean
)
language sql stable security definer set search_path = ''
as $$
  select ua.id, ua.full_name, ua.email, ua.contact_number, ua.created_at,
         (au.email_confirmed_at is not null), ua.is_active
  from public.user_accounts ua
  join auth.users au on au.id = ua.id
  where ua.role = 'customer'
    and exists (
      select 1 from public.user_accounts admin_account
      where admin_account.id = (select auth.uid()) and admin_account.role = 'admin'
    )
  order by ua.created_at desc;
$$;

create or replace function public.admin_set_customer_active(p_customer_id uuid, p_is_active boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.user_accounts admin_account
    where admin_account.id = (select auth.uid()) and admin_account.role = 'admin'
  ) then
    raise exception 'Only admins can manage customer accounts.';
  end if;
  update public.user_accounts
  set is_active = p_is_active
  where id = p_customer_id and role = 'customer';
  if not found then raise exception 'Customer account not found.'; end if;
end;
$$;

revoke all on function public.admin_list_existing_customer_accounts() from public, anon;
grant execute on function public.admin_list_existing_customer_accounts() to authenticated;
revoke all on function public.admin_set_customer_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_customer_active(uuid, boolean) to authenticated;

-- Notify active sessions when an admin changes an account's status.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_accounts'
  ) then
    alter publication supabase_realtime add table public.user_accounts;
  end if;
end;
$$;

notify pgrst, 'reload schema';
