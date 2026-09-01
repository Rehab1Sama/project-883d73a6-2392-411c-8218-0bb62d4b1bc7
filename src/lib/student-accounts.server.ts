import type { supabaseAdmin } from "@/integrations/supabase/client.server";

/** كلمة سر مؤقتة قوية تُسلَّم للطالبة عند إنشاء حسابها من الاستيراد */
export function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

type LinkArgs = {
  tenantId: string;
  studentId: string;
  trackId: string | null;
  circleId: string | null;
  email: string;
  password: string;
};

/**
 * ينشئ حساب دخول للطالبة ويربطه بسجلها ويمنحها دور "student" داخل مقرأتها.
 * يُستدعى فقط عندما تكون إعدادات المقرأة students_mode = 'accounts'؛ في وضع
 * "السجلات" لا يوجد للطالبة بريد ولا كلمة سر ويتم تجاهلهما تمامًا.
 */
export async function createStudentAccount(admin: typeof supabaseAdmin, args: LinkArgs) {
  const email = args.email.trim().toLowerCase();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: args.password,
    email_confirm: true,
    user_metadata: { full_name_source: "student_registration" },
  });

  let userId = created?.user?.id ?? null;

  if (createError || !userId) {
    const message = createError?.message ?? "تعذّر إنشاء الحساب";
    if (!/already|exists|registered/i.test(message)) {
      throw new Error(`تعذّر إنشاء حساب الطالبة: ${message}`);
    }
    throw new Error("هذا البريد مستخدم مسبقًا — استخدمي بريدًا آخر");
  }

  // عمود user_id مضاف بعد آخر توليد للأنواع، لذا نمرّره كتحديث غير مُقيَّد بالأنواع
  const { error: linkError } = await (admin.from("students") as any)
    .update({ user_id: userId })
    .eq("id", args.studentId);

  if (linkError) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(`تعذّر ربط الحساب بسجل الطالبة: ${linkError.message}`);
  }

  const { error: roleError } = await admin.from("user_roles").insert({
    user_id: userId,
    role: "student",
    tenant_id: args.tenantId,
    track_id: args.trackId,
    circle_id: args.circleId,
  });
  if (roleError && !/duplicate|unique/i.test(roleError.message)) {
    throw new Error(`تعذّر منح صلاحية الطالبة: ${roleError.message}`);
  }

  return { userId, email };
}
