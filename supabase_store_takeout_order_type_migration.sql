-- Give in-store takeout orders an explicit order_type value.
-- Previously the POS saved takeout as "pickup", which is also used by online orders.
-- Run this once in Supabase SQL Editor after deploying the updated POS code.

update public.orders
set order_type = 'takeout'
where order_source = 'store'
  and order_type = 'pickup';

notify pgrst, 'reload schema';
