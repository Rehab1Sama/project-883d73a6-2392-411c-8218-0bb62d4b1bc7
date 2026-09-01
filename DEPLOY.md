# النشر على Vercel + Supabase (حسابك الخاص)

## 1. قاعدة البيانات

تم تطبيق المخطط الكامل على مشروع Supabase الخاص بك:

- 22 جدولاً + جميع الأنواع (enums) والفهارس والقيود
- 15 دالة قاعدة بيانات (security definer) + جميع التريغرز
- تفعيل RLS على كل الجداول + جميع سياسات العزل
- صلاحيات (GRANT) مضبوطة: `authenticated` كامل، `service_role` كامل،
  و `anon` محدودة جداً (قراءة الباقات/المزايا/الكيانات النشطة، وإرسال طلبات التواصل فقط)

### العزل متعدد المستأجرين (Multi-tenant isolation)

العزل مبني على `tenant_id` في كل جدول تشغيلي، وتفرضه سياسات RLS عبر دوال:

| الدالة | الغرض |
| --- | --- |
| `is_platform_owner(uid)` | مالك المنصة — وصول كامل |
| `is_tenant_manager(uid, tenant_id)` | مدير الكيان / نائب إداري — كتابة |
| `is_tenant_member(uid, tenant_id)` | أي عضو في الكيان — قراءة |
| `has_tenant_role(uid, tenant_id, roles[])` | فحص أدوار محددة |
| `can_record_academic(uid, tenant_id)` | صلاحية إدخال البيانات الأكاديمية |

الأدوار مخزّنة في جدول منفصل `user_roles` (وليس في `profiles`) لمنع تصعيد الصلاحيات.

## 2. إعدادات Supabase المطلوبة (لوحة تحكم مشروعك)

1. **Authentication → Providers**: فعّل Email، وGoogle إن رغبت.
2. **Authentication → URL Configuration**:
   - Site URL: `https://your-domain.vercel.app`
   - Redirect URLs: `https://your-domain.vercel.app/**`
3. **Authentication → Email**: عطّل "Confirm email" فقط إن أردت تسجيلاً فورياً.

## 3. متغيرات البيئة في Vercel

في Vercel → Project → Settings → Environment Variables، أضف لكل البيئات
(Production / Preview / Development):

| المتغير | القيمة |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | المفتاح العام (anon / publishable) |
| `VITE_SUPABASE_PROJECT_ID` | `<project-ref>` |
| `SUPABASE_URL` | نفس رابط المشروع |
| `SUPABASE_PUBLISHABLE_KEY` | نفس المفتاح العام |
| `SUPABASE_SERVICE_ROLE_KEY` | مفتاح الخدمة (سرّي — للخادم فقط) |
| `RESEND_API_KEY` | مفتاح Resend |
| `EMAIL_FROM` | البريد المُرسِل |
| `ADMIN_NOTIFY_EMAIL` | بريد إشعارات الإدارة |
| `GEMINI_API_KEY` | مفتاح Gemini API من Google AI Studio (للمساعد الذكي داخل اللوحة) |
| `GEMINI_MODEL` | اسم موديل Gemini المستخدم (اختياري، افتراضيًا `gemini-2.5-flash`) |
| `LOVABLE_CRON_SECRET` | سرّ نقاط النهاية المجدولة |

> المتغيرات التي تبدأ بـ `VITE_` تظهر في المتصفح — لا تضع فيها أي مفتاح سرّي.
> `SUPABASE_SERVICE_ROLE_KEY` يُقرأ داخل دوال الخادم فقط.

## 4. البناء

المشروع TanStack Start + Nitro. عند وجود المتغير `VERCEL` يثبّت البناء
هدف `vercel` تلقائياً ويُخرج إلى `.vercel/output` (Build Output API)،
فلا حاجة لأي إعداد إضافي في Vercel غير المتغيرات أعلاه.

```bash
npm install
npm run build
```

## 5. حساب مالكة المنصة

تم إنشاؤه مسبقاً في قاعدتك: `rrehabfall88@gmail.com` بدور `platform_owner`
(البريد مُفعّل). غيّري كلمة المرور من داخل النظام بعد أول دخول.

لإضافة مالكة أخرى لاحقاً: سجّلي الحساب من `/auth` ثم نفّذي في SQL Editor:

```sql
insert into public.user_roles (user_id, role, tenant_id)
select id, 'platform_owner', null from auth.users where email = 'YOUR_EMAIL_HERE'
on conflict do nothing;
```

## 6. البيانات المبدئية

القاعدة الخارجية مهيّأة بـ 12 ميزة في دليل المزايا و3 باقات
(أساسية / متقدمة / مخصّصة) بأسعار مبدئية — عدّليها من لوحة المنصة → الباقات.
