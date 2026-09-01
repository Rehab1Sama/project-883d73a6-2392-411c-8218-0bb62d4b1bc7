import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpenText, Target } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { visibleTenantNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState, StatCard, FeatureLockedState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenantContext } from "@/hooks/useTenantContext";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { trackCategoryLabel } from "@/lib/track-categories";
import { monthLabel, pagesToJuz, surahName } from "@/lib/quran";

export const Route = createFileRoute("/_authenticated/app/$slug/students/$studentId")({
  head: () => ({
    meta: [{ title: "ملف الطالبة — سُحُب" }],
  }),
  component: StudentProfilePage,
});

function rangeText(row: {
  from_surah: number | null;
  from_ayah: number | null;
  to_surah: number | null;
  to_ayah: number | null;
}) {
  if (!row.from_surah || !row.from_ayah || !row.to_surah || !row.to_ayah) return "—";
  return `${surahName(row.from_surah)} ${row.from_ayah} ← ${surahName(row.to_surah)} ${row.to_ayah}`;
}

function StudentProfilePage() {
  const { studentId } = Route.useParams();
  const { tenant, canRead, loading, hasFeature, featuresLoading } = useTenantContext();

  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  const dataQuery = useQuery({
    queryKey: ["student-profile", tenant?.id, studentId],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const [
        { data: student, error: studErr },
        { data: progress, error: progErr },
        { data: quotas, error: quotaErr },
        { data: enrollments, error: enrollErr },
      ] = await Promise.all([
        supabase
          .from("students")
          .select("id, full_name, guardian_name, guardian_phone, date_of_birth, notes, status")
          .eq("id", studentId)
          .maybeSingle(),
        supabase
          .from("progress_records")
          .select("record_date, category, amount, from_surah, from_ayah, to_surah, to_ayah, circle_id")
          .eq("student_id", studentId)
          .order("record_date", { ascending: false }),
        supabase
          .from("quotas")
          .select("category, target_amount, from_surah, from_ayah, to_surah, to_ayah")
          .eq("student_id", studentId),
        supabase
          .from("circle_students")
          .select("circle_id, circles(name, track_id, tracks(name))")
          .eq("student_id", studentId),
      ]);
      if (studErr) throw studErr;
      if (progErr) throw progErr;
      if (quotaErr) throw quotaErr;
      if (enrollErr) throw enrollErr;
      return {
        student,
        progress: progress ?? [],
        quotas: quotas ?? [],
        enrollments: enrollments ?? [],
      };
    },
  });

  const d = dataQuery.data;

  // تجميع أوجه التقدم شهريًا مع تقديرها بالأجزاء تقريبًا
  const monthlyChartData = useMemo(() => {
    if (!d) return [];
    const byMonth: Record<string, number> = {};
    for (const r of d.progress) {
      const ym = r.record_date.slice(0, 7);
      byMonth[ym] = (byMonth[ym] ?? 0) + Number(r.amount ?? 0);
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, pages]) => ({ month: monthLabel(ym), pages, juz: pagesToJuz(pages) }));
  }, [d]);

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
        brandSubtitle="ملف الطالبة"
        logoUrl={tenant.logo_url}
        nav={visibleTenantNav(tenant.slug, hasFeature)}
        title="ملف الطالبة"
        crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "ملف الطالبة" }]}
      >
        <FeatureLockedState tenantSlug={tenant.slug} />
      </AppShell>
    );
  }

  if (dataQuery.isLoading) return <LoadingBlock />;

  if (!d?.student) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <EmptyState
          title="الطالبة غير موجودة"
          description="ربما حُذفت أو لا تملكين صلاحية الاطّلاع عليها."
          action={
            <Button asChild>
              <Link to="/app/$slug/students" params={{ slug: tenant.slug }}>
                العودة لقائمة الطالبات
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const student = d.student;
  const totalPagesAllTime = d.progress.reduce((a, r) => a + Number(r.amount ?? 0), 0);
  const thisMonthPrefix = new Date().toISOString().slice(0, 7);
  const totalPagesThisMonth = d.progress
    .filter((r) => r.record_date.startsWith(thisMonthPrefix))
    .reduce((a, r) => a + Number(r.amount ?? 0), 0);
  const recent = d.progress.slice(0, 10);

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="ملف الطالبة"
      logoUrl={tenant.logo_url}
      nav={visibleTenantNav(tenant.slug, hasFeature)}
      title={student.full_name}
      crumbs={[
        { label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } },
        { label: "الطالبات", to: "/app/$slug/students", params: { slug: tenant.slug } },
        { label: student.full_name },
      ]}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/app/$slug/students" params={{ slug: tenant.slug }}>
            <ArrowRight className="size-4" />
            العودة للطالبات
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
        <section className="surface-panel grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">وليّ الأمر</p>
            <p className="font-medium">{student.guardian_name || "—"}</p>
            {student.guardian_phone ? (
              <p className="text-xs text-muted-foreground" dir="ltr">
                {student.guardian_phone}
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">الحلقة</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {d.enrollments.length ? (
                d.enrollments.map((e) => (
                  <span key={e.circle_id} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {e.circles?.name ?? "—"}
                    {e.circles?.tracks?.name ? ` — ${e.circles.tracks.name}` : ""}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">لم تُسجَّل في أي حلقة بعد</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">الحالة</p>
            <p className="font-medium">{student.status === "active" ? "نشطة" : "مؤرشفة"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">ملاحظات</p>
            <p className="text-sm">{student.notes || "—"}</p>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="إجمالي الأوجه (كل الفترات)" value={totalPagesAllTime} icon={<BookOpenText className="size-5" />} />
          <StatCard label="أوجه هذا الشهر" value={totalPagesThisMonth} tone="success" icon={<Target className="size-5" />} />
        </div>

        <section className="surface-panel p-5">
          <h2 className="mb-4 font-semibold">التقدم الشهري</h2>
          {monthlyChartData.length === 0 ? (
            <EmptyState
              title="لا يوجد تقدم مسجَّل بعد"
              description="سيظهر هنا مخطط شهري بالأوجه والأجزاء بمجرد تسجيل تقدمها."
            />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={monthlyChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis yAxisId="pages" fontSize={12} allowDecimals={false} />
                <YAxis yAxisId="juz" orientation="right" fontSize={12} />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === "pages" ? [`${value} وجه`, "الأوجه"] : [`${value} جزء`, "الأجزاء (تقريبي)"]
                  }
                />
                <Legend formatter={(v) => (v === "pages" ? "الأوجه" : "الأجزاء (تقريبي)")} />
                <Bar yAxisId="pages" dataKey="pages" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                <Line yAxisId="juz" type="monotone" dataKey="juz" stroke="hsl(var(--primary))" strokeWidth={2} dot />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="surface-panel overflow-x-auto">
          <header className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">آخر السجلات</h2>
          </header>
          {recent.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">لا توجد سجلات بعد.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">المنهج</TableHead>
                  <TableHead className="text-right">النطاق</TableHead>
                  <TableHead className="text-right">الأوجه</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((r, i) => (
                  <TableRow key={`${r.record_date}-${i}`}>
                    <TableCell className="whitespace-nowrap tabular-nums">{r.record_date}</TableCell>
                    <TableCell>{trackCategoryLabel(r.category)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{rangeText(r)}</TableCell>
                    <TableCell className="tabular-nums">{r.amount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </AppShell>
  );
}
