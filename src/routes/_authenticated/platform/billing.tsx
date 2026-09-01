import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Wallet, Receipt, TrendingUp, Clock, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { platformNav } from "@/components/layout/nav";
import { StatCard, LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/roles";
import { BILLING_LABELS } from "@/lib/pricing";
import {
  INVOICE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDate,
  formatMoney,
} from "@/lib/billing";
import {
  cancelPaymentIntent,
  manageSubscription,
  recordManualPayment,
  runSubscriptionExpiryCheck,
} from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/platform/billing")({
  head: () => ({
    meta: [
      { title: "الفواتير والإيرادات — سُحُب" },
      { name: "description", content: "متابعة اشتراكات المقارئ والفواتير وإيرادات منصة سُحُب." },
      { property: "og:title", content: "الفواتير والإيرادات — سُحُب" },
      { property: "og:description", content: "لوحة الاشتراكات والفواتير والإيرادات في منصة سُحُب." },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const { isPlatformOwner, loading } = useAuth();
  const qc = useQueryClient();
  const [manageTarget, setManageTarget] = useState<{ id: string; tenant: string } | null>(null);
  const [months, setMonths] = useState("12");

  const markPaid = useServerFn(recordManualPayment);
  const cancelIntent = useServerFn(cancelPaymentIntent);
  const subAction = useServerFn(manageSubscription);
  const expiryCheck = useServerFn(runSubscriptionExpiryCheck);

  const revenueQuery = useQuery({
    queryKey: ["platform-revenue"],
    enabled: isPlatformOwner,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_revenue_monthly", { _months: 12 });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invoicesQuery = useQuery({
    queryKey: ["platform-invoices"],
    enabled: isPlatformOwner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, number, amount, currency, status, billing_period, issued_at, paid_at, tenants(name)")
        .order("issued_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const intentsQuery = useQuery({
    queryKey: ["platform-intents"],
    enabled: isPlatformOwner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_intents")
        .select("id, amount, currency, status, billing_period, created_at, provider, tenants(name), plans(name_ar)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const subsQuery = useQuery({
    queryKey: ["platform-subscriptions"],
    enabled: isPlatformOwner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(
          "id, status, billing_period, amount, currency, current_period_end, expires_at, cancel_at_period_end, tenants(name), plans(name_ar)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  function refreshAll() {
    void qc.invalidateQueries({ queryKey: ["platform-revenue"] });
    void qc.invalidateQueries({ queryKey: ["platform-invoices"] });
    void qc.invalidateQueries({ queryKey: ["platform-intents"] });
    void qc.invalidateQueries({ queryKey: ["platform-subscriptions"] });
    void qc.invalidateQueries({ queryKey: ["platform-tenants"] });
  }

  const payMutation = useMutation({
    mutationFn: (intentId: string) => markPaid({ data: { intentId } }),
    onSuccess: () => {
      toast.success("تم تسجيل الدفعة وتفعيل الاشتراك وإصدار الفاتورة");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (intentId: string) => cancelIntent({ data: { intentId } }),
    onSuccess: () => {
      toast.success("تم إلغاء محاولة الدفع");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const subMutation = useMutation({
    mutationFn: (input: { subscriptionId: string; action: "extend" | "cancel_at_period_end" | "resume" | "cancel_now"; months?: number }) =>
      subAction({ data: input }),
    onSuccess: () => {
      toast.success("تم تحديث الاشتراك");
      setManageTarget(null);
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const expiryMutation = useMutation({
    mutationFn: () => expiryCheck({}),
    onSuccess: (r) => {
      toast.success(r.expired ? `تم إيقاف ${r.expired} اشتراكًا منتهيًا` : "لا توجد اشتراكات منتهية");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <LoadingBlock />;
  if (!isPlatformOwner) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5 text-center">
        <p className="text-sm text-muted-foreground">هذه الصفحة مخصصة لإدارة المنصة.</p>
      </div>
    );
  }

  const revenue = revenueQuery.data ?? [];
  const currency = revenue[0]?.currency ?? "SAR";
  const total = revenue.reduce((sum, r) => sum + Number(r.paid_total ?? 0), 0);
  const thisMonthKey = new Date().toISOString().slice(0, 7);
  const thisMonth = revenue
    .filter((r) => String(r.month ?? "").startsWith(thisMonthKey))
    .reduce((sum, r) => sum + Number(r.paid_total ?? 0), 0);
  const pendingIntents = (intentsQuery.data ?? []).filter((i) => i.status === "pending");
  const activeSubs = (subsQuery.data ?? []).filter((s) => s.status === "active" || s.status === "trialing");

  return (
    <AppShell
      brandName="سُحُب"
      brandSubtitle="إدارة المنصة"
      nav={platformNav}
      title="الفواتير والإيرادات"
      crumbs={[{ label: "سُحُب" }, { label: "الفواتير والإيرادات" }]}
      actions={
        <Button size="sm" variant="outline" onClick={() => expiryMutation.mutate()} disabled={expiryMutation.isPending}>
          {expiryMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          فحص الاشتراكات المنتهية
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="إيراد هذا الشهر" value={formatMoney(thisMonth, currency)} tone="gold" icon={<TrendingUp className="size-5" />} />
          <StatCard label="إيراد ١٢ شهرًا" value={formatMoney(total, currency)} icon={<Wallet className="size-5" />} />
          <StatCard label="اشتراكات فعّالة" value={activeSubs.length} tone="success" icon={<CheckCircle2 className="size-5" />} />
          <StatCard label="مدفوعات بانتظار التأكيد" value={pendingIntents.length} tone="warning" icon={<Clock className="size-5" />} />
        </div>

        <section className="surface-panel overflow-hidden">
          <header className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">محاولات الدفع</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              التفعيل التلقائي يحدث عبر إشعار بوابة الدفع الموثوق (Webhook). قبل ربط البوابة يمكنك تأكيد الدفعة يدويًا هنا.
            </p>
          </header>
          {intentsQuery.isLoading ? (
            <LoadingBlock />
          ) : intentsQuery.data?.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المقرأة</TableHead>
                    <TableHead>الباقة</TableHead>
                    <TableHead>نوع الدفع</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {intentsQuery.data.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.tenants?.name ?? "—"}</TableCell>
                      <TableCell>{i.plans?.name_ar ?? "—"}</TableCell>
                      <TableCell>{BILLING_LABELS[i.billing_period]}</TableCell>
                      <TableCell className="tabular-nums">{formatMoney(i.amount, i.currency)}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-muted px-3 py-1 text-xs">{PAYMENT_STATUS_LABELS[i.status]}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(i.created_at)}</TableCell>
                      <TableCell>
                        {i.status === "pending" ? (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => payMutation.mutate(i.id)} disabled={payMutation.isPending}>
                              <CheckCircle2 className="size-4" />
                              تأكيد الدفع
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => cancelMutation.mutate(i.id)}>
                              <XCircle className="size-4" />
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="لا توجد محاولات دفع بعد" icon={<Wallet className="size-6" />} />
          )}
        </section>

        <section className="surface-panel overflow-hidden">
          <header className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">اشتراكات المقارئ</h2>
          </header>
          {subsQuery.isLoading ? (
            <LoadingBlock />
          ) : subsQuery.data?.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المقرأة</TableHead>
                    <TableHead>الباقة</TableHead>
                    <TableHead>نوع الدفع</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>تنتهي في</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subsQuery.data.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.tenants?.name ?? "—"}</TableCell>
                      <TableCell>{s.plans?.name_ar ?? "—"}</TableCell>
                      <TableCell>{BILLING_LABELS[s.billing_period]}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-muted px-3 py-1 text-xs">
                          {SUBSCRIPTION_STATUS_LABELS[s.status] ?? s.status}
                          {s.cancel_at_period_end ? " • لن يُجدَّد" : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(s.current_period_end ?? s.expires_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setManageTarget({ id: s.id, tenant: s.tenants?.name ?? "" })}
                        >
                          إدارة
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="لا توجد اشتراكات بعد" icon={<Receipt className="size-6" />} />
          )}
        </section>

        <section className="surface-panel overflow-hidden">
          <header className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">الفواتير</h2>
          </header>
          {invoicesQuery.isLoading ? (
            <LoadingBlock />
          ) : invoicesQuery.data?.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الرقم</TableHead>
                    <TableHead>المقرأة</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الإصدار</TableHead>
                    <TableHead>السداد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesQuery.data.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell dir="ltr" className="font-mono text-xs">{inv.number}</TableCell>
                      <TableCell>{inv.tenants?.name ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">{formatMoney(inv.amount, inv.currency)}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-muted px-3 py-1 text-xs">{INVOICE_STATUS_LABELS[inv.status]}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(inv.issued_at)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(inv.paid_at)}</TableCell>
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

      <Dialog open={manageTarget !== null} onOpenChange={(v) => !v && setManageTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إدارة اشتراك {manageTarget?.tenant}</DialogTitle>
            <DialogDescription>تمديد الاشتراك أو إيقاف التجديد أو إلغاؤه فورًا.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor="months">عدد الأشهر</Label>
                <Input id="months" value={months} onChange={(e) => setMonths(e.target.value)} inputMode="numeric" />
              </div>
              <Button
                onClick={() =>
                  manageTarget &&
                  subMutation.mutate({
                    subscriptionId: manageTarget.id,
                    action: "extend",
                    months: Math.max(1, Math.min(120, Number(months) || 1)),
                  })
                }
                disabled={subMutation.isPending}
              >
                تمديد
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => manageTarget && subMutation.mutate({ subscriptionId: manageTarget.id, action: "cancel_at_period_end" })}
              >
                إيقاف التجديد التلقائي
              </Button>
              <Button
                variant="outline"
                onClick={() => manageTarget && subMutation.mutate({ subscriptionId: manageTarget.id, action: "resume" })}
              >
                إعادة التنشيط
              </Button>
              <Button
                variant="destructive"
                onClick={() => manageTarget && subMutation.mutate({ subscriptionId: manageTarget.id, action: "cancel_now" })}
              >
                إلغاء فوري
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManageTarget(null)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
