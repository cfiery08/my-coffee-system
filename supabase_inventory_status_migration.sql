-- Add Admin-managed ingredient availability and customer menu availability.
-- Run once in the Supabase SQL Editor for the project used by this app.

begin;

alter table public.inventory
  add column if not exists status text not null default 'available';

alter table public.inventory
  drop constraint if exists inventory_status_check;
alter table public.inventory
  add constraint inventory_status_check
  check (status in ('available', 'unavailable', 'low_stock'));

-- Return only menu item IDs, never inventory quantities or ingredient details.
create or replace function public.get_unavailable_menu_item_ids(p_menu_item_ids uuid[])
returns table (menu_item_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct mi.menu_item_id
  from public.menu_ingredients mi
  join public.inventory i on i.inventory_id = mi.inventory_id
  where mi.menu_item_id = any(coalesce(p_menu_item_ids, '{}'::uuid[]))
    and (i.status = 'unavailable' or i.quantity < mi.quantity_required);
$$;

revoke all on function public.get_unavailable_menu_item_ids(uuid[]) from public;
grant execute on function public.get_unavailable_menu_item_ids(uuid[]) to anon, authenticated;

-- Enforce Admin's unavailable status at order-item insertion, including items
-- already sitting in a customer's cart when the status changes.
create or replace function public.reject_unavailable_menu_order_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ingredient_name text;
begin
  select i.ingredient_name into v_ingredient_name
  from public.menu_ingredients mi
  join public.inventory i on i.inventory_id = mi.inventory_id
  where mi.menu_item_id = new.menu_item_id
    and i.status = 'unavailable'
  limit 1;

  if v_ingredient_name is not null then
    raise exception 'Cannot order %: % is currently unavailable.', new.menu_item_name, v_ingredient_name;
  end if;
  return new;
end;
$$;

drop trigger if exists reject_unavailable_menu_order_item on public.order_items;
create trigger reject_unavailable_menu_order_item
before insert on public.order_items
for each row execute function public.reject_unavailable_menu_order_item();

notify pgrst, 'reload schema';
commit;
