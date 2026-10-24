-- Restrict customer cancellation to the first 10 seconds after order creation.
-- Run this once in the Supabase SQL Editor for the project used by this app.

begin;

drop policy if exists "Customers cancel own pending orders" on public.orders;
create policy "Customers cancel own pending orders" on public.orders
  for update to authenticated
  using (
    auth.uid() = user_id
    and status = 'pending'
    and lower(coalesce(payment_method, '')) <> 'gcash'
    and created_at > statement_timestamp() - interval '10 seconds'
  )
  with check (
    auth.uid() = user_id
    and status = 'cancelled'
    and lower(coalesce(payment_method, '')) <> 'gcash'
    and created_at > statement_timestamp() - interval '10 seconds'
  );

commit;
