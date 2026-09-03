-- =====================================================================
-- MIGRATION: بيانات الباقات الحقيقية (من suhub1r.com) + قفل التجربة
--            الفعلي بعد أسبوع + تفعيل تحقق الميزات داخل RLS نفسها
--            (مو بس بالواجهة) على الجداول الأساسية.
-- طبّقي هذا الملف بعد migration_plan_features_complete.sql. آمن للتشغيل
-- أكثر من مرة (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- ١) تصحيح بيانات الباقات (الاسم/السعر/الحدود) لتطابق صفحة الأسعار الفعلية
--    ملاحظة: الصور المُرسلة فيها السعر الشهري وسعر المقارنة (المشطوب)
--    فقط — ما فيها سعر سنوي، فتُركت price_yearly/compare_yearly كما هي
--    حاليًا بدل تخمينها. حدّثيها لاحقًا لو عندك الأرقام السنوية الفعلية.
-- ---------------------------------------------------------------------
update public.plans set
  name_ar = 'شُروع',
  description_ar = 'باقة مجانية للتجربة لمدة أسبوع',
  price_monthly = 0, compare_monthly = null,
  max_students = 20, max_circles = 3, max_teachers = 3,
  is_featured = false
where code = 'trial';

update public.plans set
  name_ar = 'مُستهل',
  description_ar = 'باقة صُممت خصيصًا للمقارئ الناشئة',
  price_monthly = 250, compare_monthly = 290,
  max_students = 70, max_circles = 7, max_teachers = 7,
  is_featured = false
where code = 'beginning';

update public.plans set
  name_ar = 'هَطل',
  description_ar = 'مناسبة للمقارئ المتوسطة',
  price_monthly = 399, compare_monthly = 450,
  max_students = 200, max_circles = 25, max_teachers = 25,
  is_featured = true
where code = 'basic';

update public.plans set
  name_ar = 'غَيث',
  description_ar = 'للمقارئ الكبيرة',
  price_monthly = 750, compare_monthly = 800,
  max_students = 0, max_circles = 0, max_teachers = 0,
  is_featured = false
where code = 'pro';

update public.plans set
  name_ar = 'انْهِمار',
  description_ar = 'للمقارئ الكبيرة والمؤسسات — حدود مفتوحة وتهيئة خاصة',
  is_custom_priced = true,
  max_students = 0, max_circles = 0, max_teachers = 0,
  is_featured = false
where code = 'enterprise';

-- ---------------------------------------------------------------------
-- ٢) إعادة بناء plan_features بالقيم الحقيقية بدل التوزيع المُخمَّن سابقًا
--    (المصدر: لقطات شاشة فعلية لصفحة الأسعار — ٣٠ أغسطس ٢٠٢٦)
--    "دعوات الفريق" الظاهرة بالموقع = roles_deputies (تأكيد صاحبة المنصة).
--    الميزات: exports / custom_domain / student_accounts /
--    priority_support / reports_advanced غير ظاهرة بأي باقة على الموقع
--    → لا تُدرج هنا، تُمنح فقط يدويًا عبر tenant_features (قرار صاحبة
--    المنصة). "مساعدة أول أسبوع" و"تصميم ميزة/ميزات مخصصة" خدمات تنفيذية
--    وليست مفاتيح ميزات قابلة للتفعيل بالنظام، فلا مقابل لها هنا.
-- ---------------------------------------------------------------------
delete from public.plan_features
where plan_id in (select id from public.plans where code in ('trial','beginning','basic','pro','enterprise'));

with tiers as (
  select 'trial'::text as code, unnest(array[
    'students','circles','tracks','quotas','progress','attendance','reports_basic','volunteers'
  ]) as feature_key
  union all
  select 'beginning', unnest(array[
    'students','circles','tracks','quotas'
  ])
  union all
  select 'basic', unnest(array[
    'students','circles','tracks','quotas','progress','attendance','reports_basic','volunteers',
    'roles_deputies'
  ])
  union all
  select 'pro', unnest(array[
    'students','circles','tracks','quotas','progress','attendance','reports_basic','volunteers',
    'roles_deputies','branding'
  ])
  union all
  select 'enterprise', unnest(array[
    'students','circles','tracks','quotas','progress','attendance','reports_basic','volunteers',
    'roles_deputies','branding','public_page'
  ])
)
insert into public.plan_features (plan_id, feature_key, sort_order)
select p.id, t.feature_key, coalesce(f.sort_order, 0)
from tiers t
join public.plans p on p.code = t.code
left join public.features f on f.key = t.feature_key
on conflict (plan_id, feature_key) do nothing;

-- ---------------------------------------------------------------------
-- ٣) قفل حقيقي بعد انتهاء أسبوع التجربة (شُروع)
--    قبل هذا التصحيح: أي اشتراك status='trialing' يُعتبر "مفعّل" إلى
--    الأبد بكل مكان يستخدم tenant_subscription_active() أو
--    tenant_effective_features()، بغض النظر عن trial_ends_at — يعني
--    القفل بعد الأسبوع ما كان له أي أثر فعلي بقاعدة البيانات.
--    التصحيح: تجربة انتهت مدتها (trial_ends_at <= الآن) لم تعد "مفعّلة".
-- ---------------------------------------------------------------------
create or replace function public.tenant_subscription_active(_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.tenant_id = _tenant_id
      and (
        s.status in ('active', 'past_due')
        or (s.status = 'trialing' and (s.trial_ends_at is null or s.trial_ends_at > now()))
      )
  );
$$;

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
      and (
        s.status in ('active', 'past_due')
        or (s.status = 'trialing' and (s.trial_ends_at is null or s.trial_ends_at > now()))
      )
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

-- ---------------------------------------------------------------------
-- ٤) تحقق الميزة داخل RLS نفسها (مو بس بالواجهة) — الآن استدعاء
--    Supabase API مباشرة بدون المرور بالواجهة ما يقدر يتخطى الميزة.
--    القراءة والكتابة معًا مقفولة، عشان مقرأة "مستهل" مثلًا (بدون
--    attendance/progress/volunteers) ما تقدر حتى تشوف بيانات هذي
--    الجداول لو انسحبت الميزة أو انتهت التجربة.
-- ---------------------------------------------------------------------

-- tracks
drop policy if exists "tracks_scoped_write" on public.tracks;
create policy "tracks_scoped_write" on public.tracks
  for all to authenticated
  using (public.can_manage_track(auth.uid(), id) and public.tenant_has_feature(tenant_id, 'tracks'))
  with check (public.can_manage_track(auth.uid(), id) and public.tenant_has_feature(tenant_id, 'tracks'));

-- circles
drop policy if exists "circles_scoped_read" on public.circles;
create policy "circles_scoped_read" on public.circles
  for select to authenticated
  using (public.can_view_circle(auth.uid(), id) and public.tenant_has_feature(tenant_id, 'circles'));

drop policy if exists "circles_scoped_update_delete" on public.circles;
create policy "circles_scoped_update_delete" on public.circles
  for update to authenticated
  using (public.can_manage_circle(auth.uid(), id) and public.tenant_has_feature(tenant_id, 'circles'))
  with check (public.can_manage_circles_in_track(auth.uid(), tenant_id, track_id) and public.tenant_has_feature(tenant_id, 'circles'));

drop policy if exists "circles_scoped_delete" on public.circles;
create policy "circles_scoped_delete" on public.circles
  for delete to authenticated
  using (public.can_manage_circle(auth.uid(), id) and public.tenant_has_feature(tenant_id, 'circles'));

drop policy if exists "circles_scoped_insert" on public.circles;
create policy "circles_scoped_insert" on public.circles
  for insert to authenticated
  with check (public.can_manage_circles_in_track(auth.uid(), tenant_id, track_id) and public.tenant_has_feature(tenant_id, 'circles'));

-- students
drop policy if exists "students_scoped_read" on public.students;
create policy "students_scoped_read" on public.students
  for select to authenticated
  using (public.can_view_student(auth.uid(), id) and public.tenant_has_feature(tenant_id, 'students'));

drop policy if exists "students_scoped_insert" on public.students;
create policy "students_scoped_insert" on public.students
  for insert to authenticated
  with check (public.can_create_student(auth.uid(), tenant_id) and public.tenant_has_feature(tenant_id, 'students'));

drop policy if exists "students_scoped_update" on public.students;
create policy "students_scoped_update" on public.students
  for update to authenticated
  using (public.can_manage_student(auth.uid(), id) and public.tenant_has_feature(tenant_id, 'students'))
  with check (public.can_manage_student(auth.uid(), id) and public.tenant_has_feature(tenant_id, 'students'));

drop policy if exists "students_scoped_delete" on public.students;
create policy "students_scoped_delete" on public.students
  for delete to authenticated
  using (public.can_manage_student(auth.uid(), id) and public.tenant_has_feature(tenant_id, 'students'));

-- attendance
drop policy if exists "attendance_scoped_read" on public.attendance;
create policy "attendance_scoped_read" on public.attendance
  for select to authenticated
  using (public.can_view_circle(auth.uid(), circle_id) and public.tenant_has_feature(tenant_id, 'attendance'));

drop policy if exists "attendance_scoped_write" on public.attendance;
create policy "attendance_scoped_write" on public.attendance
  for all to authenticated
  using (public.can_manage_progress_entries(auth.uid(), tenant_id, circle_id) and public.tenant_has_feature(tenant_id, 'attendance'))
  with check (public.can_manage_progress_entries(auth.uid(), tenant_id, circle_id) and public.tenant_has_feature(tenant_id, 'attendance'));

-- progress_records
drop policy if exists "progress_records_scoped_read" on public.progress_records;
create policy "progress_records_scoped_read" on public.progress_records
  for select to authenticated
  using (
    (
      (circle_id is not null and public.can_view_circle(auth.uid(), circle_id))
      or (circle_id is null and public.is_tenant_member(auth.uid(), tenant_id))
    )
    and public.tenant_has_feature(tenant_id, 'progress')
  );

drop policy if exists "progress_records_scoped_write" on public.progress_records;
create policy "progress_records_scoped_write" on public.progress_records
  for all to authenticated
  using (
    case
      when circle_id is not null then public.can_manage_progress_entries(auth.uid(), tenant_id, circle_id)
      else public.can_manage_track_entries(auth.uid(), tenant_id, track_id)
    end
    and public.tenant_has_feature(tenant_id, 'progress')
  )
  with check (
    case
      when circle_id is not null then public.can_manage_progress_entries(auth.uid(), tenant_id, circle_id)
      else public.can_manage_track_entries(auth.uid(), tenant_id, track_id)
    end
    and public.tenant_has_feature(tenant_id, 'progress')
  );

-- quotas
drop policy if exists "quotas_member_read" on public.quotas;
create policy "quotas_member_read" on public.quotas
  for select to authenticated
  using (public.is_tenant_member(auth.uid(), tenant_id) and public.tenant_has_feature(tenant_id, 'quotas'));

drop policy if exists "quotas_manager_write" on public.quotas;
create policy "quotas_manager_write" on public.quotas
  for all to authenticated
  using ((public.is_tenant_manager(auth.uid(), tenant_id) or public.is_platform_owner(auth.uid())) and (public.is_platform_owner(auth.uid()) or public.tenant_has_feature(tenant_id, 'quotas')))
  with check ((public.is_tenant_manager(auth.uid(), tenant_id) or public.is_platform_owner(auth.uid())) and (public.is_platform_owner(auth.uid()) or public.tenant_has_feature(tenant_id, 'quotas')));

-- volunteer_applications (قراءة/إدارة القائدة — التسجيل العام يبقى مفتوحًا)
drop policy if exists "volunteer_applications_manager_read" on public.volunteer_applications;
create policy "volunteer_applications_manager_read" on public.volunteer_applications
  for select to authenticated
  using (public.is_tenant_manager(auth.uid(), tenant_id) and public.tenant_has_feature(tenant_id, 'volunteers'));

drop policy if exists "volunteer_applications_manager_update" on public.volunteer_applications;
create policy "volunteer_applications_manager_update" on public.volunteer_applications
  for update to authenticated
  using (public.is_tenant_manager(auth.uid(), tenant_id) and public.tenant_has_feature(tenant_id, 'volunteers'));

drop policy if exists "volunteer_applications_manager_delete" on public.volunteer_applications;
create policy "volunteer_applications_manager_delete" on public.volunteer_applications
  for delete to authenticated
  using (public.is_tenant_manager(auth.uid(), tenant_id) and public.tenant_has_feature(tenant_id, 'volunteers'));

-- ---------------------------------------------------------------------
-- ٥) منع تعديل الهوية البصرية (الشعار/الألوان) والنطاق المخصص من جدول
--    tenants نفسه إن لم تملك المقرأة الميزة — دفاع مزدوج مع الواجهة،
--    يمنع أي استدعاء مباشر لـ Supabase API يتخطى صفحة الإعدادات.
--    مالكة المنصة مستثناة دائمًا.
-- ---------------------------------------------------------------------
create or replace function public.enforce_tenant_branding_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_platform_owner(auth.uid()) then
    return new;
  end if;

  if (new.logo_url is distinct from old.logo_url
      or new.primary_color is distinct from old.primary_color
      or new.accent_color is distinct from old.accent_color)
     and not public.tenant_has_feature(new.id, 'branding') then
    raise exception 'ميزة "الهوية البصرية" غير مفعّلة لهذه المقرأة';
  end if;

  if (new.custom_domain is distinct from old.custom_domain)
     and not public.tenant_has_feature(new.id, 'custom_domain') then
    raise exception 'ميزة "النطاق المخصص" غير مفعّلة لهذه المقرأة';
  end if;

  return new;
end;
$$;

drop trigger if exists tenant_branding_gate on public.tenants;
drop trigger if exists tenant_branding_gate on public.tenants;
create trigger tenant_branding_gate
  before update on public.tenants
  for each row
  execute function public.enforce_tenant_branding_gate();

-- =====================================================================
-- تحقق سريع بعد التطبيق:
--   select code, name_ar, price_monthly, max_students from public.plans order by sort_order;
--   select p.code, array_agg(pf.feature_key order by pf.sort_order)
--     from public.plan_features pf join public.plans p on p.id = pf.plan_id group by p.code;
-- =====================================================================
