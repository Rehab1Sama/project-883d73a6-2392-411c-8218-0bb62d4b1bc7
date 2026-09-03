import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";


const periodEnum = z.enum(["monthly", "yearly", "lifetime"]);

/**
 * إنشاء محاولة دفع (Checkout) للمقرأة.
 * لا توجد بوابة دفع مربوطة بعد، لذا تُنشأ المحاولة بحالة "بانتظار الدفع" فقط،
 * ويُرجع الحقل providerConfigured=false لتوضيح ذلك في الواجهة.
 */
export const createCheckoutIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        tenantId: z.string().uuid(),
        planId: z.string().uuid(),
        billingPeriod: periodEnum,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    const { data: isOwner } = await supabase.rpc("is_platform_owner", { _user_id: userId });
    const { data: isManager } = await supabase.rpc("is_tenant_manager", {
      _user_id: userId,
      _tenant_id: data.tenantId,
    });
    if (!isOwner && !isManager) throw new Error("غير مصرح");

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("id, price_monthly, price_yearly, price_lifetime, currency, is_custom_priced")
      .eq("id", data.planId)
      .maybeSingle();
    if (planError) throw planError;
    if (!plan) throw new Error("الباقة غير موجودة");

    const amount = plan.is_custom_priced
      ? 0
      : data.billingPeriod === "yearly"
        ? Number(plan.price_yearly)
        : data.billingPeriod === "lifetime"
          ? Number(plan.price_lifetime)
          : Number(plan.price_monthly);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: intent, error } = await supabaseAdmin
      .from("payment_intents")
      .insert({
        tenant_id: data.tenantId,
        plan_id: data.planId,
        billing_period: data.billingPeriod,
        amount,
        currency: plan.currency,
        status: "pending",
        customer_email: String((claims as { email?: string }).email ?? "") || null,
        created_by: userId,
      })
      .select("id, status, amount, currency, idempotency_key")
      .single();
    if (error) throw error;

    return {
      intentId: intent.id,
      amount: Number(intent.amount),
      currency: intent.currency,
      status: intent.status,
      checkoutUrl: null as string | null,
      providerConfigured: false as const,
    };
  });

/**
 * تسجيل دفعة مستلمة يدويًا (تحويل بنكي مثلًا) — لمالكة المنصة فقط.
 * تمر على نفس منطق التفعيل المستخدم مع Webhook بوابة الدفع.
 */
export const recordManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ intentId: z.string().uuid(), reference: z.string().trim().max(120).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("is_platform_owner", { _user_id: context.userId });
    if (!isOwner) throw new Error("غير مصرح");
    const { activatePaidIntent } = await import("@/lib/billing.server");
    return activatePaidIntent({
      intentId: data.intentId,
      provider: "manual",
      providerRef: data.reference ?? null,
    });
  });

/** إلغاء محاولة دفع معلّقة — لمالكة المنصة فقط */
export const cancelPaymentIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ intentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("is_platform_owner", { _user_id: context.userId });
    if (!isOwner) throw new Error("غير مصرح");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("payment_intents")
      .update({ status: "canceled" })
      .eq("id", data.intentId)
      .eq("status", "pending");
    if (error) throw error;
    return { ok: true };
  });

/** إدارة اشتراك مقرأة: تمديد، تغيير باقة، إيقاف التجديد، إعادة تنشيط، إيقاف */
export const manageSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        subscriptionId: z.string().uuid(),
        action: z.enum(["extend", "change_plan", "cancel_at_period_end", "resume", "cancel_now", "set_trial"]),
        months: z.number().int().min(1).max(120).optional(),
        planId: z.string().uuid().optional(),
        billingPeriod: periodEnum.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("is_platform_owner", { _user_id: context.userId });
    if (!isOwner) throw new Error("غير مصرح");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub, error } = await supabaseAdmin
      .from("subscriptions")
      .select("id, tenant_id, status, current_period_end, expires_at, billing_period")
      .eq("id", data.subscriptionId)
      .maybeSingle();
    if (error) throw error;
    if (!sub) throw new Error("الاشتراك غير موجود");

    const now = new Date();
    type SubPatch = Database["public"]["Tables"]["subscriptions"]["Update"];
    const patch: SubPatch = {};

    if (data.action === "extend") {
      const base =
        sub.current_period_end && new Date(sub.current_period_end) > now
          ? new Date(sub.current_period_end)
          : now;
      base.setMonth(base.getMonth() + (data.months ?? 1));
      patch.current_period_end = base.toISOString();
      patch.expires_at = base.toISOString();
      patch.status = "active";
    } else if (data.action === "change_plan") {
      if (!data.planId) throw new Error("اختاري الباقة");
      patch.plan_id = data.planId;
      if (data.billingPeriod) patch.billing_period = data.billingPeriod;
    } else if (data.action === "cancel_at_period_end") {
      patch.cancel_at_period_end = true;
    } else if (data.action === "resume") {
      patch.cancel_at_period_end = false;
      patch.status = "active";
      patch.canceled_at = null;
    } else if (data.action === "cancel_now") {
      patch.status = "canceled";
      patch.canceled_at = now.toISOString();
      patch.cancel_at_period_end = false;
    } else if (data.action === "set_trial") {
      const trialEnd = new Date(now);
      trialEnd.setMonth(trialEnd.getMonth() + (data.months ?? 1));
      patch.status = "trialing";
      patch.trial_ends_at = trialEnd.toISOString();
      patch.current_period_end = trialEnd.toISOString();
      patch.expires_at = trialEnd.toISOString();
    }

    const { error: updErr } = await supabaseAdmin
      .from("subscriptions")
      .update(patch)
      .eq("id", sub.id);
    if (updErr) throw updErr;

    if (sub.tenant_id) {
      const nextStatus =
        patch.status === "canceled" ? "suspended" : patch.status ? "active" : null;
      if (nextStatus) await supabaseAdmin.from("tenants").update({ status: nextStatus }).eq("id", sub.tenant_id);
    }

    return { ok: true };
  });

/** تشغيل فحص انتهاء الاشتراكات يدويًا — لمالكة المنصة فقط */
export const runSubscriptionExpiryCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isOwner } = await context.supabase.rpc("is_platform_owner", { _user_id: context.userId });
    if (!isOwner) throw new Error("غير مصرح");
    const { expireDueSubscriptions } = await import("@/lib/billing.server");
    return expireDueSubscriptions();
  });
