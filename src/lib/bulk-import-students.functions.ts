import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createTrackCircleResolver } from "@/lib/tenant-structure.server";

const rowSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  guardian_name: z.string().trim().max(200).nullable().optional(),
  guardian_phone: z.string().trim().max(30).nullable().optional(),
  date_of_birth: z.string().trim().max(20).nullable().optional(),
  age: z.number().int().min(0).max(120).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  track_name: z.string().trim().min(1).max(120),
  circle_name: z.string().trim().min(1).max(120),
  /** بريد الطالبة — مطلوب فقط في وضع "حسابات الطالبات" (students_mode = accounts) */
  email: z.string().trim().email().max(255).nullable().optional(),
  /** كلمة سر مؤقتة — إذا فُقِدَت تُولَّد تلقائيًا */
  password: z.string().trim().min(8).max(72).nullable().optional(),
});

const importSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
  rows: z.array(rowSchema).min(1).max(1000),
});

export type BulkImportStudentRowResult = {
  row: number;
  full_name: string;
  status: "created" | "error";
  message: string;
};

/**
 * استيراد دفعي للطالبات مع إنشاء المسار والحلقة تلقائيًا من الاسم إن لم
 * يكونا موجودين (بدون تكرار).
 *
 * في وضع "سجلات فقط" (students_mode = records): تُستورد الطالبات كسجلات فقط
 * بدون حساب دخول.
 *
 * في وضع "حسابات الطالبات" (students_mode = accounts): إذا وُفِّر البريد
 * يُنشَأ حساب دخول للطالبة ويُربط بصفها، ويُرسل البريد وكلمة السر المؤقتة
 * في نتيجة الاستيراد. إذا فُقِد البريد يُستورد السجل فقط وتُبيَّن رسالة
 * بأن الحساب لم يُنشأ لغياب البريد.
 */
export const bulkImportStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => importSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, name, slug, students_mode")
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
    const { resolveTrackId, resolveCircleId } = createTrackCircleResolver(supabaseAdmin, tenant.id);

    const results: BulkImportStudentRowResult[] = [];

    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i]!;
      const rowNum = i + 2; // صف 1 = ترويسة الملف
      try {
        const trackId = await resolveTrackId(row.track_name);
        const circleId = await resolveCircleId(trackId, row.circle_name);

        const insertPayload: Record<string, unknown> = {
          tenant_id: tenant.id,
          full_name: row.full_name,
          guardian_name: row.guardian_name || null,
          guardian_phone: row.guardian_phone || null,
          date_of_birth: row.date_of_birth || null,
          age: row.age ?? null,
          country: row.country || null,
        };

        let linkedUserId: string | null = null;
        let accountMessage = "";

        if (inAccountsMode) {
          if (row.email) {
            const tempPassword = row.password ?? generateTempPassword();
            const { createStudentAccount } = await import("@/lib/student-accounts.server");
            const { user, error: accountError } = await createStudentAccount({
              email: row.email,
              password: tempPassword,
              fullName: row.full_name,
              tenantId: tenant.id,
              supabaseAdmin,
            });
            if (accountError || !user) {
              throw new Error(accountError || "فشل إنشاء حساب الطالبة");
            }
            linkedUserId = user.id;
            accountMessage = ` — حساب: ${row.email} / كلمة السر المؤقتة: ${tempPassword}`;
          } else {
            accountMessage = " — لم يُنشأ حساب (البريد غير متوفر)";
          }
        }

        if (linkedUserId) insertPayload.user_id = linkedUserId;

        const { data: student, error: studentError } = await supabaseAdmin
          .from("students")
          .insert(insertPayload)
          .select("id")
          .single();
        if (studentError) throw new Error(studentError.message);

        const { error: linkError } = await supabaseAdmin
          .from("circle_students")
          .insert({ circle_id: circleId, student_id: student.id });
        if (linkError) throw new Error(linkError.message);

        results.push({ row: rowNum, full_name: row.full_name, status: "created", message: `تمت الإضافة${accountMessage}` });
      } catch (e) {
        results.push({
          row: rowNum,
          full_name: row.full_name,
          status: "error",
          message: (e as Error).message || "خطأ غير متوقع",
        });
      }
    }

    return { results };
  });

function generateTempPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}
