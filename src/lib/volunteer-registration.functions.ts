import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { VOLUNTEER_ROLE_LABELS, type VolunteerRole } from "@/lib/volunteers";

const registerSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
  full_name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).nullable().optional(),
  preferred_role: z.enum(["teacher", "supervisor", "academic_deputy", "admin_deputy"]),
  note: z.string().trim().max(500).nullable().optional(),
});

export type VolunteerRegistrationResult = {
  accountCreated: boolean;
  roleLabel: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** كلمة مرور مؤقتة قوية تفي بحدود سوبابيس (٦ أحرف فأكثر) */
function generatePassword(): string {
  const part = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `Sq${part}!`;
}

async function emailVolunteerCredentials(input: {
  to: string;
  fullName: string;
  tenantName: string;
  roleLabel: string;
  password: string;
}): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  const fromRaw = process.env["EMAIL_FROM"];
  const address = fromRaw?.match(/[^<>\s,"']+@[^<>\s,"']+\.[a-zA-Z]{2,}/)?.[0];
  const from = address ? `Suhub <${address}>` : "Suhub <onboarding@resend.dev>";
  if (!apiKey) {
    console.warn("[volunteer-registration] البريد غير مُهيّأ — لم تُرسل بيانات الدخول");
    return;
  }
  const html = `<div dir="rtl" style="font-family:system-ui,-apple-system,Segoe UI,Tahoma,sans-serif;line-height:1.8;color:#1f2937">
  <h2 style="margin:0 0 12px">أهلًا بك ${escapeHtml(input.fullName)} في ${escapeHtml(input.tenantName)}</h2>
  <p>تم اعتماد تسجيلك كمتطوعة بدور «${escapeHtml(input.roleLabel)}». بيانات دخولك:</p>
  <p style="margin:4px 0"><strong>البريد:</strong> ${escapeHtml(input.to)}</p>
  <p style="margin:4px 0"><strong>كلمة المرور المؤقتة:</strong> ${escapeHtml(input.password)}</p>
  <p>سجّلي دخولك ثم غيّري كلمة المرور من إعدادات حسابك.</p>
  <p style="margin-top:16px;font-size:12px;color:#6b7280">رسالة تلقائية من منصة سُحُب</p>
</div>`;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: `تم اعتماد تسجيلك في ${input.tenantName}`,
        html,
      }),
    });
    if (!response.ok) {
      console.error("[volunteer-registration] فشل إرسال البريد", response.status, (await response.text()).slice(0, 300));
    }
  } catch (error) {
    console.error("[volunteer-registration] خطأ في إرسال البريد", error instanceof Error ? error.message : error);
  }
}

/**
 * تسجيل المتطوعات من الرابط العام: اعتماد مباشر —
 * يُنشأ حساب دخول فعلي (أو يُستخدم الحساب الموجود بنفس البريد) ويُفعَّل
 * الدور المختار في المقرأة فورًا، ويُسجَّل الطلب بحالة «معتمد»، وتُرسل
 * بيانات الدخول بالبريد للحسابات الجديدة.
 */
export const registerVolunteer = createServerFn({ method: "POST" })
  .validator((input: unknown) => registerSchema.parse(input))
  .handler(async ({ data }): Promise<VolunteerRegistrationResult> => {
    const { guardPublicRate } = await import("@/lib/rate-limit-guard.server");
    await guardPublicRate("volunteer_registration", 8, 600);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id, name, status, volunteering_open")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!tenant || tenant.status === "suspended") throw new Error("المقرأة غير موجودة");
    if (!tenant.volunteering_open) throw new Error("تسجيل المتطوعات مغلق حاليًا في هذه المقرأة");

    const email = data.email.toLowerCase();
    const role = data.preferred_role as VolunteerRole;

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    let userId: string;
    let accountCreated = false;
    let password: string | null = null;

    if (existingProfile) {
      userId = existingProfile.id;
    } else {
      password = generatePassword();
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name },
      });
      if (createError) throw new Error(createError.message);
      userId = created.user.id;
      accountCreated = true;
      await supabaseAdmin.from("profiles").upsert(
        { id: userId, full_name: data.full_name, email },
        { onConflict: "id" },
      );
    }

    // الفهرس الفريد على user_roles مبني على coalesce(...) — لا upsert خام.
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("tenant_id", tenant.id)
      .eq("role", role)
      .is("track_id", null)
      .is("circle_id", null)
      .maybeSingle();

    const roleError = existingRole
      ? (await supabaseAdmin.from("user_roles").update({ is_volunteer: true }).eq("id", existingRole.id)).error
      : (
          await supabaseAdmin.from("user_roles").insert({
            user_id: userId,
            tenant_id: tenant.id,
            role,
            track_id: null,
            circle_id: null,
            is_volunteer: true,
          })
        ).error;
    if (roleError) throw new Error(roleError.message);

    // سجل الطلب بحالة «معتمد» مباشرة ليظهر في سجل القائدة.
    await supabaseAdmin.from("volunteer_applications").insert({
      tenant_id: tenant.id,
      full_name: data.full_name,
      email,
      phone: data.phone || null,
      preferred_role: role,
      note: data.note || null,
      status: "approved",
      reviewed_at: new Date().toISOString(),
    });

    if (accountCreated && password) {
      await emailVolunteerCredentials({
        to: email,
        fullName: data.full_name,
        tenantName: tenant.name,
        roleLabel: VOLUNTEER_ROLE_LABELS[role] ?? role,
        password,
      });
    }

    return { accountCreated, roleLabel: VOLUNTEER_ROLE_LABELS[role] ?? role };
  });
