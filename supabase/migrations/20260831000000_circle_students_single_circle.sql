-- الطالبة تنتمي لحلقة واحدة فقط (بدل السماح بعدة حلقات)
alter table public.circle_students
  drop constraint if exists circle_students_circle_id_student_id_key;

alter table public.circle_students
  add constraint circle_students_student_id_key unique (student_id);
