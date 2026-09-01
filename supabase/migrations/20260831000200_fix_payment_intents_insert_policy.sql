-- الثغرة: أي مستخدمة موثّقة تقدر تُنشئ صف payment_intents لأي مقرأة
-- (حتى لو مو مديرتها) وبأي حالة status (حتى 'succeeded') طالما نسبت
-- created_by لنفسها. القيد القديم يتحقق فقط من created_by، بلا ربط
-- بصلاحية إدارة المقرأة ولا تقييد للحالة المسموح إدخالها من العميل.
drop policy if exists "payment_intents_authenticated_insert" on public.payment_intents;

create policy "payment_intents_authenticated_insert" on public.payment_intents
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and status = 'pending'
    and (
      public.is_platform_owner(auth.uid())
      or (tenant_id is not null and public.is_tenant_manager(auth.uid(), tenant_id))
    )
  );
