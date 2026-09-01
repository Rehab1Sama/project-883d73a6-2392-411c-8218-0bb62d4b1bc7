import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, Download, ExternalLink, Loader2, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { platformNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { TENANT_STATUS_LABELS } from "@/lib/roles";
import { exportTenantComparisonExcel, type TenantCompareRow } from "@/lib/progress";

export const Route = createFileRoute("/_authenticated/platform/compare")({
  head: () => ({
    meta: [
      { title: "مقارنة المقارئ — سُحُب" },
      { name: "description", content: "مقارنة نشاط المقارئ المشتركة في المنصة: الطالبات والحلقات والتقدم." },
    ],
  }),
  component: ComparePage,
});

function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

type SortKey = "name" | "students" | "circles" | "teachers" | "volunteers" | "pages30d";

function ComparePage() {
  const { isPlatformOwner, loading } = useAuth();
  const [term, setTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("students");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [busy, setBusy] = useState(false);

  const compareQuery = useQuery({
    queryKey: ["platform-compare"],
    enabled: isPlatformOwner,
    queryFn: async () => {
      const since = daysAgoISO(30);
      const [
        { data: tenants, error: tErr },
        { data: students, error: sErr },
        { data: circles, error: cErr },
        { data: roles, error: rErr },
        { data: progress, error: pErr },
      ] = await Promise.all([
        supabase
          .from("tenants")
          .select("id, name, slug, status, subscriptions(status, plans(name_ar))")
          .order("name"),
        supabase.from("students").select("tenant_id").eq("status", "active"),
        supabase.from("circles").select("tenant_id").eq("status", "active"),
        supabase.from("user_roles").select("tenant_id, role, is_volunteer"),
        supabase.from("progress_records").select("tenant_id, amount").gte("record_date", since),
      ]);
      if (tErr) throw tErr;
      if (sErr) throw sErr;
      if (cErr) throw cErr;
      if (rErr) throw rErr;
      if (pErr) throw pErr;

      const countBy = (rows: { tenant_id: string | null }[] | null) => {
        const m: Record<string, number> = {};
        for (const r of rows ?? []) if (r.tenant_id) m[r.tenant_id] = (m[r.tenant_id] ?? 0) + 1;
        return m;
      };

      const studentsByTenant = countBy(students);
      const circlesByTenant = countBy(circles);
      const teachersByTenant = countBy((roles ?? []).filter((r) => r.role === "teacher"));
      const volunteersByTenant = countBy((roles ?? []).filter((r) => r.is_volunteer));
      const pagesByTenant: Record<string, number> = {};
      for (const r of progress ?? []) {
        if (!r.tenant_id) continue;
        pagesByTenant[r.tenant_id] = (pagesByTenant[r.tenant_id] ?? 0) + Number(r.amount ?? 0);
      }

      const rows: TenantCompareRow[] = (tenants ?? []).map((t) => ({
        name: t.name,
        slug: t.slug,
        status: TENANT_STATUS_LABELS[t.status] ?? t.status,
        plan: t.subscriptions?.[0]?.plans?.name_ar ?? "—",
        students: studentsByTenant[t.id] ?? 0,
        circles: circlesByTenant[t.id] ?? 0,
        teachers: teachersByTenant[t.id] ?? 0,
        volunteers: volunteersByTenant[t.id] ?? 0,
        pages30d: pagesByTenant[t.id] ?? 0,
      }));
      return rows;
    },
  });

  const rows = compareQuery.data ?? [];

  const sortedRows = useMemo(() => {
    const filtered = rows.filter((r) => !term || r.name.includes(term) || r.slug.includes(term.toLowerCase()));
    const sorted = filtered.slice().sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "string" ? av.localeCompare(bv as string, "ar") : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, term, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  async function runExcel() {
    setBusy(true);
    try {
      await exportTenantComparisonExcel({ rows: sortedRows });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;

  if (!isPlatformOwner) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5 text-center">
        <div>
          <h1 className="text-xl font-semibold">لا تملكين صلاحية الوصول</h1>
          <p className="mt-2 text-sm text-muted-foreground">هذه الصفحة مخصصة لمالكة المنصة.</p>
          <Button asChild className="mt-4">
            <Link to="/dashboard">العودة للوحتي</Link>
          </Button>
        </div>
      </div>
    );
  }

  const totalPages = sortedRows.reduce((a, r) => a + r.pages30d, 0);

  return (
    <AppShell
      brandName="سُحُب"
      brandSubtitle="إدارة المنصة"
      nav={platformNav}
      title="مقارنة المقارئ"
      description="مقارنة نشاط المقارئ المشتركة: عدد الطالبات والحلقات والمعلمات والمتطوعات، وإجمالي الأوجه المُنجزة خلال ٣٠ يومًا."
      crumbs={[{ label: "سُحُب", to: "/platform" }, { label: "مقارنة المقارئ" }]}
      actions={
        <Button size="sm" onClick={() => void runExcel()} disabled={busy || sortedRows.length === 0}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          تصدير إكسل
        </Button>
      }
    >
      <div className="mb-4">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="ابحثي باسم المقرأة أو الرابط"
          className="max-w-sm"
        />
      </div>

      {compareQuery.isLoading ? (
        <LoadingBlock />
      ) : sortedRows.length === 0 ? (
        <EmptyState
          icon={<Scale className="size-6" />}
          title="لا توجد بيانات للمقارنة"
          description="أضيفي مقارئ من صفحة «المقارئ» أولاً."
        />
      ) : (
        <div className="surface-panel overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="المقرأة" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
                <TableHead className="text-right">الرابط</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">الباقة</TableHead>
                <SortableHead
                  label="الطالبات"
                  active={sortKey === "students"}
                  dir={sortDir}
                  onClick={() => toggleSort("students")}
                />
                <SortableHead
                  label="الحلقات"
                  active={sortKey === "circles"}
                  dir={sortDir}
                  onClick={() => toggleSort("circles")}
                />
                <SortableHead
                  label="المعلمات"
                  active={sortKey === "teachers"}
                  dir={sortDir}
                  onClick={() => toggleSort("teachers")}
                />
                <SortableHead
                  label="المتطوعات"
                  active={sortKey === "volunteers"}
                  dir={sortDir}
                  onClick={() => toggleSort("volunteers")}
                />
                <SortableHead
                  label="الأوجه (٣٠ يوم)"
                  active={sortKey === "pages30d"}
                  dir={sortDir}
                  onClick={() => toggleSort("pages30d")}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((r) => (
                <TableRow key={r.slug}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <Link
                      to="/m/$slug"
                      params={{ slug: r.slug }}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                      dir="ltr"
                    >
                      /m/{r.slug}
                      <ExternalLink className="size-3" />
                    </Link>
                  </TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell>{r.plan}</TableCell>
                  <TableCell className="tabular-nums">{r.students}</TableCell>
                  <TableCell className="tabular-nums">{r.circles}</TableCell>
                  <TableCell className="tabular-nums">{r.teachers}</TableCell>
                  <TableCell className="tabular-nums">{r.volunteers}</TableCell>
                  <TableCell className="tabular-nums">{r.pages30d}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
            إجمالي الأوجه خلال ٣٠ يومًا عبر كل المقارئ:{" "}
            <span className="font-medium text-foreground tabular-nums">{totalPages}</span>
          </p>
        </div>
      )}
    </AppShell>
  );
}

function SortableHead({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <TableHead className="text-right">
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-primary ${active ? "text-primary" : ""}`}
      >
        {label}
        <ArrowUpDown className="size-3" />
        {active ? <span className="sr-only">{dir === "asc" ? "تصاعدي" : "تنازلي"}</span> : null}
      </button>
    </TableHead>
  );
}
