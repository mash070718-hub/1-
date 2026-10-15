-- Run after test-bootstrap.sql, setup.sql, test-storage-bootstrap.sql and screenshots.sql.
begin;
insert into public.library_admins values ('11111111-1111-1111-1111-111111111111') on conflict do nothing;
set local role anon;
do $$ begin
  begin
    insert into storage.objects(bucket_id, name) values ('mirror-deck-screenshots', 'mirror-decks/deck/11111111-1111-4111-8111-111111111111.webp');
    raise exception 'Anonymous upload unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
do $$ begin
  begin
    insert into storage.objects(bucket_id, name) values ('mirror-deck-screenshots', 'mirror-decks/deck/11111111-1111-4111-8111-111111111111.webp');
    raise exception 'Nonadmin upload unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
insert into storage.objects(bucket_id, name) values ('mirror-deck-screenshots', 'mirror-decks/deck/11111111-1111-4111-8111-111111111111.webp');
do $$ declare n integer; begin
  if (select count(*) from storage.objects) <> 1 then raise exception 'Admin cannot read own unpublished photo'; end if;
  begin
    insert into storage.objects(bucket_id, name) values ('mirror-deck-screenshots', '../other.svg');
    raise exception 'Invalid path unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  update storage.objects set name = 'overwritten'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'Immutable photo overwrite unexpectedly allowed'; end if;
  delete from storage.objects; get diagnostics n = row_count;
  if n <> 0 then raise exception 'Photo removal from storage unexpectedly allowed'; end if;
end $$;
set local role anon;
do $$ begin
  if exists(select 1 from storage.objects) then raise exception 'Unpublished photo exposed'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select public.publish_library('{"version":1,"entries":[],"mirrorArchive":{"decks":[{"screenshots":[{"path":"mirror-decks/deck/11111111-1111-4111-8111-111111111111.webp"}]}]}}', (select revision from public.library_publication));
set local role anon;
do $$ declare n integer; begin
  if (select count(*) from storage.objects) <> 1 then raise exception 'Published photo not visible to anonymous visitor'; end if;
  update storage.objects set name = 'overwritten'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'Anonymous overwrite unexpectedly allowed'; end if;
  delete from storage.objects; get diagnostics n = row_count;
  if n <> 0 then raise exception 'Anonymous deletion unexpectedly allowed'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
do $$ declare n integer; begin
  if (select count(*) from storage.objects) <> 1 then raise exception 'Published photo not visible to other logged-in user'; end if;
  update storage.objects set name = 'overwritten'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'Nonadmin overwrite unexpectedly allowed'; end if;
  delete from storage.objects; get diagnostics n = row_count;
  if n <> 0 then raise exception 'Nonadmin deletion unexpectedly allowed'; end if;
end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select public.publish_library('{"version":1,"entries":[],"mirrorArchive":{"decks":[]}}', (select revision from public.library_publication));
set local role anon;
do $$ begin
  if exists(select 1 from storage.objects) then raise exception 'Removed publication photo still public'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from storage.objects) <> 1 then raise exception 'Removing a reference deleted a backup photo'; end if;
end $$;
rollback;
select 'PASS: admin-only image upload, private drafts, published anonymous reads, immutable images, retained backup files' as result;
