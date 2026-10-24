-- Add the account status field used by login and staff activation.
-- Run this in the Supabase SQL Editor for the project used by the app.

alter table public.user_accounts
  add column if not exists is_active boolean not null default true;

notify pgrst, 'reload schema';
