-- شغّلي هذا الملف مرة واحدة على قاعدة البيانات (SQL Editor في لوحة القاعدة).
-- قيد فريد لسجلات الإنجاز: طالبة + مسار + منهج (التصنيف) + تاريخ،
-- وقيد مماثل للحضور: طالبة + حلقة + تاريخ.
-- الهدف: تمكين الحفظ عبر upsert بدل حذف صفوف اليوم ثم إدراجها من جديد،
-- حتى لا تتكرر السجلات إذا حُفظت الشاشة أكثر من مرة أو من متصفحين.

-- 1) تنظيف أي تكرار سابق (نُبقي أحدث صف لكل مجموعة) قبل إنشاء القيد.
delete from public.progress_records p
using public.progress_records q
where p.student_id = q.student_id
  and p.track_id = q.track_id
  and p.record_date = q.record_date
  and coalesce(p.category::text, '') = coalesce(q.category::text, '')
  and (p.created_at, p.id) < (q.created_at, q.id);

create unique index if not exists progress_records_student_track_category_date_key
  on public.progress_records (student_id, track_id, category, record_date)
  nulls not distinct;

-- 2) الحضور
delete from public.attendance a
using public.attendance b
where a.student_id = b.student_id
  and a.circle_id = b.circle_id
  and a.record_date = b.record_date
  and (a.created_at, a.id) < (b.created_at, b.id);

create unique index if not exists attendance_student_circle_date_key
  on public.attendance (student_id, circle_id, record_date)
  nulls not distinct;
