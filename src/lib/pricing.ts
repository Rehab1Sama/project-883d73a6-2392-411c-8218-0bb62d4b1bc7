import type { Database } from "@/integrations/supabase/types";

export type PlanRow = Database["public"]["Tables"]["plans"]["Row"];
export type BillingPeriod = Database["public"]["Enums"]["billing_period"];

export const BILLING_OPTIONS: { value: BillingPeriod; label: string; hint?: string }[] = [
  { value: "monthly", label: "شهري" },
  { value: "yearly", label: "سنوي", hint: "شهرين مجانًا" },
];

export const BILLING_LABELS: Record<BillingPeriod, string> = {
  monthly: "شهري",
  yearly: "سنوي",
  lifetime: "شراء كامل",
};

const SUFFIX: Record<BillingPeriod, string> = {
  monthly: "/ شهريًا",
  yearly: "/ سنويًا",
  lifetime: "دفعة واحدة",
};

export function planPrice(plan: PlanRow, period: BillingPeriod): number {
  if (period === "yearly") return Number(plan.price_yearly);
  if (period === "lifetime") return Number(plan.price_lifetime);
  return Number(plan.price_monthly);
}

/** رسوم التجهيز لمرة واحدة عند الاشتراك (0 = لا يوجد) */
export function planSetupFee(plan: PlanRow): number {
  return Number(plan.setup_fee ?? 0);
}

/** نص رسوم التجهيز الجاهز للعرض */
export function planSetupFeeLabel(plan: PlanRow): string | null {
  const fee = planSetupFee(plan);
  if (!fee) return null;
  return `+ رسوم تجهيز ${fee.toLocaleString("ar-EG")} ${plan.currency} تُدفع مرة واحدة`;
}

/** نص السعر المعروض للباقة حسب نوع الدفع */
export function planPriceLabel(
  plan: PlanRow,
  period: BillingPeriod,
): { amount: string; suffix: string | null } {
  if (plan.is_custom_priced) return { amount: "بحسب الحاجة", suffix: null };
  const value = planPrice(plan, period);
  if (value === 0) return { amount: "مجانًا", suffix: null };
  return { amount: `${value.toLocaleString("ar-EG")} ${plan.currency}`, suffix: SUFFIX[period] };
}

/** السعر قبل التخفيض (يُعرض مشطوبًا) — يُهمل إن لم يكن أكبر من السعر الحالي */
export function planComparePrice(plan: PlanRow, period: BillingPeriod): number | null {
  if (plan.is_custom_priced) return null;
  const raw =
    period === "yearly"
      ? plan.compare_yearly
      : period === "lifetime"
        ? plan.compare_lifetime
        : plan.compare_monthly;
  if (raw == null) return null;
  const value = Number(raw);
  const current = planPrice(plan, period);
  return value > current && current > 0 ? value : null;
}

/** نسبة التخفيض المئوية */
export function planDiscountPercent(plan: PlanRow, period: BillingPeriod): number | null {
  const before = planComparePrice(plan, period);
  if (!before) return null;
  return Math.round((1 - planPrice(plan, period) / before) * 100);
}

/** نسبة التوفير عند الدفع السنوي مقارنة بالشهري×12 */
export function planYearlySavingsPercent(plan: PlanRow): number | null {
  if (plan.is_custom_priced) return null;
  const monthlyTotal = Number(plan.price_monthly) * 12;
  const yearly = Number(plan.price_yearly);
  if (!monthlyTotal || !yearly || yearly >= monthlyTotal) return null;
  return Math.round((1 - yearly / monthlyTotal) * 100);
}

/** حدود الباقة كعناصر جاهزة للعرض (0 = بلا حدود) */
export function planLimits(plan: PlanRow): { label: string; value: string }[] {
  const fmt = (n: number) => (n > 0 ? n.toLocaleString("ar-EG") : "بلا حدود");
  return [
    { label: "طالبة", value: fmt(plan.max_students) },
    { label: "حلقة", value: fmt(plan.max_circles) },
    { label: "معلمة", value: fmt(plan.max_teachers) },
  ];
}
