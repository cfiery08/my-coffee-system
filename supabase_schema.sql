-- =============================================
-- BREWORA COFFEE SHOP - SUPABASE SCHEMA
-- =============================================

-- 1. USER ACCOUNT (extends Supabase auth.users)
create table if not exists public.user_accounts (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  password text,
  contact_number text,
  role text not null default 'customer', -- 'customer', 'cashier', 'admin'
  avatar_url text,
  created_at timestamptz default now()
);

-- 2. ADDRESSES (customer delivery addresses)
create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_accounts(id) on delete cascade,
  label text, -- e.g. 'Home', 'Work'
  address_line text not null,
  city text not null,
  province text,
  postal_code text,
  latitude numeric,
  longitude numeric,
  is_default boolean default false,
  created_at timestamptz default now()
);

-- 3. CATEGORIES
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  is_active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 4. MENU ITEMS
create table menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2) not null,
  image_url text,
  is_available boolean default true,
  is_featured boolean default false,
  created_at timestamptz default now()
);

-- 5. MENU ITEM OPTIONS (e.g. size: small/medium/large, sugar level, etc.)
create table menu_item_options (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid references menu_items(id) on delete cascade,
  option_group text not null, -- e.g. 'Size', 'Sugar Level', 'Temperature'
  option_name text not null,  -- e.g. 'Large', '50%', 'Hot'
  additional_price numeric(10,2) default 0
);

-- 6. ORDERS
create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_accounts(id) on delete set null,
  order_type text not null, -- 'dine_in', 'pickup', 'delivery'
  status text not null default 'pending', -- 'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'
  payment_method text, -- 'cash', 'gcash', 'card'
  payment_status text default 'unpaid', -- 'unpaid', 'paid'
  subtotal numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) default 0,
  total_amount numeric(10,2) not null default 0,
  notes text,
  -- for dine in
  table_number text,
  -- for pickup / delivery
  scheduled_at timestamptz,
  -- for delivery
  delivery_address_id uuid references addresses(id) on delete set null,
  delivery_address_snapshot text, -- snapshot of address at time of order
  -- handled by
  cashier_id uuid references user_accounts(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 7. ORDER ITEMS
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  menu_item_name text not null, -- snapshot of name at time of order
  unit_price numeric(10,2) not null,
  quantity int not null default 1,
  subtotal numeric(10,2) not null,
  notes text -- e.g. 'less ice'
);

-- 8. ORDER ITEM OPTIONS (selected options per item)
create table order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid references order_items(id) on delete cascade,
  option_group text not null,
  option_name text not null,
  additional_price numeric(10,2) default 0
);

-- 9. ORDER STATUS HISTORY (track every status change)
create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  status text not null,
  changed_by uuid references user_accounts(id) on delete set null,
  note text,
  created_at timestamptz default now()
);

-- =============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_accounts (id, full_name, email, password, contact_number, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'password', ''),
    coalesce(new.raw_user_meta_data->>'contact_number', ''),
    'customer'
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    password = excluded.password,
    contact_number = excluded.contact_number;
  return new;
end;
$$ language plpgsql security definer set search_path = public, auth;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

grant usage on schema public to supabase_auth_admin;
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- =============================================
-- AUTO-UPDATE orders.updated_at
-- =============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger orders_updated_at
  before update on orders
  for each row execute procedure update_updated_at();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

alter table user_accounts enable row level security;
alter table addresses enable row level security;
alter table categories enable row level security;
alter table menu_items enable row level security;
alter table menu_item_options enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_item_options enable row level security;
alter table order_status_history enable row level security;

-- USER ACCOUNT
create policy "Users can view own profile" on user_accounts for select using (auth.uid() = id);
create policy "Users can update own profile" on user_accounts for update using (auth.uid() = id);
create policy "Admins can view all users" on user_accounts for select using (
  exists (select 1 from user_accounts where id = auth.uid() and role = 'admin')
);

-- ADDRESSES
create policy "Users manage own addresses" on addresses for all using (auth.uid() = user_id);

-- CATEGORIES & MENU (public read, admin write)
create policy "Anyone can view categories" on categories for select using (true);
create policy "Anyone can view menu items" on menu_items for select using (true);
create policy "Anyone can view menu options" on menu_item_options for select using (true);
create policy "Admins manage categories" on categories for all using (
  exists (select 1 from user_accounts where id = auth.uid() and role = 'admin')
);
create policy "Admins manage menu items" on menu_items for all using (
  exists (select 1 from user_accounts where id = auth.uid() and role = 'admin')
);
create policy "Admins manage menu options" on menu_item_options for all using (
  exists (select 1 from user_accounts where id = auth.uid() and role = 'admin')
);

-- ORDERS
create policy "Customers view own orders" on orders for select using (auth.uid() = user_id);
create policy "Customers create orders" on orders for insert with check (auth.uid() = user_id);
create policy "Customers cancel own pending orders" on orders for update
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status = 'cancelled');
create policy "Staff view all orders" on orders for select using (
  exists (select 1 from user_accounts where id = auth.uid() and role in ('cashier', 'staff', 'admin'))
);
create policy "Staff update orders" on orders for update using (
  exists (select 1 from user_accounts where id = auth.uid() and role in ('cashier', 'staff', 'admin'))
);

-- ORDER ITEMS
create policy "Customers view own order items" on order_items for select using (
  exists (select 1 from orders where id = order_items.order_id and user_id = auth.uid())
);
create policy "Customers create order items" on order_items for insert with check (
  exists (select 1 from orders where id = order_items.order_id and user_id = auth.uid())
);
create policy "Staff view all order items" on order_items for select using (
  exists (select 1 from user_accounts where id = auth.uid() and role in ('cashier', 'staff', 'admin'))
);

-- Cashier can insert orders (POS dine-in)
create policy "Cashier insert orders" on orders for insert with check (
  exists (select 1 from user_accounts where id = auth.uid() and role in ('cashier', 'admin'))
);
create policy "Cashier insert order items" on order_items for insert with check (
  exists (select 1 from user_accounts where id = auth.uid() and role in ('cashier', 'admin'))
);

-- ORDER STATUS HISTORY
create policy "Customers view own order history" on order_status_history for select using (
  exists (select 1 from orders where id = order_status_history.order_id and user_id = auth.uid())
);
create policy "Staff manage order history" on order_status_history for all using (
  exists (select 1 from user_accounts where id = auth.uid() and role in ('cashier', 'staff', 'admin'))
);

-- =============================================
-- SAMPLE CATEGORIES
-- =============================================
insert into categories (name, sort_order) values
  ('Coffee', 1),
  ('Non-Coffee', 2),
  ('Frappe', 3),
  ('Tea', 4),
  ('Pastries', 5);
