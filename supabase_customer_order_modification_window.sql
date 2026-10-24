-- Let a customer remove a newly placed pending order from the 30-second
-- modification window. Stock is returned by the order-cancel trigger first,
-- then the temporary movement rows and order are deleted so the order does
-- not remain in customer or staff order history.
-- The existing regular cancellation policy can remain at 10 seconds.
-- Run once in the same Supabase project used by the app.

create or replace function public.cancel_order_for_modification(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to modify this order.';
  end if;

  update public.orders o
  set status = 'cancelled'
  where o.id = p_order_id
    and o.user_id = (select auth.uid())
    and o.status = 'pending'
    and o.payment_status = 'unpaid'
    and o.created_at > statement_timestamp() - interval '30 seconds';

  if not found then
    raise exception 'The modification window expired, or this order is no longer pending and unpaid.';
  end if;

  -- The status update above fires the inventory return trigger. Remove the
  -- temporary consumption/return ledger rows before deleting the order.
  delete from public.inventory_movements
  where order_id = p_order_id;

  delete from public.orders
  where id = p_order_id
    and user_id = (select auth.uid())
    and status = 'cancelled';
end;
$$;

revoke all on function public.cancel_order_for_modification(uuid) from public, anon;
grant execute on function public.cancel_order_for_modification(uuid) to authenticated;

notify pgrst, 'reload schema';
