-- Run this in the Supabase SQL Editor for the same project used by the app.
-- The SECURITY DEFINER helper reads the signed-in user's role without being
-- blocked by user_accounts RLS while orders RLS is being evaluated.

create or replace function public.can_manage_orders()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_accounts ua
    where ua.id = (select auth.uid())
      and ua.role in ('cashier', 'staff', 'admin')
  );
$$;

revoke all on function public.can_manage_orders() from public, anon;
grant execute on function public.can_manage_orders() to authenticated;

-- Return only customer contact fields for orders staff can manage. This keeps
-- the rest of user_accounts hidden while letting order screens show the name.
create or replace function public.get_order_customer_profiles(order_ids uuid[])
returns table (order_id uuid, full_name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, ua.full_name, ua.email
  from public.orders o
  join public.user_accounts ua on ua.id = o.user_id
  where o.id = any(order_ids)
    and (select public.can_manage_orders());
$$;

revoke all on function public.get_order_customer_profiles(uuid[]) from public, anon;
grant execute on function public.get_order_customer_profiles(uuid[]) to authenticated;

drop policy if exists "Staff view all orders" on public.orders;
create policy "Staff view all orders" on public.orders
  for select to authenticated
  using ((select public.can_manage_orders()));

drop policy if exists "Staff update orders" on public.orders;
create policy "Staff update orders" on public.orders
  for update to authenticated
  using ((select public.can_manage_orders()))
  with check ((select public.can_manage_orders()));

drop policy if exists "Staff view all order items" on public.order_items;
create policy "Staff view all order items" on public.order_items
  for select to authenticated
  using ((select public.can_manage_orders()));

drop policy if exists "Staff manage order history" on public.order_status_history;
create policy "Staff manage order history" on public.order_status_history
  for all to authenticated
  using ((select public.can_manage_orders()))
  with check ((select public.can_manage_orders()));

-- Make the new RPC visible to PostgREST immediately.
notify pgrst, 'reload schema';
