-- =====================================================================
-- MIGRATION: صلاحيات دقيقة على مستوى المسار والحلقة
-- =====================================================================
-- طبّقي هذا الملف عبر Supabase SQL Editor (أو supabase db push) على قاعدة
-- بيانات سُحُب بعد base_schema.sql و apply-volunteers.sql.
--
-- الفكرة:
--  - user_roles تكتسب track_id و circle_id اختياريين لتقييد الدور بنطاق
--    محدد. الصف بدون track_id/circle_id (null) = دور على مستوى المقرأة
--    كاملة (السلوك القديم، متوافق رجوعًا مع كل الحسابات الحالية).
--  - نائبة أكاديمية (academic_deputy) مرتبطة بمسار: صلاحيات كاملة
--    (قراءة/إضافة/تعديل/حذف) داخل ذلك المسار فقط.
--  - معلمة/مشرفة مرتبطة بحلقة: قراءة فقط لحلقتها (حلقات/طالبات/تسجيل
--    الطالبات)، ولا تملك إضافة/تعديل/حذف على هذه الجداول. أما الأنصبة
--    والتقدم والحضور فتبقى قابلة للإدخال منها إن سمح إعداد المقرأة
--    progress_entry_mode بذلك، وبشرط أن يكون الإدخال داخل حلقتها فقط.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) أعمدة النطاق على user_roles
-- ---------------------------------------------------------------------
alter table public.user_roles
  add column if not exists track_id uuid references public.tracks(id) on delete cascade,
  add column if not exists circle_id uuid references public.circles(id) on delete cascade;

create index if not exists user_roles_track_idx on public.user_roles (track_id);
create index if not exists user_roles_circle_idx on public.user_roles (circle_id);

-- الفهرس القديم كان يمنع تكرار (user, role, tenant)؛ الآن قد تحتاج المستخدمة
-- نفس الدور بأكثر من نطاق (مثلاً معلمة في حلقتين)، لذا نوسّع الفهرس ليشمل
-- النطاق أيضاً.
drop index if exists public.user_roles_user_role_tenant_uidx;
create unique index if not exists user_roles_user_role_scope_uidx
  on public.user_roles (
    user_id,
    role,
    coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(track_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(circle_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- ---------------------------------------------------------------------
-- 2) دوال مساعدة (SECURITY DEFINER)
-- ---------------------------------------------------------------------

-- هل تدير المستخدمة هذا المسار بالكامل؟ (قائدة/نائبة إدارية دائماً،
-- أو نائبة أكاديمية غير مقيّدة بمسار، أو نائبة أكاديمية مقيّدة بهذا المسار)
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
            and (r.track_id is null or r.track_id = t.id)
        )
      )
  );
$$;

-- هل تستطيع المستخدمة رؤية هذه الحلقة؟ (قيادة، نائبة أكاديمية لمسار
-- الحلقة، أو معلمة/مشرفة مرتبطة بهذه الحلقة تحديداً أو غير مقيّدة بحلقة)
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
            and (r.track_id is null or r.track_id = c.track_id)
        )
        or exists (
          select 1 from public.user_roles r
          where r.user_id = _user_id
            and r.tenant_id = c.tenant_id
            and r.role in ('teacher', 'supervisor')
            and (r.circle_id is null or r.circle_id = c.id)
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

-- هل تستطيع المستخدمة إدارة (إضافة/تعديل/حذف) هذه الحلقة؟ المعلمة
-- والمشرفة مستبعدتان دائماً هنا (قراءة فقط بحسب المتطلبات).
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
            and (r.track_id is null or r.track_id = c.track_id)
        )
      )
  );
$$;

-- إدارة الحلقات ضمن مسار معيّن مباشرة (تُستخدم عند إنشاء حلقة جديدة،
-- حيث لا يوجد بعد id للحلقة نفسها لفحص can_manage_circle عليه).
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
        and (r.track_id is null or r.track_id = _track_id)
    );
$$;

-- هل تستطيع المستخدمة رؤية بيانات هذه الطالبة؟
create or replace function public.can_view_student(_user_id uuid, _student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.id = _student_id
      and (
        public.is_tenant_manager(_user_id, s.tenant_id)
        or exists (
          select 1 from public.user_roles r
          where r.user_id = _user_id and r.tenant_id = s.tenant_id and r.role = 'student'
        )
        or exists ( -- نائبة أكاديمية: غير مقيّدة، أو الطالبة ضمن حلقة من مسارها، أو الطالبة غير مسندة بعد
          select 1 from public.user_roles r
          where r.user_id = _user_id and r.tenant_id = s.tenant_id and r.role = 'academic_deputy'
            and (
              r.track_id is null
              or not exists (select 1 from public.circle_students cs where cs.student_id = s.id)
              or exists (
                select 1 from public.circle_students cs
                join public.circles c on c.id = cs.circle_id
                where cs.student_id = s.id and c.track_id = r.track_id
              )
            )
        )
        or exists ( -- معلمة/مشرفة: الطالبة ضمن حلقتها المسندة، أو غير مقيّدة بحلقة
          select 1 from public.user_roles r
          where r.user_id = _user_id and r.tenant_id = s.tenant_id and r.role in ('teacher', 'supervisor')
            and (
              r.circle_id is null
              or exists (
                select 1 from public.circle_students cs
                where cs.student_id = s.id and cs.circle_id = r.circle_id
              )
            )
        )
      )
  );
$$;

-- هل تستطيع المستخدمة إضافة/تعديل/حذف بيانات هذه الطالبة؟
-- (معلمة/مشرفة مستبعدتان دائماً — قراءة فقط)
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
      and (
        public.is_tenant_manager(_user_id, s.tenant_id)
        or exists (
          select 1 from public.user_roles r
          where r.user_id = _user_id and r.tenant_id = s.tenant_id and r.role = 'academic_deputy'
            and (
              r.track_id is null
              or not exists (select 1 from public.circle_students cs where cs.student_id = s.id)
              or exists (
                select 1 from public.circle_students cs
                join public.circles c on c.id = cs.circle_id
                where cs.student_id = s.id and c.track_id = r.track_id
              )
            )
        )
      )
  );
$$;

-- إنشاء طالبة جديدة (لا يوجد بعد id لفحصه): يُسمح للقيادة ولأي نائبة
-- أكاديمية في المقرأة (لأن الطالبة الجديدة غير مسندة لأي مسار بعد).
create or replace function public.can_create_student(_user_id uuid, _tenant_id uuid)
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
      where r.user_id = _user_id and r.tenant_id = _tenant_id and r.role = 'academic_deputy'
    );
$$;

-- إدارة (إضافة/تعديل/حذف) سجلات النصاب/التقدم/الحضور داخل حلقة معيّنة،
-- بحسب إعداد progress_entry_mode في المقرأة. القيادة والنائبة الأكاديمية
-- (ضمن مسارها) لهما الإدخال دائماً بلا اشتراط إعداد المقرأة.
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
    );
$$;

-- نفس الشيء لكن على مستوى المسار (تُستخدم عندما لا يوجد circle_id،
-- كسجل تقدم عام على مستوى المسار).
create or replace function public.can_manage_track_entries(_user_id uuid, _tenant_id uuid, _track_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_track(_user_id, _track_id);
$$;

-- ---------------------------------------------------------------------
-- 3) إعادة كتابة السياسات
-- ---------------------------------------------------------------------

-- ---------------- tracks ----------------
drop policy if exists "tracks_manager_write" on public.tracks;
create policy "tracks_scoped_write" on public.tracks
  for all to authenticated
  using (public.can_manage_track(auth.uid(), id))
  with check (public.can_manage_track(auth.uid(), id));
-- ملاحظة: تبقى tracks_member_read كما هي (كل عضوات المقرأة يقرأن قائمة
-- المسارات، فهذا غير حساس ومطلوب للقوائم المنسدلة).

-- ---------------- circles ----------------
drop policy if exists "circles_member_read" on public.circles;
create policy "circles_scoped_read" on public.circles
  for select to authenticated
  using (public.can_view_circle(auth.uid(), id));

drop policy if exists "circles_manager_write" on public.circles;
create policy "circles_scoped_update_delete" on public.circles
  for update to authenticated
  using (public.can_manage_circle(auth.uid(), id))
  with check (public.can_manage_circles_in_track(auth.uid(), tenant_id, track_id));

create policy "circles_scoped_delete" on public.circles
  for delete to authenticated
  using (public.can_manage_circle(auth.uid(), id));

create policy "circles_scoped_insert" on public.circles
  for insert to authenticated
  with check (public.can_manage_circles_in_track(auth.uid(), tenant_id, track_id));

-- ---------------- students ----------------
drop policy if exists "students_member_read" on public.students;
create policy "students_scoped_read" on public.students
  for select to authenticated
  using (public.can_view_student(auth.uid(), id));

drop policy if exists "students_manager_write" on public.students;
create policy "students_scoped_insert" on public.students
  for insert to authenticated
  with check (public.can_create_student(auth.uid(), tenant_id));

create policy "students_scoped_update" on public.students
  for update to authenticated
  using (public.can_manage_student(auth.uid(), id))
  with check (public.can_manage_student(auth.uid(), id));

create policy "students_scoped_delete" on public.students
  for delete to authenticated
  using (public.can_manage_student(auth.uid(), id));

-- ---------------- circle_students ----------------
drop policy if exists "circle_students_manager_write" on public.circle_students;
create policy "circle_students_scoped_write" on public.circle_students
  for all to authenticated
  using (public.can_manage_circle(auth.uid(), circle_id))
  with check (public.can_manage_circle(auth.uid(), circle_id));
-- ملاحظة: تبقى circle_students_member_read كما هي (قراءة لأي عضوة في
-- المقرأة)؛ عدّليها لاحقاً لاستخدام can_view_circle إن أردتِ تقييد
-- القراءة أيضاً على مستوى الحلقة/التسجيلات.
drop policy if exists "circle_students_member_read" on public.circle_students;
create policy "circle_students_scoped_read" on public.circle_students
  for select to authenticated
  using (public.can_view_circle(auth.uid(), circle_id));

-- ---------------- attendance ----------------
drop policy if exists "attendance_member_read" on public.attendance;
create policy "attendance_scoped_read" on public.attendance
  for select to authenticated
  using (public.can_view_circle(auth.uid(), circle_id));

drop policy if exists "attendance_recorder_write" on public.attendance;
create policy "attendance_scoped_write" on public.attendance
  for all to authenticated
  using (public.can_manage_circle_entries(auth.uid(), tenant_id, circle_id))
  with check (public.can_manage_circle_entries(auth.uid(), tenant_id, circle_id));

-- ---------------- progress_records ----------------
drop policy if exists "progress_records_member_read" on public.progress_records;
create policy "progress_records_scoped_read" on public.progress_records
  for select to authenticated
  using (
    (circle_id is not null and public.can_view_circle(auth.uid(), circle_id))
    or (circle_id is null and public.is_tenant_member(auth.uid(), tenant_id))
  );

drop policy if exists "progress_records_recorder_write" on public.progress_records;
create policy "progress_records_scoped_write" on public.progress_records
  for all to authenticated
  using (
    case
      when circle_id is not null then public.can_manage_circle_entries(auth.uid(), tenant_id, circle_id)
      else public.can_manage_track_entries(auth.uid(), tenant_id, track_id)
    end
  )
  with check (
    case
      when circle_id is not null then public.can_manage_circle_entries(auth.uid(), tenant_id, circle_id)
      else public.can_manage_track_entries(auth.uid(), tenant_id, track_id)
    end
  );

-- =====================================================================
-- تمّ. بعد التطبيق:
--  - أي صف قديم في user_roles (track_id/circle_id = null) يستمر بنفس
--    صلاحياته الحالية على مستوى المقرأة كاملة (لا كسر رجعي).
--  - لتفعيل التقييد لعضوة معيّنة: من صفحة «المتطوعات» حدّدي مسارها
--    (للنائبة الأكاديمية) أو حلقتها (للمعلمة/المشرفة).
-- =====================================================================
