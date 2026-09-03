import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GraduationCap, Eye, Route as RouteIcon, Users, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { visibleTenantNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState, FeatureLockedState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  setMemberAccountStatus,
  setStudentAccountStatus,
  ACCOUNT_STATUS_LABELS,
  type AccountStatus,
} from "@/lib/account-status.functions";
import { listTenantAccounts, type AccountMember, type AccountStudent } from "@/lib/accounts.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/app/$slug/accounts")({
  head: () => ({
    meta: [
      { title: "الحسابات — سُحُب" },
      { name: "description", content: "حسابات المقرأة مرتبة بأقسام: المعلمات والمشرفات ومسؤولات المسارات والطالبات." },
      { property: "og:title", content: "الحسابات — سُحُب" },
      { property: "og:description", content: "إدارة حسابات أعضاء المقرأة وأدوارهن ونطاقاتهن على منصة سُحُب." },
    ],
  }),
  component: AccountsPage,
});

type RoleRow = {
  id: string;
  user_id: string;
  role: AppRole;
  is_volunteer: boolean;
  track_id: string | null;
  circle_id: string | null;
  account_status: AccountStatus;
  leave_start: string | null;
  leave_end: string | null;
};

export type StatusChange = {
  status: AccountStatus;
  leave_start?: string | null;
  leave_end?: string | null;
  circle_id?: string | null;
};

/** رمز خاص في قوائم النطاق يعني "بلا تقييد" (null فعليًا في القاعدة) */
const SCOPE_ALL = "__all__";

type MemberRow = RoleRow & {
  full_name: string | null;
  email: string | null;
};

function AccountsPage() {
  const { tenant, canManage, canRead, hasFeature, canRecord, isCircleScopedOnly } = useTenantContext();
  const qc = useQueryClient();
  const setMemberStatus = useServerFn(setMemberAccountStatus);
  const setStudentStatus = useServerFn(setStudentAccountStatus);
  const [sectionSearch, setSectionSearch] = useState({ teacher: "", supervisor: "", academic_deputy: "", student: "" });

  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  // تُقرأ من الخادم بمفتاح إداري: سياسات RLS تمنع القائدة من قراءة بُرد
  // العضوات الأخريات وملفاتهن الشخصية من المتصفح، فكانت الصفحة تظهر بلا
  // أسماء ولا حلقات. دالة listTenantAccounts تجلب كل شيء دفعة واحدة.
  const fetchAccounts = useServerFn(listTenantAccounts);
  const accountsQuery = useQuery({
    queryKey: ["tenant-accounts", tenant?.slug],
    enabled: canRead && !!tenant?.slug,
    queryFn: () => fetchAccounts({ data: { slug: tenant!.slug } }),
    retry: false,
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

  /** إزالة عضوة من كادر المقرأة نهائيًا (حذف صف user_roles) */
  const removeMember = useMutation({
    mutationFn: async (roleRowId: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", roleRowId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إزالة العضوة من المقرأة");
      void qc.invalidateQueries({ queryKey: ["tenant-members"] });
      void qc.invalidateQueries({ queryKey: ["tenant-stats"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر إزالة العضوة"),
  });

  /** تغيير حالة حساب عضوة: فعّال / موقوف (يفصلها عن الحلقة) / إجازة بمدة */
  const memberStatusMutation = useMutation({
    mutationFn: async (input: StatusChange & { role_row_id: string }) =>
      setMemberStatus({ data: { slug: tenant!.slug, ...input } }),
    onSuccess: () => {
      toast.success("تم تحديث حالة الحساب");
      void qc.invalidateQueries({ queryKey: ["tenant-members"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر تحديث الحالة"),
  });

  /** تغيير حالة حساب طالبة: الإيقاف يحذفها من الحلقة، والتفعيل يعيد ربطها */
  const studentStatusMutation = useMutation({
    mutationFn: async (input: StatusChange & { student_id: string }) =>
      setStudentStatus({ data: { slug: tenant!.slug, ...input } }),
    onSuccess: () => {
      toast.success("تم تحديث حالة الحساب");
      void qc.invalidateQueries({ queryKey: ["tenant-student-members"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر تحديث الحالة"),
  });

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

  const nav = visibleTenantNav(tenant.slug, hasFeature, canManage, canRecord, isCircleScopedOnly);
  const crumbs = [{ label: tenant.name, to: "/app/$slug" as const, params: { slug: tenant.slug } }, { label: "الحسابات" }];

  if (!hasFeature("volunteers")) {
    return (
      <AppShell
        brandName={tenant.name}
        brandSubtitle="الحسابات"
        logoUrl={tenant.logo_url}
        nav={nav}
        title="الحسابات"
        crumbs={crumbs}
      >
        <FeatureLockedState tenantSlug={tenant.slug} />
      </AppShell>
    );
  }

  const accounts = accountsQuery.data;
  const members: MemberRow[] = (accounts?.members ?? [])
    // الطالبات مصدرهن قسم منفصل بالأسفل (accounts.students).
    .filter((r) => r.role !== "student")
    .map((r) => ({
      id: r.id,
      user_id: r.user_id,
      role: r.role as AppRole,
      is_volunteer: r.is_volunteer,
      track_id: r.track_id,
      circle_id: r.circle_id,
      account_status: r.account_status,
      leave_start: r.leave_start,
      leave_end: r.leave_end,
      full_name: r.full_name,
      email: r.email,
    }));

  function bySearch(rows: MemberRow[], term: string): MemberRow[] {
    const q = term.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (m) => (m.full_name ?? "").toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q),
    );
  }

  // كل قسم يعرض دورًا واحدًا فقط — عضوة عندها دوران تظهر بالقسمين.
  const teacherRows = bySearch(members.filter((m) => m.role === "teacher"), sectionSearch.teacher);
  const supervisorRows = bySearch(members.filter((m) => m.role === "supervisor"), sectionSearch.supervisor);
  const academicDeputyRows = bySearch(
    members.filter((m) => m.role === "academic_deputy"),
    sectionSearch.academic_deputy,
  );
  const studentSearchTerm = sectionSearch.student.trim().toLowerCase();
  const studentRows = (accounts?.students ?? []).filter((s) =>
    studentSearchTerm ? s.full_name.toLowerCase().includes(studentSearchTerm) : true,
  );

  const tracks = accounts?.tracks ?? [];
  const circles = accounts?.circles ?? [];
  const circleNames = new Map(circles.map((c) => [c.id, c.name]));


  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="الحسابات"
      logoUrl={tenant.logo_url}
      nav={nav}
      title="الحسابات"
      crumbs={crumbs}
    >
      <p className="mb-4 text-sm text-muted-foreground">
        كل حسابات المقرأة في مكان واحد، مرتبة بأقسام: المعلمات، المشرفات، مسؤولات المسارات، والطالبات صاحبات
        حسابات الدخول. من هنا تديرين نطاق كل عضوة وحالتها التطوعية أو تزيلينها من المقرأة.
      </p>

      {accountsQuery.isLoading ? (
        <LoadingBlock />
      ) : accountsQuery.isError ? (
        <EmptyState
          title="تعذّر تحميل الحسابات"
          description={(accountsQuery.error as Error)?.message ?? "حاولي مرة أخرى."}
        />
      ) : (
        <div className="space-y-4">
          <RoleSection
            icon={<GraduationCap className="size-4" />}
            title="المعلمات"
            count={teacherRows.length}
            search={sectionSearch.teacher}
            onSearchChange={(v) => setSectionSearch((s) => ({ ...s, teacher: v }))}
            empty="لا يوجد معلمات بعد"
          >
            <MemberTable
              rows={teacherRows}
              canManage={canManage}
              tracks={tracks}
              circles={circles}
              onToggle={(row) => toggleVolunteer.mutate({ user_id: row.user_id, is_volunteer: !row.is_volunteer })}
              onScopeChange={(row, field, value) => updateScope.mutate({ roleRowId: row.id, field, value })}
              onRemove={(row) => removeMember.mutate(row.id)}
              onStatusChange={(row, change) => memberStatusMutation.mutate({ role_row_id: row.id, ...change })}
            />
          </RoleSection>

          <RoleSection
            icon={<RouteIcon className="size-4" />}
            title="مسؤولات المسار"
            count={academicDeputyRows.length}
            search={sectionSearch.academic_deputy}
            onSearchChange={(v) => setSectionSearch((s) => ({ ...s, academic_deputy: v }))}
            empty="لا يوجد مسؤولات مسار بعد"
          >
            <MemberTable
              rows={academicDeputyRows}
              canManage={canManage}
              tracks={tracks}
              circles={circles}
              onToggle={(row) => toggleVolunteer.mutate({ user_id: row.user_id, is_volunteer: !row.is_volunteer })}
              onScopeChange={(row, field, value) => updateScope.mutate({ roleRowId: row.id, field, value })}
              onRemove={(row) => removeMember.mutate(row.id)}
              onStatusChange={(row, change) => memberStatusMutation.mutate({ role_row_id: row.id, ...change })}
            />
          </RoleSection>

          <RoleSection
            icon={<Eye className="size-4" />}
            title="المشرفات"
            count={supervisorRows.length}
            search={sectionSearch.supervisor}
            onSearchChange={(v) => setSectionSearch((s) => ({ ...s, supervisor: v }))}
            empty="لا يوجد مشرفات بعد"
          >
            <MemberTable
              rows={supervisorRows}
              canManage={canManage}
              tracks={tracks}
              circles={circles}
              onToggle={(row) => toggleVolunteer.mutate({ user_id: row.user_id, is_volunteer: !row.is_volunteer })}
              onScopeChange={(row, field, value) => updateScope.mutate({ roleRowId: row.id, field, value })}
              onRemove={(row) => removeMember.mutate(row.id)}
              onStatusChange={(row, change) => memberStatusMutation.mutate({ role_row_id: row.id, ...change })}
            />
          </RoleSection>

          <RoleSection
            icon={<Users className="size-4" />}
            title="الطالبات"
            count={studentRows.length}
            search={sectionSearch.student}
            onSearchChange={(v) => setSectionSearch((s) => ({ ...s, student: v }))}
            empty="لا يوجد طالبات لها حساب دخول بعد"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الحلقة</TableHead>
                  {canManage ? <TableHead className="text-right">الحالة</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentRows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link
                        to="/app/$slug/students/$studentId"
                        params={{ slug: tenant.slug, studentId: s.id }}
                        className="font-medium text-primary hover:underline"
                      >
                        {s.full_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {circleNames.get(s.circle_id ?? "") ?? "—"}
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        <StatusCell
                          name={s.full_name}
                          status={s.status}
                          leaveStart={s.leave_start}
                          leaveEnd={s.leave_end}
                          currentCircleId={s.circle_id}
                          circles={circles}
                          onSubmit={(change) => studentStatusMutation.mutate({ student_id: s.id, ...change })}
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

          </RoleSection>
        </div>
      )}
    </AppShell>
  );
}

function RoleSection({
  icon,
  title,
  count,
  search,
  onSearchChange,
  empty,
  children,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  search: string;
  onSearchChange: (value: string) => void;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="surface-panel space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-medium">
          {icon} {title}
          <span className="text-xs font-normal text-muted-foreground">({count})</span>
        </h2>
      </div>
      <div className="relative">
        <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="بحث بالاسم أو البريد"
          className="pr-9"
        />
      </div>
      {count === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </section>
  );
}

function MemberTable({
  rows,
  canManage,
  tracks,
  circles,
  onToggle,
  onScopeChange,
  onRemove,
  onStatusChange,
}: {
  rows: MemberRow[];
  canManage: boolean;
  tracks: { id: string; name: string }[];
  circles: { id: string; name: string; track_id: string | null }[];
  onToggle: (row: MemberRow) => void;
  onScopeChange: (row: MemberRow, field: "track_id" | "circle_id", value: string | null) => void;
  onRemove: (row: MemberRow) => void;
  onStatusChange: (row: MemberRow, change: StatusChange) => void;
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
          {canManage ? <TableHead className="text-right">الحالة</TableHead> : null}
          {canManage ? <TableHead className="text-right">متطوعة</TableHead> : null}
          {canManage ? <TableHead className="text-right" /> : null}
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
                <StatusCell
                  name={m.full_name || "العضوة"}
                  status={m.account_status}
                  leaveStart={m.leave_start}
                  leaveEnd={m.leave_end}
                  currentCircleId={m.circle_id}
                  circles={circles}
                  onSubmit={(change) => onStatusChange(m, change)}
                />
              </TableCell>
            ) : null}
            {canManage ? (
              <TableCell>
                <Switch checked={m.is_volunteer} onCheckedChange={() => onToggle(m)} />
              </TableCell>
            ) : null}
            {canManage ? (
              <TableCell>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      إزالة
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>إزالة {m.full_name || "هذه العضوة"} من المقرأة؟</AlertDialogTitle>
                      <AlertDialogDescription>
                        هذا يلغي دورها ({ROLE_LABELS[m.role]}) وصلاحياتها بالمقرأة فورًا. هذا الإجراء لا يمكن التراجع
                        عنه من هنا.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>تراجع</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onRemove(m)} className="bg-destructive text-destructive-foreground">
                        إزالة نهائيًا
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}


/**
 * خلية حالة الحساب: تعرض الحالة الحالية وتفتح نافذة لتغييرها.
 * الإيقاف يفصل عن الحلقة، والتفعيل يطلب اختيار حلقة، والإجازة تحتاج مدة.
 */
function StatusCell({
  name,
  status,
  leaveStart,
  leaveEnd,
  currentCircleId,
  circles,
  onSubmit,
}: {
  name: string;
  status: AccountStatus;
  leaveStart: string | null;
  leaveEnd: string | null;
  currentCircleId: string | null;
  circles: { id: string; name: string; track_id: string | null }[];
  onSubmit: (change: StatusChange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState<AccountStatus>(status);
  const [from, setFrom] = useState(leaveStart ?? "");
  const [to, setTo] = useState(leaveEnd ?? "");
  const [circleId, setCircleId] = useState(currentCircleId ?? SCOPE_ALL);

  const tone =
    status === "active"
      ? "bg-primary-soft text-primary"
      : status === "on_leave"
        ? "bg-accent/15 text-accent-foreground"
        : "bg-destructive/10 text-destructive";

  function submit() {
    if (next === "on_leave" && (!from || !to)) return;
    onSubmit({
      status: next,
      leave_start: next === "on_leave" ? from : null,
      leave_end: next === "on_leave" ? to : null,
      circle_id: next === "active" ? (circleId === SCOPE_ALL ? null : circleId) : null,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={`rounded-full px-3 py-1 text-xs ${tone}`}>
          {ACCOUNT_STATUS_LABELS[status]}
          {status === "on_leave" && leaveEnd ? ` حتى ${leaveEnd}` : ""}
        </button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>حالة حساب {name}</DialogTitle>
          <DialogDescription>
            الإيقاف يزيلها من حلقتها، والإجازة توقف إدخال أنصبتها واحتساب غيابها خلال المدة المحددة.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>الحالة</Label>
            <Select value={next} onValueChange={(v) => setNext(v as AccountStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">فعّال</SelectItem>
                <SelectItem value="suspended">إيقاف الحساب</SelectItem>
                <SelectItem value="on_leave">إجازة بمدة محددة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {next === "on_leave" ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>من</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>إلى</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          ) : null}
          {next === "active" ? (
            <div className="space-y-1">
              <Label>الحلقة بعد التفعيل</Label>
              <Select value={circleId} onValueChange={setCircleId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختاري الحلقة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SCOPE_ALL}>بدون حلقة الآن</SelectItem>
                  {circles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={submit}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
