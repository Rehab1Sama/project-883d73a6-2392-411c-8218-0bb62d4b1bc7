import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9-]+$/);

const registerSchema = z.object({
  slug: slugSchema,
  full_name: z.string().trim().min(2).max(200),
  guardian_name: z.string().trim().max(200).nullable().optional(),
  guardian_phone: z.string().trim().max(30).nullable().optional(),
  date_of_birth: z.string().trim().max(20).nullable().optional(),
  age: z.number().int().min(0).max(120).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  /** حلقة موجودة تختارها الطالبة من القائمة */
  circle_id: z.string().uuid().nullable().optional(),
  /** أو اسم مسار/حلقة جديدة تُنشأ تلقائيًا إن لم تكن موجودة */
  track_name: z.string().trim().max(120).nullable().optional(),
  circle_name: z.string().trim().max(120).nullable().optional(),
  /** يُتجاهلان تمامًا إذا كانت المقرأة في وضع "السجلات" (بدون بوابة للطالبة) */
  email: z.string().trim().email().max(255).nullable().optional(),
  password: z.string().min(8).max(72).nullable().optional(),
});

export type PublicCircleOption = { id: string; name: string; track_name: string };

export type PublicRegistrationInfo = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  short_description: string | null;
  status: string;
  registration_open: boolean;
  /** accounts = للطالبة بوابة وحساب دخول، records = سجل فقط بلا بريد ولا كلمة سر */
  students_mode: "records" | "accounts";
  circles: PublicCircleOption[];
};

/** بيانات صفحة تسجيل الطالبات العامة: المقرأة + حلقاتها المتاحة */
export const getPublicRegistrationInfo = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ slug: slugSchema }).parse(input))
  .handler(async ({ data }): Promise<PublicRegistrationInfo | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select(
        "id, name, slug, logo_url, primary_color, accent_color, short_description, status, registration_open, students_mode",
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (!tenant) return null;

    const { data: circles } = await supabaseAdmin
      .from("circles")
      .select("id, name, status, tracks(name)")
      .eq("tenant_id", tenant.id)
      .eq("status", "active")
      .order("name");

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logo_url: tenant.logo_url,
      primary_color: tenant.primary_color,
      accent_color: tenant.accent_color,
      short_description: tenant.short_description,
      status: tenant.status,
      registration_open: tenant.registration_open,
      students_mode: tenant.students_mode === "accounts" ? "accounts" : "records",
      circles: (circles ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        track_name: (c as { tracks?: { name?: string } | null }).tracks?.name ?? "بدون مسار",
      })),
    };
  });

export type StudentRegistrationResult = {
  studentId: string;
  circleName: string;
  /** true فقط إذا كانت المقرأة تفعّل بوابة الطالبة وأُنشئ حساب دخول */
  accountCreated: boolean;
};

/**
 * تسجيل الطالبة نفسها من رابط التسجيل العام. النتيجة مطابقة تمامًا لنتيجة
 * استيراد القائدة من ملف Excel: سجل طالبة مربوط بحلقتها (تُنشأ الحلقة/المسار
 * إن لم يكونا موجودَين). حساب الدخول يُنشأ فقط إذا كانت إعدادات المقرأة
 * students_mode = 'accounts'؛ غير ذلك يُتجاهل البريد وكلمة السر.
 */
export const registerStudent = createServerFn({ method: "POST" })
  .validator((input: unknown) => registerSchema.parse(input))
  .handler(async ({ data }): Promise<StudentRegistrationResult> => {
    const { guardPublicRate } = await import("@/lib/rate-limit-guard.server");
    await guardPublicRate("student_registration", 8, 600);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id, status, registration_open, students_mode")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!tenant || tenant.status === "suspended") throw new Error("المقرأة غير موجودة");
    if (!tenant.registration_open) throw new Error("التسجيل مغلق حاليًا في هذه المقرأة");

    const withAccounts = tenant.students_mode === "accounts";
    if (withAccounts && (!data.email || !data.password)) {
      throw new Error("البريد الإلكتروني وكلمة السر مطلوبان للدخول إلى بوابة الطالبة");
    }

    const { createTrackCircleResolver } = await import("@/lib/tenant-structure.server");
    const { resolveTrackId, resolveCircleId } = createTrackCircleResolver(supabaseAdmin, tenant.id);

    let circleId: string;
    let trackId: string | null;
    let circleName: string;

    if (data.circle_id) {
      const { data: circle } = await supabaseAdmin
        .from("circles")
        .select("id, name, track_id, tenant_id")
        .eq("id", data.circle_id)
        .eq("tenant_id", tenant.id)
        .maybeSingle();
      if (!circle) throw new Error("الحلقة المختارة غير موجودة");
      circleId = circle.id;
      trackId = circle.track_id;
      circleName = circle.name;
    } else {
      if (!data.track_name || !data.circle_name) {
        throw new Error("اختاري حلقتك من القائمة أو اكتبي اسم المسار والحلقة");
      }
      trackId = await resolveTrackId(data.track_name);
      circleId = await resolveCircleId(trackId, data.circle_name);
      circleName = data.circle_name.trim();
    }

    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .insert({
        tenant_id: tenant.id,
        full_name: data.full_name,
        guardian_name: data.guardian_name || null,
        guardian_phone: data.guardian_phone || null,
        date_of_birth: data.date_of_birth || null,
        age: data.age ?? null,
        country: data.country || null,
      })
      .select("id")
      .single();
    if (studentError) throw new Error(studentError.message);

    const { error: linkError } = await supabaseAdmin
      .from("circle_students")
      .insert({ circle_id: circleId, student_id: student.id });
    if (linkError) throw new Error(linkError.message);

    if (!withAccounts) {
      return { studentId: student.id, circleName, accountCreated: false };
    }

    const { createStudentAccount } = await import("@/lib/student-accounts.server");
    try {
      await createStudentAccount(supabaseAdmin, {
        tenantId: tenant.id,
        studentId: student.id,
        trackId,
        circleId,
        email: data.email!,
        password: data.password!,
      });
    } catch (e) {
      // لا نترك سجلًا معلّقًا بلا حساب بعد فشل الإنشاء
      await supabaseAdmin.from("students").delete().eq("id", student.id);
      throw e;
    }

    return { studentId: student.id, circleName, accountCreated: true };
  });
