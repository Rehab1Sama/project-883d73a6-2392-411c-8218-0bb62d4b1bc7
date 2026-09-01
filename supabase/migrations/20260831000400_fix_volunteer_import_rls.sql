-- خطأ منطقي: سياسة الإدراج القديمة تشترط volunteering_open=true حتى
-- لمديرة المقرأة نفسها، فتمنعها من استيراد ملف Excel يدويًا إلا لو
-- فتحت باب التسجيل العام أولًا — رغم إن الاستيراد إجراء إداري داخلي
-- ما له علاقة بحالة التسجيل العام للزوار.
drop policy if exists "volunteer_applications_auth_insert" on public.volunteer_applications;

create policy "volunteer_applications_auth_insert" on public.volunteer_applications
  for insert to authenticated
  with check (
    -- مديرة المقرأة تقدر تُضيف/تستورد متطوعات في أي وقت
    public.is_tenant_manager(auth.uid(), tenant_id)
    or
    -- أي مستخدمة موثّقة أخرى (تسجّل نفسها) تخضع لنفس شرط الزوار العامّين
    exists (
      select 1 from public.tenants t
      where t.id = tenant_id
        and t.status = 'active'
        and t.volunteering_open = true
    )
  );
