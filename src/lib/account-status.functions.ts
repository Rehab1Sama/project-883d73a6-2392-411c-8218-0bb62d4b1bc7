import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** حالات الحساب المدعومة */
export const ACCOUNT_STATUSES = ["active", "suspended", "on_leave"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: "فعّال",
  suspended: "موقوف",
  on_leave: "في إجازة",
};

const baseSchema = {
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
  status: z.enum(ACCOUNT_STATUSES),
  /** بداية ونهاية الإجازة (مطلوبة عند status = on_leave) */
  leave_start: z.string().trim().max(20).nullable().optional(),
  leave_end: z.string().trim().max(20).nullable().optional(),
  /** الحلقة التي تُربط بها العضوة/الطالبة عند إعادة التفعيل */
  circle_id: z.string().uuid().nullable().optional(),
};

const memberSchema = z.object({ ...baseSchema, role_row_id: z.string().uuid() });
const studentSchema = z.object({ ...baseSchema, student_id: z.string().uuid() });

async function assertManager(
  supabase: { from: (t: string) => any; rpc: (n: string, a: unknown) => Promise<{ data: unknown }> },
  userId: string,
  slug: string,
) {
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!tenant) throw new Error("المقرأة غير موجودة");
  const { data: isManager } = await supabase.rpc("is_tenant_manager", {
    _user_id: userId,
    _tenant_id: tenant.id,
  });
  if (!isManager) throw new Error("غير مصرح لك بهذا الإجراء");
  return tenant as { id: string };
}

function leaveDates(input: { status: AccountStatus; leave_start?: string | null | undefined; leave_end?: string | null | undefined }) {
  if (input.status !== "on_leave") return { leave_start: null, leave_end: null };
  if (!input.leave_start || !input.leave_end) throw new Error("حددي تاريخ بداية ونهاية الإجازة");
  if (input.leave_end < input.leave_start) throw new Error("تاريخ نهاية الإجازة قبل بدايتها");
  return { leave_start: input.leave_start, leave_end: input.leave_end };
}

/**
 * تغيير حالة حساب عضوة (معلمة/مشرفة/مسؤولة مسار).
 * الإيقاف يفصلها عن حلقتها، وإعادة التفعيل تسمح بربطها بحلقة جديدة،
 * والإجازة تبقي الارتباط لكن ضمن مدة محددة.
 */
export const setMemberAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => memberSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenant = await assertManager(supabase as never, userId, data.slug);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dates = leaveDates(data);

    const patch: Record<string, unknown> = { account_status: data.status, ...dates };
    if (data.status === "suspended") patch['circle_id'] = null;
    if (data.status === "active" && data.circle_id !== undefined) patch['circle_id'] = data.circle_id;

    const { error } = await supabaseAdmin
      .from("user_roles")
      .update(patch as never)
      .eq("id", data.role_row_id)
      .eq("tenant_id", tenant.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * تغيير حالة حساب طالبة.
 * الإيقاف يحذفها من حلقتها، وإعادة التفعيل تربطها بالحلقة المختارة،
 * والإجازة توقف إدخال الأنصبة واحتساب الغياب خلال مدتها.
 */
export const setStudentAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => studentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenant = await assertManager(supabase as never, userId, data.slug);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dates = leaveDates(data);

    const { error } = await supabaseAdmin
      .from("students")
      .update({ status: data.status, ...dates } as never)
      .eq("id", data.student_id)
      .eq("tenant_id", tenant.id);
    if (error) throw new Error(error.message);

    if (data.status === "suspended") {
      const { error: delError } = await supabaseAdmin
        .from("circle_students")
        .delete()
        .eq("student_id", data.student_id);
      if (delError) throw new Error(delError.message);
    }

    if (data.status === "active" && data.circle_id) {
      await supabaseAdmin.from("circle_students").delete().eq("student_id", data.student_id);
      const { error: linkError } = await supabaseAdmin
        .from("circle_students")
        .insert({ circle_id: data.circle_id, student_id: data.student_id });
      if (linkError) throw new Error(linkError.message);
    }

    return { ok: true };
  });
