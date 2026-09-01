-- إضافة العمر والبلد: للمتطوعات (profiles) وللطالبات (students)، عشان
-- يتوفر نفس الحقل سواء سُجّلت الطالبة/المتطوعة يدويًا أو عبر استيراد ملف.
alter table public.profiles
  add column if not exists age integer,
  add column if not exists country text;

alter table public.students
  add column if not exists age integer,
  add column if not exists country text;
