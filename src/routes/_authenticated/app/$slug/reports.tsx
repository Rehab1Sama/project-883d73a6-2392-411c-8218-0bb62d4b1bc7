import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, FileSpreadsheet, FileBarChart2, Users, GraduationCap, BookOpenText, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { visibleTenantNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState, StatCard, FeatureLockedState } from "@/components/ui-blocks";
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
import { trackCategoryLabel, TRACK_CATEGORY_KEYS } from "@/lib/track-categories";
import { exportReportExcel, exportStudentsExcel, exportVolunteersExcel, type TrackExport } from "@/lib/progress";

export const Route = createFileRoute("/_authenticated/app/$slug/reports")({
  head: () => ({
    meta: [
      { title: "التقارير والإحصائيات — سُحُب" },
      { name: "description", content: "إحصائيات الحفظ والمراجعة والتلاوة والحضور لكل مسار وللمقرأة، مع تصدير إكسل." },
      { property: "og:title", content: "التقارير والإحصائيات — سُحُب" },
      { property: "og:description", content: "تقارير إنجاز المقرأة القابلة للتصدير على منصة سُحُب." },
    ],
  }),
  component: ReportsPage,
});

type Period = { key: string; label: string };

const PERIODS: Period[] = [
  { key: "all", label: "كل الفترات" },
  { key: "7d", label: "آخر ٧ أيام" },
  { key: "30d", label: "آخر ٣٠ يوم" },
  { key: "custom", label: "فترة محددة" },
];

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function ReportsPage() {
  const { tenant, canRead, loading, hasFeature, featuresLoading } = useTenantContext();
  const [period, setPeriod] = useState<string>("all");
  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());
  const [exporting, setExporting] = useState<string | null>(null);

  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  const range = useMemo(() => {
    if (period === "all") return null;
    if (period === "7d") return { from: daysAgoISO(7), to: todayISO() };
    if (period === "30d") return { from: daysAgoISO(30), to: todayISO() };
    return { from, to };
  }, [period, from, to]);

  const periodLabel = (PERIODS.find((p) => p.key === period)?.label ?? "كل الفترات") + (range ? ` (${range.from} → ${range.to})` : "");

  const dataQuery = useQuery({
    queryKey: ["reports", tenant?.id, range?.from ?? "all", range?.to ?? "all"],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      let base = supabase.from("progress_records").select("amount, track_id, category, student_id, tracks(category)").eq("tenant_id", tenant!.id);
      if (range) {
        base = base.gte("record_date", range.from).lte("record_date", range.to);
      }
      const { data: progress, error: pErr } = await base;
      if (pErr) throw pErr;

      let attBase = supabase
        .from("attendance")
        .select("status, circle_id, circles(track_id)")
        .eq("tenant_id", tenant!.id);
      if (range) {
        attBase = attBase.gte("record_date", range.from).lte("record_date", range.to);
      }
      const { data: attendance, error: aErr } = await attBase;
      if (aErr) throw aErr;

      const [{ count: studentCount }, { count: volunteerCount }, { data: quotas }] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("tenant_id", tenant!.id).eq("status", "active"),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("tenant_id", tenant!.id).eq("is_volunteer", true),
        supabase.from("quotas").select("student_id, track_id, target_amount").eq("tenant_id", tenant!.id),
      ]);

      // التجميع حسب المسار والفئة
      const perTrack: Record<string, { name: string; category: string; oruj: number; absences: number }> = {};
      // خريطة المسار -> الفئة من بيانات التقدم
      const catFromProgress: Record<string, string> = {};
      for (const r of progress ?? []) {
        const cat = (r.tracks as { category?: string } | null)?.category ?? "";
        if (cat) catFromProgress[r.track_id] = cat;
      }
      const orujByTrack: Record<string, number> = {};
      for (const r of progress ?? []) orujByTrack[r.track_id] = (orujByTrack[r.track_id] ?? 0) + Number(r.amount ?? 0);

      // التفصيل حسب المنهج مأخوذ من نوع كل سجل نفسه (حفظ/مراجعة/تلاوة...)
      const orujByCategory: Record<string, number> = {};
      for (const r of progress ?? []) {
        const cat = (r.category as string | null) ?? (r.tracks as { category?: string } | null)?.category ?? "";
        if (cat) orujByCategory[cat] = (orujByCategory[cat] ?? 0) + Number(r.amount ?? 0);
      }

      // الغياب حسب المسار
      const absByTrack: Record<string, number> = {};
      let totalAbs = 0;
      let totalRecords = 0;
      for (const r of attendance ?? []) {
        totalRecords++;
        const trackId = (r.circles as { track_id?: string | null } | null)?.track_id ?? "";
        if (r.status === "absent") {
          totalAbs++;
          absByTrack[trackId] = (absByTrack[trackId] ?? 0) + 1;
        }
      }

      // نصاب: طالبة مع نِصاب وأنجزت في الفترة ≥ نِصابها
      const quotaTargets = new Map<string, number>();
      for (const q of quotas ?? []) quotaTargets.set(`${q.student_id}:${q.track_id}`, Number(q.target_amount ?? 0));
      const achieved = new Map<string, number>();
      const activeStudents = new Set<string>();
      for (const r of progress ?? []) {
        activeStudents.add(r.student_id);
        const key = `${r.student_id}:${r.track_id}`;
        achieved.set(key, (achieved.get(key) ?? 0) + Number(r.amount ?? 0));
      }
      let metQuota = 0;
      for (const [key, target] of quotaTargets) {
        if ((achieved.get(key) ?? 0) >= target) metQuota++;
      }

      const trackIds = new Set([...Object.keys(orujByTrack), ...Object.keys(absByTrack)]);
      const tracks: TrackExport[] = [];
      for (const id of trackIds) {
        tracks.push({
          name: "مسار",
          category: trackCategoryLabel(catFromProgress[id]),
          oruj: orujByTrack[id] ?? 0,
          absences: absByTrack[id] ?? 0,
        });
      }
      tracks.sort((a, b) => (a.category === "—" ? 1 : 0) - (b.category === "—" ? 1 : 0));

      return {
        students: studentCount ?? 0,
        volunteers: volunteerCount ?? 0,
        totalOruj: Object.values(orujByTrack).reduce((a, b) => a + b, 0),
        totalAbsences: totalAbs,
        attendanceRatio: totalRecords ? totalAbs / totalRecords : null,
        quotaStudents: quotaTargets.size,
        metQuota,
        activeStudents: activeStudents.size,
        tracks,
        byCategory: TRACK_CATEGORY_KEYS.map((k) => ({
          key: k,
          label: trackCategoryLabel(k),
          oruj: orujByCategory[k] ?? 0,
          absences: tracks.filter((t) => t.category === trackCategoryLabel(k)).reduce((a, t) => a + t.absences, 0),
        })),
      };
    },
  });

  const staffQuery = useQuery({
    queryKey: ["staff-export", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id, role, is_volunteer")
        .eq("tenant_id", tenant!.id);
      if (error) throw error;
      const ids = (roles ?? []).map((r) => r.user_id).filter(Boolean);
      const { data: profiles } =
        ids.length > 0
          ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
          : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (roles ?? []).map((r) => ({
        name: byId.get(r.user_id)?.full_name ?? "—",
        email: byId.get(r.user_id)?.email ?? "—",
        role: r.role,
        volunteer: r.is_volunteer,
      }));
    },
  });

  const studentsExportQuery = useQuery({
    queryKey: ["students-export", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, guardian_name, guardian_phone, date_of_birth, status")
        .eq("tenant_id", tenant!.id)
        .order("full_name");
      if (error) throw error;
      const { data: enr, error: eErr } = await supabase.from("circle_students").select("student_id, circle_id, circles(name)");
      if (eErr) throw eErr;
      const { data: circles } = await supabase.from("circles").select("id, name").eq("tenant_id", tenant!.id);
      const circleName = new Map((circles ?? []).map((c) => [c.id, c.name]));
      const byStudent: Record<string, string[]> = {};
      for (const row of enr ?? []) (byStudent[row.student_id] ??= []).push(circleName.get(row.circle_id) ?? "—");
      return (data ?? []).map((s) => ({
        name: s.full_name,
        guardian: s.guardian_name ?? "—",
        phone: s.guardian_phone ?? "—",
        dob: s.date_of_birth ?? "—",
        circles: (byStudent[s.id] ?? []).join("، ") || "—",
        status: s.status === "active" ? "نشطة" : "مؤرشفة",
      }));
    },
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

  if (!hasFeature("reports_basic")) {
    return (
      <AppShell
        brandName={tenant.name}
        brandSubtitle="التقارير"
        logoUrl={tenant.logo_url}
        nav={visibleTenantNav(tenant.slug, hasFeature)}
        title="التقارير"
        crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "التقارير" }]}
      >
        <FeatureLockedState tenantSlug={tenant.slug} />
      </AppShell>
    );
  }

  const d = dataQuery.data;
  async function runExport(kind: string) {
    if (!d || !tenant) return;
    setExporting(kind);
    try {
      if (kind === "report") {
        await exportReportExcel({
          madrasa: tenant.name,
          periodLabel,
          students: d.students,
          staff: d.tracks.length,
          volunteers: d.volunteers,
          totalOruj: d.totalOruj,
          totalAbsences: d.totalAbsences,
          attendanceRatio: d.attendanceRatio,
          quotaStudents: d.quotaStudents,
          metQuota: d.metQuota,
          tracks: d.tracks,
        });
      } else if (kind === "students") {
        await exportStudentsExcel({ madrasa: tenant.name, rows: studentsExportQuery.data ?? [] });
      } else {
        await exportVolunteersExcel({ madrasa: tenant.name, rows: staffQuery.data ?? [] });
      }
    } finally {
      setExporting(null);
    }
  }

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="التقارير والإحصائيات"
      logoUrl={tenant.logo_url}
      nav={visibleTenantNav(tenant.slug, hasFeature)}
      title="التقارير والإحصائيات"
      crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "التقارير" }]}
      actions={
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="الفترة" />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {period === "custom" ? (
            <>
              <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              <Input type="date" value={to} min={from} max={todayISO()} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </>
          ) : null}
        </div>
      }
    >
      {dataQuery.isLoading || !d ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="الطالبات النشطة" value={d.students} icon={<GraduationCap className="size-5" />} />
            <StatCard label="إجمالي الأوجه المنجزة" value={d.totalOruj} tone="gold" icon={<BookOpenText className="size-5" />} />
            <StatCard label="طالبات سجّلت تقدمًا" value={d.activeStudents} icon={<Users className="size-5" />} />
            <StatCard label="المتطوعات" value={d.volunteers} icon={<Heart className="size-5" />} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="surface-panel p-6">
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
                <BookOpenText className="size-5 text-primary" />
                الأوجه المنجزة حسب الفئة
              </h2>
              <div className="space-y-3">
                {d.byCategory.filter((c) => c.oruj > 0 || c.absences > 0).map((c) => (
                  <div key={c.key} className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5">
                    <span className="text-sm font-medium">{c.label}</span>
                    <span className="tabular-nums text-sm text-primary">{c.oruj} وجه</span>
                  </div>
                ))}
                {d.byCategory.every((c) => c.oruj === 0) ? (
                  <p className="text-sm text-muted-foreground">لا توجد أوجه مسجلة في هذه الفترة.</p>
                ) : null}
              </div>
            </section>

            <section className="surface-panel p-6">
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
                <FileBarChart2 className="size-5 text-primary" />
                ملخص الفترة
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>نسبة إنجاز النصاب</span>
                  <span className="tabular-nums font-medium">
                    {d.quotaStudents ? `${Math.round((d.metQuota / d.quotaStudents) * 100)}%` : "—"}
                    <span className="ms-1 text-xs text-muted-foreground">
                      ({d.metQuota}/{d.quotaStudents})
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>إجمالي الغياب</span>
                  <span className="tabular-nums font-medium text-destructive">{d.totalAbsences}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>نسبة الغياب</span>
                  <span className="tabular-nums font-medium">
                    {d.attendanceRatio === null ? "—" : `${Math.round(d.attendanceRatio * 100)}%`}
                  </span>
                </div>
              </div>

              <h3 className="mt-6 mb-3 font-display text-base font-bold">الغياب حسب المسار</h3>
              <div className="space-y-2">
                {d.tracks.filter((t) => t.absences > 0).map((t, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-muted px-4 py-2 text-sm">
                    <span>{t.category === "—" ? "مسار بدون فئة" : t.category}</span>
                    <span className="tabular-nums text-destructive">{t.absences}</span>
                  </div>
                ))}
                {d.tracks.every((t) => t.absences === 0) ? (
                  <p className="text-sm text-muted-foreground">لا غياب مسجل في هذه الفترة.</p>
                ) : null}
              </div>
            </section>
          </div>

          <section className="surface-panel p-6">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
              <FileSpreadsheet className="size-5 text-primary" />
              التصدير إلى إكسل
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => runExport("report")} disabled={exporting !== null}>
                {exporting === "report" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
                تقرير الفترة
              </Button>
              <Button variant="outline" onClick={() => runExport("students")} disabled={exporting !== null}>
                {exporting === "students" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
                قائمة الطالبات
              </Button>
              <Button variant="outline" onClick={() => runExport("staff")} disabled={exporting !== null}>
                {exporting === "staff" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
                قائمة الطاقم والمتطوعات
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <FileSpreadsheet className="size-4" />
                تصدير PDF (طباعة)
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              التقارير أسبوعية أو شهرية حسب الفترة المختارة، ويمكن تصديرها لحفظها ومشاركتها.
            </p>
          </section>
        </div>
      )}
    </AppShell>
  );
}
