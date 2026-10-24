-- Keep manually unavailable menu items visible to customers with an Unavailable label.
-- Hide menu items that have a low-stock ingredient or cannot make one serving.
create or replace function public.get_low_stock_menu_item_ids(p_menu_item_ids uuid[])
returns table (menu_item_id uuid)
language sql stable security definer set search_path = ''
as $$
  select distinct mi.menu_item_id
  from public.menu_ingredients mi
  join public.inventory i on i.inventory_id = mi.inventory_id
  where mi.menu_item_id = any(coalesce(p_menu_item_ids, '{}'::uuid[]))
    and (i.status = 'low_stock' or i.quantity <= i.reorder_level or i.quantity < mi.quantity_required);
$$;

revoke all on function public.get_low_stock_menu_item_ids(uuid[]) from public;
grant execute on function public.get_low_stock_menu_item_ids(uuid[]) to anon, authenticated;

notify pgrst, 'reload schema';
