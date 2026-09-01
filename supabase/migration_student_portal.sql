-- بوابة الطالبة
-- طريقة التطبيق: افتحي Supabase → SQL Editor والصقي هذا الملف كاملاً ثم Run.
--
-- ما الذي يفعله:
-- 1) ربط حساب الدخول بصف الطالبة عبر students.user_id
-- 2) سياسات قراءة ذاتية للطالبة على صفّها وسجلاتها فقط
-- 3) دالة SECURITY DEFINER تُرجع كل بيانات البوابة (الحلقة، المعلمة،
--    المشرفة، الحضور، التقدّم) بعد التحقق أن الصف يخص المستخدمة الحالية.
-- لا تُمسّ أي سياسة قائمة للموظفات.

alter table public.students
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists students_user_id_key
  on public.students(user_id)
  where user_id is not null;

-- الطالبة تقرأ صفّها فقط
drop policy if exists "students_self_select" on public.students;
create policy "students_self_select" on public.students
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.students to authenticated;

-- ربط الطالبة بحلقتها
drop policy if exists "circle_students_self_select" on public.circle_students;
create policy "circle_students_self_select" on public.circle_students
  for select to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = circle_students.student_id and s.user_id = auth.uid()
    )
  );

grant select on public.circle_students to authenticated;

-- سجلات الحضور الخاصة بها
drop policy if exists "attendance_self_select" on public.attendance;
create policy "attendance_self_select" on public.attendance
  for select to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = attendance.student_id and s.user_id = auth.uid()
    )
  );

grant select on public.attendance to authenticated;

-- سجلات التقدّم الخاصة بها
drop policy if exists "progress_records_self_select" on public.progress_records;
create policy "progress_records_self_select" on public.progress_records
  for select to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = progress_records.student_id and s.user_id = auth.uid()
    )
  );

grant select on public.progress_records to authenticated;

-- هل المستخدمة الحالية طالبة مرتبطة بصف في هذه المقرأة؟
create or replace function public.my_student_id(_tenant_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.students s
  where s.user_id = auth.uid()
    and s.tenant_id = _tenant_id
  limit 1
$$;

grant execute on function public.my_student_id(uuid) to authenticated;

-- كل بيانات بوابة الطالبة في استدعاء واحد
create or replace function public.student_portal(_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant record;
  v_student record;
  v_circle record;
  v_track record;
  v_teacher text;
  v_supervisor text;
begin
  select id, name, slug, logo_url into v_tenant
  from public.tenants
  where slug = _slug;

  if v_tenant.id is null then
    return jsonb_build_object('found', false, 'reason', 'tenant_not_found');
  end if;

  select s.* into v_student
  from public.students s
  where s.tenant_id = v_tenant.id
    and s.user_id = auth.uid()
  limit 1;

  if v_student.id is null then
    return jsonb_build_object('found', false, 'reason', 'not_linked');
  end if;

  select c.* into v_circle
  from public.circle_students cs
  join public.circles c on c.id = cs.circle_id
  where cs.student_id = v_student.id
  order by cs.created_at desc
  limit 1;

  if v_circle.id is not null and v_circle.track_id is not null then
    select t.* into v_track from public.tracks t where t.id = v_circle.track_id;
  end if;

  if v_circle.id is not null then
    v_teacher := coalesce(
      (select p.full_name from public.profiles p where p.id = v_circle.teacher_user_id),
      v_circle.teacher_name
    );

    select p.full_name into v_supervisor
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.role = 'supervisor'
      and ur.tenant_id = v_tenant.id
      and (
        ur.circle_id = v_circle.id
        or (ur.circle_id is null and (ur.track_id is null or ur.track_id = v_circle.track_id))
      )
    order by (ur.circle_id = v_circle.id) desc
    limit 1;
  end if;

  return jsonb_build_object(
    'found', true,
    'tenant', jsonb_build_object(
      'id', v_tenant.id, 'name', v_tenant.name, 'slug', v_tenant.slug,
      'logo_url', v_tenant.logo_url
    ),
    'student', jsonb_build_object(
      'id', v_student.id, 'full_name', v_student.full_name,
      'status', v_student.status, 'age', v_student.age, 'country', v_student.country
    ),
    'circle', case when v_circle.id is null then null else jsonb_build_object(
      'id', v_circle.id, 'name', v_circle.name, 'schedule', v_circle.schedule,
      'teacher_name', v_teacher, 'supervisor_name', v_supervisor
    ) end,
    'track', case when v_track.id is null then null else jsonb_build_object(
      'id', v_track.id, 'name', v_track.name, 'category', v_track.category
    ) end,
    'attendance', (
      select jsonb_build_object(
        'present', count(*) filter (where a.status = 'present'),
        'absent', count(*) filter (where a.status = 'absent'),
        'excused', count(*) filter (where a.status = 'excused'),
        'total', count(*)
      )
      from public.attendance a
      where a.student_id = v_student.id
    ),
    'attendance_recent', coalesce((
      select jsonb_agg(x)
      from (
        select a.record_date, a.status, a.notes
        from public.attendance a
        where a.student_id = v_student.id
        order by a.record_date desc
        limit 10
      ) x
    ), '[]'::jsonb),
    'progress_by_category', coalesce((
      select jsonb_agg(x)
      from (
        select coalesce(pr.category::text, 'other') as category, sum(pr.amount) as total
        from public.progress_records pr
        where pr.student_id = v_student.id
        group by 1
        order by 2 desc
      ) x
    ), '[]'::jsonb),
    'progress_recent', coalesce((
      select jsonb_agg(x)
      from (
        select pr.record_date, pr.amount, pr.category::text as category,
               pr.from_surah, pr.from_ayah, pr.to_surah, pr.to_ayah, pr.notes
        from public.progress_records pr
        where pr.student_id = v_student.id
        order by pr.record_date desc, pr.created_at desc
        limit 10
      ) x
    ), '[]'::jsonb),
    'progress_monthly', coalesce((
      select jsonb_agg(x order by x.month)
      from (
        select to_char(date_trunc('month', pr.record_date), 'YYYY-MM') as month,
               sum(pr.amount) as total
        from public.progress_records pr
        where pr.student_id = v_student.id
          and pr.record_date >= (current_date - interval '6 months')
        group by 1
      ) x
    ), '[]'::jsonb),
    'progress_total', coalesce((
      select sum(pr.amount) from public.progress_records pr where pr.student_id = v_student.id
    ), 0)
  );
end;
$$;

grant execute on function public.student_portal(text) to authenticated;

-- تقييد التنفيذ: منع الزوار غير المسجلين من استدعاء الدوال
revoke execute on function public.student_portal(text) from public, anon;
revoke execute on function public.my_student_id(uuid) from public, anon;
grant execute on function public.student_portal(text) to authenticated;
grant execute on function public.my_student_id(uuid) to authenticated;
