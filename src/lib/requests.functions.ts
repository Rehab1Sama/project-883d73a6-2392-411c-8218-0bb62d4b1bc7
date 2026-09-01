import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const planRequestSchema = z.object({
  planId: z.string().uuid().nullable(),
  billingPeriod: z.enum(["monthly", "yearly", "lifetime"]),
  tenantName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  subject: z.string().trim().min(2).max(160),
  message: z.string().trim().min(10).max(2000),
});

/** طلب باقة من صفحة الأسعار — يُحفظ ثم يُرسل تنبيه بريدي فوري لمالكة المنصة */
export const submitPlanRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => planRequestSchema.parse(input))
  .handler(async ({ data }) => {
    const { guardPublicRate } = await import("@/lib/rate-limit-guard.server");
    await guardPublicRate("plan_request", 5, 300);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("plan_requests")
      .insert({
        plan_id: data.planId,
        billing_period: data.billingPeriod,
        tenant_name: data.tenantName,
        contact_name: data.contactName,
        email: data.email,
        phone: data.phone ?? null,
        notes: data.notes ?? null,
      })
      .select("id, plan_id")
      .single();
    if (error) throw new Error("تعذّر إرسال الطلب");

    let planName = "—";
    if (row.plan_id) {
      const { data: plan } = await supabaseAdmin
        .from("plans")
        .select("name_ar")
        .eq("id", row.plan_id)
        .maybeSingle();
      planName = plan?.name_ar ?? "—";
    }

    const periodLabel =
      data.billingPeriod === "yearly" ? "سنوي" : data.billingPeriod === "lifetime" ? "شراء كامل" : "شهري";

    const { notifyPlatformOwner } = await import("@/lib/notify.server");
    await notifyPlatformOwner({
      subject: `طلب باقة جديد: ${planName} — ${data.tenantName}`,
      replyTo: data.email,
      lines: [
        `الباقة: ${planName} (${periodLabel})`,
        `المقرأة: ${data.tenantName}`,
        `مقدّمة الطلب: ${data.contactName}`,
        `البريد: ${data.email}`,
        `الجوال: ${data.phone ?? "—"}`,
        `ملاحظات: ${data.notes ?? "—"}`,
      ],
    });

    return { ok: true as const };
  });

/** رسالة من صفحة تواصل معنا — تُحفظ ثم يُرسل تنبيه بريدي فوري */
export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => contactSchema.parse(input))
  .handler(async ({ data }) => {
    const { guardPublicRate } = await import("@/lib/rate-limit-guard.server");
    await guardPublicRate("contact_message", 5, 300);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("contact_messages").insert({
      name: data.name,
      email: data.email,
      message: `${data.subject}\n\n${data.message}`,
    });
    if (error) throw new Error("تعذّر إرسال الرسالة");

    const { notifyPlatformOwner } = await import("@/lib/notify.server");
    await notifyPlatformOwner({
      subject: `رسالة تواصل جديدة: ${data.subject}`,
      replyTo: data.email,
      lines: [`من: ${data.name}`, `البريد: ${data.email}`, "الرسالة:", data.message],
    });

    return { ok: true as const };
  });
