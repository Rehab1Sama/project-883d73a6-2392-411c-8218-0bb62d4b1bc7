-- =====================================================================
-- MIGRATION: إصلاحات صلاحيات + تقييد الأنصبة + وضع القراءة فقط عند
--            انتهاء الاشتراك + إنفاذ حدود الباقة + نسبة استهلاكها
-- =====================================================================
-- طبّقي هذا الملف بعد base_schema.sql و apply-volunteers.sql و
-- migration_scoped_permissions.sql. آمن للتشغيل أكثر من مرة (idempotent).
-- الترتيب بالأسفل مهم: كل دالة تُعرَّف قبل أول استخدام لها.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) هل اشتراك المقرأة مفعّل؟ (trialing/active/past_due = مفعّل)
-- ---------------------------------------------------------------------
-- "past_due" مقصودة عمدًا كمهلة سماح قصيرة (متأخر بالدفع لكن لسا ما
-- انتهى/انلغى) — لو تبين إيقاف الكتابة فورًا بمجرد التأخر بدون مهلة،
-- احذفي 'past_due' من القائمة بالأسفل.
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
      and s.status in ('trialing', 'active', 'past_due')
  );
$$;

-- ---------------------------------------------------------------------
-- 1) إصلاح: القائدة ما تقدر تدير user_roles + تمييز صلاحياتها عن
--    النائبة الإدارية + إيقاف كامل عند انتهاء الاشتراك
-- ---------------------------------------------------------------------
-- قواعد can_manage_role_assignment:
--  - مالكة المنصة: مسموح دائمًا (تدير أي مقرأة حتى لو اشتراكها منتهي،
--    لأنها هي من تُصلح/تحدّث الاشتراك أصلًا).
--  - أي أحد غيرها: ممنوع كليًا لو اشتراك المقرأة غير مفعّل (وضع قراءة
--    فقط، لا استثناء ولا حتى للقائدة).
--  - ممنوع نهائيًا إسناد دور platform_owner من هذا المسار.
--  - فقط القائدة (tenant_admin) تقدر تسند/تعدّل/تحذف صف بدور tenant_admin
--    أو admin_deputy. النائبة الإدارية تدير بقية الأدوار فقط، ولا تقدر
--    ترقّي نفسها أو غيرها لقائدة أو نائبة إدارية أخرى.
drop policy if exists "roles_manage" on public.user_roles;
drop policy if exists "roles_manage_platform" on public.user_roles;
drop policy if exists "roles_manage_tenant" on public.user_roles;

create or replace function public.can_manage_role_assignment(_actor uuid, _tenant_id uuid, _role public.app_role)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _is_tenant_admin boolean;
begin
  if public.is_platform_owner(_actor) then
    return true;
  end if;
  if _tenant_id is null then
    return false;
  end if;
  if not public.is_tenant_manager(_actor, _tenant_id) then
    return false;
  end if;
  if not public.tenant_subscription_active(_tenant_id) then
    return false;
  end if;
  if _role = 'platform_owner' then
    return false;
  end if;
  if _role in ('tenant_admin', 'admin_deputy') then
    select exists (
      select 1 from public.user_roles r
      where r.user_id = _actor and r.tenant_id = _tenant_id and r.role = 'tenant_admin'
    ) into _is_tenant_admin;
    return coalesce(_is_tenant_admin, false);
  end if;
  return true;
end;
$$;

create policy "roles_manage" on public.user_roles
  for all to authenticated
  using (public.can_manage_role_assignment(auth.uid(), tenant_id, role))
  with check (public.can_manage_role_assignment(auth.uid(), tenant_id, role));

-- ---------------------------------------------------------------------
-- 2) تقييد إدخال الأنصبة/التقدم على المعلمة/المشرفة فقط (بحسب
--    progress_entry_mode) + إيقافه كليًا عند انتهاء الاشتراك
-- ---------------------------------------------------------------------
-- can_manage_circle_entries (بملف migration_scoped_permissions.sql)
-- تبقى كما هي بلا تعديل، وتُستخدم للحضور (attendance) فقط، حيث القيادة
-- ما زال مسموح لها تسجيل الحضور. هذي دالة جديدة مستقلة للأنصبة تحديدًا.
create or replace function public.can_manage_progress_entries(_user_id uuid, _tenant_id uuid, _circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.tenant_subscription_active(_tenant_id)
    and (
      exists (
        select 1
        from public.user_roles r
        join public.tenants t on t.id = r.tenant_id
        where r.user_id = _user_id
          and r.tenant_id = _tenant_id
          and r.role = 'teacher'
          and t.progress_entry_mode in ('teacher', 'both')
          and (r.circle_id is null or r.circle_id = _circle_id)
      )
      or exists (
        select 1
        from public.user_roles r
        join public.tenants t on t.id = r.tenant_id
        where r.user_id = _user_id
          and r.tenant_id = _tenant_id
          and r.role = 'supervisor'
          and t.progress_entry_mode in ('supervisor', 'both')
          and (r.circle_id is null or r.circle_id = _circle_id)
      )
    );
$$;

drop policy if exists "progress_records_scoped_write" on public.progress_records;
create policy "progress_records_scoped_write" on public.progress_records
  for all to authenticated
  using (
    case
      when circle_id is not null then public.can_manage_progress_entries(auth.uid(), tenant_id, circle_id)
      -- سجل نصاب على مستوى المسار مباشرة (بدون حلقة): لا معلمة ولا مشرفة
      -- مرتبطة بمسار (فقط بحلقة) — فلا يوجد من يملك صلاحية إدخاله الآن.
      else false
    end
  )
  with check (
    case
      when circle_id is not null then public.can_manage_progress_entries(auth.uid(), tenant_id, circle_id)
      else false
    end
  );

-- ---------------------------------------------------------------------
-- 3) وضع القراءة فقط الشامل عند انتهاء الاشتراك — بقية الجداول
-- ---------------------------------------------------------------------
-- نضيف شرط tenant_subscription_active داخل كل دالة "can_manage_*"
-- المستخدَمة حصرًا بسياسات الكتابة (insert/update/delete)، وليس داخل
-- دوال العرض (can_view_*, is_tenant_member) حتى تبقى القراءة شغّالة.
-- مالكة المنصة مستثناة دائمًا (تحتاج تدير المقرأة لإصلاح اشتراكها).

-- تعديل المسارات (tracks)
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
      and (public.is_platform_owner(_user_id) or public.tenant_subscription_active(t.tenant_id))
      and (
        public.is_tenant_manager(_user_id, t.tenant_id)
        or exists (
          select 1 from public.user_roles r
          where r.user_id = _user_id
            and r.tenant_id = t.tenant_id
            and r.role = 'academic_deputy'
            and (r.track_id is null or r.track_id = t.id)
        )
      )
  );
$$;

-- تعديل/حذف حلقة
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
      and (public.is_platform_owner(_user_id) or public.tenant_subscription_active(c.tenant_id))
      and (
        public.is_tenant_manager(_user_id, c.tenant_id)
        or exists (
          select 1 from public.user_roles r
          where r.user_id = _user_id
            and r.tenant_id = c.tenant_id
            and r.role = 'academic_deputy'
            and (r.track_id is null or r.track_id = c.track_id)
        )
      )
  );
$$;

-- إضافة حلقة جديدة ضمن مسار
create or replace function public.can_manage_circles_in_track(_user_id uuid, _tenant_id uuid, _track_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (public.is_platform_owner(_user_id) or public.tenant_subscription_active(_tenant_id))
    and (
      public.is_tenant_manager(_user_id, _tenant_id)
      or exists (
        select 1 from public.user_roles r
        where r.user_id = _user_id
          and r.tenant_id = _tenant_id
          and r.role = 'academic_deputy'
          and (r.track_id is null or r.track_id = _track_id)
      )
    );
$$;

-- تعديل/حذف طالبة
create or replace function public.can_manage_student(_user_id uuid, _student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.id = _student_id
      and (public.is_platform_owner(_user_id) or public.tenant_subscription_active(s.tenant_id))
      and (
        public.is_tenant_manager(_user_id, s.tenant_id)
        or exists (
          select 1 from public.user_roles r
          where r.user_id = _user_id
            and r.tenant_id = s.tenant_id
            and r.role = 'academic_deputy'
            and (
              r.track_id is null
              or r.track_id in (select c.track_id from public.circles c join public.circle_students cs on cs.circle_id = c.id where cs.student_id = s.id)
            )
        )
      )
  );
$$;

-- إضافة طالبة جديدة
create or replace function public.can_create_student(_user_id uuid, _tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (public.is_platform_owner(_user_id) or public.tenant_subscription_active(_tenant_id))
    and (
      public.is_tenant_manager(_user_id, _tenant_id)
      or exists (
        select 1 from public.user_roles r
        where r.user_id = _user_id and r.tenant_id = _tenant_id and r.role = 'academic_deputy'
      )
    );
$$;

-- تحديث إعدادات المقرأة (الاسم/الشعار/الألوان...) من القائدة
drop policy if exists "tenants_manager_update" on public.tenants;
create policy "tenants_manager_update" on public.tenants
  for update to authenticated
  using (public.is_tenant_manager(auth.uid(), id))
  with check (
    public.is_tenant_manager(auth.uid(), id)
    and (public.is_platform_owner(auth.uid()) or public.tenant_subscription_active(id))
  );

-- ---------------------------------------------------------------------
-- 4) إنفاذ حدود الباقة (max_students / max_circles / max_teachers)
-- ---------------------------------------------------------------------
-- الدالة public.tenant_within_limit كانت موجودة من قبل (0 = بلا حدود)
-- لكن غير مستخدمة بأي مكان. نربطها الآن بمشغّلات (triggers) BEFORE INSERT
-- على الجداول الثلاثة، برسالة خطأ عربية واضحة بدل رفض RLS صامت.

create or replace function public.enforce_student_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tenant_within_limit(new.tenant_id, 'students') then
    raise exception 'وصلتِ الحد الأعلى لعدد الطالبات في باقتك الحالية. رقّي باقتك لإضافة طالبات جديدات.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists students_enforce_limit on public.students;
create trigger students_enforce_limit
  before insert on public.students
  for each row execute function public.enforce_student_limit();

create or replace function public.enforce_circle_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tenant_within_limit(new.tenant_id, 'circles') then
    raise exception 'وصلتِ الحد الأعلى لعدد الحلقات في باقتك الحالية. رقّي باقتك لإضافة حلقات جديدة.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists circles_enforce_limit on public.circles;
create trigger circles_enforce_limit
  before insert on public.circles
  for each row execute function public.enforce_circle_limit();

create or replace function public.enforce_teacher_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- الحد يخص دور "معلمة" تحديدًا (max_teachers)، لا بقية الأدوار.
  if new.role = 'teacher' and new.tenant_id is not null
     and not public.tenant_within_limit(new.tenant_id, 'teachers') then
    raise exception 'وصلتِ الحد الأعلى لعدد المعلمات في باقتك الحالية. رقّي باقتك لإضافة معلمات جديدات.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists user_roles_enforce_teacher_limit on public.user_roles;
create trigger user_roles_enforce_teacher_limit
  before insert on public.user_roles
  for each row execute function public.enforce_teacher_limit();

-- ---------------------------------------------------------------------
-- 5) لمالكة المنصة: نسبة استهلاك كل مقرأة لحدود باقتها
-- ---------------------------------------------------------------------
-- تُرجع لكل مقرأة استخدامها الحالي وحدّ باقتها لكل بند (طالبات/حلقات/
-- معلمات)، ونسبة الاستهلاك = أعلى نسبة بين البنود الثلاثة (0 لو ما فيه
-- حد = بلا حدود). محصورة على مالكة المنصة فقط.
create or replace function public.platform_tenant_usage_summary()
returns table (
  tenant_id uuid,
  students_used integer,
  students_limit integer,
  circles_used integer,
  circles_limit integer,
  teachers_used integer,
  teachers_limit integer,
  usage_pct numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_owner(auth.uid()) then
    raise exception 'غير مصرح لك بهذه البيانات' using errcode = '42501';
  end if;

  return query
  with current_plan as (
    select distinct on (s.tenant_id)
      s.tenant_id,
      s.plan_id
    from public.subscriptions s
    where s.status in ('trialing', 'active', 'past_due')
    order by s.tenant_id, s.created_at desc
  ),
  usage as (
    select
      t.id as tid,
      (select count(*) from public.students st where st.tenant_id = t.id)::integer as s_used,
      (select count(*) from public.circles c where c.tenant_id = t.id)::integer as c_used,
      (select count(*) from public.user_roles r where r.tenant_id = t.id and r.role = 'teacher')::integer as th_used,
      coalesce(p.max_students, 0) as s_limit,
      coalesce(p.max_circles, 0) as c_limit,
      coalesce(p.max_teachers, 0) as th_limit
    from public.tenants t
    left join current_plan cp on cp.tenant_id = t.id
    left join public.plans p on p.id = cp.plan_id
  )
  select
    tid,
    s_used, s_limit,
    c_used, c_limit,
    th_used, th_limit,
    greatest(
      case when s_limit > 0 then round((s_used::numeric / s_limit) * 100, 1) else 0 end,
      case when c_limit > 0 then round((c_used::numeric / c_limit) * 100, 1) else 0 end,
      case when th_limit > 0 then round((th_used::numeric / th_limit) * 100, 1) else 0 end
    ) as usage_pct
  from usage;
end;
$$;

grant execute on function public.platform_tenant_usage_summary() to authenticated;

-- ---------------------------------------------------------------------
-- 6) الحضور = نفس الأنصبة تمامًا (نفس الصلاحية، نفس القيد)
-- ---------------------------------------------------------------------
-- توضيح مهم من صاحبة المنتج: الحضور والأنصبة عملية واحدة من نفس الشاشة
-- (نفس المعلمة/المشرفة بنفس اللحظة) — فلا معنى لوجود دالتين مختلفتين
-- لهما. نلغي can_manage_circle_entries كليًا (وفيها استثناء للقيادة كان
-- خطأ أصلًا) ونجعل سياسة attendance تستخدم can_manage_progress_entries
-- نفسها المستخدمة لجدول progress_records. النتيجة: قيد واحد موحّد —
-- معلمة/مشرفة فقط بحسب progress_entry_mode، ولا أحد غيرهما ولا حتى
-- القيادة، ويتوقف تمامًا عند انتهاء الاشتراك (already inside الدالة).
drop policy if exists "attendance_scoped_write" on public.attendance;
create policy "attendance_scoped_write" on public.attendance
  for all to authenticated
  using (public.can_manage_progress_entries(auth.uid(), tenant_id, circle_id))
  with check (public.can_manage_progress_entries(auth.uid(), tenant_id, circle_id));

drop function if exists public.can_manage_circle_entries(uuid, uuid, uuid);

-- ---------------------------------------------------------------------
-- 7) التسجيل العلني (طلبات التطوع/الانضمام من صفحات /m و /v) يتوقف
--    كمان عند انتهاء الاشتراك — بالإضافة لشرط volunteering_open الحالي
-- ---------------------------------------------------------------------
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
    and public.tenant_subscription_active(tenant_id)
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
    and public.tenant_subscription_active(tenant_id)
  );

-- مراجعة/اعتماد/رفض/حذف طلبات التطوع من القائدة تتوقف كذلك (تبقى
-- القراءة "volunteer_applications_manager_read" شغّالة بدون تغيير).
drop policy if exists "volunteer_applications_manager_update" on public.volunteer_applications;
create policy "volunteer_applications_manager_update" on public.volunteer_applications
  for update to authenticated
  using (public.is_tenant_manager(auth.uid(), tenant_id))
  with check (
    public.is_tenant_manager(auth.uid(), tenant_id)
    and (public.is_platform_owner(auth.uid()) or public.tenant_subscription_active(tenant_id))
  );

drop policy if exists "volunteer_applications_manager_delete" on public.volunteer_applications;
create policy "volunteer_applications_manager_delete" on public.volunteer_applications
  for delete to authenticated
  using (
    public.is_tenant_manager(auth.uid(), tenant_id)
    and (public.is_platform_owner(auth.uid()) or public.tenant_subscription_active(tenant_id))
  );

-- =====================================================================
-- تمّ. ملاحظات مهمة:
--  - الحدود (٤) تُفحص عند الإضافة (INSERT) فقط، وليس عند تغيير دور
--    موجود إلى "معلمة" عبر UPDATE — حالة نادرة، أضيفي trigger على
--    UPDATE لاحقًا لو احتجتِها.
--  - وضع القراءة فقط (٣، ٦، ٧) يشمل الآن: المسارات، الحلقات، الطالبات،
--    الأنصبة، الحضور، إدارة الأدوار، إعدادات المقرأة، وطلبات
--    التطوع/الانضمام (تسجيل جديد + مراجعة القائدة لها) — بلا استثناء
--    لأي دور غير مالكة المنصة.
--  - الحضور والأنصبة الآن نفس القيد تمامًا (can_manage_progress_entries):
--    معلمة/مشرفة فقط بحسب progress_entry_mode، بدون استثناء للقيادة —
--    ودالة can_manage_circle_entries القديمة أُلغيت نهائيًا.
--  - رسائل الخطأ تصل للواجهة عبر e.message من Supabase؛ تأكدي إن كل
--    mutation بالواجهة يعرض e.message بدل رسالة عامة ليستفيد المستخدم
--    من الرسائل العربية الواضحة أعلاه.
-- =====================================================================
