import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Loader2, Search, Upload } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { visibleTenantNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState, FeatureLockedState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { useTenantContext } from "@/hooks/useTenantContext";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import type { StudentRow } from "@/lib/types";
import { bulkImportStudents, type BulkImportStudentRowResult } from "@/lib/bulk-import-students.functions";

export const Route = createFileRoute("/_authenticated/app/$slug/students")({
  head: () => ({
    meta: [
      { title: "الطالبات — سُحُب" },
      { name: "description", content: "إدارة سجلات طالبات المقرأة وتوزيعهن على الحلقات." },
      { property: "og:title", content: "الطالبات — سُحُب" },
      { property: "og:description", content: "إدارة طالبات المقرأة على منصة سُحُب." },
    ],
  }),
  component: StudentsPage,
});

type StudentEdit = {
  id: string | null;
  full_name: string;
  guardian_name: string;
  guardian_phone: string;
  date_of_birth: string;
  age: string;
  country: string;
  notes: string;
  circle_id: string | null;
};

function StudentsPage() {
  const { tenant, canManage, canRead, loading, isAcademicDeputy, canManageStudentInTracks, hasFeature, featuresLoading } = useTenantContext();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<StudentEdit | null>(null);
  const [term, setTerm] = useState("");
  // القيادة تدير كل الطالبات؛ النائبة الأكاديمية تدير طالبات مسارها فقط
  const canManageAny = canManage || isAcademicDeputy;
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<BulkImportStudentRowResult[] | null>(null);
  const importStudents = useServerFn(bulkImportStudents);

  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  const circlesQuery = useQuery({
    queryKey: ["circles", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circles")
        .select("id, name, track_id")
        .eq("tenant_id", tenant!.id)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const studentsQuery = useQuery({
    queryKey: ["students", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, guardian_name, guardian_phone, date_of_birth, age, country, notes, status, created_at")
        .eq("tenant_id", tenant!.id)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const enrollmentsQuery = useQuery({
    queryKey: ["enrollments", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_students")
        .select("student_id, circle_id");
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data ?? []) {
        map[row.student_id] = row.circle_id;
      }
      return map;
    },
  });

  const save = useMutation({
    mutationFn: async (values: StudentEdit) => {
      const payload = {
        full_name: values.full_name.trim(),
        guardian_name: values.guardian_name.trim() || null,
        guardian_phone: values.guardian_phone.trim() || null,
        date_of_birth: values.date_of_birth || null,
        age: values.age.trim() ? Number(values.age.trim()) : null,
        country: values.country.trim() || null,
        notes: values.notes.trim() || null,
      };
      let studentId = values.id;
      if (values.id) {
        const { error } = await supabase.from("students").update(payload).eq("id", values.id);
        if (error) throw error;
      } else {
        const { data: allowed } = await supabase.rpc("tenant_within_limit", {
          _tenant_id: tenant!.id,
          _kind: "students",
        });
        if (allowed === false) throw new Error("بلغتِ الحد الأقصى لعدد الطالبات في باقتك، رقّي الباقة للمتابعة");
        const { data, error } = await supabase
          .from("students")
          .insert({ ...payload, tenant_id: tenant!.id })
          .select("id")
          .single();
        if (error) throw error;
        studentId = data.id;
      }
      // تسجيل الطالبة في حلقة واحدة فقط
      const { data: existing, error: exError } = await supabase
        .from("circle_students")
        .select("circle_id")
        .eq("student_id", studentId!)
        .maybeSingle();
      if (exError) throw exError;
      const existingId = existing?.circle_id ?? null;
      const targetId = values.circle_id;
      if (existingId !== targetId) {
        if (existingId) {
          const { error } = await supabase
            .from("circle_students")
            .delete()
            .eq("student_id", studentId!);
          if (error) throw error;
        }
        if (targetId) {
          const { error } = await supabase
            .from("circle_students")
            .insert({ student_id: studentId!, circle_id: targetId });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success("تم حفظ الطالبة");
      setEdit(null);
      void qc.invalidateQueries({ queryKey: ["students"] });
      void qc.invalidateQueries({ queryKey: ["enrollments"] });
      void qc.invalidateQueries({ queryKey: ["circle-student-counts"] });
      void qc.invalidateQueries({ queryKey: ["tenant-stats"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر الحفظ"),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "archived" }) => {
      const { error } = await supabase.from("students").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث حالة الطالبة");
      void qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: () => toast.error("تعذّر تحديث الحالة"),
  });

  if (loading || featuresLoading) return <LoadingBlock />;

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

  if (!hasFeature("students")) {
    return (
      <AppShell
        brandName={tenant.name}
        brandSubtitle="الطالبات"
        logoUrl={tenant.logo_url}
        nav={visibleTenantNav(tenant.slug, hasFeature)}
        title="الطالبات"
        crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "الطالبات" }]}
      >
        <FeatureLockedState tenantSlug={tenant.slug} />
      </AppShell>
    );
  }

  const circleMap = new Map((circlesQuery.data ?? []).map((c) => [c.id, c.name]));
  const circleTrackMap = new Map((circlesQuery.data ?? []).map((c) => [c.id, c.track_id]));
  const enroll = enrollmentsQuery.data ?? {};
  function studentTrackIds(studentId: string): string[] {
    const cid = enroll[studentId];
    const trackId = cid ? circleTrackMap.get(cid) : undefined;
    return trackId ? [trackId] : [];
  }
  const rows = (studentsQuery.data ?? []).filter(
    (s) =>
      !term ||
      s.full_name.toLowerCase().includes(term.toLowerCase()) ||
      (s.guardian_phone ?? "").includes(term),
  );

  function openNew() {
    setEdit({
      id: null,
      full_name: "",
      guardian_name: "",
      guardian_phone: "",
      date_of_birth: "",
      age: "",
      country: "",
      notes: "",
      circle_id: null,
    });
  }

  async function handleImportStudents(file: File) {
    setImporting(true);
    setImportResults(null);
    try {
      const ExcelJS = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const sheet = wb.worksheets[0];
      if (!sheet) throw new Error("الملف فارغ");
      const rows: {
        full_name: string;
        guardian_name: string | null;
        guardian_phone: string | null;
        date_of_birth: string | null;
        age: number | null;
        country: string | null;
        track_name: string;
        circle_name: string;
      }[] = [];
      sheet.eachRow((row, index) => {
        if (index === 1) return; // ترويسة
        const cell = (i: number) => String(row.getCell(i).text ?? "").trim();
        const full_name = cell(1);
        if (!full_name) return;
        const ageRaw = cell(5);
        rows.push({
          full_name,
          guardian_name: cell(2) || null,
          guardian_phone: cell(3) || null,
          date_of_birth: cell(4) || null,
          age: ageRaw ? Number(ageRaw) || null : null,
          country: cell(6) || null,
          track_name: cell(7),
          circle_name: cell(8),
        });
      });
      if (rows.length === 0) throw new Error("لم نجد صفوفًا صالحة في الملف");
      const { results } = await importStudents({ data: { slug: tenant!.slug, rows } });
      setImportResults(results);
      const created = results.filter((r) => r.status === "created").length;
      const failed = results.filter((r) => r.status === "error").length;
      if (failed === 0) {
        toast.success(`تمت إضافة ${created} طالبة`);
      } else {
        toast.error(`اكتمل الاستيراد مع ${failed} صف به مشكلة — راجعي التفاصيل أدناه`);
      }
      void qc.invalidateQueries({ queryKey: ["students", tenant?.id] });
      void qc.invalidateQueries({ queryKey: ["enrollments", tenant?.id] });
    } catch (e) {
      toast.error((e as Error).message || "تعذّر قراءة الملف");
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  }

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="الطالبات"
      logoUrl={tenant.logo_url}
      nav={visibleTenantNav(tenant.slug, hasFeature)}
      title="الطالبات"
      crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "الطالبات" }]}
      actions={
        canManageAny ? (
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" />
            طالبة جديدة
          </Button>
        ) : undefined
      }
    >
      {canManageAny ? (
        <div className="surface-panel mb-4 space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImportStudents(f);
              }}
            />
            <Button variant="outline" disabled={importing} onClick={() => importFileRef.current?.click()}>
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              استيراد من Excel
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            الأعمدة بالترتيب: الاسم، اسم ولي الأمر، جوال ولي الأمر، تاريخ الميلاد، العمر، البلد، المسار،
            الحلقة. تُضاف كل طالبة بنفس شكل الإضافة اليدوية بالضبط، وتُنشأ المسار/الحلقة تلقائيًا إن لم
            يكونا موجودَين — بشرط ألا يتكرر اسمهما.
          </p>
          {importResults ? (
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
                  {importResults.map((r) => (
                    <TableRow key={r.row}>
                      <TableCell>{r.row}</TableCell>
                      <TableCell>{r.full_name}</TableCell>
                      <TableCell className={r.status === "error" ? "text-destructive" : "text-primary"}>
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

      <div className="relative mb-4 min-w-56">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="ابحثي بالاسم أو جوال وليّ الأمر"
          className="pr-9"
        />
      </div>

      {studentsQuery.isLoading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Plus className="size-6" />}
          title={term ? "لا نتائج مطابقة" : "لا توجد طالبات بعد"}
          description={term ? "جرّبي كلمة بحث مختلفة." : "أضيفي أول طالبة ووزّعيها على الحلقات."}
          action={!term && canManageAny ? <Button onClick={openNew}>إضافة طالبة</Button> : undefined}
        />
      ) : (
        <div className="surface-panel overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الطالبة</TableHead>
                <TableHead className="text-right">ولي الأمر</TableHead>
                <TableHead className="text-right">الحلقات</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                {canManageAny ? <TableHead className="text-right">إجراءات</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link
                      to="/app/$slug/students/$studentId"
                      params={{ slug: tenant.slug, studentId: s.id }}
                      className="hover:text-primary hover:underline"
                    >
                      {s.full_name}
                    </Link>
                    {s.notes ? (
                      <p className="max-w-xs truncate text-xs text-muted-foreground">{s.notes}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <p>{s.guardian_name || "—"}</p>
                    {s.guardian_phone ? (
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {s.guardian_phone}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {enroll[s.id] ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {circleMap.get(enroll[s.id]!) ?? "—"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {canManageStudentInTracks(studentTrackIds(s.id)) ? (
                        <Switch
                          checked={s.status === "active"}
                          onCheckedChange={(checked) =>
                            toggleStatus.mutate({ id: s.id, status: checked ? "active" : "archived" })
                          }
                        />
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {s.status === "active" ? "نشطة" : "مؤرشفة"}
                      </span>
                    </div>
                  </TableCell>
                  {canManageAny ? (
                    <TableCell>
                      {canManageStudentInTracks(studentTrackIds(s.id)) ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setEdit({
                              id: s.id,
                              full_name: s.full_name,
                              guardian_name: s.guardian_name ?? "",
                              guardian_phone: s.guardian_phone ?? "",
                              date_of_birth: s.date_of_birth ?? "",
                              age: s.age != null ? String(s.age) : "",
                              country: s.country ?? "",
                              notes: s.notes ?? "",
                              circle_id: enroll[s.id] ?? null,
                            })
                          }
                        >
                          <Pencil className="size-4" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">خارج نطاقك</span>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "تعديل الطالبة" : "طالبة جديدة"}</DialogTitle>
            <DialogDescription>أدخلي بيانات الطالبة واختاري الحلقات التي تسجل فيها.</DialogDescription>
          </DialogHeader>
          {edit ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="s-name">اسم الطالبة</Label>
                <Input
                  id="s-name"
                  value={edit.full_name}
                  onChange={(e) => setEdit({ ...edit, full_name: e.target.value })}
                  required
                  maxLength={120}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="s-guardian">اسم وليّ الأمر</Label>
                  <Input
                    id="s-guardian"
                    value={edit.guardian_name}
                    onChange={(e) => setEdit({ ...edit, guardian_name: e.target.value })}
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-phone">جوال وليّ الأمر</Label>
                  <Input
                    id="s-phone"
                    dir="ltr"
                    value={edit.guardian_phone}
                    onChange={(e) => setEdit({ ...edit, guardian_phone: e.target.value })}
                    maxLength={20}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-dob">تاريخ الميلاد</Label>
                <Input
                  id="s-dob"
                  type="date"
                  value={edit.date_of_birth}
                  onChange={(e) => setEdit({ ...edit, date_of_birth: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="s-age">العمر</Label>
                  <Input
                    id="s-age"
                    type="number"
                    min={0}
                    max={120}
                    value={edit.age}
                    onChange={(e) => setEdit({ ...edit, age: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-country">البلد</Label>
                  <Input
                    id="s-country"
                    value={edit.country}
                    onChange={(e) => setEdit({ ...edit, country: e.target.value })}
                    maxLength={100}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-circle">الحلقة</Label>
                {circlesQuery.data?.length ? (
                  <Select
                    value={edit.circle_id ?? "none"}
                    onValueChange={(v) => setEdit({ ...edit, circle_id: v === "none" ? null : v })}
                  >
                    <SelectTrigger id="s-circle">
                      <SelectValue placeholder="اختاري الحلقة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون حلقة</SelectItem>
                      {(circlesQuery.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    لا توجد حلقات نشطة — أنشئي حلقات أولًا من صفحة الحلقات.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-notes">ملاحظات</Label>
                <Textarea
                  id="s-notes"
                  rows={2}
                  value={edit.notes}
                  onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                  maxLength={300}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => edit && save.mutate(edit)} disabled={save.isPending || !edit?.full_name.trim()}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
