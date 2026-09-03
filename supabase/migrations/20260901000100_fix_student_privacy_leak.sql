-- إصلاح ثغرة خصوصية خطيرة: can_view_student() و can_view_circle() كانتا
-- تسمحان لأي طالبة عندها حساب دخول (دور 'student' بهذي المقرأة) بقراءة
-- بيانات *كل* طالبات المقرأة وكل حلقاتها — مو صفّها/حلقتها بس — لأن الشرط
-- كان "عندها دور طالبة بهذي المقرأة" فقط، بدون أي تحقق إن الصف/الحلقة
-- يخصّها هي بالذات.
--
-- سياسة students_self_select (بملف 20260901000000_student_portal.sql)
-- ما كانت كافية لسدّ هذي الثغرة: سياسات RLS تتجمع بـ OR، فسياسة
-- students_scoped_read الأوسع (المبنية على can_view_student) بقيت فعّالة
-- وتلغي فائدة السياسة الأدق.
--
-- هذا الملف يعيد تعريف الدالتين فقط (idempotent، create or replace) —
-- لا حاجة لمس السياسات نفسها لأنها تستدعي هاتين الدالتين مباشرة.

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
        -- الطالبة نفسها فقط (بدل أي طالبة بالمقرأة)
        or s.user_id = _user_id
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
        -- طالبة مسجّلة فعليًا بهذي الحلقة بالذات فقط (بدل أي طالبة بالمقرأة)
        or exists (
          select 1 from public.circle_students cs
          join public.students s on s.id = cs.student_id
          where cs.circle_id = c.id and s.user_id = _user_id
        )
      )
  );
$$;
