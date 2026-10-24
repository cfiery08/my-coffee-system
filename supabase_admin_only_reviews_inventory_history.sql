-- Restrict customer review management and inventory movement history to admins.
-- Run this in the Supabase SQL Editor for an existing project.

create or replace function public.can_manage_customer_reviews()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_accounts ua
    where ua.id = (select auth.uid())
      and ua.role = 'admin'
  );
$$;

revoke all on function public.can_manage_customer_reviews() from public, anon;
grant execute on function public.can_manage_customer_reviews() to authenticated;

drop policy if exists "Staff read order reviews" on public.order_reviews;
drop policy if exists "Admins read order reviews" on public.order_reviews;
create policy "Admins read order reviews" on public.order_reviews
  for select to authenticated using ((select public.can_manage_customer_reviews()));

drop policy if exists "Staff read item reviews" on public.order_item_reviews;
drop policy if exists "Admins read item reviews" on public.order_item_reviews;
create policy "Admins read item reviews" on public.order_item_reviews
  for select to authenticated using ((select public.can_manage_customer_reviews()));

drop policy if exists "Inventory movement history visible to admin and staff" on public.inventory_movements;
drop policy if exists "Inventory movement history visible to admin" on public.inventory_movements;
create policy "Inventory movement history visible to admin" on public.inventory_movements
  for select to authenticated using ((select public.is_inventory_admin()));

notify pgrst, 'reload schema';
