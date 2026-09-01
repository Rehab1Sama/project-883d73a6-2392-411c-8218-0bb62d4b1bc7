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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTenantContext } from "@/hooks/useTenantContext";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { ROLE_LABELS } from "@/lib/roles";
import type { AppRole } from "@/lib/roles";
import {
  VOLUNTEER_ROLE_LABELS,
  VOLUNTEER_STATUS_LABELS,
  normalizeRoleLabel,
  type ImportedVolunteer,
  type VolunteerRole,
} from "@/lib/volunteers";
import { bulkImportVolunteerAccounts, type BulkImportRowResult } from "@/lib/bulk-import.functions";
import { sendMemberInvitation } from "@/lib/invitations.functions";
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
  role: AppRole;
  is_volunteer: boolean;
  track_id: string | null;
  circle_id: string | null;
};

/** رمز خاص في قوائم النطاق يعني "بلا تقييد" (null فعليًا في القاعدة) */
const SCOPE_ALL = "__all__";

type MemberRow = RoleRow & {
  full_name: string | null;
  email: string | null;
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
  const { tenant, canManage, canRead, loading, hasFeature, featuresLoading } = useTenantContext();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const directFileRef = useRef<HTMLInputElement>(null);
  const [importingDirect, setImportingDirect] = useState(false);
  const [directResults, setDirectResults] = useState<BulkImportRowResult[] | null>(null);
  const importVolunteerAccounts = useServerFn(bulkImportVolunteerAccounts);
  const sendInvite = useServerFn(sendMemberInvitation);
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

  // تُستخدم لتعبئة قوائم إسناد المسار (للنائبة الأكاديمية) والحلقة
  // (للمعلمة/المشرفة) لكل عضوة.
  const tracksQuery = useQuery({
    queryKey: ["tracks-for-scope", tenant?.id],
    enabled: canManage && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("id, name")
        .eq("tenant_id", tenant!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const circlesQuery = useQuery({
    queryKey: ["circles-for-scope", tenant?.id],
    enabled: canManage && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circles")
        .select("id, name, track_id")
        .eq("tenant_id", tenant!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["member-profiles", tenant?.id],
    enabled: canRead && !!tenant?.id && (rolesQuery.data?.length ?? 0) > 0,
    queryFn: async () => {
      const ids = rolesQuery.data!.map((r) => r.user_id);
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      if (error) throw error;
      return new Map((data ?? []).map((p) => [p.id, p]));
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

  const toggleVolunteer = useMutation({
    mutationFn: async ({ user_id, is_volunteer }: { user_id: string; is_volunteer: boolean }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ is_volunteer })
        .eq("tenant_id", tenant!.id)
        .eq("user_id", user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث الحالة");
      void qc.invalidateQueries({ queryKey: ["tenant-members"] });
      void qc.invalidateQueries({ queryKey: ["tenant-stats"] });
    },
    onError: () => toast.error("تعذّر التحديث"),
  });

  /** إسناد نطاق العضوة: مسار للنائبة الأكاديمية، أو حلقة للمعلمة/المشرفة */
  const updateScope = useMutation({
    mutationFn: async ({
      roleRowId,
      field,
      value,
    }: {
      roleRowId: string;
      field: "track_id" | "circle_id";
      value: string | null;
    }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ [field]: value } as never)
        .eq("id", roleRowId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث النطاق");
      void qc.invalidateQueries({ queryKey: ["tenant-members"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر تحديث النطاق"),
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
          // ملاحظة: لا يوجد قيد فريد على (tenant_id, user_id) وحدهما — الفهرس
          // الفعلي يشمل role/track_id/circle_id أيضًا، فـ upsert بـ onConflict
          // هنا كان يفشل دائمًا. نفحص الصف يدويًا ونقرر إضافة أو تحديث.
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
                  role: row.preferred_role as AppRole,
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

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const ExcelJS = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const sheet = wb.worksheets[0];
      if (!sheet) throw new Error("الملف فارغ");
      const rows: ImportedVolunteer[] = [];
      sheet.eachRow((row, index) => {
        if (index === 1) return; // ترويسة
        const cell = (i: number) => String(row.getCell(i).text ?? "").trim();
        const full_name = cell(1);
        if (!full_name) return;
        rows.push({
          full_name,
          phone: cell(2) || null,
          email: cell(3) || null,
          preferred_role: normalizeRoleLabel(cell(4)),
          note: cell(5) || null,
        });
      });
      if (rows.length === 0) throw new Error("لم نجد صفوفًا صالحة في الملف");
      const { error } = await (supabase as any).from("volunteer_applications").insert(
        rows.map((r) => ({ ...r, tenant_id: tenant!.id, status: "new" })),
      );
      if (error) throw error;
      toast.success(`تم استيراد ${rows.length} متطوعة`);
      void qc.invalidateQueries({ queryKey: ["volunteer-applications"] });
    } catch (e) {
      const raw = (e as Error).message || "";
      const friendly = raw.includes("row-level security")
        ? "تعذّر إضافة المتطوعات. تأكدي إنك مديرة هذه المقرأة وحاولي مرة أخرى."
        : raw || "تعذّر قراءة الملف";
      toast.error(friendly);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDirectImport(file: File) {
    setImportingDirect(true);
    setDirectResults(null);
    try {
      const ExcelJS = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const sheet = wb.worksheets[0];
      if (!sheet) throw new Error("الملف فارغ");
      const rows: {
        full_name: string;
        email: string;
        password: string;
        role_label: string;
        track_name: string | null;
        circle_name: string | null;
        age: number | null;
        country: string | null;
      }[] = [];
      sheet.eachRow((row, index) => {
        if (index === 1) return; // ترويسة
        const cell = (i: number) => String(row.getCell(i).text ?? "").trim();
        const full_name = cell(1);
        if (!full_name) return;
        const ageRaw = cell(7);
        rows.push({
          full_name,
          email: cell(2),
          password: cell(3),
          role_label: cell(4),
          track_name: cell(5) || null,
          circle_name: cell(6) || null,
          age: ageRaw ? Number(ageRaw) || null : null,
          country: cell(8) || null,
        });
      });
      if (rows.length === 0) throw new Error("لم نجد صفوفًا صالحة في الملف");
      const { results } = await importVolunteerAccounts({ data: { slug: tenant!.slug, rows } });
      setDirectResults(results);
      const created = results.filter((r) => r.status === "created").length;
      const linked = results.filter((r) => r.status === "linked").length;
      const failed = results.filter((r) => r.status === "error").length;
      if (failed === 0) {
        toast.success(`تم: ${created} حساب جديد، ${linked} ربط بحساب موجود`);
      } else {
        toast.error(`اكتمل الاستيراد مع ${failed} صف به مشكلة — راجعي التفاصيل أدناه`);
      }
      void qc.invalidateQueries({ queryKey: ["tenant-members"] });
    } catch (e) {
      toast.error((e as Error).message || "تعذّر قراءة الملف");
    } finally {
      setImportingDirect(false);
      if (directFileRef.current) directFileRef.current.value = "";
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
        nav={visibleTenantNav(tenant.slug, hasFeature)}
        title="المتطوعات"
        crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "المتطوعات" }]}
      >
        <FeatureLockedState tenantSlug={tenant.slug} />
      </AppShell>
    );
  }

  const profiles = profilesQuery.data ?? new Map();
  const members: MemberRow[] = (rolesQuery.data ?? []).map((r) => {
    const p = profiles.get(r.user_id);
    return { ...r, full_name: p?.full_name ?? null, email: p?.email ?? null };
  });
  const volunteers = members.filter((m) => m.is_volunteer);
  const others = members.filter((m) => !m.is_volunteer);
  const tracks = tracksQuery.data ?? [];
  const circles = circlesQuery.data ?? [];
  const apps = appsQuery.data ?? [];
  const pending = apps.filter((a) => a.status === "new" || a.status === "contacted");
  // بريد كل عضوة لها حساب فعّال في المقرأة — لإخفاء زر الدعوة عمّن انضمت فعلًا
  const memberEmails = new Set(members.map((m) => (m.email ?? "").toLowerCase()).filter(Boolean));
  // خريطة الدعوات المعلّقة (بريد+دور) لإعادة نفس الرابط بدل إنشاء دعوة جديدة
  const pendingInvites = new Map(
    (invitesQuery.data ?? []).map((i) => [`${i.email.toLowerCase()}|${i.role}`, i]),
  );

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="المتطوعات"
      logoUrl={tenant.logo_url}
      nav={visibleTenantNav(tenant.slug, hasFeature)}
      title="المتطوعات"
      crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "المتطوعات" }]}
    >
      <p className="mb-4 text-sm text-muted-foreground">
        متطوعات المقرأة يسجّلن أنفسهن عبر صفحة التسجيل العامة{" "}
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs" dir="ltr">
          /v/{tenant.slug}
        </span>{" "}
        كمعلمات أو مشرفات أو مسؤولات مسارات، وتعتمدينهن من تبويب «طلبات التسجيل». ويمكنك استيراد قائمتهن من ملف
        Excel مباشرة.
      </p>

      <Tabs defaultValue="requests" dir="rtl">
        <TabsList>
          <TabsTrigger value="requests">طلبات التسجيل {pending.length ? `(${pending.length})` : ""}</TabsTrigger>
          <TabsTrigger value="members">أعضاء المقرأة</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4 space-y-4">
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
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
                الأعمدة بالترتيب: الاسم، الجوال، البريد، الدور، ملاحظة
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
        </TabsContent>

        <TabsContent value="members" className="mt-4 space-y-4">
          {canManage ? (
            <div className="surface-panel space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={directFileRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleDirectImport(f);
                  }}
                />
                <Button
                  variant="outline"
                  disabled={importingDirect}
                  onClick={() => directFileRef.current?.click()}
                >
                  {importingDirect ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  استيراد مباشر بحسابات فعّالة
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                الأعمدة بالترتيب: الاسم، البريد الإلكتروني، كلمة المرور، الدور، المسار، الحلقة، العمر
                (اختياري)، البلد (اختياري). يُنشئ حساب دخول فعّال لكل صف مباشرة (بدون مراجعة)، وينشئ
                المسار/الحلقة تلقائيًا إن لم يكونا موجودَين — بشرط ألا يتكرر اسم المسار أو الحلقة.
              </p>
              {directResults ? (
                <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الصف</TableHead>
                        <TableHead>الاسم</TableHead>
                        <TableHead>النتيجة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {directResults.map((r) => (
                        <TableRow key={r.row}>
                          <TableCell>{r.row}</TableCell>
                          <TableCell>{r.full_name}</TableCell>
                          <TableCell
                            className={
                              r.status === "error"
                                ? "text-destructive"
                                : r.status === "created"
                                  ? "text-primary"
                                  : "text-muted-foreground"
                            }
                          >
                            {r.message}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </div>
          ) : null}

          {rolesQuery.isLoading ? (
            <LoadingBlock />
          ) : members.length === 0 ? (
            <EmptyState
              icon={<Heart className="size-6" />}
              title="لا يوجد أعضاء بعد"
              description="أضيفي أعضاءً عبر دعوتهن للمقرأة، ثم حدّدي من هن المتطوعات."
            />
          ) : (
            <div className="space-y-6">
              {volunteers.length > 0 && (
                <section>
                  <h2 className="mb-2 flex items-center gap-2 font-medium">
                    <Heart className="size-4 text-primary" /> المتطوعات ({volunteers.length})
                  </h2>
                  <div className="surface-panel overflow-x-auto">
                    <MemberTable
                      rows={volunteers}
                      canManage={canManage}
                      tracks={tracks}
                      circles={circles}
                      onToggle={(row) =>
                        toggleVolunteer.mutate({ user_id: row.user_id, is_volunteer: !row.is_volunteer })
                      }
                      onScopeChange={(row, field, value) =>
                        updateScope.mutate({ roleRowId: row.id, field, value })
                      }
                    />
                  </div>
                </section>
              )}
              {others.length > 0 && (
                <section>
                  <h2 className="mb-2 font-medium">بقية الأعضاء ({others.length})</h2>
                  <div className="surface-panel overflow-x-auto">
                    <MemberTable
                      rows={others}
                      canManage={canManage}
                      tracks={tracks}
                      circles={circles}
                      onToggle={(row) =>
                        toggleVolunteer.mutate({ user_id: row.user_id, is_volunteer: !row.is_volunteer })
                      }
                      onScopeChange={(row, field, value) =>
                        updateScope.mutate({ roleRowId: row.id, field, value })
                      }
                    />
                  </div>
                </section>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

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

function MemberTable({
  rows,
  canManage,
  tracks,
  circles,
  onToggle,
  onScopeChange,
}: {
  rows: MemberRow[];
  canManage: boolean;
  tracks: { id: string; name: string }[];
  circles: { id: string; name: string; track_id: string | null }[];
  onToggle: (row: MemberRow) => void;
  onScopeChange: (row: MemberRow, field: "track_id" | "circle_id", value: string | null) => void;
}) {
  // النطاق يظهر فقط للأدوار التي تدعم التقييد
  const hasScope = rows.some((m) => m.role === "academic_deputy" || m.role === "teacher" || m.role === "supervisor");

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-right">الاسم</TableHead>
          <TableHead className="text-right">الدور</TableHead>
          {canManage && hasScope ? <TableHead className="text-right">النطاق</TableHead> : null}
          {canManage ? <TableHead className="text-right">متطوعة</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((m) => (
          <TableRow key={m.id}>
            <TableCell>
              <p className="font-medium">{m.full_name || "—"}</p>
              {m.email ? (
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {m.email}
                </p>
              ) : null}
            </TableCell>
            <TableCell>
              <span className="rounded-full bg-primary-soft px-3 py-1 text-xs text-primary">
                {ROLE_LABELS[m.role]}
              </span>
            </TableCell>
            {canManage && hasScope ? (
              <TableCell>
                {m.role === "academic_deputy" ? (
                  <Select
                    value={m.track_id ?? SCOPE_ALL}
                    onValueChange={(v) => onScopeChange(m, "track_id", v === SCOPE_ALL ? null : v)}
                  >
                    <SelectTrigger className="h-8 min-w-[10rem] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SCOPE_ALL}>كل المقرأة</SelectItem>
                      {tracks.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : m.role === "teacher" || m.role === "supervisor" ? (
                  <Select
                    value={m.circle_id ?? SCOPE_ALL}
                    onValueChange={(v) => onScopeChange(m, "circle_id", v === SCOPE_ALL ? null : v)}
                  >
                    <SelectTrigger className="h-8 min-w-[10rem] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SCOPE_ALL}>كل الحلقات</SelectItem>
                      {circles.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            ) : null}
            {canManage ? (
              <TableCell>
                <Switch checked={m.is_volunteer} onCheckedChange={() => onToggle(m)} />
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
