import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Copy, CheckCircle2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { platformNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { BILLING_LABELS } from "@/lib/pricing";
import { slugify } from "@/lib/tenant";
import { approvePlanRequest } from "@/lib/invitations.functions";

export const Route = createFileRoute("/_authenticated/platform/requests")({
  head: () => ({
    meta: [
      { title: "طلبات الاشتراك — سُحُب" },
      { name: "description", content: "اعتماد طلبات الاشتراك وتحويلها إلى مقارئ عاملة مع دعوة القائدة." },
      { property: "og:title", content: "طلبات الاشتراك — سُحُب" },
      { property: "og:description", content: "إدارة طلبات الاشتراك في منصة سُحُب." },
    ],
  }),
  component: RequestsPage,
});

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  approved: "معتمد",
  rejected: "مرفوض",
};

type RequestRow = {
  id: string;
  tenant_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  status: string;
  billing_period: "monthly" | "yearly" | "lifetime";
  created_at: string;
  plan_id: string | null;
  tenant_id: string | null;
  plans: { name_ar: string } | null;
};

function RequestsPage() {
  const { isPlatformOwner, loading } = useAuth();
  const qc = useQueryClient();
  const approve = useServerFn(approvePlanRequest);
  const [target, setTarget] = useState<RequestRow | null>(null);
  const [slug, setSlug] = useState("");
  const [planId, setPlanId] = useState("");
  const [months, setMonths] = useState("12");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [details, setDetails] = useState<RequestRow | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("id, name_ar").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const requestsQuery = useQuery({
    queryKey: ["plan-requests"],
    enabled: isPlatformOwner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_requests")
        .select("*, plans(name_ar)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as RequestRow[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "contacted" | "rejected" }) => {
      const { error } = await supabase.from("plan_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث الطلب");
      void qc.invalidateQueries({ queryKey: ["plan-requests"] });
    },
    onError: () => toast.error("تعذّر تحديث الطلب"),
  });

  const approveMutation = useMutation({
    mutationFn: async () =>
      approve({
        data: { requestId: target!.id, slug, planId, months: Number(months) },
      }),
    onSuccess: (res) => {
      setInviteLink(`${window.location.origin}/invite/${res.token}`);
      setTarget(null);
      void qc.invalidateQueries({ queryKey: ["plan-requests"] });
      void qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      void qc.invalidateQueries({ queryKey: ["platform-stats"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر اعتماد الطلب"),
  });

  function openApprove(row: RequestRow) {
    setTarget(row);
    setSlug(slugify(row.tenant_name).replace(/[^a-z0-9-]/g, "") || "");
    setPlanId(row.plan_id ?? "");
    setMonths(row.billing_period === "lifetime" ? "0" : row.billing_period === "yearly" ? "12" : "1");
  }

  if (loading) return <LoadingBlock />;
  if (!isPlatformOwner) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5 text-center">
        <div>
          <h1 className="text-xl font-semibold">لا تملكين صلاحية الوصول</h1>
          <Button asChild className="mt-4">
            <Link to="/dashboard">العودة للوحتي</Link>
          </Button>
        </div>
      </div>
    );
  }

  const allRows = requestsQuery.data ?? [];
  const q = search.trim().toLowerCase();
  const rows = allRows
    .filter((r) => (statusFilter === "all" ? true : r.status === statusFilter))
    .filter((r) =>
      q
        ? [r.tenant_name, r.contact_name, r.email, r.phone ?? ""].some((v) => v.toLowerCase().includes(q))
        : true,
    );

  return (
    <AppShell
      brandName="سُحُب"
      brandSubtitle="إدارة المنصة"
      nav={platformNav}
      title="طلبات الاشتراك"
      crumbs={[{ label: "سُحُب", to: "/platform" }, { label: "طلبات الاشتراك" }]}
    >
      <div className="surface-panel mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1 space-y-2">
          <Label htmlFor="req-search">بحث</Label>
          <Input
            id="req-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="اسم المقرأة أو مقدِّمة الطلب أو البريد"
          />
        </div>
        <div className="w-48 space-y-2">
          <Label>الحالة</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="كل الحالات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات ({allRows.length})</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label} ({allRows.filter((r) => r.status === k).length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {requestsQuery.isLoading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState title="لا توجد طلبات بعد" description="ستظهر هنا طلبات الاشتراك الواردة من صفحة الباقات." />
      ) : (
        <div className="surface-panel overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المقرأة</TableHead>
                <TableHead className="text-right">مقدِّمة الطلب</TableHead>
                <TableHead className="text-right">الباقة</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <p className="font-medium">{r.tenant_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("ar-EG")}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p>{r.contact_name}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {r.email}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p>{r.plans?.name_ar ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{BILLING_LABELS[r.billing_period]}</p>
                  </TableCell>
                  <TableCell>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs">
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDetails(r)}>
                        <Eye className="size-4" />
                        التفاصيل
                      </Button>
                      {r.tenant_id ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckCircle2 className="size-4 text-primary" /> تم التفعيل
                        </span>
                      ) : (
                        <>
                          <Button size="sm" onClick={() => openApprove(r)}>
                            اعتماد وتفعيل
                          </Button>
                          {r.status === "new" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setStatus.mutate({ id: r.id, status: "contacted" })}
                            >
                              تم التواصل
                            </Button>
                          )}
                          {r.status !== "rejected" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setStatus.mutate({ id: r.id, status: "rejected" })}
                            >
                              رفض
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!details} onOpenChange={(o) => !o && setDetails(null)}>
        <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل الطلب</DialogTitle>
            <DialogDescription>كل البيانات التي أرسلتها مقدِّمة الطلب.</DialogDescription>
          </DialogHeader>
          {details ? (
            <dl className="space-y-3 text-sm">
              {[
                ["اسم المقرأة", details.tenant_name],
                ["مقدِّمة الطلب", details.contact_name],
                ["البريد", details.email],
                ["الجوال", details.phone ?? "—"],
                ["الباقة", details.plans?.name_ar ?? "—"],
                ["نوع الاشتراك", BILLING_LABELS[details.billing_period]],
                ["الحالة", STATUS_LABELS[details.status] ?? details.status],
                ["تاريخ الطلب", new Date(details.created_at).toLocaleString("ar-EG")],
                ["مفعّلة", details.tenant_id ? "نعم" : "لا"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-border/70 pb-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-end font-medium">{value}</dd>
                </div>
              ))}
              <div>
                <dt className="mb-1 text-muted-foreground">ملاحظات الطلب</dt>
                <dd className="whitespace-pre-wrap rounded-xl bg-muted/60 p-3 leading-relaxed">
                  {details.notes?.trim() || "لا توجد ملاحظات"}
                </dd>
              </div>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>اعتماد وتفعيل المقرأة</DialogTitle>
            <DialogDescription>
              سيتم إنشاء المقرأة وتشغيل اشتراكها، ثم توليد رابط دعوة للقائدة لتصبح مديرة المقرأة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="a-slug">الرابط المختصر</Label>
              <Input id="a-slug" dir="ltr" value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={40} />
              <p className="text-xs text-muted-foreground" dir="ltr">
                /m/{slug || "slug"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>الباقة</Label>
              <Select value={planId} onValueChange={setPlanId}>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-months">مدة الاشتراك (بالأشهر، صفر = دائم)</Label>
              <Input
                id="a-months"
                type="number"
                min={0}
                max={120}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              الدعوة تُرسل إلى: <span dir="ltr">{target?.email}</span>
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending || !slug || !planId}
            >
              {approveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "اعتماد وتفعيل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!inviteLink} onOpenChange={(o) => !o && setInviteLink(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تم تفعيل المقرأة</DialogTitle>
            <DialogDescription>
              أرسلي رابط الدعوة التالي إلى القائدة، تفتحه وتسجّل بنفس بريدها لتصبح مديرة المقرأة.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={inviteLink ?? ""} dir="ltr" />
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(inviteLink ?? "");
                toast.success("تم نسخ الرابط");
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
