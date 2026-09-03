import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, BookOpenText, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { visibleTenantNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState, FeatureLockedState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTenantContext } from "@/hooks/useTenantContext";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { Checkbox } from "@/components/ui/checkbox";
import { trackCategoryLabel, TRACK_CATEGORY_KEYS } from "@/lib/track-categories";
import {
  AyahRangePicker,
  emptyRange,
  isCompleteRange,
  rangePages,
  toRange,
  type RangeValue,
} from "@/components/AyahRangePicker";
import { normalizeRange } from "@/lib/quran";

export const Route = createFileRoute("/_authenticated/app/$slug/progress")({
  head: () => ({
    meta: [
      { title: "الأنصبة والتقدم — سُحُب" },
      { name: "description", content: "تسجيل أنصبة الطالبات بالسور والآيات وحساب الأوجه تلقائياً وفق مصحف المدينة." },
      { property: "og:title", content: "الأنصبة والتقدم — سُحُب" },
      { property: "og:description", content: "متابعة أنصبة الطالبات وإنجازهن اليومي على منصة سُحُب." },
    ],
  }),
  component: ProgressPage,
});

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function rangeFrom(row: {
  from_surah: number | null;
  from_ayah: number | null;
  to_surah: number | null;
  to_ayah: number | null;
}): RangeValue {
  if (!row.from_surah || !row.from_ayah || !row.to_surah || !row.to_ayah) return emptyRange;
  return {
    fromSurah: String(row.from_surah),
    fromAyah: String(row.from_ayah),
    toSurah: String(row.to_surah),
    toAyah: String(row.to_ayah),
  };
}

function rangeColumns(v: RangeValue) {
  const r = toRange(v);
  if (!r) return { from_surah: null, from_ayah: null, to_surah: null, to_ayah: null };
  const n = normalizeRange(r);
  return {
    from_surah: n.fromSurah,
    from_ayah: n.fromAyah,
    to_surah: n.toSurah,
    to_ayah: n.toAyah,
  };
}

function ProgressPage() {
  const { tenant, canRead, canManage, canRecord: canRecordAtAll, canRecordForCircle, canViewCircle, loading, hasFeature, featuresLoading, isCircleScopedOnly } = useTenantContext();
  const qc = useQueryClient();
  const [circleId, setCircleId] = useState<string>("");
  const [date, setDate] = useState(todayISO());
  const [dayRanges, setDayRanges] = useState<Record<string, RangeValue>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  // الحضور مبني على الأنصبة نفسها: لو سُجّل نصاب لطالبة فهي حاضرة تلقائيًا،
  // ولو انحطّت عليها علامة "غايبة" فهي غايبة ولا يُسجَّل لها نصاب اليوم —
  // بدون صفحة أو جدول منفصل يحتاج تعبئة يدوية إضافية.
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());

  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  const circlesQuery = useQuery({
    queryKey: ["circles", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circles")
        .select("id, name, track_id, teacher_user_id, tracks(name, category, categories)")
        .eq("tenant_id", tenant!.id)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const allCircles = circlesQuery.data ?? [];
  // تُصفَّى الحلقات وفق نطاق المستخدمة: القيادة ترى كل الحلقات، النائبة
  // الأكاديمية ترى حلقات مسارها المسنَد فقط (ولا شي لو غير مقيَّدة)،
  // والمعلمة/المشرفة ترى حلقتها المسندة فقط (ولا شي لو غير مقيَّدة).
  const visibleCircles = allCircles.filter((c) => canViewCircle(c));

  useEffect(() => {
    if (!circleId && visibleCircles.length) setCircleId(visibleCircles[0]!.id);
  }, [circleId, visibleCircles]);

  const studentsQuery = useQuery({
    queryKey: ["students", tenant?.id, date],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, status, leave_start, leave_end")
        .eq("tenant_id", tenant!.id)
        .in("status", ["active", "on_leave"])
        .order("full_name");
      if (error) throw error;
      // الطالبة في إجازة سارية على تاريخ اليوم المختار لا يظهر لها إدخال
      // أنصبة ولا تُحتسب غيابها؛ وبعد انتهاء الإجازة تعود تلقائيًا.
      return (data ?? []).filter((s) => {
        if (s.status !== "on_leave") return true;
        const from = s.leave_start ?? "0000-00-00";
        const to = s.leave_end ?? "9999-12-31";
        return date < from || date > to;
      });
    },
  });

  const enrollmentsQuery = useQuery({
    queryKey: ["enrollments", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("circle_students").select("student_id, circle_id");
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const row of data ?? []) (map[row.student_id] ??= []).push(row.circle_id);
      return map;
    },
  });

  const dayProgressQuery = useQuery({
    queryKey: ["progress-day", tenant?.id, date],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("progress_records")
        .select("student_id, track_id, category, amount, notes, from_surah, from_ayah, to_surah, to_ayah")
        .eq("tenant_id", tenant!.id)
        .eq("record_date", date);
      if (error) throw error;
      return data;
    },
  });

  const dayAttendanceQuery = useQuery({
    queryKey: ["attendance-day", tenant?.id, circleId, date],
    enabled: canRead && !!tenant?.id && !!circleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, status")
        .eq("tenant_id", tenant!.id)
        .eq("circle_id", circleId)
        .eq("record_date", date);
      if (error) throw error;
      return data;
    },
  });

  const selected = visibleCircles.find((c) => c.id === circleId);
  // هل تستطيع المستخدمة تسجيل الأنصبة/التقدم لهذه الحلقة تحديداً؟
  const canRecord = canRecordForCircle(circleId || null);
  const trackId = selected?.track_id ?? "";
  // الحلقة ترث مناهج مسارها تلقائياً
  const trackRaw = selected?.tracks;
  const trackCats = (
    trackRaw?.categories && trackRaw.categories.length > 0
      ? TRACK_CATEGORY_KEYS.filter((k) => (trackRaw.categories as string[]).includes(k))
      : trackRaw?.category
        ? [trackRaw.category as string]
        : []
  ) as string[];
  const cats = trackCats.length > 0 ? trackCats : ["hifz_new"];
  const keyOf = (studentId: string, cat: string) => `${studentId}|${cat}`;

  const enroll = enrollmentsQuery.data ?? {};
  const circleStudents = (studentsQuery.data ?? []).filter((s) =>
    (enroll[s.id] ?? []).includes(circleId),
  );

  // تعبئة الحالة من قاعدة البيانات عند تغيير الحلقة أو اليوم
  const dayRows = dayProgressQuery.data;
  useEffect(() => {
    if (!trackId) return;
    const d: Record<string, RangeValue> = {};
    const n: Record<string, string> = {};
    for (const r of dayRows ?? []) {
      if (r.track_id === trackId) {
        d[`${r.student_id}|${r.category}`] = rangeFrom(r);
        if (r.notes) n[r.student_id] = r.notes;
      }
    }
    setDayRanges(d);
    setNotes(n);
  }, [trackId, date, dayRows]);

  // تهيئة الغائبات من سجل الحضور المحفوظ (مرتبط بالحلقة نفسها لا المسار)
  useEffect(() => {
    const absent = new Set<string>();
    for (const r of dayAttendanceQuery.data ?? []) {
      if (r.status === "absent") absent.add(r.student_id);
    }
    setAbsentIds(absent);
  }, [circleId, date, dayAttendanceQuery.data]);

  const saveProgress = useMutation({
    mutationFn: async () => {
      if (!trackId) return;
      const rows = circleStudents
        .filter((s) => !absentIds.has(s.id))
        .flatMap((s) => cats.map((cat) => ({ s, cat, v: dayRanges[keyOf(s.id, cat)] ?? emptyRange })))
        .filter((x) => isCompleteRange(x.v))
        .map(({ s, cat, v }) => ({
          tenant_id: tenant!.id,
          student_id: s.id,
          track_id: trackId,
          category: cat as "hifz_new",
          circle_id: circleId,
          record_date: date,
          amount: rangePages(v) ?? 0,
          notes: (notes[s.id] ?? "").trim() || null,
          ...rangeColumns(v),
        }));

      // الحضور مشتقّ من نفس الشاشة: افتراضيًا كل طالبة "حاضرة" إلا لو
      // انحطّت عليها علامة "غايبة" — بغض النظر عن وجود نصاب مسجَّل لها
      // أو لا (يوم مراجعة بدون نصاب جديد يبقى حاضرة). هذا يضمن سجل حضور
      // كامل لكل الطالبات كل يوم (بدل الاعتماد فقط على وجود نصاب).
      const attendanceRows = circleStudents.map((s) => ({
        tenant_id: tenant!.id,
        circle_id: circleId,
        student_id: s.id,
        record_date: date,
        status: absentIds.has(s.id) ? ("absent" as const) : ("present" as const),
      }));

      // لا نعتمد على upsert/onConflict لأن الجداول ما فيها قيود فريدة
      // مطابقة (كان هذا سبب رفض الحفظ). نحذف سجلات اليوم لهؤلاء الطالبات
      // ثم نُدرج من جديد.
      const studentIds = circleStudents.map((s) => s.id);
      if (studentIds.length) {
        const { error: delErr } = await supabase
          .from("progress_records")
          .delete()
          .eq("tenant_id", tenant!.id)
          .eq("track_id", trackId)
          .eq("record_date", date)
          .in("student_id", studentIds);
        if (delErr) throw delErr;

        const { error: delAtt } = await supabase
          .from("attendance")
          .delete()
          .eq("tenant_id", tenant!.id)
          .eq("circle_id", circleId)
          .eq("record_date", date)
          .in("student_id", studentIds);
        if (delAtt) throw delAtt;
      }
      if (rows.length) {
        const { error } = await supabase.from("progress_records").insert(rows);
        if (error) throw error;
      }
      if (attendanceRows.length) {
        const { error } = await supabase.from("attendance").insert(attendanceRows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم تسجيل تقدم اليوم والحضور");
      void qc.invalidateQueries({ queryKey: ["progress-day"] });
      void qc.invalidateQueries({ queryKey: ["attendance-day"] });
      void qc.invalidateQueries({ queryKey: ["attendance-stats"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر تسجيل التقدم — تأكدي من صلاحياتك"),
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

  // ⚠️ هذه الصفحة مقصورة على المعلمة/المشرفة المسموح لها بالإدخال حاليًا
  // وفق إعداد progress_entry_mode فقط. القيادة والنائبة الأكاديمية ومالكة
  // المنصة لا تُشاهد هذه الصفحة إطلاقًا (لا حتى للقراءة) — القرار مقصود من
  // صاحبة المنتج. الحماية الفعلية والملزمة تتم عبر RLS.
  if (!canRecordAtAll) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <EmptyState
          title="هذه الصفحة غير متاحة لكِ"
          description="صفحة الأنصبة والتقدم مقصورة على المعلمة أو المشرفة، بحسب إعداد المقرأة الحالي."
          action={
            <Button asChild>
              <Link to="/app/$slug" params={{ slug: tenant.slug }}>العودة للوحة المقرأة</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!hasFeature("progress")) {
    return (
      <AppShell
        brandName={tenant.name}
        brandSubtitle="الأنصبة والتقدم"
        logoUrl={tenant.logo_url}
        nav={visibleTenantNav(tenant.slug, hasFeature, canManage, canRecordAtAll, isCircleScopedOnly)}
        title="الأنصبة والتقدم"
        crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "الأنصبة والتقدم" }]}
      >
        <FeatureLockedState tenantSlug={tenant.slug} />
      </AppShell>
    );
  }

  const categoryLabel = cats.map((c) => trackCategoryLabel(c)).join(" · ");

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="الأنصبة والتقدم"
      logoUrl={tenant.logo_url}
      nav={visibleTenantNav(tenant.slug, hasFeature, canManage, canRecordAtAll, isCircleScopedOnly)}
      title="الأنصبة والتقدم"
      crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "الأنصبة والتقدم" }]}
    >
      <div className="space-y-6">
        <section className="surface-panel grid gap-4 p-6 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>حلقتي</Label>
            {visibleCircles.length > 1 ? (
              <Select value={circleId} onValueChange={setCircleId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختاري حلقة" />
                </SelectTrigger>
                <SelectContent>
                  {visibleCircles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.tracks?.name ? ` — ${c.tracks.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-base font-semibold">
                {selected ? selected.name : "لم تُسنَد إليكِ حلقة بعد"}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {selected
                ? `المسار: ${selected.tracks?.name ?? "—"}${categoryLabel ? ` — ${categoryLabel}` : ""}`
                : "تواصلي مع قائدة المقرأة لربط حلقتك بكِ."}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="date">اليوم</Label>
            <Input id="date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              {canRecord
                ? "اختاري السورة والآية، ويُحسب عدد الأوجه تلقائياً وفق مصحف المدينة."
                : "قراءة فقط — إعداد المقرأة لا يسمح لكِ بالإدخال."}
            </p>
          </div>
        </section>

        {!selected ? (
          <EmptyState
            icon={<BookOpenText className="size-6" />}
            title="لا توجد حلقة مرتبطة بكِ"
            description="بعد أن تربط القائدة الحلقة بحسابك ستظهر طالباتك ومسارهن هنا مباشرة."
          />
        ) : circleStudents.length === 0 ? (
          <EmptyState
            icon={<BookOpenText className="size-6" />}
            title="لا توجد طالبات في هذه الحلقة"
            description="تُضاف الطالبات إلى الحلقة من صفحة الطالبات."
          />
        ) : (
          <>
            <div className="space-y-4">
              {circleStudents.map((s) => {
                const isAbsent = absentIds.has(s.id);
                const doneTotal = cats.reduce(
                  (sum, c) => sum + (rangePages(dayRanges[keyOf(s.id, c)] ?? emptyRange) ?? 0),
                  0,
                );
                return (
                  <section
                    key={s.id}
                    className={`surface-panel space-y-5 p-5 ${isAbsent ? "opacity-60" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-semibold">{s.full_name}</h3>
                      <div className="flex items-center gap-3">
                        {!isAbsent ? (
                          <span className="text-xs text-muted-foreground">
                            {`${doneTotal} أوجه`}
                          </span>
                        ) : (
                          <span className="rounded-full bg-destructive-soft px-2 py-0.5 text-xs text-destructive">
                            غايبة
                          </span>
                        )}
                        {canRecord ? (
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Checkbox
                              checked={isAbsent}
                              onCheckedChange={(checked) => {
                                const next = new Set(absentIds);
                                if (checked) next.add(s.id);
                                else next.delete(s.id);
                                setAbsentIds(next);
                              }}
                            />
                            غايبة اليوم
                          </label>
                        ) : null}
                      </div>
                    </div>
                    {cats.map((cat) => {
                      const tKey = keyOf(s.id, cat);
                      const d = dayRanges[tKey] ?? emptyRange;
                      return (
                        <div key={cat} className="space-y-3 rounded-xl border border-border/70 p-4">
                          <p className="text-sm font-medium text-primary">{trackCategoryLabel(cat)}</p>
                          <AyahRangePicker
                            label="منجز اليوم"
                            value={d}
                            disabled={!canRecord || isAbsent}
                            onChange={(v) => setDayRanges({ ...dayRanges, [tKey]: v })}
                          />
                        </div>
                      );
                    })}
                    {canRecord && !isAbsent ? (
                      <div className="grid gap-1.5">
                        <Label className="text-sm">ملاحظات</Label>
                        <Input
                          dir="rtl"
                          value={notes[s.id] ?? ""}
                          onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })}
                          placeholder="ملاحظة اختيارية"
                        />
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>

            {canRecord ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button onClick={() => saveProgress.mutate()} disabled={saveProgress.isPending}>
                  {saveProgress.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  تسجيل التقدم والحضور
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
