-- ميزة "المساعدة الذكية": معطّلة افتراضيًا لكل المقارئ، وتُفعَّل يدويًا
-- (أو عبر باقة) من لوحة المنصة. مالكة المنصة تتخطى هذا القيد دائمًا
-- (يُنفَّذ التحقق في src/lib/assistant.functions.ts).
insert into public.features (key, name_ar, description_ar, default_enabled, sort_order)
values (
  'ai_assistant',
  'المساعدة الذكية',
  'مساعدة ذكية داخل لوحة المقرأة تجيب عن أرقام وأداء المقرأة وطريقة استخدام النظام.',
  false,
  (select coalesce(max(sort_order), 0) + 1 from public.features)
)
on conflict (key) do nothing;
