import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CreditCard, Receipt, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { visibleTenantNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState, StatCard } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenantContext } from "@/hooks/useTenantContext";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/roles";
import { BILLING_LABELS, BILLING_OPTIONS, type BillingPeriod } from "@/lib/pricing";
import { INVOICE_STATUS_LABELS, LIMIT_LABELS, formatDate, formatMoney, type LimitKind } from "@/lib/billing";
import { createCheckoutIntent } from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/app/$slug/subscription")({
  head: () => ({
    meta: [
      { title: "الاشتراك والفواتير — سُحُب" },
      { name: "description", content: "متابعة اشتراك المقرأة وحدود الباقة والفواتير وتجديد الاشتراك." },
      { property: "og:title", content: "الاشتراك والفواتير — سُحُب" },
      { property: "og:description", content: "اشتراك المقرأة وحدود الباقة والفواتير في منصة سُحُب." },
    ],
  }),
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const { tenant, canManage, loading, hasFeature, canRecord, isCircleScopedOnly } = useTenantContext();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [planId, setPlanId] = useState<string>("");
  const startCheckout = useServerFn(createCheckoutIntent);

  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);
  const planLimits = usePlanLimits(tenant?.id);

  const subQuery = useQuery({
    queryKey: ["tenant-subscription", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, status, billing_period, amount, currency, current_period_end, expires_at, cancel_at_period_end, plans(id, name_ar)")
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invoicesQuery = useQuery({
    queryKey: ["tenant-invoices", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, number, amount, currency, status, issued_at, paid_at, billing_period")
        .eq("tenant_id", tenant!.id)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const checkout = useMutation({
    mutationFn: () =>
      startCheckout({ data: { tenantId: tenant!.id, planId: planId || subQuery.data?.plans?.id || "", billingPeriod: period } }),
    onSuccess: (res) => {
      if (res.providerConfigured && res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      toast.success(
        `تم إنشاء طلب دفع بمبلغ ${formatMoney(res.amount, res.currency)}. سيتم تفعيل الاشتراك تلقائيًا بعد تأكيد الدفع.`,
      );
      void qc.invalidateQueries({ queryKey: ["tenant-intents", tenant?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <LoadingBlock />;
  if (!tenant || !canManage) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5 text-center">
        <p className="text-sm text-muted-foreground">هذه الصفحة مخصصة لإدارة المقرأة.</p>
      </div>
    );
  }

  const sub = subQuery.data;
  const kinds: LimitKind[] = ["students", "circles", "teachers"];

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="الاشتراك والفواتير"
      nav={visibleTenantNav(tenant.slug, hasFeature, canManage, canRecord, isCircleScopedOnly)}
      title="الاشتراك والفواتير"
      crumbs={[{ label: tenant.name }, { label: "الاشتراك" }]}
    >
      <div className="space-y-6">
        <section className="surface-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">الباقة الحالية</p>
              <h2 className="mt-1 text-2xl font-bold">{sub?.plans?.name_ar ?? "لا يوجد اشتراك"}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {sub
                  ? `${SUBSCRIPTION_STATUS_LABELS[sub.status] ?? sub.status} • ${BILLING_LABELS[sub.billing_period]} • تنتهي في ${formatDate(sub.current_period_end ?? sub.expires_at)}`
                  : "اختاري باقة وابدئي الاشتراك"}
              </p>
              {sub?.cancel_at_period_end ? (
                <p className="mt-1 text-xs text-warning-foreground">التجديد التلقائي موقوف؛ سينتهي الاشتراك في نهاية الفترة.</p>
              ) : null}
            </div>
            <span className="grid size-12 place-items-center rounded-xl bg-primary-soft text-primary">
              <ShieldCheck className="size-6" />
            </span>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-3">
          {kinds.map((kind) => {
            const limit = planLimits.data?.limits[kind] ?? 0;
            const used = planLimits.data?.usage[kind] ?? 0;
            const unlimited = !limit || limit <= 0;
            return (
              <StatCard
                key={kind}
                label={LIMIT_LABELS[kind]}
                value={unlimited ? `${used} / بلا حد` : `${used} / ${limit}`}
                tone={!unlimited && used >= limit ? "warning" : "default"}
                hint={unlimited ? "الباقة بلا حدود لهذا البند" : `المتبقي ${Math.max(0, limit - used)}`}
                icon={<Users className="size-5" />}
              />
            );
          })}
        </div>

        <section className="surface-panel p-5">
          <h2 className="font-semibold">تجديد أو ترقية الاشتراك</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            بعد إتمام الدفع يُفعَّل الاشتراك تلقائيًا عند وصول تأكيد موثوق من بوابة الدفع، لا بمجرد رجوعك من صفحة الدفع.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Select value={planId || sub?.plans?.id || ""} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="اختاري الباقة" />
              </SelectTrigger>
              <SelectContent>
                {plansQuery.data?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={(v) => setPeriod(v as BillingPeriod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILLING_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => checkout.mutate()}
              disabled={checkout.isPending || !(planId || sub?.plans?.id)}
            >
              <CreditCard className="size-4" />
              متابعة الدفع
            </Button>
          </div>
        </section>

        <section className="surface-panel overflow-hidden">
          <header className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">فواتيري</h2>
          </header>
          {invoicesQuery.isLoading ? (
            <LoadingBlock />
          ) : invoicesQuery.data?.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الرقم</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>نوع الدفع</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesQuery.data.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell dir="ltr" className="font-mono text-xs">{inv.number}</TableCell>
                      <TableCell className="tabular-nums">{formatMoney(inv.amount, inv.currency)}</TableCell>
                      <TableCell>{BILLING_LABELS[inv.billing_period]}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-muted px-3 py-1 text-xs">{INVOICE_STATUS_LABELS[inv.status]}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(inv.paid_at ?? inv.issued_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="لا توجد فواتير بعد" icon={<Receipt className="size-6" />} />
          )}
        </section>
      </div>
    </AppShell>
  );
}
