import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, Search, ExternalLink, Loader2, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { platformNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TenantFeaturesDialog } from "@/components/platform/TenantFeaturesDialog";
import { useAuth } from "@/hooks/useAuth";
import { TENANT_STATUS_LABELS, SUBSCRIPTION_STATUS_LABELS } from "@/lib/roles";
import { slugify } from "@/lib/tenant";

export const Route = createFileRoute("/_authenticated/platform/tenants")({
  component: TenantsPage,
});

const tenantSchema = z.object({
  name: z.string().trim().min(2, "اسم المقرأة قصير جدًا").max(120),
  slug: z
    .string()
    .trim()
    .min(2, "الرابط قصير جدًا")
    .max(40)
    .regex(/^[a-z0-9-]+$/, "الرابط يجب أن يكون بأحرف إنجليزية صغيرة وأرقام وشرطات فقط"),
  short_description: z.string().trim().max(300).optional().or(z.literal("")),
  plan_id: z.string().uuid("اختاري الباقة"),
});

function TenantsPage() {
  const { isPlatformOwner, loading } = useAuth();
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const tenantsQuery = useQuery({
    queryKey: ["platform-tenants"],
    enabled: isPlatformOwner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, slug, status, registration_open, created_at, subscriptions(id, status, expires_at, plans(name_ar))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const usageQuery = useQuery({
    queryKey: ["platform-tenant-usage"],
    enabled: isPlatformOwner,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_tenant_usage_summary");
      if (error) throw error;
      return data ?? [];
    },
  });
  const usageByTenant = new Map((usageQuery.data ?? []).map((u) => [u.tenant_id, u]));

  const createTenant = useMutation({
    mutationFn: async (values: z.infer<typeof tenantSchema>) => {
      const { data: tenant, error } = await supabase
        .from("tenants")
        .insert({
          name: values.name,
          slug: values.slug,
          short_description: values.short_description || null,
          status: "active",
        })
        .select("id")
        .single();
      if (error) throw error;

      const expires = new Date();
      expires.setMonth(expires.getMonth() + 1);
      const { error: subError } = await supabase.from("subscriptions").insert({
        tenant_id: tenant.id,
        plan_id: values.plan_id,
        status: "trialing",
        expires_at: expires.toISOString(),
      });
      if (subError) throw subError;
      return tenant;
    },
    onSuccess: () => {
      toast.success("تم إنشاء المقرأة");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      void qc.invalidateQueries({ queryKey: ["platform-stats"] });
    },
    onError: (e: Error) =>
      toast.error(e.message.includes("duplicate") ? "هذا الرابط مستخدم لمقرأة أخرى" : "تعذّر إنشاء المقرأة"),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "suspended" }) => {
      const { error } = await supabase.from("tenants").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث حالة المقرأة");
      void qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      void qc.invalidateQueries({ queryKey: ["platform-stats"] });
    },
    onError: () => toast.error("تعذّر تحديث الحالة"),
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = tenantSchema.safeParse({
      name: form.get("name"),
      slug: form.get("slug"),
      short_description: form.get("short_description"),
      plan_id: form.get("plan_id"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    createTenant.mutate(parsed.data);
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

  const rows = (tenantsQuery.data ?? []).filter((t) => {
    const matchTerm = !term || t.name.includes(term) || t.slug.includes(term.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchTerm && matchStatus;
  });

  return (
    <AppShell
      brandName="سُحُب"
      brandSubtitle="إدارة المنصة"
      nav={platformNav}
      title="المقارئ"
      crumbs={[{ label: "سُحُب", to: "/platform" }, { label: "المقارئ" }]}
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              مقرأة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>إضافة مقرأة</DialogTitle>
              <DialogDescription>
                سيحصل كل مقرأة على رابط مستقل فورًا دون الحاجة لإعادة نشر النظام.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="t-name">اسم المقرأة</Label>
                <Input
                  id="t-name"
                  name="name"
                  required
                  maxLength={120}
                  onChange={(e) => {
                    const slugInput = document.getElementById("t-slug") as HTMLInputElement | null;
                    if (slugInput && !slugInput.dataset["touched"]) slugInput.value = slugify(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-slug">الرابط المختصر</Label>
                <Input
                  id="t-slug"
                  name="slug"
                  dir="ltr"
                  required
                  maxLength={40}
                  placeholder="al-noor"
                  onInput={(e) => (e.currentTarget.dataset["touched"] = "1")}
                />
                <p className="text-xs text-muted-foreground" dir="ltr">
                  /m/&lt;slug&gt; — أو &lt;slug&gt;.suhub.app
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-desc">وصف مختصر</Label>
                <Textarea id="t-desc" name="short_description" maxLength={300} rows={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-plan">الباقة</Label>
                <Select name="plan_id" required>
                  <SelectTrigger id="t-plan">
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
              <DialogFooter>
                <Button type="submit" disabled={createTenant.isPending}>
                  {createTenant.isPending ? <Loader2 className="size-4 animate-spin" /> : "إنشاء"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="ابحثي باسم المقرأة أو الرابط"
            className="pr-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="active">نشطة</SelectItem>
            <SelectItem value="suspended">موقوفة</SelectItem>
            <SelectItem value="pending">قيد التهيئة</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tenantsQuery.isLoading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState
          title="لا توجد مقارئ"
          description="ابدئي بإضافة أول مقرأة، وسيصبح لها رابط ومساحة مستقلة فورًا."
          action={<Button onClick={() => setOpen(true)}>إضافة مقرأة</Button>}
        />
      ) : (
        <div className="surface-panel overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المقرأة</TableHead>
                <TableHead className="text-right">الرابط</TableHead>
                <TableHead className="text-right">الباقة</TableHead>
                <TableHead className="text-right">الاشتراك</TableHead>
                <TableHead className="text-right">ينتهي في</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">استهلاك الباقة</TableHead>
                <TableHead className="text-right">الميزات</TableHead>
                <TableHead className="text-right">الهوية</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => {
                const sub = t.subscriptions?.[0];
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <Link
                        to="/m/$slug"
                        params={{ slug: t.slug }}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                        dir="ltr"
                      >
                        /m/{t.slug}
                        <ExternalLink className="size-3" />
                      </Link>
                    </TableCell>
                    <TableCell>{sub?.plans?.name_ar ?? "—"}</TableCell>
                    <TableCell>{sub ? (SUBSCRIPTION_STATUS_LABELS[sub.status] ?? sub.status) : "—"}</TableCell>
                    <TableCell className="tabular-nums" dir="ltr">
                      {sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString("ar-SA") : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={t.status === "active"}
                          onCheckedChange={(checked) =>
                            toggleStatus.mutate({ id: t.id, status: checked ? "active" : "suspended" })
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          {TENANT_STATUS_LABELS[t.status] ?? t.status}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const u = usageByTenant.get(t.id);
                        if (!u) return <span className="text-xs text-muted-foreground">—</span>;
                        const pct = Math.min(100, Number(u.usage_pct ?? 0));
                        const color =
                          pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-gold" : "bg-primary";
                        return (
                          <div className="w-28">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>{pct.toFixed(0)}%</span>
                            </div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn("h-full rounded-full", color)}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              طالبات {u.students_used}/{u.students_limit || "∞"} · حلقات{" "}
                              {u.circles_used}/{u.circles_limit || "∞"} · معلمات {u.teachers_used}/
                              {u.teachers_limit || "∞"}
                            </p>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <TenantFeaturesDialog tenantId={t.id} tenantName={t.name} />
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/app/$slug/settings" params={{ slug: t.slug }}>
                          <Settings2 className="size-4" />
                          الشعار والألوان
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
