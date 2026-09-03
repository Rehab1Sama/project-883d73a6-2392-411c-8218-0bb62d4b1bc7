import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { visibleTenantNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState, FeatureLockedState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useTenantContext } from "@/hooks/useTenantContext";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { trackCategoriesLabel } from "@/lib/track-categories";
import type { CircleRow, ScheduleSlot } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/app/$slug/circles")({
  head: () => ({
    meta: [
      { title: "الحلقات — سُحُب" },
      { name: "description", content: "إدارة حلقات المقرأة ومعلماتها ومواعيدها والطالبات المسجلات فيها." },
      { property: "og:title", content: "الحلقات — سُحُب" },
      { property: "og:description", content: "إدارة حلقات المقرأة على منصة سُحُب." },
    ],
  }),
  component: CirclesPage,
});

type CircleEdit = {
  id: string | null;
  name: string;
  track_id: string;
  teacher_name: string;
  teacher_user_id: string;
  schedule: ScheduleSlot[];
  notes: string;
};

function CirclesPage() {
  const { tenant, canManage, canRead, loading, canManageTrack, canViewCircle, isAcademicDeputy, myTrackScopes, hasFeature, featuresLoading, canRecord, isCircleScopedOnly } = useTenantContext();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<CircleEdit | null>(null);
  // القيادة تدير كل الحلقات؛ النائبة الأكاديمية تدير حلقات مسارها فقط —
  // وبما إن "بلا مسار مسنَد" تعني بلا صلاحية، لا نمنحها زر "حلقة جديدة"
  // ولا قائمة موظفات إلا لو عندها مسار واحد على الأقل فعليًا مسنَد لها.
  const canManageAny = canManage || (isAcademicDeputy && myTrackScopes.length > 0);

  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  const tracksQuery = useQuery({
    queryKey: ["tracks", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("id, name, category, categories, age_group")
        .eq("tenant_id", tenant!.id)
        .eq("status", "active")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const circlesQuery = useQuery({
    queryKey: ["circles", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circles")
        .select("id, name, teacher_name, teacher_user_id, track_id, schedule, notes, status, tracks(name, category, categories)")
        .eq("tenant_id", tenant!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const staffQuery = useQuery({
    queryKey: ["tenant-staff", tenant?.id],
    enabled: canManageAny && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("tenant_id", tenant!.id);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((r) => r.user_id))];
      if (!ids.length) return [] as Array<{ id: string; name: string }>;
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      if (pErr) throw pErr;
      return (profiles ?? []).map((p) => ({ id: p.id, name: p.full_name || p.email || "عضوة" }));
    },
  });

  const studentCountsQuery = useQuery({
    queryKey: ["circle-student-counts", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_students")
        .select("circle_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.circle_id] = (counts[row.circle_id] ?? 0) + 1;
      return counts;
    },
  });

  const save = useMutation({
    mutationFn: async (values: CircleEdit) => {
      const payload = {
        name: values.name.trim(),
        track_id: values.track_id && values.track_id !== "__none" ? values.track_id : null,
        teacher_name: values.teacher_name.trim() || null,
        teacher_user_id: values.teacher_user_id || null,
        schedule: values.schedule,
        notes: values.notes.trim() || null,
      };
      if (values.id) {
        const { error } = await supabase.from("circles").update(payload).eq("id", values.id);
        if (error) throw error;
      } else {
        const { data: allowed } = await supabase.rpc("tenant_within_limit", {
          _tenant_id: tenant!.id,
          _kind: "circles",
        });
        if (allowed === false) throw new Error("بلغتِ الحد الأقصى لعدد الحلقات في باقتك، رقّي الباقة للمتابعة");
        const { error } = await supabase.from("circles").insert({ ...payload, tenant_id: tenant!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم حفظ الحلقة");
      setEdit(null);
      void qc.invalidateQueries({ queryKey: ["circles"] });
      void qc.invalidateQueries({ queryKey: ["tenant-stats"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر الحفظ"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("circles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الحلقة");
      void qc.invalidateQueries({ queryKey: ["circles"] });
      void qc.invalidateQueries({ queryKey: ["circle-student-counts"] });
      void qc.invalidateQueries({ queryKey: ["tenant-stats"] });
    },
    onError: () => toast.error("تعذّر حذف الحلقة"),
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

  if (!hasFeature("circles")) {
    return (
      <AppShell
        brandName={tenant.name}
        brandSubtitle="الحلقات"
        logoUrl={tenant.logo_url}
        nav={visibleTenantNav(tenant.slug, hasFeature, canManage, canRecord, isCircleScopedOnly)}
        title="الحلقات"
        crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "الحلقات" }]}
      >
        <FeatureLockedState tenantSlug={tenant.slug} />
      </AppShell>
    );
  }

  const allRows = circlesQuery.data ?? [];
  // ⚠️ فلترة فعلية للقائمة حسب نطاق المستخدمة — القيادة/النائبة الإدارية
  // ترى كل الحلقات، مسؤولة المسار ترى حلقات مسارها المسنَد فقط (ولا شي لو
  // غير مقيَّدة)، والمعلمة/المشرفة ترى حلقتها المسنَدة فقط.
  const rows = allRows.filter((c) => canViewCircle(c));
  const counts = studentCountsQuery.data ?? {};
  const trackMap = new Map((tracksQuery.data ?? []).map((t) => [t.id, t]));

  function openNew() {
    setEdit({ id: null, name: "", track_id: "", teacher_name: "", teacher_user_id: "", schedule: [], notes: "" });
  }

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="الحلقات"
      logoUrl={tenant.logo_url}
      nav={visibleTenantNav(tenant.slug, hasFeature, canManage, canRecord, isCircleScopedOnly)}
      title="الحلقات"
      crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "الحلقات" }]}
      actions={
        canManageAny ? (
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" />
            حلقة جديدة
          </Button>
        ) : undefined
      }
    >
      {circlesQuery.isLoading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Plus className="size-6" />}
          title={allRows.length > 0 ? "لا حلقات مسندة إليك بعد" : "لا توجد حلقات بعد"}
          description={
            allRows.length > 0
              ? "ما عندك مسار أو حلقة مسندة لك حاليًا. تواصلي مع قائدة المقرأة لتقييدك بمسارك أو حلقتك."
              : "أنشئي أول حلقة واربطيها بمسار، وحدّدي معلمتها ومواعيدها."
          }
          action={canManageAny ? <Button onClick={openNew}>إنشاء أول حلقة</Button> : undefined}
        />
      ) : (
        <div className="surface-panel overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الحلقة</TableHead>
                <TableHead className="text-right">المسار</TableHead>
                <TableHead className="text-right">المعلمة</TableHead>
                <TableHead className="text-right">المواعيد</TableHead>
                <TableHead className="text-right">الطالبات</TableHead>
                {canManageAny ? <TableHead className="text-right">إجراءات</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const track = c.track_id ? trackMap.get(c.track_id) : null;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.name}
                      {c.notes ? (
                        <p className="max-w-xs truncate text-xs text-muted-foreground">{c.notes}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {track ? (
                        <span className="text-sm">
                          {track.name}
                          <span className="ms-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">
                            {trackCategoriesLabel(track)}
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {c.teacher_name || "—"}
                      {c.teacher_user_id ? (
                        <span className="ms-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">مرتبطة</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {Array.isArray(c.schedule) && c.schedule.length ? (
                        <span className="flex flex-wrap gap-1">
                          {(c.schedule as ScheduleSlot[]).map((s, i) => (
                            <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                              {s.day} {s.time}
                            </span>
                          ))}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">{counts[c.id] ?? 0}</TableCell>
                    {canManageAny ? (
                      <TableCell>
                        {canManageTrack(c.track_id) ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setEdit({
                                  id: c.id,
                                  name: c.name,
                                  track_id: c.track_id ?? "",
                                  teacher_name: c.teacher_name ?? "",
                                  teacher_user_id: c.teacher_user_id ?? "",
                                  schedule: Array.isArray(c.schedule) ? (c.schedule as ScheduleSlot[]) : [],
                                  notes: c.notes ?? "",
                                })
                              }
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => {
                                if (window.confirm(`حذف الحلقة «${c.name}»؟`)) remove.mutate(c.id);
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">خارج نطاقك</span>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "تعديل الحلقة" : "حلقة جديدة"}</DialogTitle>
            <DialogDescription>حدّدي اسم الحلقة والمسار والمعلمة والمواعيد.</DialogDescription>
          </DialogHeader>
          {edit ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="c-name">اسم الحلقة</Label>
                <Input
                  id="c-name"
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  placeholder="مثال: سراج ١"
                  required
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label>المسار</Label>
                <Select value={edit.track_id} onValueChange={(v) => setEdit({ ...edit, track_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="بدون مسار" />
                  </SelectTrigger>
                  <SelectContent>
                    {canManage ? <SelectItem value="__none">بدون مسار</SelectItem> : null}
                    {tracksQuery.data
                      ?.filter((t) => canManageTrack(t.id))
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} — {trackCategoriesLabel(t)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-teacher">المعلمة</Label>
                <Input
                  id="c-teacher"
                  value={edit.teacher_name}
                  onChange={(e) => setEdit({ ...edit, teacher_name: e.target.value })}
                  placeholder="اسم المعلمة"
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label>حساب المعلمة (لتسجيل الأنصبة)</Label>
                <Select
                  value={edit.teacher_user_id || "__none"}
                  onValueChange={(v) => setEdit({ ...edit, teacher_user_id: v === "__none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="بدون ربط" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">بدون ربط</SelectItem>
                    {staffQuery.data?.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  المعلمة المرتبطة ترى طالبات هذه الحلقة ومسارها مباشرة في صفحة الأنصبة.
                </p>
              </div>
              <div className="space-y-2">
                <Label>المواعيد</Label>
                {edit.schedule.map((slot, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={slot.day}
                      placeholder="اليوم"
                      onChange={(e) => {
                        const s = [...edit.schedule];
                        s[i] = { ...s[i]!, day: e.target.value };
                        setEdit({ ...edit, schedule: s });
                      }}
                      maxLength={40}
                    />
                    <Input
                      value={slot.time}
                      placeholder="الوقت"
                      onChange={(e) => {
                        const s = [...edit.schedule];
                        s[i] = { ...s[i]!, time: e.target.value };
                        setEdit({ ...edit, schedule: s });
                      }}
                      maxLength={40}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0 text-destructive"
                      onClick={() => setEdit({ ...edit, schedule: edit.schedule.filter((_, j) => j !== i) })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEdit({ ...edit, schedule: [...edit.schedule, { day: "", time: "" }] })}
                >
                  <Plus className="size-4" />
                  إضافة موعد
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-notes">ملاحظات</Label>
                <Textarea
                  id="c-notes"
                  rows={2}
                  value={edit.notes}
                  onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                  maxLength={300}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              onClick={() => edit && save.mutate(edit)}
              disabled={save.isPending || !edit?.name.trim()}
            >
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
