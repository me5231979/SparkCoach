-- Every app transaction switches to this role (SET LOCAL ROLE spark_rls). It can't bypass row-level security,
-- so isolation holds even if the connecting role is a superuser or has BYPASSRLS (as some hosted defaults do).
do $$ begin
  if not exists (select from pg_roles where rolname = 'spark_rls') then
    create role spark_rls nologin nobypassrls;
  end if;
end $$;
grant usage on schema public to spark_rls;
grant select, insert, update, delete on all tables in schema public to spark_rls;
grant usage, select on all sequences in schema public to spark_rls;
alter default privileges in schema public grant select, insert, update, delete on tables to spark_rls;
alter default privileges in schema public grant usage, select on sequences to spark_rls;
grant execute on function spark_org(), spark_bypass() to spark_rls;
grant spark_rls to current_user;
