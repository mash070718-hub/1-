-- Run once in the existing project's SQL Editor, after setup.sql.
-- This adds image storage and permissions; it never changes evaluations or admin membership.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mirror-deck-screenshots', 'mirror-deck-screenshots', false, 2097152, array['image/webp'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_published_library_screenshot(object_name text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.library_publication
    where id = 'library' and data @> jsonb_build_object('mirrorArchive',
      jsonb_build_object('decks', jsonb_build_array(jsonb_build_object('screenshots',
        jsonb_build_array(jsonb_build_object('path', object_name))))))
  );
$$;
revoke all on function public.is_published_library_screenshot(text) from public;
grant execute on function public.is_published_library_screenshot(text) to anon, authenticated;

drop policy if exists library_screenshot_admin_insert on storage.objects;
create policy library_screenshot_admin_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'mirror-deck-screenshots' and public.is_library_admin()
  and name ~ '^mirror-decks/[a-zA-Z0-9_-]{1,100}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$'
);

drop policy if exists library_screenshot_admin_read on storage.objects;
create policy library_screenshot_admin_read on storage.objects
for select to authenticated using (
  bucket_id = 'mirror-deck-screenshots' and public.is_library_admin()
);

drop policy if exists library_screenshot_published_read on storage.objects;
create policy library_screenshot_published_read on storage.objects
for select to anon, authenticated using (
  bucket_id = 'mirror-deck-screenshots' and public.is_published_library_screenshot(name)
);

-- No overwrite/delete policies: editing a draft must not break the currently
-- published photos or old backups. Removing an attachment only removes its reference.
commit;
