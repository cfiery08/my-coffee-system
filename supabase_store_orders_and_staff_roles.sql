-- Separate online orders from physical-store orders and scope staff access.
-- Store order preparation is handled by the barista role. Run in Supabase SQL Editor.

begin;

alter table public.user_accounts
  add column if not exists is_active boolean not null default true;

alter table public.orders
  add column if not exists order_source text not null default 'online'
  check (order_source in ('online', 'store'));

alter table public.orders
  add column if not exists customer_name text;

alter table public.orders
  add column if not exists contact_number text;

alter table public.orders
  add column if not exists cancellation_reason text;

-- Cashiers and baristas need read-only ingredient stock and recipe access.
create or replace function public.can_view_inventory()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_accounts ua
    where ua.id = (select auth.uid())
      and ua.role in ('admin', 'staff', 'cashier', 'barista')
  );
$$;

revoke all on function public.can_view_inventory() from public, anon;
grant execute on function public.can_view_inventory() to authenticated;

-- Recover walk-in names previously stored as "Customer: ..." in notes.
update public.orders
set customer_name = btrim(substring(notes from 'Customer: ([^\n]+)'))
where customer_name is null
  and notes ~ '(^|\n)Customer: ';

-- Move online checkout contact numbers out of notes into their own column.
update public.orders
set contact_number = btrim(substring(notes from 'Contact: ([^\n]+)')),
    notes = nullif(btrim(regexp_replace(notes, '(^|\n\n)Contact: [^\n]+', '', 'g')), '')
where notes ~ '(^|\n\n)Contact: ';

-- Existing dine-in/POS orders belong to the physical store. Other legacy orders
-- remain online orders.
update public.orders
set order_source = 'store'
where order_type = 'dine_in' or cashier_id is not null;

-- Store orders are served at the counter or table, so use completed rather
-- than the delivery-specific delivered status. Normalize existing store data.
drop index if exists public.store_active_dine_in_table_unique_idx;
update public.orders
set status = 'completed'
where order_source = 'store' and status = 'delivered';

update public.orders
set status = 'pending'
where order_source = 'store' and status = 'confirmed';

update public.order_status_history osh
set status = 'completed'
where osh.status = 'delivered'
  and exists (
    select 1 from public.orders o
    where o.id = osh.order_id and o.order_source = 'store'
  );

create index if not exists orders_source_created_at_idx
  on public.orders (order_source, created_at desc);

-- Reserve each dine-in table for one active store order. Completed and
-- cancelled orders release the table for the next customer.
create unique index store_active_dine_in_table_unique_idx
  on public.orders (table_number)
  where order_source = 'store'
    and order_type = 'dine_in'
    and table_number is not null
    and status not in ('completed', 'cancelled');

create or replace function public.can_access_order_source(p_order_source text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_accounts ua
    where ua.id = (select auth.uid())
      and (
        ua.role = 'admin'
        or (ua.role = 'staff' and p_order_source = 'online')
        or (ua.role in ('cashier', 'barista') and p_order_source = 'store')
      )
  );
$$;

revoke all on function public.can_access_order_source(text) from public, anon;
grant execute on function public.can_access_order_source(text) to authenticated;

create or replace function public.guard_order_source_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.order_source is distinct from old.order_source
     and not exists (
       select 1 from public.user_accounts ua
       where ua.id = (select auth.uid()) and ua.role = 'admin'
     ) then
    raise exception 'Only an administrator can change an order source.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_order_source_change on public.orders;
create trigger guard_order_source_change
before update of order_source on public.orders
for each row execute function public.guard_order_source_change();

create or replace function public.guard_store_order_staff_edits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.order_source = 'store'
     and old.status is distinct from 'cancelled'
     and new.status = 'cancelled'
     and nullif(btrim(new.cancellation_reason), '') is null then
    raise exception 'A reason is required to cancel a store order.';
  end if;

  if exists (
    select 1 from public.user_accounts ua
    where ua.id = (select auth.uid()) and ua.role = 'cashier'
  ) and (
    old.order_source is distinct from 'store'
    or old.cashier_id is distinct from (select auth.uid())
    or old.status is distinct from 'pending'
    or new.status is distinct from 'cancelled'
    or nullif(btrim(new.cancellation_reason), '') is null
    or (to_jsonb(new) - 'status' - 'cancellation_reason')
       is distinct from (to_jsonb(old) - 'status' - 'cancellation_reason')
  ) then
    raise exception 'Cashiers can only cancel their own pending store orders.';
  end if;

  if exists (
    select 1 from public.user_accounts ua
    where ua.id = (select auth.uid()) and ua.role = 'barista'
  ) and old.status is distinct from 'cancelled'
    and new.status = 'cancelled' then
    raise exception 'Baristas cannot cancel orders.';
  end if;

  if exists (
    select 1 from public.user_accounts ua
    where ua.id = (select auth.uid()) and ua.role = 'barista'
  ) and (
    new.order_source is distinct from old.order_source
    or new.order_type is distinct from old.order_type
    or new.user_id is distinct from old.user_id
    or new.payment_method is distinct from old.payment_method
    or new.payment_status is distinct from old.payment_status
    or new.subtotal is distinct from old.subtotal
    or new.delivery_fee is distinct from old.delivery_fee
    or new.total_amount is distinct from old.total_amount
    or new.notes is distinct from old.notes
    or new.customer_name is distinct from old.customer_name
    or new.contact_number is distinct from old.contact_number
    or new.table_number is distinct from old.table_number
    or new.cashier_id is distinct from old.cashier_id
    or new.created_at is distinct from old.created_at
    or (new.cancellation_reason is distinct from old.cancellation_reason
      and not (old.status is distinct from 'cancelled' and new.status = 'cancelled'
        and nullif(btrim(new.cancellation_reason), '') is not null))
  ) then
    raise exception 'Baristas can update order status only.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_store_order_staff_edits on public.orders;
create trigger guard_store_order_staff_edits
before update on public.orders
for each row execute function public.guard_store_order_staff_edits();

-- Keep the existing customer profile helper, but return names only for orders
-- that the signed-in staff role is allowed to see.
create or replace function public.get_order_customer_profiles(order_ids uuid[])
returns table (order_id uuid, full_name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, ua.full_name, ua.email
  from public.orders o
  join public.user_accounts ua on ua.id = o.user_id
  where o.id = any(order_ids)
    and (select public.can_access_order_source(o.order_source));
$$;

revoke all on function public.get_order_customer_profiles(uuid[]) from public, anon;
grant execute on function public.get_order_customer_profiles(uuid[]) to authenticated;

-- Drop this migration's policy names too, so rerunning the full file is safe.
drop policy if exists "Customers view own online orders" on public.orders;
drop policy if exists "Customers create online orders" on public.orders;
drop policy if exists "Customers cancel own pending online orders" on public.orders;
drop policy if exists "Staff view scoped orders" on public.orders;
drop policy if exists "Staff update scoped orders" on public.orders;
drop policy if exists "Cashiers cancel own pending store orders" on public.orders;
drop policy if exists "Cashier insert store orders" on public.orders;
drop policy if exists "Customers view own online order items" on public.order_items;
drop policy if exists "Customers create own online order items" on public.order_items;
drop policy if exists "Staff view scoped order items" on public.order_items;
drop policy if exists "Cashier insert store order items" on public.order_items;
drop policy if exists "Staff view scoped order history" on public.order_status_history;
drop policy if exists "Staff create scoped order history" on public.order_status_history;

drop policy if exists "Customers view own orders" on public.orders;
drop policy if exists "Customers create orders" on public.orders;
drop policy if exists "Customers cancel own pending orders" on public.orders;
create policy "Customers view own online orders" on public.orders
  for select to authenticated
  using (auth.uid() = user_id and order_source = 'online');
create policy "Customers create online orders" on public.orders
  for insert to authenticated
  with check (auth.uid() = user_id and order_source = 'online');
create policy "Customers cancel own pending online orders" on public.orders
  for update to authenticated
  using (auth.uid() = user_id and order_source = 'online' and status = 'pending'
    and lower(coalesce(payment_method, '')) <> 'gcash'
    and created_at > statement_timestamp() - interval '10 seconds')
  with check (auth.uid() = user_id and order_source = 'online' and status = 'cancelled'
    and lower(coalesce(payment_method, '')) <> 'gcash'
    and created_at > statement_timestamp() - interval '10 seconds');

drop policy if exists "Staff view all orders" on public.orders;
create policy "Staff view scoped orders" on public.orders
  for select to authenticated
  using ((select public.can_access_order_source(order_source)));

drop policy if exists "Staff update orders" on public.orders;
create policy "Staff update scoped orders" on public.orders
  for update to authenticated
  using (
    (select public.can_access_order_source(order_source))
    and exists (
      select 1 from public.user_accounts ua
      where ua.id = (select auth.uid()) and ua.role in ('admin', 'staff', 'barista')
    )
  )
  with check ((select public.can_access_order_source(order_source)));

create policy "Cashiers cancel own pending store orders" on public.orders
  for update to authenticated
  using (
    order_source = 'store'
    and cashier_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.user_accounts ua
      where ua.id = (select auth.uid()) and ua.role = 'cashier'
    )
  )
  with check (
    order_source = 'store'
    and cashier_id = (select auth.uid())
    and status = 'cancelled'
    and nullif(btrim(cancellation_reason), '') is not null
  );

drop policy if exists "Cashier insert orders" on public.orders;
create policy "Cashier insert store orders" on public.orders
  for insert to authenticated
  with check (
    order_source = 'store'
    and exists (
      select 1 from public.user_accounts ua
      where ua.id = (select auth.uid()) and ua.role in ('admin', 'cashier')
    )
  );

drop policy if exists "Customers view own order items" on public.order_items;
create policy "Customers view own online order items" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.user_id = (select auth.uid()) and o.order_source = 'online'
  ));

drop policy if exists "Customers create order items" on public.order_items;
create policy "Customers create own online order items" on public.order_items
  for insert to authenticated
  with check (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.user_id = (select auth.uid()) and o.order_source = 'online'
  ));

drop policy if exists "Staff view all order items" on public.order_items;
create policy "Staff view scoped order items" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (select public.can_access_order_source(o.order_source))
  ));

drop policy if exists "Cashier insert order items" on public.order_items;
create policy "Cashier insert store order items" on public.order_items
  for insert to authenticated
  with check (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.order_source = 'store'
      and exists (
        select 1 from public.user_accounts ua
        where ua.id = (select auth.uid()) and ua.role in ('admin', 'cashier')
      )
  ));

drop policy if exists "Staff manage order history" on public.order_status_history;
create policy "Staff view scoped order history" on public.order_status_history
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_status_history.order_id
      and (select public.can_access_order_source(o.order_source))
  ));
create policy "Staff create scoped order history" on public.order_status_history
  for insert to authenticated
  with check (exists (
    select 1 from public.orders o
    where o.id = order_status_history.order_id
      and (select public.can_access_order_source(o.order_source))
  ));

-- Admin staff management includes the store order updater role.
create or replace function public.admin_assign_staff_role(
  p_staff_id uuid,
  p_role text,
  p_full_name text,
  p_contact_number text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.user_accounts ua
    where ua.id = (select auth.uid()) and ua.role = 'admin'
  ) then
    raise exception 'Only admins can assign staff roles.';
  end if;
  if p_role not in ('cashier', 'barista', 'staff') then
    raise exception 'Invalid staff role.';
  end if;
  if not exists (
    select 1 from auth.users au
    where au.id = p_staff_id and au.email_confirmed_at is not null
  ) then
    raise exception 'Verify the staff email before assigning a staff role.';
  end if;

  update public.user_accounts
  set full_name = nullif(btrim(p_full_name), ''),
      contact_number = nullif(btrim(p_contact_number), ''),
      role = p_role,
      is_active = true
  where id = p_staff_id;
  if not found then raise exception 'The user profile was not created.'; end if;
end;
$$;

create or replace function public.admin_assign_staff_by_email(
  p_email text,
  p_role text,
  p_full_name text,
  p_contact_number text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff_id uuid;
begin
  if not exists (
    select 1 from public.user_accounts ua
    where ua.id = (select auth.uid()) and ua.role = 'admin'
  ) then
    raise exception 'Only admins can assign staff roles.';
  end if;
  select au.id into v_staff_id
  from auth.users au
  where lower(au.email) = lower(btrim(p_email))
    and au.email_confirmed_at is not null;
  if v_staff_id is null then
    raise exception 'No verified account was found for that email. Verify the email first.';
  end if;
  perform public.admin_assign_staff_role(v_staff_id, p_role, p_full_name, p_contact_number);
end;
$$;

create or replace function public.admin_list_existing_customer_accounts()
returns table (
  id uuid,
  full_name text,
  email text,
  contact_number text,
  created_at timestamptz,
  email_confirmed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select ua.id, ua.full_name, ua.email, ua.contact_number, ua.created_at,
         (au.email_confirmed_at is not null)
  from public.user_accounts ua
  join auth.users au on au.id = ua.id
  where ua.role = 'customer'
    and exists (
      select 1 from public.user_accounts current_user_account
      where current_user_account.id = (select auth.uid()) and current_user_account.role = 'admin'
    )
  order by ua.created_at desc;
$$;

create or replace function public.admin_set_staff_active(p_staff_id uuid, p_is_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.user_accounts ua
    where ua.id = (select auth.uid()) and ua.role = 'admin'
  ) then
    raise exception 'Only admins can manage staff activation.';
  end if;
  update public.user_accounts
  set is_active = p_is_active
  where id = p_staff_id and role in ('cashier', 'barista', 'staff');
  if not found then raise exception 'Staff account not found.'; end if;
end;
$$;

drop function if exists public.admin_list_staff();
create function public.admin_list_staff()
returns table (
  id uuid,
  full_name text,
  email text,
  contact_number text,
  created_at timestamptz,
  role text,
  is_active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select ua.id, ua.full_name, ua.email, ua.contact_number, ua.created_at, ua.role::text, ua.is_active
  from public.user_accounts ua
  where ua.role in ('cashier', 'barista', 'staff')
    and exists (
      select 1 from public.user_accounts current_user_account
      where current_user_account.id = (select auth.uid()) and current_user_account.role = 'admin'
    )
  order by ua.created_at desc;
$$;

revoke all on function public.admin_set_staff_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_staff_active(uuid, boolean) to authenticated;
revoke all on function public.admin_assign_staff_role(uuid, text, text, text) from public, anon;
grant execute on function public.admin_assign_staff_role(uuid, text, text, text) to authenticated;
revoke all on function public.admin_assign_staff_by_email(text, text, text, text) from public, anon;
grant execute on function public.admin_assign_staff_by_email(text, text, text, text) to authenticated;
revoke all on function public.admin_list_existing_customer_accounts() from public, anon;
grant execute on function public.admin_list_existing_customer_accounts() to authenticated;
revoke all on function public.admin_list_staff() from public, anon;
grant execute on function public.admin_list_staff() to authenticated;

-- Dashboard and reports subscribe to both the order header and its line items.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_items'
  ) then
    alter publication supabase_realtime add table public.order_items;
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
