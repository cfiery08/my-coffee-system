-- Allow one inventory movement per ingredient on an order item.
-- A menu recipe has multiple ingredients, so order_item_id alone must not be unique.
-- Run once in Supabase SQL Editor after the inventory setup has been installed.

begin;

drop index if exists public.inventory_movements_order_consumption_idx;
create unique index inventory_movements_order_consumption_idx
  on public.inventory_movements(order_item_id, inventory_id)
  where movement_type = 'order_consumption';

drop index if exists public.inventory_movements_order_return_idx;
create unique index inventory_movements_order_return_idx
  on public.inventory_movements(order_item_id, inventory_id)
  where movement_type = 'order_cancellation_return';

notify pgrst, 'reload schema';
commit;
