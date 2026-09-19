-- Fix "Database error saving new user" during Supabase Auth signup.
-- Run this in Supabase SQL Editor for the same project used by .env.local.
-- This stores signup details in public.user_accounts.

create table if not exists public.user_accounts (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  password text,
  contact_number text,
  role text not null default 'customer',
  avatar_url text,
  created_at timestamptz default now()
);

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

-- Allow customers to cancel their own pending orders from My Orders.
drop policy if exists "Customers cancel own pending orders" on orders;
create policy "Customers cancel own pending orders" on orders
  for update
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status = 'cancelled');

-- Make address insert explicit for the checkout address selector.
drop policy if exists "Users insert own addresses" on addresses;
create policy "Users insert own addresses" on addresses
  for insert
  with check (auth.uid() = user_id);
