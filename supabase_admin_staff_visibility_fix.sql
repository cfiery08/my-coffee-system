-- Fix Admin > Manage Staff when user_accounts RLS blocks the direct query.
-- Run once in the Supabase SQL Editor for the same project used by the app.
-- Returns only cashier/staff rows, and only to a signed-in admin.

create or replace function public.admin_list_staff()
returns table (
  id uuid,
  full_name text,
  email text,
  contact_number text,
  created_at timestamptz,
  role text
)
language sql
stable
security definer
set search_path = ''
as $$
  select ua.id, ua.full_name, ua.email, ua.contact_number, ua.created_at, ua.role::text
  from public.user_accounts ua
  where ua.role in ('cashier', 'staff')
    and exists (
      select 1
      from public.user_accounts current_user_account
      where current_user_account.id = (select auth.uid())
        and current_user_account.role = 'admin'
    )
  order by ua.created_at desc;
$$;

revoke all on function public.admin_list_staff() from public, anon;
grant execute on function public.admin_list_staff() to authenticated;

notify pgrst, 'reload schema';
