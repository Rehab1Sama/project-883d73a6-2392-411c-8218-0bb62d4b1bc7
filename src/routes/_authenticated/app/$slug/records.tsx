import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Loader2, BookOpenText, Target } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useTenantContext } from "@/hooks/useTenantContext";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { trackCategoryLabel, TRACK_CATEGORY_KEYS } from "@/lib/track-categories";
import { surahName } from "@/lib/quran";
import {
  exportRecordsExcel,
  progressCsv,
  quotasCsv,
  type RecordExportRow,
  type QuotaExportRow,
} from "@/lib/progress";

export const Route = createFileRoute("/_authenticated/app/$slug/records")({
  head: () => ({
    meta: [
      { title: "سجلات الأنصبة والتقدم — سُحُب" },
      {
        name: "description",
        content: "استعراض كل سجلات الأنصبة والتقدم مع الفلترة حسب المسار والمنهج وتصديرها إلى إكسل أو CSV.",
      },
      { property: "og:title", content: "سجلات الأنصبة والتقدم — سُحُب" },
      { property: "og:description", content: "سجلات مفصلة قابلة للفلترة والتصدير في منصة سُحُب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecordsPage,
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

function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function RecordsPage() {
  const { tenant, canRead, loading, hasFeature, featuresLoading } = useTenantContext();
  const [trackId, setTrackId] = useState("all");
  const [category, setCategory] = useState("all");
  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());
  const [useDates, setUseDates] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  const dataQuery = useQuery({
    queryKey: ["records", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const [{ data: progress, error: pErr }, { data: quotas, error: qErr }, { data: tracks }, { data: students }, { data: circles }] =
        await Promise.all([
          supabase
            .from("progress_records")
            .select(
              "id, record_date, student_id, circle_id, track_id, category, amount, notes, from_surah, from_ayah, to_surah, to_ayah",
            )
            .eq("tenant_id", tenant!.id)
            .order("record_date", { ascending: false }),
          supabase
            .from("quotas")
            .select(
              "id, student_id, track_id, category, period, target_amount, notes, from_surah, from_ayah, to_surah, to_ayah",
            )
            .eq("tenant_id", tenant!.id),
          supabase.from("tracks").select("id, name").eq("tenant_id", tenant!.id).order("sort_order"),
          supabase.from("students").select("id, full_name").eq("tenant_id", tenant!.id),
          supabase.from("circles").select("id, name").eq("tenant_id", tenant!.id),
        ]);
      if (pErr) throw pErr;
      if (qErr) throw qErr;
      return {
        progress: progress ?? [],
        quotas: quotas ?? [],
        tracks: tracks ?? [],
        studentName: new Map((students ?? []).map((s) => [s.id, s.full_name])),
        circleName: new Map((circles ?? []).map((c) => [c.id, c.name])),
        trackName: new Map((tracks ?? []).map((t) => [t.id, t.name])),
      };
    },
  });

  const d = dataQuery.data;

  const progressRows: RecordExportRow[] = useMemo(() => {
    if (!d) return [];
    return d.progress
      .filter((r) => (trackId === "all" ? true : r.track_id === trackId))
      .filter((r) => (category === "all" ? true : r.category === category))
      .filter((r) => (!useDates ? true : r.record_date >= from && r.record_date <= to))
      .map((r) => ({
        date: r.record_date,
        student: d.studentName.get(r.student_id) ?? "—",
        circle: r.circle_id ? (d.circleName.get(r.circle_id) ?? "—") : "—",
        track: d.trackName.get(r.track_id) ?? "—",
        category: trackCategoryLabel(r.category),
        range: rangeText(r),
        amount: Number(r.amount ?? 0),
        notes: r.notes ?? "",
      }));
  }, [d, trackId, category, useDates, from, to]);

  const quotaRows: QuotaExportRow[] = useMemo(() => {
    if (!d) return [];
    return d.quotas
      .filter((q) => (trackId === "all" ? true : q.track_id === trackId))
      .filter((q) => (category === "all" ? true : q.category === category))
      .map((q) => ({
        student: d.studentName.get(q.student_id) ?? "—",
        track: d.trackName.get(q.track_id) ?? "—",
        category: trackCategoryLabel(q.category),
        period: q.period,
        range: rangeText(q),
        target: Number(q.target_amount ?? 0),
        notes: q.notes ?? "",
      }));
  }, [d, trackId, category]);

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

  if (!hasFeature("exports")) {
    return (
      <AppShell
        brandName={tenant.name}
        brandSubtitle="السجلات والتصدير"
        logoUrl={tenant.logo_url}
        nav={visibleTenantNav(tenant.slug, hasFeature)}
        title="السجلات والتصدير"
        crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "السجلات والتصدير" }]}
      >
        <FeatureLockedState tenantSlug={tenant.slug} />
      </AppShell>
    );
  }

  const filterLabel = [
    trackId === "all" ? "كل المسارات" : (d?.trackName.get(trackId) ?? "مسار"),
    category === "all" ? "كل المناهج" : trackCategoryLabel(category),
    useDates ? `${from} → ${to}` : "كل الفترات",
  ].join(" · ");

  async function runExcel() {
    if (!tenant) return;
    setBusy("excel");
    try {
      await exportRecordsExcel({
        madrasa: tenant.name,
        filterLabel,
        progress: progressRows,
        quotas: quotaRows,
      });
    } finally {
      setBusy(null);
    }
  }

  const totalOruj = progressRows.reduce((a, r) => a + r.amount, 0);

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="السجلات"
      logoUrl={tenant.logo_url}
      nav={visibleTenantNav(tenant.slug, hasFeature)}
      title="سجلات الأنصبة والتقدم"
      description="كل السجلات المحفوظة مع الفلترة حسب المسار والمنهج والفترة، وتصديرها إلى إكسل أو CSV."
      crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "السجلات" }]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void runExcel()} disabled={busy === "excel"}>
            {busy === "excel" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
            تحميل إكسل
          </Button>
          <Button size="sm" variant="outline" onClick={() => progressCsv(tenant.name, progressRows)}>
            <Download className="size-4" />
            CSV التقدم
          </Button>
          <Button size="sm" variant="outline" onClick={() => quotasCsv(tenant.name, quotaRows)}>
            <Download className="size-4" />
            CSV الأنصبة
          </Button>
        </div>
      }
    >
      <div className="surface-panel mb-5 grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label>المسار</Label>
          <Select value={trackId} onValueChange={setTrackId}>
            <SelectTrigger>
              <SelectValue placeholder="كل المسارات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المسارات</SelectItem>
              {(d?.tracks ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>المنهج</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="كل المناهج" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المناهج</SelectItem>
              {TRACK_CATEGORY_KEYS.map((k) => (
                <SelectItem key={k} value={k}>
                  {trackCategoryLabel(k)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rec-from">من تاريخ</Label>
          <Input
            id="rec-from"
            type="date"
            value={from}
            max={to}
            onChange={(e) => {
              setFrom(e.target.value);
              setUseDates(true);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rec-to">إلى تاريخ</Label>
          <div className="flex gap-2">
            <Input
              id="rec-to"
              type="date"
              value={to}
              min={from}
              onChange={(e) => {
                setTo(e.target.value);
                setUseDates(true);
              }}
            />
            {useDates ? (
              <Button variant="ghost" size="sm" onClick={() => setUseDates(false)}>
                كل الفترات
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {dataQuery.isLoading ? (
        <LoadingBlock />
      ) : (
        <Tabs defaultValue="progress" className="space-y-4">
          <TabsList>
            <TabsTrigger value="progress">
              <BookOpenText className="size-4" /> التقدم ({progressRows.length})
            </TabsTrigger>
            <TabsTrigger value="quotas">
              <Target className="size-4" /> الأنصبة ({quotaRows.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="progress">
            {progressRows.length === 0 ? (
              <EmptyState title="لا توجد سجلات تقدم" description="جرّبي تغيير الفلاتر أو سجّلي تقدمًا من صفحة الأنصبة والتقدم." />
            ) : (
              <div className="surface-panel overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الطالبة</TableHead>
                      <TableHead className="text-right">الحلقة</TableHead>
                      <TableHead className="text-right">المسار</TableHead>
                      <TableHead className="text-right">المنهج</TableHead>
                      <TableHead className="text-right">النطاق</TableHead>
                      <TableHead className="text-right">الأوجه</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {progressRows.map((r, i) => (
                      <TableRow key={`${r.date}-${r.student}-${i}`}>
                        <TableCell className="whitespace-nowrap tabular-nums">{r.date}</TableCell>
                        <TableCell>{r.student}</TableCell>
                        <TableCell>{r.circle}</TableCell>
                        <TableCell>{r.track}</TableCell>
                        <TableCell>{r.category}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{r.range}</TableCell>
                        <TableCell className="tabular-nums">{r.amount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                  الإجمالي: <span className="font-medium text-foreground tabular-nums">{totalOruj}</span> وجه
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="quotas">
            {quotaRows.length === 0 ? (
              <EmptyState title="لا توجد أنصبة" description="جرّبي تغيير الفلاتر أو حدّدي أنصبة من صفحة الأنصبة والتقدم." />
            ) : (
              <div className="surface-panel overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الطالبة</TableHead>
                      <TableHead className="text-right">المسار</TableHead>
                      <TableHead className="text-right">المنهج</TableHead>
                      <TableHead className="text-right">الفترة</TableHead>
                      <TableHead className="text-right">النطاق</TableHead>
                      <TableHead className="text-right">النصاب</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotaRows.map((q, i) => (
                      <TableRow key={`${q.student}-${q.track}-${i}`}>
                        <TableCell>{q.student}</TableCell>
                        <TableCell>{q.track}</TableCell>
                        <TableCell>{q.category}</TableCell>
                        <TableCell>{q.period}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{q.range}</TableCell>
                        <TableCell className="tabular-nums">{q.target}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}
