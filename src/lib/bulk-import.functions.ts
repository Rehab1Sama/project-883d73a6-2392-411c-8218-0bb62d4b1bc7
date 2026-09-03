import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeRoleLabel, type VolunteerRole } from "@/lib/volunteers";
import { createTrackCircleResolver } from "@/lib/tenant-structure.server";

const rowSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
  role_label: z.string().trim().min(1).max(100),
  track_name: z.string().trim().max(120).nullable().optional(),
  circle_name: z.string().trim().max(120).nullable().optional(),
  age: z.number().int().min(0).max(120).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
});

const importSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
  rows: z.array(rowSchema).min(1).max(500),
});

export type BulkImportRowResult = {
  row: number;
  full_name: string;
  status: "created" | "linked" | "error";
  message: string;
};

/**
 * استيراد دفعي لموظفات/متطوعات بحسابات دخول فعلية (بريد + كلمة مرور)
 * مع إنشاء المسار والحلقة تلقائيًا من الاسم إن لم يكونا موجودين
 * (بدون تكرار — يُعاد استخدام المسار/الحلقة الموجودة بنفس الاسم).
 */
export const bulkImportVolunteerAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => importSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, name, slug")
      .eq("slug", data.slug)
      .maybeSingle();
    if (tenantError) throw tenantError;
    if (!tenant) throw new Error("المقرأة غير موجودة");

    const { data: isManager } = await supabase.rpc("is_tenant_manager", {
      _user_id: userId,
      _tenant_id: tenant.id,
    });
    if (!isManager) throw new Error("غير مصرح لك بهذا الإجراء");

    // ذاكرة مؤقتة لتفادي إعادة إنشاء نفس المسار/الحلقة أكثر من مرة
    // داخل نفس عملية الاستيراد (وليس فقط الاعتماد على قاعدة البيانات).
    const { resolveTrackId, resolveCircleId, resolveTrackForCircle } = createTrackCircleResolver(supabaseAdmin, tenant.id);

    const results: BulkImportRowResult[] = [];

    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i]!;
      const rowNum = i + 2; // صف 1 = ترويسة الملف
      try {
        const role: VolunteerRole = normalizeRoleLabel(row.role_label);

        let trackId: string | null = null;
        let circleId: string | null = null;

        if (role === "teacher" || role === "supervisor") {
          if (!row.circle_name) {
            throw new Error("المعلمة/المشرفة تحتاج اسم حلقة");
          }
          // اسم المسار اختياري: يُستنتج من اسم الحلقة (البهور ١ → البهور)
          trackId = await resolveTrackForCircle(row.circle_name, row.track_name ?? null);
          circleId = await resolveCircleId(trackId, row.circle_name);
        } else if (role === "academic_deputy") {
          if (!row.track_name) throw new Error("مسؤولة المسار تحتاج اسم مسار");
          trackId = await resolveTrackId(row.track_name);
        }
        // admin_deputy: بدون نطاق (على مستوى المقرأة كاملة)

        const email = row.email.toLowerCase();
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .ilike("email", email)
          .maybeSingle();

        let targetUserId: string;
        let created = false;

        if (existingProfile) {
          targetUserId = existingProfile.id;
        } else {
          const { data: created_, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: row.password,
            email_confirm: true,
            user_metadata: { full_name: row.full_name },
          });
          if (createError) throw new Error(createError.message);
          targetUserId = created_.user.id;
          created = true;
          // الـ trigger على auth.users يملأ profiles تلقائيًا، لكن نضمن
          // التزامن الفوري هنا تحسبًا لأي تأخير — ونفس شكل بيانات نموذج
          // التسجيل اليدوي بالضبط (بما فيها العمر والبلد).
          await supabaseAdmin.from("profiles").upsert(
            {
              id: targetUserId,
              full_name: row.full_name,
              email,
              age: row.age ?? null,
              country: row.country || null,
            },
            { onConflict: "id" },
          );
        }

        // ملاحظة: الفهرس الفريد على user_roles مبني على coalesce(...) لأعمدة
        // قابلة للـ null، فـ upsert العادي (يعتمد على أعمدة خام) لا يطابقه.
        // نتحقق يدويًا بنفس أسلوب صفحة المتطوعات الحالية.
        let roleQuery = supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", targetUserId)
          .eq("tenant_id", tenant.id)
          .eq("role", role);
        roleQuery = trackId ? roleQuery.eq("track_id", trackId) : roleQuery.is("track_id", null);
        roleQuery = circleId ? roleQuery.eq("circle_id", circleId) : roleQuery.is("circle_id", null);
        const { data: existingRole } = await roleQuery.maybeSingle();

        const roleError = existingRole
          ? (await supabaseAdmin.from("user_roles").update({ is_volunteer: true }).eq("id", existingRole.id))
              .error
          : (
              await supabaseAdmin.from("user_roles").insert({
                user_id: targetUserId,
                tenant_id: tenant.id,
                role,
                track_id: trackId,
                circle_id: circleId,
                is_volunteer: true,
              })
            ).error;
        if (roleError) throw new Error(roleError.message);

        results.push({
          row: rowNum,
          full_name: row.full_name,
          status: created ? "created" : "linked",
          message: created
            ? "تم إنشاء الحساب وربطه"
            : "حساب موجود مسبقًا — تم ربط الدور فقط (كلمة المرور لم تتغيّر)",
        });
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
