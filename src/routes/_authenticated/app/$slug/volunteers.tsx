import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Heart, Check, X, Upload, Loader2, Inbox, Send, Copy, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { visibleTenantNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState, FeatureLockedState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenantContext } from "@/hooks/useTenantContext";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import type { AppRole } from "@/lib/roles";
import { VOLUNTEER_ROLE_LABELS, VOLUNTEER_STATUS_LABELS, type VolunteerRole } from "@/lib/volunteers";
import { sendMemberInvitation } from "@/lib/invitations.functions";
import { bulkImportVolunteerAccounts } from "@/lib/bulk-import.functions";
import {
  buildCsv,
  downloadCsv,
  mapRows,
  readSheetGrid,
  toNumber,
  VOLUNTEER_ALIASES,
  VOLUNTEER_HEADERS,
  VOLUNTEER_SAMPLE,
} from "@/lib/csv-import";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/app/$slug/volunteers")({
  head: () => ({
    meta: [
      { title: "المتطوعات — سُحُب" },
      { name: "description", content: "تسجيل متطوعات المقرأة كمعلمات ومشرفات ومسؤولات مسارات ومتابعة طلباتهن." },
      { property: "og:title", content: "المتطوعات — سُحُب" },
      { property: "og:description", content: "إدارة متطوعات المقرأة على منصة سُحُب." },
    ],
  }),
  component: VolunteersPage,
});

type RoleRow = {
  id: string;
  user_id: string;
  role: string;
  is_volunteer: boolean;
  track_id: string | null;
  circle_id: string | null;
};

type ApplicationRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  preferred_role: string;
  note: string | null;
  status: string;
  created_at: string;
};

function VolunteersPage() {
  const { tenant, canManage, canRead, loading, hasFeature, canRecord, isCircleScopedOnly } = useTenantContext();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const sendInvite = useServerFn(sendMemberInvitation);
  const importAccounts = useServerFn(bulkImportVolunteerAccounts);
  const [inviteInfo, setInviteInfo] = useState<{ link: string; phone: string | null; name: string } | null>(null);


  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  const rolesQuery = useQuery({
    queryKey: ["tenant-members", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role, is_volunteer, track_id, circle_id")
        .eq("tenant_id", tenant!.id);
      if (error) throw error;
      return data as unknown as RoleRow[];
    },
  });

  const appsQuery = useQuery({
    queryKey: ["volunteer-applications", tenant?.id],
    enabled: canManage && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("volunteer_applications")
        .select("id, full_name, email, phone, preferred_role, note, status, created_at")
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApplicationRow[];
    },
  });

  // دعوات معلّقة صالحة لهذه المقرأة — لمعرفة من أُرسلت لها دعوة مسبقًا
  const invitesQuery = useQuery({
    queryKey: ["member-invitations", tenant?.id],
    enabled: canManage && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("email, role, token, status, expires_at")
        .eq("tenant_id", tenant!.id)
        .eq("status", "pending");
      if (error) throw error;
      return data;
    },
  });

  const inviteApp = useMutation({
    mutationFn: async (row: ApplicationRow) =>
      sendInvite({
        data: { tenantId: tenant!.id, email: row.email!.trim(), role: row.preferred_role as VolunteerRole },
      }),
    onSuccess: (res, row) => {
      setInviteInfo({ link: `${window.location.origin}/invite/${res.token}`, phone: row.phone, name: row.full_name });
      toast.success(res.reused ? "لديها دعوة مُرسلة مسبقًا — إليك رابطها" : "تم إنشاء الدعوة");
      void qc.invalidateQueries({ queryKey: ["member-invitations"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر إرسال الدعوة"),
  });

  /** اعتماد التسجيل: تفعيل الدور مباشرة إن كان لها حساب بنفس البريد */
  const reviewApp = useMutation({
    mutationFn: async ({ row, status }: { row: ApplicationRow; status: "approved" | "rejected" }) => {
      let linked = false;
      if (status === "approved" && row.email) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", row.email)
          .maybeSingle();
        if (profile?.id) {
          const { data: existingRole } = await supabase
            .from("user_roles")
            .select("id")
            .eq("tenant_id", tenant!.id)
            .eq("user_id", profile.id)
            .eq("role", row.preferred_role as AppRole)
            .is("track_id", null)
            .is("circle_id", null)
            .maybeSingle();

          const roleErr = existingRole
            ? (
                await supabase
                  .from("user_roles")
                  .update({ is_volunteer: true } as never)
                  .eq("id", existingRole.id)
              ).error
            : (
                await supabase.from("user_roles").insert({
                  tenant_id: tenant!.id,
                  user_id: profile.id,
                  role: row.preferred_role,
                  is_volunteer: true,
                } as never)
              ).error;
          if (roleErr) throw roleErr;
          linked = true;
        }
      }
      const { error } = await (supabase as any)
        .from("volunteer_applications")
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw error;
      return { linked, status };
    },
    onSuccess: ({ linked, status }) => {
      toast.success(
        status === "rejected"
          ? "تم رفض الطلب"
          : linked
            ? "تم الاعتماد وتفعيل الدور في المقرأة"
            : "تم الاعتماد — لا يوجد حساب بهذا البريد بعد، أرسلي لها دعوة",
      );
      void qc.invalidateQueries({ queryKey: ["volunteer-applications"] });
      void qc.invalidateQueries({ queryKey: ["tenant-members"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر تنفيذ العملية"),
  });

  /**
   * استيراد ملف المتطوعات = إنشاء حسابات فعلية مباشرة وربطها بالمسار/الحلقة،
   * بدون طلبات معلّقة ولا دعوات (الملف يحتوي البريد وكلمة المرور).
   */
  async function handleImport(file: File) {
    setImporting(true);
    try {
      // القراءة بأسماء الترويسة (عربية أو إنجليزية) لا بترتيب الأعمدة، وتقبل Excel و CSV.
      const grid = await readSheetGrid(file);
      const rows = mapRows(grid, VOLUNTEER_ALIASES)
        .filter((r) => (r["full_name"] ?? "").trim())
        .map((r) => ({
          full_name: (r["full_name"] ?? "").trim(),
          email: (r["email"] ?? "").trim(),
          password: (r["password"] ?? "").trim(),
          role_label: (r["role_label"] ?? "").trim(),
          track_name: (r["track_name"] ?? "").trim() || null,
          circle_name: (r["circle_name"] ?? "").trim() || null,
          age: toNumber(r["age"] ?? ""),
          country: (r["country"] ?? "").trim() || null,
        }));
      if (rows.length === 0) throw new Error("لم نجد صفوفًا صالحة في الملف");
      const { results } = await importAccounts({ data: { slug: tenant!.slug, rows } });
      const created = results.filter((r) => r.status === "created").length;
      const linked = results.filter((r) => r.status === "linked").length;
      const failed = results.filter((r) => r.status === "error");
      if (failed.length === 0) {
        toast.success(`تم اعتمادهن مباشرة: ${created} حساب جديد، ${linked} ربط بحساب موجود`);
      } else {
        toast.error(`${failed.length} صف لم يكتمل: ${failed[0]?.message ?? ""}`);
      }
      void qc.invalidateQueries({ queryKey: ["tenant-members"] });
      void qc.invalidateQueries({ queryKey: ["volunteer-applications"] });
    } catch (e) {
      toast.error((e as Error).message || "تعذّر قراءة الملف");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }


  if (!tenant || !canRead) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <EmptyState
          title={tenant ? "لا تملكين صلاحية الوصول لهذه المقرأة" : "المقرأة غير موجودة"}
          description="تأكدي من الرابط أو تواصلي مع إدارة المقرأة."
          action={
            <Button asChild>
              <Link to="/dashboard">العودة للوحتي</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!hasFeature("volunteers")) {
    return (
      <AppShell
        brandName={tenant.name}
        brandSubtitle="المتطوعات"
        logoUrl={tenant.logo_url}
        nav={visibleTenantNav(tenant.slug, hasFeature, canManage, canRecord, isCircleScopedOnly)}
        title="المتطوعات"
        crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "المتطوعات" }]}
      >
        <FeatureLockedState tenantSlug={tenant.slug} />
      </AppShell>
    );
  }

  const apps = appsQuery.data ?? [];
  const pending = apps.filter((a) => a.status === "new" || a.status === "contacted");
  // بريد كل عضوة لها حساب فعّال في المقرأة — لإخفاء زر الدعوة عمّن انضمت فعلًا
  const memberEmails = new Set(
    (rolesQuery.data ?? [])
      .map((m) => (m as any).email?.toLowerCase())
      .filter(Boolean),
  );
  // خريطة الدعوات المعلّقة (بريد+دور) لإعادة نفس الرابط بدل إنشاء دعوة جديدة
  const pendingInvites = new Map(
    (invitesQuery.data ?? []).map((i) => [`${i.email.toLowerCase()}|${i.role}`, i]),
  );

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="المتطوعات"
      logoUrl={tenant.logo_url}
      nav={visibleTenantNav(tenant.slug, hasFeature, canManage, canRecord, isCircleScopedOnly)}
      title="المتطوعات"
      crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "المتطوعات" }]}
    >
      <p className="mb-4 text-sm text-muted-foreground">
        متطوعات المقرأة يسجّلن أنفسهن عبر صفحة التسجيل العامة{" "}
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs" dir="ltr">
          /v/{tenant.slug}
        </span>{" "}
        كمعلمات أو مشرفات أو مسؤولات مسارات، وتعتمدينهن من هنا. أما استيراد ملف Excel فينشئ حساباتهن ويربطهن بحلقاتهن مباشرة — بلا اعتماد ولا دعوة — وتظهرن فورًا في صفحة الحسابات.
      </p>

      <div className="space-y-4">
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImport(f);
              }}
            />
            <Button variant="outline" disabled={importing} onClick={() => fileRef.current?.click()}>
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              استيراد من Excel
            </Button>
            <span className="text-xs text-muted-foreground">
              الأعمدة بالترتيب: الاسم، البريد، كلمة المرور، الدور، المسار، الحلقة، العمر، البلد
            </span>
          </div>
        ) : null}

        {appsQuery.isLoading ? (
          <LoadingBlock />
        ) : apps.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-6" />}
            title="لا توجد طلبات تسجيل"
            description="شاركي رابط صفحة التسجيل مع متطوعات المقرأة أو استوردي قائمتهن من Excel."
          />
        ) : (
          <div className="surface-panel overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الدور المطلوب</TableHead>
                  <TableHead className="text-right">التواصل</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  {canManage ? <TableHead className="text-right">إجراء</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <p className="font-medium">{a.full_name}</p>
                      {a.note ? <p className="text-xs text-muted-foreground">{a.note}</p> : null}
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-primary-soft px-3 py-1 text-xs text-primary">
                        {VOLUNTEER_ROLE_LABELS[a.preferred_role] ?? a.preferred_role}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground" dir="ltr">
                      {a.email || a.phone || "—"}
                    </TableCell>
                    <TableCell className="text-xs">{VOLUNTEER_STATUS_LABELS[a.status] ?? a.status}</TableCell>
                    {canManage ? (
                      <TableCell>
                        {a.status === "approved" ? (
                          a.email && !memberEmails.has(a.email.toLowerCase()) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={inviteApp.isPending}
                              onClick={() => {
                                const key = `${a.email!.toLowerCase()}|${a.preferred_role}`;
                                const pending = pendingInvites.get(key);
                                if (pending) {
                                  setInviteInfo({
                                    link: `${window.location.origin}/invite/${pending.token}`,
                                    phone: a.phone,
                                    name: a.full_name,
                                  });
                                } else {
                                  inviteApp.mutate(a);
                                }
                              }}
                            >
                              {inviteApp.isPending && inviteApp.variables?.id === a.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Send className="size-4" />
                              )}
                              {pendingInvites.has(`${a.email!.toLowerCase()}|${a.preferred_role}`)
                                ? "رابط الدعوة"
                                : "إرسال دعوة"}
                            </Button>
                          ) : a.email ? (
                            <span className="text-xs text-primary">منضمة للمقرأة</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">لا يوجد بريد لإرسال دعوة</span>
                          )
                        ) : a.status === "rejected" ? (
                          <span className="text-xs text-muted-foreground">تمت المراجعة</span>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={reviewApp.isPending}
                              onClick={() => reviewApp.mutate({ row: a, status: "approved" })}
                            >
                              <Check className="size-4" />
                              اعتماد
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={reviewApp.isPending}
                              onClick={() => reviewApp.mutate({ row: a, status: "rejected" })}
                            >
                              <X className="size-4" />
                              رفض
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={!!inviteInfo} onOpenChange={(o) => !o && setInviteInfo(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>رابط دعوة {inviteInfo?.name}</DialogTitle>
            <DialogDescription>
              شاركي هذا الرابط معها لتنشئ حسابها وتقبل الدعوة. الرابط صالح لفترة محدودة، وإن انتهت مدّته ارجعي هنا
              وأرسلي لها رابطًا جديدًا.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
            <p className="flex-1 truncate text-xs" dir="ltr">
              {inviteInfo?.link}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => {
                if (!inviteInfo) return;
                void navigator.clipboard.writeText(inviteInfo.link);
                toast.success("تم نسخ الرابط");
              }}
            >
              <Copy className="size-4" />
              نسخ الرابط
            </Button>
            <Button className="flex-1" disabled={!inviteInfo?.phone} asChild={!!inviteInfo?.phone}>
              {inviteInfo?.phone ? (
                <a
                  href={`https://wa.me/${inviteInfo.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                    `مرحبًا ${inviteInfo.name}، إليك رابط دعوتك للانضمام إلى ${tenant?.name ?? "المقرأة"} على منصة سُحُب:\n${inviteInfo.link}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="size-4" />
                  واتساب
                </a>
              ) : (
                <span className="flex items-center gap-2">
                  <MessageCircle className="size-4" />
                  لا يوجد جوال
                </span>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
