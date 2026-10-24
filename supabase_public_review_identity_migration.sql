-- Show a customer's own public review as "You" and other reviewers as "User".
-- Comments and ratings stay public; customer names remain private.
-- Run this in Supabase SQL Editor after the customer reviews migration.

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
  select
    case
      when r.customer_id = (select auth.uid()) then 'You'
      when nullif(btrim(ua.full_name), '') is null then 'Customer'
      else left(btrim(ua.full_name), 1) || '***'
    end,
    coalesce(r.customer_id = (select auth.uid()), false),
    r.rating::integer,
    r.would_order_again,
    r.comment,
    r.created_at
  from public.order_reviews r
  left join public.user_accounts ua on ua.id = r.customer_id
  order by r.created_at desc;
$$;

revoke all on function public.get_public_order_reviews() from public;
grant execute on function public.get_public_order_reviews() to anon, authenticated;

notify pgrst, 'reload schema';
