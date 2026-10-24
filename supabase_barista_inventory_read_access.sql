-- Give baristas read-only access to inventory and menu ingredient recipes.
-- Run this script in the Supabase SQL Editor after the inventory tables exist.

begin;

create or replace function public.can_view_inventory()
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
      and ua.role in ('admin', 'staff', 'cashier', 'barista')
  );
$$;

revoke all on function public.can_view_inventory() from public, anon;
grant execute on function public.can_view_inventory() to authenticated;

alter table public.inventory enable row level security;
alter table public.menu_ingredients enable row level security;

drop policy if exists "Inventory visible to admin and staff" on public.inventory;
drop policy if exists "Inventory visible to admin, staff, and cashier" on public.inventory;
create policy "Inventory visible to admin, staff, and cashier" on public.inventory
  for select to authenticated
  using ((select public.can_view_inventory()));

drop policy if exists "Recipes visible to admin and staff" on public.menu_ingredients;
drop policy if exists "Recipes visible to admin, staff, and cashier" on public.menu_ingredients;
create policy "Recipes visible to admin, staff, and cashier" on public.menu_ingredients
  for select to authenticated
  using ((select public.can_view_inventory()));

grant select on public.inventory, public.menu_ingredients to authenticated;

notify pgrst, 'reload schema';
commit;
