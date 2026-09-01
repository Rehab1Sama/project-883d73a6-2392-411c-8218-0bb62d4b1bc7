import type { Database } from "@/integrations/supabase/types";
import type { BillingPeriod } from "@/lib/pricing";

export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];
export type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];
export type PaymentIntentRow = Database["public"]["Tables"]["payment_intents"]["Row"];
export type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
export type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "بانتظار الدفع",
  processing: "جارٍ التحقق",
  succeeded: "مدفوعة",
  failed: "فشل الدفع",
  canceled: "ملغاة",
  expired: "منتهية الصلاحية",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "مسودة",
  open: "مستحقة",
  paid: "مدفوعة",
  void: "ملغاة",
  refunded: "مستردة",
  failed: "فاشلة",
};

/** نهاية الفترة التالية حسب نوع الدفع (الشراء الكامل بلا نهاية) */
export function nextPeriodEnd(period: BillingPeriod, from: Date = new Date()): Date | null {
  const d = new Date(from);
  if (period === "monthly") {
    d.setMonth(d.getMonth() + 1);
    return d;
  }
  if (period === "yearly") {
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  return null;
}

export function formatMoney(amount: number | string, currency = "SAR"): string {
  return `${Number(amount).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ${currency}`;
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}

export const LIMIT_LABELS = {
  students: "الطالبات",
  circles: "الحلقات",
  teachers: "المعلمات",
} as const;

export type LimitKind = keyof typeof LIMIT_LABELS;
