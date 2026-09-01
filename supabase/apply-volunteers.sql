-- =====================================================================
-- طلبات التطوع + فتح باب التطوع في المقرأة
-- نفّذي هذا الملف كاملاً في محرر SQL داخل مشروع Supabase الخاص بك.
-- الملف آمن للتشغيل أكثر من مرة (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) عمود فتح باب التطوع على جدول المقارئ
-- ---------------------------------------------------------------------
alter table public.tenants
  add column if not exists volunteering_open boolean not null default false;

-- ---------------------------------------------------------------------
-- 2) جدول طلبات التطوع
-- ---------------------------------------------------------------------
create table if not exists public.volunteer_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  preferred_role public.app_role not null default 'teacher',
  note text,
  status public.request_status not null default 'new',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists volunteer_applications_tenant_idx
  on public.volunteer_applications (tenant_id, status, created_at desc);

drop trigger if exists volunteer_applications_set_updated_at on public.volunteer_applications;
create trigger volunteer_applications_set_updated_at
  before update on public.volunteer_applications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3) صلاحيات الوصول (Data API)
-- ---------------------------------------------------------------------
grant insert on public.volunteer_applications to anon;
grant select, insert, update, delete on public.volunteer_applications to authenticated;
grant all on public.volunteer_applications to service_role;

-- ---------------------------------------------------------------------
-- 4) سياسات الأمان
-- ---------------------------------------------------------------------
alter table public.volunteer_applications enable row level security;

drop policy if exists "volunteer_applications_anon_insert" on public.volunteer_applications;
create policy "volunteer_applications_anon_insert" on public.volunteer_applications
  for insert to anon
  with check (
    exists (
      select 1 from public.tenants t
      where t.id = tenant_id
        and t.status = 'active'
        and t.volunteering_open = true
    )
  );

drop policy if exists "volunteer_applications_auth_insert" on public.volunteer_applications;
create policy "volunteer_applications_auth_insert" on public.volunteer_applications
  for insert to authenticated
  with check (
    exists (
      select 1 from public.tenants t
      where t.id = tenant_id
        and t.status = 'active'
        and t.volunteering_open = true
    )
  );

drop policy if exists "volunteer_applications_manager_read" on public.volunteer_applications;
create policy "volunteer_applications_manager_read" on public.volunteer_applications
  for select to authenticated
  using (public.is_tenant_manager(auth.uid(), tenant_id));

drop policy if exists "volunteer_applications_manager_update" on public.volunteer_applications;
create policy "volunteer_applications_manager_update" on public.volunteer_applications
  for update to authenticated
  using (public.is_tenant_manager(auth.uid(), tenant_id))
  with check (public.is_tenant_manager(auth.uid(), tenant_id));

drop policy if exists "volunteer_applications_manager_delete" on public.volunteer_applications;
create policy "volunteer_applications_manager_delete" on public.volunteer_applications
  for delete to authenticated
  using (public.is_tenant_manager(auth.uid(), tenant_id));
