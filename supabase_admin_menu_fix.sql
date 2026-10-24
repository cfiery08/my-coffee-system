-- Run in the Supabase SQL Editor for the project used by this app.
-- Lets admin accounts manage categories and menu items.
-- The helper avoids RLS recursion when checking the admin role.

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_accounts ua
    where ua.id = (select auth.uid())
      and ua.role = 'admin'
  );
$$;

revoke all on function public.is_admin_user() from public, anon;
grant execute on function public.is_admin_user() to authenticated;

grant select, insert, update, delete on public.categories, public.menu_items to authenticated;

insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories" on public.categories
  for all to authenticated
  using ((select public.is_admin_user()))
  with check ((select public.is_admin_user()));

drop policy if exists "Admins manage menu items" on public.menu_items;
create policy "Admins manage menu items" on public.menu_items
  for all to authenticated
  using ((select public.is_admin_user()))
  with check ((select public.is_admin_user()));

-- Update this policy separately from any public image-read policy.
drop policy if exists "Admins manage menu images" on storage.objects;
create policy "Admins manage menu images" on storage.objects
  for all to authenticated
  using (bucket_id = 'menu-images' and (select public.is_admin_user()))
  with check (bucket_id = 'menu-images' and (select public.is_admin_user()));

notify pgrst, 'reload schema';
