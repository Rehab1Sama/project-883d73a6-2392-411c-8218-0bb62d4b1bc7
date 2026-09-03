import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
  full_name: z.string().trim().min(1).max(200),
  guardian_name: z.string().trim().max(200).nullable().optional(),
  guardian_phone: z.string().trim().max(30).nullable().optional(),
  date_of_birth: z.string().trim().max(20).nullable().optional(),
  age: z.number().int().min(0).max(120).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  circle_id: z.string().uuid().nullable().optional(),
  /** بريد الطالبة — تُنشأ لها حساب دخول فقط لو المقرأة بوضع "حسابات الطالبات" */
  email: z.string().trim().email().max(255).nullable().optional(),
});

export type CreateStudentResult = {
  studentId: string;
  accountCreated: boolean;
  tempPassword?: string;
};

/**
 * إنشاء طالبة يدويًا من لوحة الطالبات (بديل الاستيراد الجماعي والتسجيل
 * الذاتي). لو المقرأة بوضع "حسابات الطالبات" ووُفِّر بريد، يُنشأ لها حساب
 * دخول فورًا بنفس منطق الاستيراد الجماعي — بدل ما تبقى الطالبة بدون بوابة
 * لمجرد إنها انضافت يدويًا.
 */
export const createStudentManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<CreateStudentResult> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, students_mode")
      .eq("slug", data.slug)
      .maybeSingle();
    if (tenantError) throw tenantError;
    if (!tenant) throw new Error("المقرأة غير موجودة");

    const { data: isManager } = await supabase.rpc("is_tenant_manager", {
      _user_id: userId,
      _tenant_id: tenant.id,
    });
    if (!isManager) throw new Error("غير مصرح لك بهذا الإجراء");

    const inAccountsMode = (tenant as unknown as { students_mode?: string }).students_mode === "accounts";

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
        notes: data.notes || null,
      })
      .select("id")
      .single();
    if (studentError) throw new Error(studentError.message);

    let trackId: string | null = null;

    if (data.circle_id) {
      const { data: circle, error: circleError } = await supabaseAdmin
        .from("circles")
        .select("track_id")
        .eq("id", data.circle_id)
        .single();
      if (circleError) throw new Error(circleError.message);
      trackId = circle.track_id;

      const { error: linkError } = await supabaseAdmin
        .from("circle_students")
        .insert({ circle_id: data.circle_id, student_id: student.id });
      if (linkError) throw new Error(linkError.message);
    }

    if (!inAccountsMode || !data.email) {
      return { studentId: student.id, accountCreated: false };
    }

    const { createStudentAccount, generateTempPassword } = await import("@/lib/student-accounts.server");
    const tempPassword = generateTempPassword();
    await createStudentAccount(supabaseAdmin, {
      studentId: student.id,
      tenantId: tenant.id,
      trackId,
      circleId: data.circle_id ?? null,
      email: data.email,
      password: tempPassword,
    });

    return { studentId: student.id, accountCreated: true, tempPassword };
  });
