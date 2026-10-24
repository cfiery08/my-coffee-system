-- Customer cancellation is allowed for the first 10 seconds on non-GCash orders.
-- GCash orders cannot be cancelled through the customer order page.
-- Run this in Supabase SQL Editor after the existing cancellation migration.

begin;

drop policy if exists "Customers cancel own pending orders" on public.orders;
drop policy if exists "Customers cancel own pending online orders" on public.orders;
create policy "Customers cancel own pending online orders" on public.orders
  for update to authenticated
  using (
    auth.uid() = user_id
    and order_source = 'online'
    and status = 'pending'
    and lower(coalesce(payment_method, '')) <> 'gcash'
    and created_at > statement_timestamp() - interval '10 seconds'
  )
  with check (
    auth.uid() = user_id
    and order_source = 'online'
    and status = 'cancelled'
    and lower(coalesce(payment_method, '')) <> 'gcash'
    and created_at > statement_timestamp() - interval '10 seconds'
  );

commit;
