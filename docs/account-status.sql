-- شغّلي هذا مرة واحدة في Supabase → SQL Editor
alter table public.user_roles
  add column if not exists account_status text not null default 'active',
  add column if not exists leave_start date,
  add column if not exists leave_end date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_roles_account_status_check') then
    alter table public.user_roles add constraint user_roles_account_status_check
      check (account_status in ('active','suspended','on_leave'));
  end if;
end $$;

alter table public.students
  add column if not exists leave_start date,
  add column if not exists leave_end date;

create index if not exists idx_students_status on public.students (tenant_id, status);
create index if not exists idx_user_roles_account_status on public.user_roles (tenant_id, account_status);
