// منطق تفعيل الاشتراكات — يعمل على الخادم فقط.
// المصدر الموثوق للتفعيل هو Webhook بوابة الدفع (أو تسجيل يدوي من مالكة المنصة)،
// ولا يُفعَّل أي اشتراك بمجرد عودة المستخدمة من صفحة الدفع.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { nextPeriodEnd } from "@/lib/billing";
import type { BillingPeriod } from "@/lib/pricing";

type ActivateArgs = {
  intentId: string;
  provider: string;
  providerRef?: string | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  providerInvoiceId?: string | null;
  paidAmount?: number | null;
};

/**
 * يفعّل/يجدّد الاشتراك المرتبط بمحاولة دفع ناجحة، ويصدر فاتورة مدفوعة.
 * العملية idempotent: إذا كانت المحاولة مسجّلة ناجحة مسبقًا لا يتكرر أي شيء.
 */
export async function activatePaidIntent(args: ActivateArgs) {
  const { data: intent, error } = await supabaseAdmin
    .from("payment_intents")
    .select("*")
    .eq("id", args.intentId)
    .maybeSingle();
  if (error) throw error;
  if (!intent) throw new Error("محاولة الدفع غير موجودة");
  if (intent.status === "succeeded") {
    return { alreadyProcessed: true as const, tenantId: intent.tenant_id };
  }
  if (!intent.tenant_id) throw new Error("محاولة الدفع غير مرتبطة بمقرأة");

  const period = intent.billing_period as BillingPeriod;
  const now = new Date();
  const periodEnd = nextPeriodEnd(period, now);
  const amount = args.paidAmount ?? Number(intent.amount);

  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("id, current_period_end, expires_at")
    .eq("tenant_id", intent.tenant_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // التجديد يمتد من نهاية الفترة الحالية إن كانت مستقبلية
  const base =
    existing?.current_period_end && new Date(existing.current_period_end) > now
      ? new Date(existing.current_period_end)
      : now;
  const renewedEnd = nextPeriodEnd(period, base);

  const subPayload = {
    tenant_id: intent.tenant_id,
    plan_id: intent.plan_id,
    billing_period: period,
    status: "active" as const,
    amount,
    currency: intent.currency,
    cancel_at_period_end: false,
    canceled_at: null,
    current_period_start: now.toISOString(),
    current_period_end: (existing ? renewedEnd : periodEnd)?.toISOString() ?? null,
    expires_at: (existing ? renewedEnd : periodEnd)?.toISOString() ?? null,
    provider: args.provider,
    provider_customer_id: args.providerCustomerId ?? null,
    provider_subscription_id: args.providerSubscriptionId ?? null,
  };

  let subscriptionId: string;
  if (existing) {
    const { data, error: updErr } = await supabaseAdmin
      .from("subscriptions")
      .update(subPayload)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (updErr) throw updErr;
    subscriptionId = data.id;
  } else {
    const { data, error: insErr } = await supabaseAdmin
      .from("subscriptions")
      .insert({ ...subPayload, started_at: now.toISOString() })
      .select("id")
      .single();
    if (insErr) throw insErr;
    subscriptionId = data.id;
  }

  const { data: invoice, error: invErr } = await supabaseAdmin
    .from("invoices")
    .insert({
      tenant_id: intent.tenant_id,
      subscription_id: subscriptionId,
      payment_intent_id: intent.id,
      plan_id: intent.plan_id,
      billing_period: period,
      amount,
      currency: intent.currency,
      status: "paid",
      paid_at: now.toISOString(),
      period_start: subPayload.current_period_start,
      period_end: subPayload.current_period_end,
      provider: args.provider,
      provider_invoice_id: args.providerInvoiceId ?? null,
    })
    .select("id, number")
    .single();
  if (invErr) throw invErr;

  await supabaseAdmin
    .from("payment_intents")
    .update({
      status: "succeeded",
      provider: args.provider,
      provider_ref: args.providerRef ?? intent.provider_ref,
      completed_at: now.toISOString(),
    })
    .eq("id", intent.id);

  await supabaseAdmin.from("tenants").update({ status: "active" }).eq("id", intent.tenant_id);

  return {
    alreadyProcessed: false as const,
    tenantId: intent.tenant_id,
    subscriptionId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
  };
}

/** تسجيل فشل الدفع دون تفعيل أي اشتراك */
export async function failIntent(intentId: string, reason: string, provider: string) {
  await supabaseAdmin
    .from("payment_intents")
    .update({ status: "failed", failure_reason: reason.slice(0, 500), provider })
    .eq("id", intentId);
}

/** إيقاف الاشتراكات المنتهية وتعليق مقارئها (يمكن استدعاؤها من مهمة مجدولة) */
export async function expireDueSubscriptions() {
  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, tenant_id")
    .in("status", ["active", "trialing", "past_due"])
    .not("expires_at", "is", null)
    .lt("expires_at", nowIso);
  if (error) throw error;
  if (!due?.length) return { expired: 0 };

  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "expired" })
    .in(
      "id",
      due.map((s) => s.id),
    );

  const tenantIds = [...new Set(due.map((s) => s.tenant_id).filter(Boolean))] as string[];
  if (tenantIds.length) {
    await supabaseAdmin.from("tenants").update({ status: "suspended" }).in("id", tenantIds);
  }
  return { expired: due.length };
}
