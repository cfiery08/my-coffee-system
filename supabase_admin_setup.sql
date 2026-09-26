-- =============================================
-- BREWORA - CREATE ADMIN & CASHIER ACCOUNTS
-- =============================================
-- Run this in Supabase SQL Editor AFTER running supabase_schema.sql
-- and supabase_signup_fix.sql.
--
-- STEP 1: Go to Supabase Dashboard → Authentication → Users → Add User
--   Create the admin user with email/password there first.
--   Then run the UPDATE below to set their role to 'admin'.
--
-- STEP 2: Repeat for cashier accounts.
--
-- =============================================

-- After creating the user in Supabase Auth dashboard,
-- set their role to 'admin' using their email:
UPDATE public.user_accounts
SET role = 'admin'
WHERE email = 'admin@brewora.com';  -- replace with actual admin email

-- Set a cashier role (in-store, handles dine-in orders):
UPDATE public.user_accounts
SET role = 'cashier'
WHERE email = 'cashier@brewora.com';  -- replace with actual cashier email

-- Set a staff role (online orders: pickup & delivery):
UPDATE public.user_accounts
SET role = 'staff'
WHERE email = 'staff@brewora.com';  -- replace with actual staff email

-- =============================================
-- ALTERNATIVE: Use a function to create staff
-- directly from the admin panel (recommended).
-- The admin panel's "Add Staff" button uses
-- supabase.auth.signUp() and then sets role='cashier'.
-- =============================================

-- =============================================
-- RLS POLICIES — ensure staff can read all users
-- (needed for admin customers/staff pages)
-- =============================================

-- Allow admin to read all user_accounts
DROP POLICY IF EXISTS "Admins can view all users" ON user_accounts;
CREATE POLICY "Admins can view all users" ON user_accounts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow admin to update any user_account (for role changes)
DROP POLICY IF EXISTS "Admins can update all users" ON user_accounts;
CREATE POLICY "Admins can update all users" ON user_accounts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow admin to delete user_accounts
DROP POLICY IF EXISTS "Admins can delete users" ON user_accounts;
CREATE POLICY "Admins can delete users" ON user_accounts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow admin to insert user_accounts (for staff creation)
DROP POLICY IF EXISTS "Admins can insert users" ON user_accounts;
CREATE POLICY "Admins can insert users" ON user_accounts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow staff (cashier/staff/admin) to read all orders
DROP POLICY IF EXISTS "Staff view all orders" ON orders;
CREATE POLICY "Staff view all orders" ON orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role IN ('cashier', 'staff', 'admin'))
  );

-- Allow staff to update orders (status changes)
DROP POLICY IF EXISTS "Staff update orders" ON orders;
CREATE POLICY "Staff update orders" ON orders
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role IN ('cashier', 'staff', 'admin'))
  );

-- Allow cashier to INSERT orders (POS dine-in)
DROP POLICY IF EXISTS "Cashier insert orders" ON orders;
CREATE POLICY "Cashier insert orders" ON orders
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role IN ('cashier', 'admin'))
  );

-- Allow cashier to INSERT order items (POS)
DROP POLICY IF EXISTS "Cashier insert order items" ON order_items;
CREATE POLICY "Cashier insert order items" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role IN ('cashier', 'admin'))
  );

-- Allow cashier to INSERT order status history
DROP POLICY IF EXISTS "Cashier insert order status history" ON order_status_history;
CREATE POLICY "Cashier insert order status history" ON order_status_history
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role IN ('cashier', 'staff', 'admin'))
  );

-- Allow staff to delete orders (admin only)
DROP POLICY IF EXISTS "Admins delete orders" ON orders;
CREATE POLICY "Admins delete orders" ON orders
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow staff to read all order items
DROP POLICY IF EXISTS "Staff view all order items" ON order_items;
CREATE POLICY "Staff view all order items" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role IN ('cashier', 'admin'))
  );

-- Allow staff (cashier/staff/admin) to read all order items
DROP POLICY IF EXISTS "Staff view all order items" ON order_items;
CREATE POLICY "Staff view all order items" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role IN ('cashier', 'staff', 'admin'))
  );

-- Allow staff to manage order status history
DROP POLICY IF EXISTS "Staff manage order history" ON order_status_history;
CREATE POLICY "Staff manage order history" ON order_status_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role IN ('cashier', 'staff', 'admin'))
  );

-- Allow admin to manage categories
DROP POLICY IF EXISTS "Admins manage categories" ON categories;
CREATE POLICY "Admins manage categories" ON categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow admin to manage menu items
DROP POLICY IF EXISTS "Admins manage menu items" ON menu_items;
CREATE POLICY "Admins manage menu items" ON menu_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- STORAGE: Allow admin to upload menu images
-- Run this in Supabase Dashboard → Storage → Policies
-- or via SQL:
-- =============================================

-- Create the menu-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read menu images (public bucket)
DROP POLICY IF EXISTS "Public read menu images" ON storage.objects;
CREATE POLICY "Public read menu images" ON storage.objects
  FOR SELECT USING (bucket_id = 'menu-images');

-- Allow admins to upload menu images
DROP POLICY IF EXISTS "Admins upload menu images" ON storage.objects;
CREATE POLICY "Admins upload menu images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'menu-images' AND
    EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow admins to update/delete menu images
DROP POLICY IF EXISTS "Admins manage menu images" ON storage.objects;
CREATE POLICY "Admins manage menu images" ON storage.objects
  FOR ALL USING (
    bucket_id = 'menu-images' AND
    EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role = 'admin')
  );
