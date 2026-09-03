import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, GraduationCap, Users, Award, CircleDot, BookOpenText, CalendarX2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { visibleTenantNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState, StatCard } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenantContext } from "@/hooks/useTenantContext";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { TRACK_CATEGORY_LABELS, TRACK_CATEGORY_KEYS, trackCategoriesLabel } from "@/lib/track-categories";

export const Route = createFileRoute("/_authenticated/app/$slug/stats")({
  head: () => ({
    meta: [
      { title: "الإحصائيات — سُحُب" },
      { name: "description", content: "لوحة إحصائيات موسّعة للمقرأة: الكوادر والطالبات والأوجه والغياب وتفاصيل الحلقات." },
      { property: "og:title", content: "الإحصائيات — سُحُب" },
      { property: "og:description", content: "إحصائيات المقرأة الكاملة ولكل مسار على منصة سُحُب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StatsPage,
});

const PERIODS = [
  { key: "year", label: "هذا العام" },
  { key: "90d", label: "آخر ٩٠ يوم" },
  { key: "30d", label: "آخر ٣٠ يوم" },
  { key: "7d", label: "هذا الأسبوع" },
  { key: "all", label: "كل الفترات" },
  { key: "custom", label: "فترة محددة" },
] as const;

function iso(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
}

const AGE_BUCKETS: { label: string; test: (a: number) => boolean }[] = [
  { label: "أقل من ١٠ سنوات", test: (a) => a < 10 },
  { label: "١٠ - ١٥", test: (a) => a >= 10 && a <= 15 },
  { label: "١٦ - ٢٠", test: (a) => a >= 16 && a <= 20 },
  { label: "٢١ - ٣٠", test: (a) => a >= 21 && a <= 30 },
  { label: "٣١ - ٤٠", test: (a) => a >= 31 && a <= 40 },
  { label: "٤١ - ٥٠", test: (a) => a >= 41 && a <= 50 },
  { label: "+٥١", test: (a) => a > 50 },
];

function StatsPage() {
  const { tenant, canRead, canManage, isAcademicDeputy, myTrackScopes, loading, hasFeature, featuresLoading, canRecord, isCircleScopedOnly } =
    useTenantContext();
  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  const [period, setPeriod] = useState<string>("year");
  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(iso(new Date()));

  const range = useMemo(() => {
    if (period === "all") return null;
    if (period === "custom") return { from, to };
    if (period === "year") return { from: `${new Date().getFullYear()}-01-01`, to: iso(new Date()) };
    if (period === "90d") return { from: daysAgoISO(90), to: iso(new Date()) };
    if (period === "30d") return { from: daysAgoISO(30), to: iso(new Date()) };
    return { from: daysAgoISO(7), to: iso(new Date()) };
  }, [period, from, to]);

  // نطاق العرض: القيادة/مالكة المنصة ترى كل المقرأة، ونائبة المسار ترى
  // مساراتها المسنَدة فقط (وإن لم يُسنَد لها مسار فلا شيء).
  const scopeTracks: string[] | null = canManage ? null : isAcademicDeputy ? myTrackScopes : [];
  const scopeKey = scopeTracks ? scopeTracks.slice().sort().join(",") : "all";

  const statsQuery = useQuery({
    queryKey: ["tenant-full-stats", tenant?.id, scopeKey, range?.from ?? "all", range?.to ?? "all"],
    enabled: canRead && !!tenant?.id && (scopeTracks === null || scopeTracks.length > 0),
    queryFn: async () => {
      const tenantId = tenant!.id;

      const [{ data: tracksRaw, error: tErr }, { data: circlesRaw, error: cErr }, { data: rolesRaw, error: rErr }] =
        await Promise.all([
          supabase.from("tracks").select("id, name, category, categories, age_group, status").eq("tenant_id", tenantId),
          supabase.from("circles").select("id, name, track_id, status").eq("tenant_id", tenantId),
          supabase.from("user_roles").select("id, role, is_volunteer, track_id, circle_id").eq("tenant_id", tenantId),
        ]);
      if (tErr) throw tErr;
      if (cErr) throw cErr;
      if (rErr) throw rErr;

      const tracks = (tracksRaw ?? []).filter((t) => !scopeTracks || scopeTracks.includes(t.id));
      const trackIds = new Set(tracks.map((t) => t.id));
      const circles = (circlesRaw ?? []).filter((c) => !scopeTracks || (c.track_id && trackIds.has(c.track_id)));
      const circleIds = circles.map((c) => c.id);

      const { data: links, error: lErr } = circleIds.length
        ? await supabase.from("circle_students").select("circle_id, student_id").in("circle_id", circleIds)
        : { data: [] as { circle_id: string; student_id: string }[], error: null };
      if (lErr) throw lErr;

      const scopedStudentIds = new Set((links ?? []).map((l) => l.student_id));

      const { data: studentsRaw, error: sErr } = await supabase
        .from("students")
        .select("id, age, status")
        .eq("tenant_id", tenantId)
        .eq("status", "active");
      if (sErr) throw sErr;
      const students = (studentsRaw ?? []).filter((s) => !scopeTracks || scopedStudentIds.has(s.id));

      let pQ = supabase
        .from("progress_records")
        .select("amount, category, track_id, circle_id, student_id")
        .eq("tenant_id", tenantId);
      if (range) pQ = pQ.gte("record_date", range.from).lte("record_date", range.to);
      const { data: progress, error: pErr } = await pQ;
      if (pErr) throw pErr;

      let aQ = supabase.from("attendance").select("status, circle_id, student_id").eq("tenant_id", tenantId);
      if (range) aQ = aQ.gte("record_date", range.from).lte("record_date", range.to);
      const { data: attendance, error: aErr } = await aQ;
      if (aErr) throw aErr;

      const circleSet = new Set(circleIds);
      const progressScoped = (progress ?? []).filter(
        (r) => !scopeTracks || trackIds.has(r.track_id) || (r.circle_id && circleSet.has(r.circle_id)),
      );
      const attendanceScoped = (attendance ?? []).filter((r) => !scopeTracks || circleSet.has(r.circle_id));

      // الكوادر
      const staff = { teachers: 0, supervisors: 0, trackLeads: 0, admins: 0 };
      for (const r of rolesRaw ?? []) {
        if (scopeTracks) {
          const inScope =
            (r.track_id && trackIds.has(r.track_id)) || (r.circle_id && circleSet.has(r.circle_id));
          if (!inScope) continue;
        }
        if (r.role === "teacher") staff.teachers++;
        else if (r.role === "supervisor") staff.supervisors++;
        else if (r.role === "academic_deputy") staff.trackLeads++;
        else if (r.role === "tenant_admin" || r.role === "admin_deputy") staff.admins++;
      }

      // الطالبات حسب الفئة العمرية للمسار
      const trackById = new Map(tracks.map((t) => [t.id, t]));
      const circleById = new Map(circles.map((c) => [c.id, c]));
      const byAgeGroup: Record<string, Set<string>> = {};
      for (const l of links ?? []) {
        const c = circleById.get(l.circle_id);
        const group = (c?.track_id ? trackById.get(c.track_id)?.age_group : null) ?? "غير محدد";
        (byAgeGroup[group] ??= new Set()).add(l.student_id);
      }

      // توزيع الأعمار
      const ageDist = AGE_BUCKETS.map((b) => ({
        label: b.label,
        count: students.filter((s) => typeof s.age === "number" && b.test(Number(s.age))).length,
      }));

      // الأوجه حسب المنهج
      const byCategory: Record<string, number> = {};
      for (const r of progressScoped) {
        const key = (r.category as string | null) ?? trackById.get(r.track_id)?.category ?? "";
        if (key) byCategory[key] = (byCategory[key] ?? 0) + Number(r.amount ?? 0);
      }
      const totalOruj = Object.values(byCategory).reduce((a, b) => a + b, 0);

      // الغياب
      let absences = 0;
      let attendanceRows = 0;
      const absByCircle: Record<string, number> = {};
      for (const r of attendanceScoped) {
        attendanceRows++;
        if (r.status === "absent") {
          absences++;
          absByCircle[r.circle_id] = (absByCircle[r.circle_id] ?? 0) + 1;
        }
      }

      // تفاصيل الحلقات
      const studentsPerCircle: Record<string, number> = {};
      for (const l of links ?? []) studentsPerCircle[l.circle_id] = (studentsPerCircle[l.circle_id] ?? 0) + 1;
      const orujPerCircle: Record<string, number> = {};
      for (const r of progressScoped) {
        if (!r.circle_id) continue;
        orujPerCircle[r.circle_id] = (orujPerCircle[r.circle_id] ?? 0) + Number(r.amount ?? 0);
      }
      const circleRows = circles
        .map((c) => ({
          id: c.id,
          name: c.name,
          track: c.track_id ? (trackById.get(c.track_id)?.name ?? "—") : "—",
          students: studentsPerCircle[c.id] ?? 0,
          oruj: orujPerCircle[c.id] ?? 0,
          absences: absByCircle[c.id] ?? 0,
        }))
        .sort((a, b) => b.oruj - a.oruj);

      return {
        staff,
        totalStudents: students.length,
        byAgeGroup: Object.entries(byAgeGroup)
          .map(([label, set]) => ({ label, count: set.size }))
          .sort((a, b) => b.count - a.count),
        ageDist,
        byCategory,
        totalOruj,
        absences,
        attendanceRows,
        tracksCount: tracks.length,
        circlesCount: circles.length,
        circleRows,
        topCircle: circleRows[0] ?? null,
      };
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

  const scopeLabel = canManage ? "كامل المقرأة" : "مساراتك المسنَدة فقط";
  const data = statsQuery.data;
  const maxAge = Math.max(1, ...(data?.ageDist.map((a) => a.count) ?? [1]));

  return (
    <AppShell
      brandName={tenant.name}
      logoUrl={tenant.logo_url}
      nav={visibleTenantNav(tenant.slug, hasFeature, canManage, canRecord, isCircleScopedOnly)}
      title="الإحصائيات"
      crumbs={[{ label: tenant.name }, { label: "الإحصائيات" }]}
    >
      {(
        <div className="space-y-6">
          <section className="surface-panel gradient-sky flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <BarChart3 className="size-5 text-primary" /> لوحة الإحصائيات
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">نطاق العرض: {scopeLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PERIODS.map((p) => (
                <Button
                  key={p.key}
                  size="sm"
                  variant={period === p.key ? "default" : "outline"}
                  onClick={() => setPeriod(p.key)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </section>

          {period === "custom" ? (
            <section className="surface-panel grid gap-3 p-5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="from">من تاريخ</Label>
                <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="to">إلى تاريخ</Label>
                <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </section>
          ) : null}

          {!canManage && !isAcademicDeputy ? (
            <EmptyState
              title="الإحصائيات الموسّعة للقيادة ومسؤولات المسارات"
              description="تظهر لك هنا إحصائيات مسارك عند إسنادك مسؤولةً لمسار."
            />
          ) : !canManage && myTrackScopes.length === 0 ? (
            <EmptyState
              title="لم يُسنَد لكِ مسار بعد"
              description="تواصلي مع قائدة المقرأة لإسنادك مسؤولةً لمسار حتى تظهر إحصائياته."
            />
          ) : statsQuery.isLoading || !data ? (
            <LoadingBlock />
          ) : (
            <>
              <section className="space-y-3">
                <h3 className="flex items-center gap-2 font-display text-base font-bold">
                  <Users className="size-4 text-primary" /> الكوادر التعليمية
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="معلمات" value={data.staff.teachers} icon={<GraduationCap className="size-5" />} />
                  <StatCard label="مشرفات" value={data.staff.supervisors} tone="gold" icon={<Award className="size-5" />} />
                  <StatCard label="مسؤولات مسار" value={data.staff.trackLeads} tone="success" icon={<Users className="size-5" />} />
                  <StatCard label="القيادة" value={data.staff.admins} icon={<Users className="size-5" />} />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="flex items-center gap-2 font-display text-base font-bold">
                  <GraduationCap className="size-4 text-primary" /> الطالبات ({data.totalStudents} إجمالًا)
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="المسارات" value={data.tracksCount} icon={<BookOpenText className="size-5" />} />
                  <StatCard label="الحلقات" value={data.circlesCount} tone="success" icon={<CircleDot className="size-5" />} />
                  {data.byAgeGroup.slice(0, 4).map((g) => (
                    <StatCard key={g.label} label={`حلقات ${g.label}`} value={g.count} tone="gold" icon={<Users className="size-5" />} />
                  ))}
                </div>
              </section>

              <section className="surface-panel space-y-3 p-5">
                <h3 className="font-display text-base font-bold">توزيع الطالبات حسب الأعمار</h3>
                <div className="space-y-2">
                  {data.ageDist.map((b) => (
                    <div key={b.label} className="flex items-center gap-3 text-sm">
                      <span className="w-28 shrink-0 text-muted-foreground">{b.label}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(b.count / maxAge) * 100}%` }} />
                      </div>
                      <span className="w-10 shrink-0 tabular-nums">{b.count}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="flex items-center gap-2 font-display text-base font-bold">
                  <BookOpenText className="size-4 text-primary" /> إحصائيات الأوجه
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {TRACK_CATEGORY_KEYS.map((k) => (
                    <StatCard
                      key={k}
                      label={TRACK_CATEGORY_LABELS[k] ?? k}
                      value={data.byCategory[k] ?? 0}
                      icon={<BookOpenText className="size-5" />}
                    />
                  ))}
                  <StatCard label="إجمالي الأوجه" value={data.totalOruj} tone="success" icon={<BookOpenText className="size-5" />} />
                  <StatCard label="الغياب (إجمالي)" value={data.absences} tone="warning" icon={<CalendarX2 className="size-5" />} />
                  <StatCard
                    label="نسبة الغياب"
                    value={data.attendanceRows ? `${Math.round((data.absences / data.attendanceRows) * 100)}%` : "—"}
                    tone="warning"
                    icon={<CalendarX2 className="size-5" />}
                  />
                </div>
              </section>

              {data.topCircle && data.topCircle.oruj > 0 ? (
                <section className="surface-panel flex items-center justify-between gap-4 p-5">
                  <div>
                    <p className="text-xs text-muted-foreground">الحلقة الأولى خلال الفترة</p>
                    <p className="font-display text-lg font-bold">{data.topCircle.name}</p>
                  </div>
                  <div className="flex items-center gap-2 text-primary">
                    <Trophy className="size-6" />
                    <span className="font-display text-lg font-bold tabular-nums">{data.topCircle.oruj}</span>
                    <span className="text-sm text-muted-foreground">وجه</span>
                  </div>
                </section>
              ) : null}

              <section className="surface-panel overflow-x-auto p-5">
                <h3 className="mb-3 font-display text-base font-bold">تفاصيل الحلقات</h3>
                {data.circleRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا توجد حلقات ضمن نطاقك بعد.</p>
                ) : (
                  <table className="w-full min-w-[520px] text-right text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="p-2 font-medium">الحلقة</th>
                        <th className="p-2 font-medium">المسار</th>
                        <th className="p-2 font-medium">الطالبات</th>
                        <th className="p-2 font-medium">الأوجه</th>
                        <th className="p-2 font-medium">الغياب</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.circleRows.map((r) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="p-2 font-medium">{r.name}</td>
                          <td className="p-2 text-muted-foreground">{r.track}</td>
                          <td className="p-2 tabular-nums">{r.students}</td>
                          <td className="p-2 tabular-nums">{r.oruj}</td>
                          <td className="p-2 tabular-nums text-destructive">{r.absences || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}

// يُستخدم فقط لعرض مناهج المسار في تلميح مستقبلي — نُبقيه مستوردًا لتفادي
// تكرار منطق التسميات.
void trackCategoriesLabel;
