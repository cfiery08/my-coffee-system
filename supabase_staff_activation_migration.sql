-- Add Admin-controlled activation for staff and cashier accounts.
-- Run this in the Supabase SQL Editor for the app's project.

begin;

alter table public.user_accounts
  add column if not exists is_active boolean not null default true;

-- Prevent account owners from reactivating themselves through a direct update.
create or replace function public.guard_staff_activation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active is distinct from old.is_active
     and not exists (
       select 1 from public.user_accounts admin_account
       where admin_account.id = (select auth.uid())
         and admin_account.role = 'admin'
     ) then
    raise exception 'Only an admin can activate or deactivate staff accounts.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_staff_activation_change on public.user_accounts;
create trigger guard_staff_activation_change
before update of is_active on public.user_accounts
for each row execute function public.guard_staff_activation_change();

create or replace function public.admin_set_staff_active(p_staff_id uuid, p_is_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.user_accounts admin_account
    where admin_account.id = (select auth.uid())
      and admin_account.role = 'admin'
  ) then
    raise exception 'Only admins can manage staff activation.';
  end if;

  update public.user_accounts
  set is_active = p_is_active
  where id = p_staff_id
    and role in ('cashier', 'staff');

  if not found then
    raise exception 'Staff or cashier account not found.';
  end if;
end;
$$;

revoke all on function public.admin_set_staff_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_staff_active(uuid, boolean) to authenticated;

-- Recreate the list RPC with the activation flag for the Admin page.
drop function if exists public.admin_list_staff();
create function public.admin_list_staff()
returns table (
  id uuid,
  full_name text,
  email text,
  contact_number text,
  created_at timestamptz,
  role text,
  is_active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select ua.id, ua.full_name, ua.email, ua.contact_number, ua.created_at, ua.role::text, ua.is_active
  from public.user_accounts ua
  where ua.role in ('cashier', 'staff')
    and exists (
      select 1 from public.user_accounts current_user_account
      where current_user_account.id = (select auth.uid())
        and current_user_account.role = 'admin'
    )
  order by ua.created_at desc;
$$;

revoke all on function public.admin_list_staff() from public, anon;
grant execute on function public.admin_list_staff() to authenticated;

notify pgrst, 'reload schema';
commit;
