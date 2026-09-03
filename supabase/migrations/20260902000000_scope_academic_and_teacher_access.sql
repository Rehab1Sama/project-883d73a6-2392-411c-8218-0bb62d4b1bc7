-- =====================================================================
-- تصحيح: "غير مقيّدة = بلا صلاحية" بدل "غير مقيّدة = نطاق كامل"
-- =====================================================================
-- كانت الدوال أدناه تمنح نائبة أكاديمية بلا track_id مسنَد (أو معلمة/
-- مشرفة بلا circle_id مسنَد) نطاقًا كاملاً (كل المسارات/الحلقات). هذا عكس
-- المطلوب فعليًا:
--   - القائدة (tenant_admin/admin_deputy) ومالكة المنصة: كل الحلقات دائمًا.
--   - نائبة أكاديمية (academic_deputy): فقط المسار/المسارات المسنَدة لها
--     صراحة عبر track_id. بلا مسار مسنَد = بلا صلاحية إطلاقًا حتى تُقيَّد.
--   - معلمة/مشرفة (teacher/supervisor): فقط الحلقة/الحلقات المسنَدة لها
--     صراحة عبر circle_id. بلا حلقة مسنَدة = بلا صلاحية إطلاقًا حتى تُقيَّد.
--
-- ⚠️ راجعي أسماء وتوقيعات هذه الدوال في قاعدتك الحية قبل التطبيق (عبر
-- supabase db push أو محرر SQL) — إن اختلفت التوقيعات عن الموجود هنا
-- (مثلاً بارامترات إضافية) سيفشل CREATE OR REPLACE وتحتاجين لصقها هنا لي
-- لأعدّل عليها بدقة بدل التخمين.
-- =====================================================================

create or replace function public.can_manage_track(_user_id uuid, _track_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tracks t
    where t.id = _track_id
      and (
        public.is_tenant_manager(_user_id, t.tenant_id)
        or exists (
          select 1 from public.user_roles r
          where r.user_id = _user_id
            and r.tenant_id = t.tenant_id
            and r.role = 'academic_deputy'
            and r.track_id = t.id -- ⚠️ لم يعد r.track_id is null يمنح نطاقًا كاملاً
        )
      )
  );
$$;

create or replace function public.can_view_circle(_user_id uuid, _circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.circles c
    where c.id = _circle_id
      and (
        public.is_tenant_manager(_user_id, c.tenant_id)
        or exists (
          select 1 from public.user_roles r
          where r.user_id = _user_id
            and r.tenant_id = c.tenant_id
            and r.role = 'academic_deputy'
            and r.track_id = c.track_id -- ⚠️ لم يعد r.track_id is null يمنح كل الحلقات
        )
        or exists (
          select 1 from public.user_roles r
          where r.user_id = _user_id
            and r.tenant_id = c.tenant_id
            and r.role in ('teacher', 'supervisor')
            and r.circle_id = c.id -- ⚠️ لم يعد r.circle_id is null يمنح كل الحلقات
        )
        or exists (
          select 1 from public.user_roles r
          where r.user_id = _user_id
            and r.tenant_id = c.tenant_id
            and r.role = 'student'
        )
      )
  );
$$;

create or replace function public.can_manage_circle(_user_id uuid, _circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.circles c
    where c.id = _circle_id
      and (
        public.is_tenant_manager(_user_id, c.tenant_id)
        or exists (
          select 1 from public.user_roles r
          where r.user_id = _user_id
            and r.tenant_id = c.tenant_id
            and r.role = 'academic_deputy'
            and r.track_id = c.track_id
        )
      )
  );
$$;

create or replace function public.can_manage_circles_in_track(_user_id uuid, _tenant_id uuid, _track_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_tenant_manager(_user_id, _tenant_id)
    or exists (
      select 1 from public.user_roles r
      where r.user_id = _user_id
        and r.tenant_id = _tenant_id
        and r.role = 'academic_deputy'
        and r.track_id = _track_id
    );
$$;

-- إدخال الأنصبة/التقدم/الحضور: نفس المبدأ — معلمة/مشرفة بلا circle_id
-- مسنَد لا تُدخل بيانات لأي حلقة، فقط لحلقتها المسندة صراحة. القيادة
-- والنائبة الأكاديمية (ضمن مسارها المسنَد) تبقى تدخل عبر can_manage_circle.
create or replace function public.can_manage_circle_entries(_user_id uuid, _tenant_id uuid, _circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_manage_circle(_user_id, _circle_id)
    or exists (
      select 1
      from public.user_roles r
      join public.tenants t on t.id = r.tenant_id
      where r.user_id = _user_id
        and r.tenant_id = _tenant_id
        and r.role = 'teacher'
        and t.progress_entry_mode in ('teacher', 'both')
        and r.circle_id = _circle_id
    )
    or exists (
      select 1
      from public.user_roles r
      join public.tenants t on t.id = r.tenant_id
      where r.user_id = _user_id
        and r.tenant_id = _tenant_id
        and r.role = 'supervisor'
        and t.progress_entry_mode in ('supervisor', 'both')
        and r.circle_id = _circle_id
    );
$$;
