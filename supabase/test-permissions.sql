insert into public.library_admins values ('11111111-1111-1111-1111-111111111111');
set role anon;
select revision = 0 and data is null as public_initial_read from public.library_publication;
do $$ begin
 begin update public.library_publication set data = '{}'::jsonb; raise exception 'Anonymous update unexpectedly allowed';
 exception when insufficient_privilege then null; end;
 begin perform public.publish_library('{"version":1,"entries":[]}', 0); raise exception 'Anonymous publish unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ declare n integer; begin
 if public.is_library_admin() then raise exception 'Reader considered admin'; end if;
 update public.library_publication set data = '{}'::jsonb; get diagnostics n = row_count;
 if n <> 0 then raise exception 'Nonadmin update unexpectedly allowed'; end if;
 begin perform public.publish_library('{"version":1,"entries":[]}', 0); raise exception 'Nonadmin publish unexpectedly allowed';
 exception when insufficient_privilege then null; end;
 begin insert into public.library_admins values ('22222222-2222-2222-2222-222222222222'); raise exception 'Self grant unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
 if not public.is_library_admin() then raise exception 'Admin denied'; end if;
 if public.publish_library('{"version":1,"entries":[]}', 0) <> 1 then raise exception 'Wrong revision'; end if;
 begin perform public.publish_library('{"version":1,"entries":[]}', 0); raise exception 'Stale publication unexpectedly allowed';
 exception when serialization_failure then null; end;
end $$;
reset role;
set role anon;
do $$ begin
 if not exists(select 1 from public.library_publication where revision = 1 and data->>'version' = '1') then raise exception 'Public publication not visible'; end if;
end $$;
select 'PASS: anonymous read, admin publish, nonadmin denial, no self grant, stale revision rejection' as result;
