-- Run in Supabase SQL Editor. No passwords or privileged keys belong in the website.
begin;
create table if not exists public.library_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.library_admins enable row level security;
revoke all on public.library_admins from anon, authenticated;
grant select on public.library_admins to authenticated;
drop policy if exists own_admin_membership on public.library_admins;
create policy own_admin_membership on public.library_admins for select to authenticated using (user_id = auth.uid());

create or replace function public.is_library_admin() returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.library_admins where user_id = auth.uid());
$$;
revoke all on function public.is_library_admin() from public, anon;
grant execute on function public.is_library_admin() to authenticated;

create table if not exists public.library_publication (
  id text primary key check (id = 'library'),
  data jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.library_publication(id) values ('library') on conflict do nothing;
alter table public.library_publication enable row level security;
revoke all on public.library_publication from anon, authenticated;
grant select on public.library_publication to anon, authenticated;
grant update(data, revision, updated_at) on public.library_publication to authenticated;
drop policy if exists public_read on public.library_publication;
create policy public_read on public.library_publication for select to anon, authenticated using (true);
drop policy if exists admin_publish on public.library_publication;
create policy admin_publish on public.library_publication for update to authenticated
  using (public.is_library_admin()) with check (public.is_library_admin());

-- Serializes writes and rejects stale browser revisions. Runs with caller's RLS rights.
create or replace function public.publish_library(document jsonb, expected_revision bigint)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare next_revision bigint;
begin
  if not public.is_library_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  if document is null or jsonb_typeof(document) <> 'object'
    or document->>'version' is distinct from '1'
    or jsonb_typeof(document->'entries') is distinct from 'array'
    or octet_length(document::text) > 5000000 then
    raise exception 'Invalid library document' using errcode = '22023';
  end if;
  update public.library_publication set data = document, revision = revision + 1, updated_at = now()
    where id = 'library' and revision = expected_revision returning revision into next_revision;
  if next_revision is null then raise exception 'Publication changed' using errcode = '40001'; end if;
  return next_revision;
end;
$$;
revoke all on function public.publish_library(jsonb, bigint) from public, anon;
grant execute on function public.publish_library(jsonb, bigint) to authenticated;
commit;

-- After creating your user in Authentication > Users, run separately:
-- insert into public.library_admins(user_id)
-- select id from auth.users where email = 'YOUR_ADMIN_EMAIL'
-- on conflict do nothing;
