-- =====================================================================
-- Migration: نظام ميزات الباقات الفعلي (plan_features + tenant_effective_features)
-- طبّقي هذا الملف بعد base_schema.sql و apply-volunteers.sql و
-- migration_scoped_permissions.sql و migration_permission_fixes.sql.
--
-- يحل هذا الملف المشاكل التالية:
--  ١) جدول plan_features (ربط كل باقة بمزاياها) لم يكن موجودًا أصلًا، رغم
--     أن لوحة المنصة (platform/plans.tsx) ولوحة المقارنة العامة (compare.tsx)
--     كانتا تحاولان القراءة/الكتابة عليه — كل عملية كانت تفشل بصمت.
--  ٢) الدالة tenant_has_feature() كانت تسقط دائمًا إلى default_enabled
--     العام على جدول features بدل مراعاة باقة المقرأة فعليًا، فتصير كل
--     المقارئ (بغض النظر عن باقتها) ترى نفس الميزات الافتراضية.
--  ٣) لا توجد دالة موحّدة تحسب "الميزات الفعلية" لمقرأة معينة (باقتها +
--     أي استثناء يدوي)، فكل واجهة (نافذة تفعيل الميزات لمالكة المنصة مقابل
--     صفحات المقرأة نفسها) كانت تحسب النتيجة بمنطق مختلف.
--  ٤) ميزة "المتطوعات" كانت ناقصة من كتالوج الميزات رغم أن صفحتها مكتملة.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ١) جدول plan_features — يربط كل باقة (plan) بمفاتيح الميزات المشمولة بها
-- ---------------------------------------------------------------------
create table if not exists public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  feature_key text not null references public.features(key) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (plan_id, feature_key)
);

create index if not exists plan_features_plan_idx on public.plan_features (plan_id);
create index if not exists plan_features_feature_idx on public.plan_features (feature_key);

grant select on public.plan_features to anon;
grant select, insert, update, delete on public.plan_features to authenticated;
grant all on public.plan_features to service_role;

alter table public.plan_features enable row level security;

drop policy if exists "plan_features_public_read" on public.plan_features;
create policy "plan_features_public_read" on public.plan_features
  for select to anon, authenticated
  using (true);

drop policy if exists "plan_features_owner_manage" on public.plan_features;
create policy "plan_features_owner_manage" on public.plan_features
  for all to authenticated
  using (public.is_platform_owner(auth.uid()))
  with check (public.is_platform_owner(auth.uid()));

-- ---------------------------------------------------------------------
-- ٢) ميزة "المتطوعات" الناقصة من الكتالوج
-- ---------------------------------------------------------------------
insert into public.features (key, name_ar, description_ar, default_enabled, sort_order)
values ('volunteers', 'إدارة المتطوعات', 'تسجيل ومتابعة المتطوعات المساندات للمقرأة', true, 45)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- ٣) تغذية plan_features بقيم افتراضية معقولة لكل باقة حالية
--    (الجدول كان فارغًا تمامًا — بدون هذه الخطوة ستفقد كل المقارئ المشتركة
--    كل ميزاتها فور تفعيل المنطق الجديد، لأن "بلا باقة نشطة تملك ميزات
--    = بلا ميزات". عدّلي هذا التوزيع من لوحة المنصة → الباقات والأسعار
--    متى ما احتجتِ.)
-- ---------------------------------------------------------------------
with tiers as (
  select 'trial'::text as code, unnest(array[
    'students','circles','tracks','progress','attendance','reports_basic','volunteers'
  ]) as feature_key
  union all
  select 'beginning', unnest(array[
    'students','circles','tracks','progress','attendance','reports_basic','volunteers','quotas'
  ])
  union all
  select 'basic', unnest(array[
    'students','circles','tracks','progress','attendance','reports_basic','volunteers','quotas',
    'exports','reports_advanced'
  ])
  union all
  select 'pro', unnest(array[
    'students','circles','tracks','progress','attendance','reports_basic','volunteers','quotas',
    'exports','reports_advanced','roles_deputies','student_accounts','branding','public_page'
  ])
  union all
  select 'enterprise', unnest(array[
    'students','circles','tracks','progress','attendance','reports_basic','volunteers','quotas',
    'exports','reports_advanced','roles_deputies','student_accounts','branding','public_page',
    'custom_domain','priority_support'
  ])
)
insert into public.plan_features (plan_id, feature_key, sort_order)
select p.id, t.feature_key, coalesce(f.sort_order, 0)
from tiers t
join public.plans p on p.code = t.code
left join public.features f on f.key = t.feature_key
on conflict (plan_id, feature_key) do nothing;

-- ---------------------------------------------------------------------
-- ٤) الدالة الموحّدة: الميزات الفعلية لمقرأة = ميزات باقتها النشطة
--    + أي استثناء يدوي صريح من مالكة المنصة عبر tenant_features
--    (الاستثناء يطغى دائمًا على الباقة، سواء منحًا إضافيًا أو سحبًا).
--    بلا اشتراك نشط = بلا ميزات إطلاقًا إلا الممنوح يدويًا.
-- ---------------------------------------------------------------------
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

grant execute on function public.tenant_effective_features(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- ٥) تصحيح tenant_has_feature() لتستخدم نفس المنطق الموحّد أعلاه بدل
--    السقوط إلى default_enabled العام.
-- ---------------------------------------------------------------------
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

grant execute on function public.tenant_has_feature(uuid, text) to authenticated;

-- =====================================================================
-- تحقق سريع بعد التطبيق (اختياري - شغّليه يدويًا لو حبيتِ التأكد):
--   select * from public.tenant_effective_features('<tenant-uuid>');
-- =====================================================================
