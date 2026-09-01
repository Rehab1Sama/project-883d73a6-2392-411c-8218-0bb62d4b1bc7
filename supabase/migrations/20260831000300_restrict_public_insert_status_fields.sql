-- ثغرة بسيطة: نماذج التواصل/طلبات الباقة العامة تسمح للمرسل (حتى anon)
-- بتحديد status و tenant_id بنفسه عند الإرسال (كانت with check (true)).
-- مو تصعيد صلاحيات، لكن تسمح بإزعاج بسيط: إغراق طابور "المعلّقة" لدى
-- مالكة المنصة برسائل تظهر "منتهية" فتُخفى من المراجعة، أو ربط طلب باقة
-- بمقرأة قائمة فعلاً (يمنع مالكة المنصة من اعتماد الطلب لاحقًا).
drop policy if exists "contact_messages_anon_insert" on public.contact_messages;
create policy "contact_messages_anon_insert" on public.contact_messages
  for insert to anon
  with check (status = 'new');

drop policy if exists "contact_messages_auth_insert" on public.contact_messages;
create policy "contact_messages_auth_insert" on public.contact_messages
  for insert to authenticated
  with check (status = 'new');

drop policy if exists "plan_requests_anon_insert" on public.plan_requests;
create policy "plan_requests_anon_insert" on public.plan_requests
  for insert to anon
  with check (status = 'new' and tenant_id is null);

drop policy if exists "plan_requests_auth_insert" on public.plan_requests;
create policy "plan_requests_auth_insert" on public.plan_requests
  for insert to authenticated
  with check (status = 'new' and tenant_id is null);
