-- =====================================================================
-- BASE SCHEMA (reconstructed) - Multi-tenant Quran/Islamic education SaaS
-- =====================================================================

-- ---------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------
create type public.app_role as enum (
  'platform_owner',
  'tenant_admin',
  'admin_deputy',
  'academic_deputy',
  'supervisor',
  'teacher',
  'student'
);

create type public.attendance_status as enum ('present', 'absent', 'excused');

create type public.billing_period as enum ('monthly', 'yearly', 'lifetime');

create type public.invoice_status as enum ('draft', 'open', 'paid', 'void', 'refunded', 'failed');

create type public.payment_status as enum (
  'pending', 'processing', 'succeeded', 'failed', 'canceled', 'expired'
);

create type public.request_status as enum ('new', 'contacted', 'approved', 'rejected');

create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'expired'
);

create type public.tenant_progress_mode as enum ('teacher', 'supervisor', 'both');

create type public.tenant_status as enum ('active', 'suspended', 'pending');

create type public.tenant_students_mode as enum ('records', 'accounts');

create type public.track_category as enum (
  'hifz_new', 'thabit_new', 'review_general', 'review_recent', 'review_distant', 'tilawa'
);

create type public.webhook_event_status as enum ('received', 'processed', 'ignored', 'error');

-- ---------------------------------------------------------------------
-- UTILITY FUNCTIONS
-- ---------------------------------------------------------------------

-- generic updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------

-- profiles (1:1 with auth.users, no FK to auth.users per instructions)
create table public.profiles (
  id uuid primary key,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- tenants
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text,
  logo_url text,
  primary_color text not null default '#0f766e',
  accent_color text not null default '#14b8a6',
  contact_email text,
  contact_phone text,
  custom_domain text,
  status public.tenant_status not null default 'pending',
  registration_open boolean not null default false,
  students_mode public.tenant_students_mode not null default 'records',
  progress_entry_mode public.tenant_progress_mode not null default 'teacher',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- user_roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  tenant_id uuid references public.tenants(id) on delete cascade,
  is_volunteer boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index user_roles_user_role_tenant_uidx
  on public.user_roles (user_id, role, coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- plans
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  description_ar text,
  currency text not null default 'SAR',
  price_monthly numeric not null default 0,
  price_yearly numeric not null default 0,
  price_lifetime numeric not null default 0,
  is_custom_priced boolean not null default false,
  max_students integer not null default 0,
  max_circles integer not null default 0,
  max_teachers integer not null default 0,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- features
create table public.features (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name_ar text not null,
  description_ar text,
  default_enabled boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- tenant_features
create table public.tenant_features (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  feature_key text not null references public.features(key) on delete cascade,
  enabled boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, feature_key)
);

-- plan_features (يربط كل باقة بمفاتيح الميزات المشمولة بها)
create table public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  feature_key text not null references public.features(key) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (plan_id, feature_key)
);

-- tracks
create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  category public.track_category not null,
  age_group text,
  notes text,
  status text not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- students
create table public.students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null,
  date_of_birth date,
  guardian_name text,
  guardian_phone text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- circles
create table public.circles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  track_id uuid references public.tracks(id) on delete set null,
  name text not null,
  teacher_user_id uuid,
  teacher_name text,
  schedule jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- circle_students
create table public.circle_students (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (circle_id, student_id)
);

-- attendance
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  circle_id uuid not null references public.circles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  record_date date not null default current_date,
  status public.attendance_status not null default 'present',
  entered_by uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- progress_records
create table public.progress_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  circle_id uuid references public.circles(id) on delete set null,
  track_id uuid not null references public.tracks(id) on delete cascade,
  record_date date not null default current_date,
  from_surah integer,
  from_ayah integer,
  to_surah integer,
  to_ayah integer,
  amount numeric not null default 0,
  notes text,
  entered_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- quotas
create table public.quotas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  period text not null default 'weekly',
  target_amount numeric not null default 0,
  from_surah integer,
  from_ayah integer,
  to_surah integer,
  to_ayah integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- invitations
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'student',
  status text not null default 'pending',
  token text not null default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid,
  accepted_by uuid,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- contact_messages
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  status public.request_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- plan_requests
create table public.plan_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  plan_id uuid references public.plans(id) on delete set null,
  tenant_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  billing_period public.billing_period not null default 'monthly',
  status public.request_status not null default 'new',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- subscriptions
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status public.subscription_status not null default 'trialing',
  billing_period public.billing_period not null default 'monthly',
  amount numeric not null default 0,
  currency text not null default 'SAR',
  started_at timestamptz not null default now(),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  expires_at timestamptz,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- payment_intents
create table public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  plan_id uuid not null references public.plans(id) on delete restrict,
  plan_request_id uuid references public.plan_requests(id) on delete set null,
  billing_period public.billing_period not null,
  amount numeric not null default 0,
  currency text not null default 'SAR',
  status public.payment_status not null default 'pending',
  idempotency_key text not null default encode(gen_random_bytes(16), 'hex'),
  customer_name text,
  customer_email text,
  checkout_url text,
  provider text,
  provider_ref text,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- invoices
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  plan_id uuid references public.plans(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  payment_intent_id uuid references public.payment_intents(id) on delete set null,
  number text not null default concat('INV-', to_char(now(), 'YYYYMMDDHH24MISS'), '-', substr(gen_random_uuid()::text, 1, 6)),
  status public.invoice_status not null default 'draft',
  billing_period public.billing_period not null default 'monthly',
  amount numeric not null default 0,
  tax_amount numeric not null default 0,
  currency text not null default 'SAR',
  description text,
  provider text,
  provider_invoice_id text,
  issued_at timestamptz not null default now(),
  due_at timestamptz,
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- payment_webhook_events
create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  payment_intent_id uuid references public.payment_intents(id) on delete set null,
  provider text not null,
  event_id text not null,
  event_type text not null,
  status public.webhook_event_status not null default 'received',
  signature_verified boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, event_id)
);

-- ---------------------------------------------------------------------
-- SECURITY-DEFINER HELPER FUNCTIONS (tenant/role checks)
-- ---------------------------------------------------------------------

create or replace function public.is_platform_owner(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = _user_id and r.role = 'platform_owner'
  );
$$;

create or replace function public.is_tenant_member(_user_id uuid, _tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = _user_id and r.tenant_id = _tenant_id
  ) or public.is_platform_owner(_user_id);
$$;

create or replace function public.is_tenant_manager(_user_id uuid, _tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = _user_id
      and r.tenant_id = _tenant_id
      and r.role in ('tenant_admin', 'admin_deputy')
  ) or public.is_platform_owner(_user_id);
$$;

create or replace function public.has_tenant_role(_user_id uuid, _tenant_id uuid, _roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = _user_id
      and r.tenant_id = _tenant_id
      and r.role = any(_roles)
  ) or public.is_platform_owner(_user_id);
$$;

create or replace function public.can_record_academic(_user_id uuid, _tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_tenant_role(
    _user_id, _tenant_id,
    array['tenant_admin','admin_deputy','academic_deputy','supervisor','teacher']::public.app_role[]
  );
$$;

create or replace function public.my_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.user_roles
  where user_id = auth.uid() and tenant_id is not null;
$$;

-- الميزات الفعلية لمقرأة معيّنة = ميزات باقتها النشطة عبر plan_features
-- + أي استثناء يدوي صريح من مالكة المنصة عبر tenant_features (يطغى دائمًا
-- على الباقة، منحًا أو سحبًا). بلا اشتراك نشط = بلا ميزات إطلاقًا إلا
-- الممنوح يدويًا. هذه الدالة الموحّدة المصدر لكل واجهة تعرض/تفرض الميزات.
create or replace function public.tenant_effective_features(_tenant_id uuid)
returns table (feature_key text, enabled boolean)
language sql
stable
security definer
set search_path = public
as $$
  with current_sub as (
    select s.plan_id
    from public.subscriptions s
    where s.tenant_id = _tenant_id
      and s.status in ('trialing', 'active', 'past_due')
    order by s.created_at desc
    limit 1
  ),
  plan_feats as (
    select pf.feature_key
    from current_sub cs
    join public.plan_features pf on pf.plan_id = cs.plan_id
  ),
  overrides as (
    select tf.feature_key, tf.enabled
    from public.tenant_features tf
    where tf.tenant_id = _tenant_id
  )
  select
    f.key as feature_key,
    coalesce(o.enabled, (pf.feature_key is not null), false) as enabled
  from public.features f
  left join plan_feats pf on pf.feature_key = f.key
  left join overrides o on o.feature_key = f.key
  order by f.sort_order;
$$;

create or replace function public.tenant_has_feature(_tenant_id uuid, _feature_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select tef.enabled from public.tenant_effective_features(_tenant_id) tef
      where tef.feature_key = _feature_key),
    false
  );
$$;

create or replace function public.tenant_plan_limits(_tenant_id uuid)
returns table (
  plan_id uuid,
  plan_name text,
  max_students integer,
  max_circles integer,
  max_teachers integer
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id as plan_id, p.name_ar as plan_name, p.max_students, p.max_circles, p.max_teachers
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.tenant_id = _tenant_id
    and s.status in ('trialing', 'active', 'past_due')
  order by s.created_at desc
  limit 1;
$$;

create or replace function public.tenant_usage(_tenant_id uuid)
returns table (
  students integer,
  circles integer,
  teachers integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::integer from public.students st where st.tenant_id = _tenant_id) as students,
    (select count(*)::integer from public.circles c where c.tenant_id = _tenant_id) as circles,
    (select count(*)::integer from public.user_roles r where r.tenant_id = _tenant_id and r.role = 'teacher') as teachers;
$$;

create or replace function public.tenant_within_limit(_tenant_id uuid, _kind text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _limit integer;
  _usage integer;
begin
  select
    case _kind
      when 'students' then l.max_students
      when 'circles' then l.max_circles
      when 'teachers' then l.max_teachers
      else null
    end
  into _limit
  from public.tenant_plan_limits(_tenant_id) l;

  if _limit is null then
    return true;
  end if;

  if _limit = 0 then
    return true; -- 0 = unlimited (enterprise convention)
  end if;

  select
    case _kind
      when 'students' then u.students
      when 'circles' then u.circles
      when 'teachers' then u.teachers
      else 0
    end
  into _usage
  from public.tenant_usage(_tenant_id) u;

  return coalesce(_usage, 0) < _limit;
end;
$$;

create or replace function public.platform_revenue_monthly(_months integer default 12)
returns table (
  month text,
  currency text,
  paid_total numeric,
  invoice_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    to_char(date_trunc('month', i.paid_at), 'YYYY-MM') as month,
    i.currency,
    sum(i.amount) as paid_total,
    count(*)::integer as invoice_count
  from public.invoices i
  where i.status = 'paid'
    and i.paid_at is not null
    and i.paid_at >= (date_trunc('month', now()) - (_months || ' months')::interval)
  group by 1, 2
  order by 1 desc;
$$;

-- ---------------------------------------------------------------------
-- TRIGGERS: updated_at
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'profiles','tenants','plans','features','tenant_features','tracks','students',
      'circles','attendance','progress_records','quotas','invitations','contact_messages',
      'plan_requests','subscriptions','payment_intents','invoices','payment_webhook_events'
    ])
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- INDEXES (common lookups)
-- ---------------------------------------------------------------------
create index tenants_slug_idx on public.tenants (slug);
create index plan_features_plan_idx on public.plan_features (plan_id);
create index plan_features_feature_idx on public.plan_features (feature_key);
create index user_roles_user_idx on public.user_roles (user_id);
create index user_roles_tenant_idx on public.user_roles (tenant_id);
create index students_tenant_idx on public.students (tenant_id);
create index circles_tenant_idx on public.circles (tenant_id);
create index tracks_tenant_idx on public.tracks (tenant_id);
create index attendance_tenant_idx on public.attendance (tenant_id);
create index attendance_student_idx on public.attendance (student_id);
create index progress_records_tenant_idx on public.progress_records (tenant_id);
create index progress_records_student_idx on public.progress_records (student_id);
create index quotas_tenant_idx on public.quotas (tenant_id);
create index invoices_tenant_idx on public.invoices (tenant_id);
create index subscriptions_tenant_idx on public.subscriptions (tenant_id);
create index payment_intents_tenant_idx on public.payment_intents (tenant_id);
create index invitations_tenant_idx on public.invitations (tenant_id);
create index invitations_email_idx on public.invitations (lower(email));

-- =====================================================================
-- GRANTS + ROW LEVEL SECURITY + POLICIES
-- =====================================================================

-- ---------------- profiles ----------------
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "profiles_select_own_or_owner" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_platform_owner(auth.uid()));

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy "profiles_update_own_or_owner" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_platform_owner(auth.uid()))
  with check (id = auth.uid() or public.is_platform_owner(auth.uid()));

-- ---------------- tenants ----------------
grant select on public.tenants to anon;
grant select, insert, update, delete on public.tenants to authenticated;
grant all on public.tenants to service_role;

alter table public.tenants enable row level security;

create policy "tenants_public_read_active" on public.tenants
  for select to anon, authenticated
  using (status = 'active');

create policy "tenants_member_read" on public.tenants
  for select to authenticated
  using (public.is_tenant_member(auth.uid(), id));

create policy "tenants_owner_all" on public.tenants
  for all to authenticated
  using (public.is_platform_owner(auth.uid()))
  with check (public.is_platform_owner(auth.uid()));

create policy "tenants_manager_update" on public.tenants
  for update to authenticated
  using (public.is_tenant_manager(auth.uid(), id))
  with check (public.is_tenant_manager(auth.uid(), id));

-- ---------------- user_roles ----------------
grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "user_roles_select_own_or_tenant" on public.user_roles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_platform_owner(auth.uid())
    or (tenant_id is not null and public.is_tenant_manager(auth.uid(), tenant_id))
  );

create policy "roles_manage" on public.user_roles
  for all to authenticated
  using (public.is_platform_owner(auth.uid()))
  with check (public.is_platform_owner(auth.uid()));

-- ---------------- plans ----------------
grant select on public.plans to anon;
grant select, insert, update, delete on public.plans to authenticated;
grant all on public.plans to service_role;

alter table public.plans enable row level security;

create policy "plans_public_read" on public.plans
  for select to anon, authenticated
  using (is_active = true);

create policy "plans_owner_read_all" on public.plans
  for select to authenticated
  using (public.is_platform_owner(auth.uid()));

-- Note: plans_owner_write policy is (re)created in a later migration.

-- ---------------- features ----------------
grant select on public.features to anon;
grant select, insert, update, delete on public.features to authenticated;
grant all on public.features to service_role;

alter table public.features enable row level security;

create policy "features_public_read" on public.features
  for select to anon, authenticated
  using (true);

create policy "features_owner_manage" on public.features
  for all to authenticated
  using (public.is_platform_owner(auth.uid()))
  with check (public.is_platform_owner(auth.uid()));

-- ---------------- tenant_features ----------------
grant select, insert, update, delete on public.tenant_features to authenticated;
grant all on public.tenant_features to service_role;

alter table public.tenant_features enable row level security;

create policy "tenant_features_member_read" on public.tenant_features
  for select to authenticated
  using (public.is_tenant_member(auth.uid(), tenant_id));

create policy "tenant_features_owner_manage" on public.tenant_features
  for all to authenticated
  using (public.is_platform_owner(auth.uid()))
  with check (public.is_platform_owner(auth.uid()));

-- ---------------- plan_features ----------------
grant select on public.plan_features to anon;
grant select, insert, update, delete on public.plan_features to authenticated;
grant all on public.plan_features to service_role;

alter table public.plan_features enable row level security;

create policy "plan_features_public_read" on public.plan_features
  for select to anon, authenticated
  using (true);

create policy "plan_features_owner_manage" on public.plan_features
  for all to authenticated
  using (public.is_platform_owner(auth.uid()))
  with check (public.is_platform_owner(auth.uid()));

-- ---------------- tracks ----------------
grant select, insert, update, delete on public.tracks to authenticated;
grant all on public.tracks to service_role;

alter table public.tracks enable row level security;

create policy "tracks_member_read" on public.tracks
  for select to authenticated
  using (public.is_tenant_member(auth.uid(), tenant_id));

create policy "tracks_manager_write" on public.tracks
  for all to authenticated
  using (public.is_tenant_manager(auth.uid(), tenant_id) or public.is_platform_owner(auth.uid()))
  with check (public.is_tenant_manager(auth.uid(), tenant_id) or public.is_platform_owner(auth.uid()));

-- ---------------- students ----------------
grant select, insert, update, delete on public.students to authenticated;
grant all on public.students to service_role;

alter table public.students enable row level security;

create policy "students_member_read" on public.students
  for select to authenticated
  using (public.is_tenant_member(auth.uid(), tenant_id));

create policy "students_manager_write" on public.students
  for all to authenticated
  using (public.is_tenant_manager(auth.uid(), tenant_id) or public.is_platform_owner(auth.uid()))
  with check (public.is_tenant_manager(auth.uid(), tenant_id) or public.is_platform_owner(auth.uid()));

-- ---------------- circles ----------------
grant select, insert, update, delete on public.circles to authenticated;
grant all on public.circles to service_role;

alter table public.circles enable row level security;

create policy "circles_member_read" on public.circles
  for select to authenticated
  using (public.is_tenant_member(auth.uid(), tenant_id));

create policy "circles_manager_write" on public.circles
  for all to authenticated
  using (public.is_tenant_manager(auth.uid(), tenant_id) or public.is_platform_owner(auth.uid()))
  with check (public.is_tenant_manager(auth.uid(), tenant_id) or public.is_platform_owner(auth.uid()));

-- ---------------- circle_students ----------------
grant select, insert, update, delete on public.circle_students to authenticated;
grant all on public.circle_students to service_role;

alter table public.circle_students enable row level security;

create policy "circle_students_member_read" on public.circle_students
  for select to authenticated
  using (
    exists (
      select 1 from public.circles c
      where c.id = circle_students.circle_id
        and public.is_tenant_member(auth.uid(), c.tenant_id)
    )
  );

create policy "circle_students_manager_write" on public.circle_students
  for all to authenticated
  using (
    public.is_platform_owner(auth.uid())
    or exists (
      select 1 from public.circles c
      where c.id = circle_students.circle_id
        and public.is_tenant_manager(auth.uid(), c.tenant_id)
    )
  )
  with check (
    public.is_platform_owner(auth.uid())
    or exists (
      select 1 from public.circles c
      where c.id = circle_students.circle_id
        and public.is_tenant_manager(auth.uid(), c.tenant_id)
    )
  );

-- ---------------- attendance ----------------
grant select, insert, update, delete on public.attendance to authenticated;
grant all on public.attendance to service_role;

alter table public.attendance enable row level security;

create policy "attendance_member_read" on public.attendance
  for select to authenticated
  using (public.is_tenant_member(auth.uid(), tenant_id));

create policy "attendance_recorder_write" on public.attendance
  for all to authenticated
  using (public.can_record_academic(auth.uid(), tenant_id) or public.is_platform_owner(auth.uid()))
  with check (public.can_record_academic(auth.uid(), tenant_id) or public.is_platform_owner(auth.uid()));

-- ---------------- progress_records ----------------
grant select, insert, update, delete on public.progress_records to authenticated;
grant all on public.progress_records to service_role;

alter table public.progress_records enable row level security;

create policy "progress_records_member_read" on public.progress_records
  for select to authenticated
  using (public.is_tenant_member(auth.uid(), tenant_id));

create policy "progress_records_recorder_write" on public.progress_records
  for all to authenticated
  using (public.can_record_academic(auth.uid(), tenant_id) or public.is_platform_owner(auth.uid()))
  with check (public.can_record_academic(auth.uid(), tenant_id) or public.is_platform_owner(auth.uid()));

-- ---------------- quotas ----------------
grant select, insert, update, delete on public.quotas to authenticated;
grant all on public.quotas to service_role;

alter table public.quotas enable row level security;

create policy "quotas_member_read" on public.quotas
  for select to authenticated
  using (public.is_tenant_member(auth.uid(), tenant_id));

create policy "quotas_manager_write" on public.quotas
  for all to authenticated
  using (public.is_tenant_manager(auth.uid(), tenant_id) or public.is_platform_owner(auth.uid()))
  with check (public.is_tenant_manager(auth.uid(), tenant_id) or public.is_platform_owner(auth.uid()));

-- ---------------- invitations ----------------
grant select, insert, update, delete on public.invitations to authenticated;
grant all on public.invitations to service_role;

alter table public.invitations enable row level security;

create policy "invitations_manager_read" on public.invitations
  for select to authenticated
  using (
    public.is_platform_owner(auth.uid())
    or (tenant_id is not null and public.is_tenant_manager(auth.uid(), tenant_id))
    or lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );

create policy "invitations_manager_manage" on public.invitations
  for all to authenticated
  using (
    public.is_platform_owner(auth.uid())
    or (tenant_id is not null and public.is_tenant_manager(auth.uid(), tenant_id))
  )
  with check (
    public.is_platform_owner(auth.uid())
    or (tenant_id is not null and public.is_tenant_manager(auth.uid(), tenant_id))
  );

-- ---------------- contact_messages ----------------
grant insert on public.contact_messages to anon;
grant select, insert, update, delete on public.contact_messages to authenticated;
grant all on public.contact_messages to service_role;

alter table public.contact_messages enable row level security;

create policy "contact_messages_anon_insert" on public.contact_messages
  for insert to anon
  with check (true);

create policy "contact_messages_auth_insert" on public.contact_messages
  for insert to authenticated
  with check (true);

create policy "contact_messages_owner_manage" on public.contact_messages
  for all to authenticated
  using (public.is_platform_owner(auth.uid()))
  with check (public.is_platform_owner(auth.uid()));

-- ---------------- plan_requests ----------------
grant insert on public.plan_requests to anon;
grant select, insert, update, delete on public.plan_requests to authenticated;
grant all on public.plan_requests to service_role;

alter table public.plan_requests enable row level security;

create policy "plan_requests_anon_insert" on public.plan_requests
  for insert to anon
  with check (true);

create policy "plan_requests_auth_insert" on public.plan_requests
  for insert to authenticated
  with check (true);

create policy "plan_requests_owner_manage" on public.plan_requests
  for all to authenticated
  using (public.is_platform_owner(auth.uid()))
  with check (public.is_platform_owner(auth.uid()));

create policy "plan_requests_tenant_read" on public.plan_requests
  for select to authenticated
  using (tenant_id is not null and public.is_tenant_manager(auth.uid(), tenant_id));

-- ---------------- subscriptions ----------------
grant select, insert, update, delete on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

alter table public.subscriptions enable row level security;

create policy "subscriptions_tenant_read" on public.subscriptions
  for select to authenticated
  using (public.is_tenant_member(auth.uid(), tenant_id));

create policy "subscriptions_owner_manage" on public.subscriptions
  for all to authenticated
  using (public.is_platform_owner(auth.uid()))
  with check (public.is_platform_owner(auth.uid()));

-- ---------------- payment_intents ----------------
grant select, insert, update, delete on public.payment_intents to authenticated;
grant all on public.payment_intents to service_role;

alter table public.payment_intents enable row level security;

create policy "payment_intents_tenant_read" on public.payment_intents
  for select to authenticated
  using (
    (tenant_id is not null and public.is_tenant_manager(auth.uid(), tenant_id))
    or created_by = auth.uid()
    or public.is_platform_owner(auth.uid())
  );

create policy "payment_intents_authenticated_insert" on public.payment_intents
  for insert to authenticated
  with check (created_by = auth.uid() or public.is_platform_owner(auth.uid()));

create policy "payment_intents_owner_manage" on public.payment_intents
  for all to authenticated
  using (public.is_platform_owner(auth.uid()))
  with check (public.is_platform_owner(auth.uid()));

-- ---------------- invoices ----------------
grant select, insert, update, delete on public.invoices to authenticated;
grant all on public.invoices to service_role;

alter table public.invoices enable row level security;

create policy "invoices_tenant_read" on public.invoices
  for select to authenticated
  using (
    (tenant_id is not null and public.is_tenant_manager(auth.uid(), tenant_id))
    or public.is_platform_owner(auth.uid())
  );

create policy "invoices_owner_manage" on public.invoices
  for all to authenticated
  using (public.is_platform_owner(auth.uid()))
  with check (public.is_platform_owner(auth.uid()));

-- ---------------- payment_webhook_events ----------------
grant select, insert, update, delete on public.payment_webhook_events to authenticated;
grant all on public.payment_webhook_events to service_role;

alter table public.payment_webhook_events enable row level security;

create policy "payment_webhook_events_owner_manage" on public.payment_webhook_events
  for all to authenticated
  using (public.is_platform_owner(auth.uid()))
  with check (public.is_platform_owner(auth.uid()));

-- =====================================================================
-- SEED DATA
-- =====================================================================

insert into public.plans (code, name_ar, description_ar, price_monthly, price_yearly, price_lifetime, is_custom_priced, max_students, max_circles, max_teachers, is_active, is_featured, sort_order)
values
  ('trial', 'تجريبية', 'خطة تجريبية مجانية لاستكشاف المنصة', 0, 0, 0, false, 10, 2, 2, true, false, 1),
  ('beginning', 'الانطلاق', 'خطة مناسبة للمقارئ الناشئة', 49, 490, 0, false, 60, 6, 5, true, false, 2),
  ('basic', 'الأساسية', 'خطة الاحتياجات الأساسية للمقارئ المتوسطة', 99, 990, 0, false, 200, 20, 15, true, false, 3),
  ('pro', 'الاحترافية', 'خطة متكاملة للمقارئ الكبيرة', 199, 1990, 0, false, 800, 80, 60, true, true, 4),
  ('enterprise', 'المؤسسات', 'خطة مخصصة للمؤسسات والجمعيات الكبيرة', 0, 0, 0, true, 0, 0, 0, true, false, 5)
on conflict (code) do nothing;

insert into public.features (key, name_ar, description_ar, default_enabled, sort_order)
values
  ('students', 'إدارة الطالبات', 'تسجيل ومتابعة بيانات الطالبات', true, 10),
  ('circles', 'إدارة الحلقات', 'إنشاء وإدارة الحلقات التعليمية', true, 20),
  ('tracks', 'المسارات التعليمية', 'تعريف مسارات الحفظ والمراجعة', true, 30),
  ('progress', 'سجل التقدم', 'تسجيل التقدم في الحفظ والمراجعة', true, 40),
  ('attendance', 'الحضور والغياب', 'تسجيل حضور وغياب الطالبات', true, 50),
  ('volunteers', 'إدارة المتطوعات', 'تسجيل ومتابعة المتطوعات المساندات للمقرأة', true, 45),
  ('reports_basic', 'تقارير أساسية', 'تقارير مبسطة عن الأداء والحضور', true, 60),
  ('quotas', 'الأهداف والحصص', 'تحديد أهداف الحفظ والمراجعة الدورية', false, 70),
  ('exports', 'تصدير البيانات', 'تصدير التقارير والبيانات', false, 80),
  ('reports_advanced', 'تقارير متقدمة', 'تحليلات وتقارير تفصيلية متقدمة', false, 90),
  ('roles_deputies', 'صلاحيات الوكيلات', 'إسناد أدوار الوكيلة الأكاديمية والمشرفة', false, 100),
  ('student_accounts', 'حسابات الطالبات', 'تفعيل حسابات دخول مستقلة للطالبات', false, 110),
  ('branding', 'الهوية البصرية', 'تخصيص الشعار والألوان', false, 120),
  ('public_page', 'الصفحة التعريفية', 'صفحة تعريفية عامة للمقرأة', false, 130),
  ('custom_domain', 'نطاق مخصص', 'ربط نطاق مخصص بالمقرأة', false, 140),
  ('priority_support', 'دعم ذو أولوية', 'دعم فني سريع الاستجابة', false, 150)
on conflict (key) do nothing;

-- =====================================================================
-- END OF BASE SCHEMA
-- =====================================================================
