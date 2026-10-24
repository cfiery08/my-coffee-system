-- Customer contact form submissions and the admin inbox.
-- Run this in the Supabase SQL Editor for the project used by the app.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  subject text not null default 'General inquiry',
  other_subject text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_messages_subject_check check (subject in ('General inquiry', 'Order support', 'Menu question', 'Feedback', 'Business inquiry', 'Other')),
  constraint contact_messages_other_subject_check check (subject <> 'Other' or nullif(btrim(other_subject), '') is not null)
);

create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from public, anon, authenticated;

create or replace function public.submit_contact_message(
  p_subject text,
  p_message text,
  p_other_subject text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_full_name text;
  v_email text;
  v_subject text := coalesce(nullif(btrim(p_subject), ''), 'General inquiry');
  v_other_subject text := nullif(btrim(p_other_subject), '');
  v_message text := btrim(coalesce(p_message, ''));
  v_message_id uuid;
begin
  if v_user_id is null then
    raise exception 'Please sign in with a customer account to send a message.';
  end if;

  select nullif(btrim(ua.full_name), ''), au.email
    into v_full_name, v_email
  from public.user_accounts ua
  join auth.users au on au.id = ua.id
  where ua.id = v_user_id and ua.role = 'customer';

  if v_email is null then
    raise exception 'A customer account profile could not be found.';
  end if;
  if v_subject not in ('General inquiry', 'Order support', 'Menu question', 'Feedback', 'Business inquiry', 'Other') then
    raise exception 'Please choose a valid subject.';
  end if;
  if v_subject = 'Other' and v_other_subject is null then
    raise exception 'Please describe the subject when choosing Other.';
  end if;
  if length(v_subject) > 80 or length(v_other_subject) > 100 then
    raise exception 'The subject is too long.';
  end if;
  if length(v_message) < 1 or length(v_message) > 3000 then
    raise exception 'Message must be between 1 and 3000 characters.';
  end if;

  insert into public.contact_messages (user_id, full_name, email, subject, other_subject, message)
  values (v_user_id, coalesce(v_full_name, 'Customer'), v_email, v_subject, v_other_subject, v_message)
  returning id into v_message_id;

  return v_message_id;
end;
$$;

revoke all on function public.submit_contact_message(text, text, text) from public, anon;
grant execute on function public.submit_contact_message(text, text, text) to authenticated;

create or replace function public.admin_list_contact_messages()
returns table (
  id uuid,
  full_name text,
  email text,
  subject text,
  other_subject text,
  message text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select cm.id, cm.full_name, cm.email, cm.subject, cm.other_subject, cm.message, cm.status, cm.created_at
  from public.contact_messages cm
  where exists (
    select 1 from public.user_accounts ua
    where ua.id = (select auth.uid()) and ua.role = 'admin'
  )
  order by cm.created_at desc;
$$;

revoke all on function public.admin_list_contact_messages() from public, anon;
grant execute on function public.admin_list_contact_messages() to authenticated;

create or replace function public.admin_update_contact_message_status(p_message_id uuid, p_status text)
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
    raise exception 'Only administrators can update contact message status.';
  end if;
  if p_status not in ('new', 'read', 'resolved') then
    raise exception 'Invalid contact message status.';
  end if;

  update public.contact_messages
  set status = p_status, updated_at = now()
  where id = p_message_id;
end;
$$;

revoke all on function public.admin_update_contact_message_status(uuid, text) from public, anon;
grant execute on function public.admin_update_contact_message_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';
