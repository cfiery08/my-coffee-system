-- Customer order reviews, per-item thumbs ratings, menu summaries, and item
-- image snapshots for Brewora orders. Run once in the app's Supabase project.

begin;

-- Save the menu picture at purchase time so order history remains consistent
-- if the menu image is changed or the menu item is later removed.
alter table public.order_items
  add column if not exists image_url text;

update public.order_items oi
set image_url = mi.image_url
from public.menu_items mi
where oi.menu_item_id = mi.id
  and oi.image_url is null;

create table if not exists public.order_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  would_order_again boolean,
  comment text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_item_reviews (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  customer_id uuid not null references auth.users(id) on delete cascade,
  liked boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists order_reviews_created_at_idx on public.order_reviews(created_at desc);
create index if not exists order_item_reviews_menu_item_idx on public.order_item_reviews(menu_item_id);
create index if not exists order_item_reviews_created_at_idx on public.order_item_reviews(created_at desc);

alter table public.order_reviews enable row level security;
alter table public.order_item_reviews enable row level security;

create or replace function public.can_manage_customer_reviews()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_accounts ua
    where ua.id = (select auth.uid())
      and ua.role = 'admin'
  );
$$;
revoke all on function public.can_manage_customer_reviews() from public, anon;
grant execute on function public.can_manage_customer_reviews() to authenticated;

drop policy if exists "Customers read own order reviews" on public.order_reviews;
create policy "Customers read own order reviews" on public.order_reviews
  for select to authenticated using (customer_id = (select auth.uid()));
drop policy if exists "Staff read order reviews" on public.order_reviews;
drop policy if exists "Admins read order reviews" on public.order_reviews;
create policy "Admins read order reviews" on public.order_reviews
  for select to authenticated using ((select public.can_manage_customer_reviews()));

drop policy if exists "Customers read own item reviews" on public.order_item_reviews;
create policy "Customers read own item reviews" on public.order_item_reviews
  for select to authenticated using (customer_id = (select auth.uid()));
drop policy if exists "Staff read item reviews" on public.order_item_reviews;
drop policy if exists "Admins read item reviews" on public.order_item_reviews;
create policy "Admins read item reviews" on public.order_item_reviews
  for select to authenticated using ((select public.can_manage_customer_reviews()));

grant select on public.order_reviews, public.order_item_reviews to authenticated;

-- A customer can review only their delivered order. A resubmission edits the
-- existing review rather than creating a second review for the same order.
create or replace function public.submit_order_review(
  p_order_id uuid,
  p_rating integer,
  p_would_order_again boolean,
  p_comment text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := (select auth.uid());
begin
  if v_customer_id is null then raise exception 'Sign in to submit a review.'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Choose a rating from 1 to 5 stars.'; end if;
  if char_length(coalesce(p_comment, '')) > 1000 then raise exception 'Review comments must be 1000 characters or fewer.'; end if;
  if not exists (
    select 1 from public.orders o
    where o.id = p_order_id and o.user_id = v_customer_id and o.status = 'delivered'
  ) then raise exception 'Only your delivered orders can be reviewed.'; end if;

  insert into public.order_reviews(order_id, customer_id, rating, would_order_again, comment)
  values (p_order_id, v_customer_id, p_rating, p_would_order_again, coalesce(p_comment, ''))
  on conflict (order_id) do update set
    rating = excluded.rating,
    would_order_again = excluded.would_order_again,
    comment = excluded.comment,
    updated_at = now()
  where public.order_reviews.customer_id = v_customer_id;
end;
$$;

-- A customer can rate each purchased item once per order. Repeated submission
-- updates that vote and cannot target an item from another customer's order.
create or replace function public.submit_order_item_review(p_order_item_id uuid, p_liked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := (select auth.uid());
  v_order_id uuid;
  v_menu_item_id uuid;
begin
  if v_customer_id is null then raise exception 'Sign in to rate menu items.'; end if;
  select o.id, oi.menu_item_id into v_order_id, v_menu_item_id
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.id = p_order_item_id and o.user_id = v_customer_id and o.status = 'delivered';
  if not found then raise exception 'Only items from your delivered orders can be rated.'; end if;

  insert into public.order_item_reviews(order_item_id, order_id, menu_item_id, customer_id, liked)
  values (p_order_item_id, v_order_id, v_menu_item_id, v_customer_id, p_liked)
  on conflict (order_item_id) do update set
    liked = excluded.liked,
    created_at = now()
  where public.order_item_reviews.customer_id = v_customer_id;
end;
$$;

revoke all on function public.submit_order_review(uuid, integer, boolean, text) from public, anon;
revoke all on function public.submit_order_item_review(uuid, boolean) from public, anon;
grant execute on function public.submit_order_review(uuid, integer, boolean, text) to authenticated;
grant execute on function public.submit_order_item_review(uuid, boolean) to authenticated;

-- Public menu feedback contains no email or full customer name.
-- Drop first so this remains rerunnable if an earlier draft included order_id.
drop function if exists public.get_public_order_reviews();
create or replace function public.get_public_order_reviews()
returns table (
  customer_name text,
  is_own boolean,
  rating integer,
  would_order_again boolean,
  comment text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select case when r.customer_id = (select auth.uid()) then 'You'
         when nullif(btrim(ua.full_name), '') is null then 'Customer'
         else left(btrim(ua.full_name), 1) || '***' end,
    coalesce(r.customer_id = (select auth.uid()), false),
    r.rating::integer, r.would_order_again, r.comment, r.created_at
  from public.order_reviews r
  left join public.user_accounts ua on ua.id = r.customer_id
  order by r.created_at desc;
$$;

create or replace function public.get_menu_item_review_summary(p_menu_item_ids uuid[])
returns table (menu_item_id uuid, thumbs_up bigint, thumbs_down bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.menu_item_id,
    count(*) filter (where r.liked) as thumbs_up,
    count(*) filter (where not r.liked) as thumbs_down
  from public.order_item_reviews r
  where r.menu_item_id = any(coalesce(p_menu_item_ids, '{}'::uuid[]))
  group by r.menu_item_id;
$$;

-- Admin feedback inbox: one RPC for overall order reviews and one for
-- per-item votes. Customer names are masked here as well.
create or replace function public.list_order_reviews_for_staff()
returns table (
  order_id uuid,
  customer_name text,
  rating integer,
  would_order_again boolean,
  comment text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.order_id,
    case when nullif(btrim(ua.full_name), '') is null then 'Customer'
         else left(btrim(ua.full_name), 1) || '***' end,
    r.rating::integer, r.would_order_again, r.comment, r.created_at
  from public.order_reviews r
  left join public.user_accounts ua on ua.id = r.customer_id
  where (select public.can_manage_customer_reviews())
  order by r.created_at desc;
$$;

create or replace function public.list_item_reviews_for_staff()
returns table (
  order_item_id uuid,
  order_id uuid,
  menu_item_name text,
  image_url text,
  liked boolean,
  customer_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.order_item_id, r.order_id, oi.menu_item_name, oi.image_url, r.liked,
    case when nullif(btrim(ua.full_name), '') is null then 'Customer'
         else left(btrim(ua.full_name), 1) || '***' end,
    r.created_at
  from public.order_item_reviews r
  join public.order_items oi on oi.id = r.order_item_id
  left join public.user_accounts ua on ua.id = r.customer_id
  where (select public.can_manage_customer_reviews())
  order by r.created_at desc;
$$;

revoke all on function public.get_public_order_reviews() from public;
revoke all on function public.get_menu_item_review_summary(uuid[]) from public;
revoke all on function public.list_order_reviews_for_staff() from public, anon;
revoke all on function public.list_item_reviews_for_staff() from public, anon;
grant execute on function public.get_public_order_reviews() to anon, authenticated;
grant execute on function public.get_menu_item_review_summary(uuid[]) to anon, authenticated;
grant execute on function public.list_order_reviews_for_staff() to authenticated;
grant execute on function public.list_item_reviews_for_staff() to authenticated;

notify pgrst, 'reload schema';
commit;
