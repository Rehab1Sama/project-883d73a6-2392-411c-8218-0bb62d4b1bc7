-- =====================================================================
-- سد ثغرة: مديرة المقرأة تقدر تكتب محتوى "الصفحة التعريفية" (settings
-- ->public_page) حتى لو ميزة public_page غير مفعّلة لباقتها، عبر طلب
-- مباشر لقاعدة البيانات يتجاوز واجهة الإعدادات (اللي ترسل الحقل فقط
-- لو hasFeature('public_page') = true بالواجهة — دفاع أول غير كافٍ
-- وحده). المحتوى وقتها ما يظهر لزوار الصفحة العامة (لأنها تتحقق من
-- الميزة بشكل منفصل)، لكن يبقى مخزّنًا بدون حق.
--
-- الحل: نفس نمط enforce_tenant_branding_gate() الموجود أصلاً لمنع تغيير
-- logo_url/primary_color/accent_color/custom_domain بدون الميزة
-- المناسبة — نضيف له فحص مماثل لعمود settings، مقصور فقط على المفتاح
-- public_page (بقية مفاتيح settings تبقى حرة، لأنها مو مرتبطة بميزة
-- مدفوعة).
--
-- ⚠️ هذا create or replace لنفس الدالة الموجودة — يستبدل جسمها بالكامل،
-- فلازم يحتوي كل الفحوصات القديمة (الشعار/الألوان/النطاق) + الفحص
-- الجديد معًا. راجعي التوقيع في قاعدتك الحية قبل التطبيق؛ لو مختلف
-- الصقيه لي بدل التخمين.
-- =====================================================================

create or replace function public.enforce_tenant_branding_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_platform_owner(auth.uid()) then
    return new;
  end if;

  if (new.logo_url is distinct from old.logo_url
      or new.primary_color is distinct from old.primary_color
      or new.accent_color is distinct from old.accent_color)
     and not public.tenant_has_feature(new.id, 'branding') then
    raise exception 'ميزة "الهوية البصرية" غير مفعّلة لهذه المقرأة';
  end if;

  if (new.custom_domain is distinct from old.custom_domain)
     and not public.tenant_has_feature(new.id, 'custom_domain') then
    raise exception 'ميزة "النطاق المخصص" غير مفعّلة لهذه المقرأة';
  end if;

  if ((new.settings -> 'public_page') is distinct from (old.settings -> 'public_page'))
     and not public.tenant_has_feature(new.id, 'public_page') then
    raise exception 'ميزة "الصفحة التعريفية" غير مفعّلة لهذه المقرأة';
  end if;

  return new;
end;
$$;

-- الترغر نفسه موجود مسبقًا ومرتبط بالدالة بالاسم، فما يحتاج إعادة إنشاء،
-- لكن نعيد التأكيد على وجوده احتياطًا (idempotent — بلا ضرر لو مكرر).
drop trigger if exists tenant_branding_gate on public.tenants;
create trigger tenant_branding_gate
  before update on public.tenants
  for each row
  execute function public.enforce_tenant_branding_gate();
