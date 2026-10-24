-- Remove tables that this app does not use.
-- Delivery addresses continue to be saved on orders.delivery_address_snapshot;
-- the old address lookup column/table are no longer needed.
-- Run once in the Supabase SQL Editor for the app's project.

begin;

alter table if exists public.orders
  drop column if exists delivery_address_id;

drop table if exists public.order_item_options;
drop table if exists public.menu_item_options;
drop table if exists public.addresses;

notify pgrst, 'reload schema';
commit;
