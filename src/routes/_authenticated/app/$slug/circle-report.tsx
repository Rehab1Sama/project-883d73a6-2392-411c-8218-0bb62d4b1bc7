import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, BookOpenText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { visibleTenantNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState } from "@/components/ui-blocks";
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
import { useTenantContext } from "@/hooks/useTenantContext";
import { useTenantTheme } from "@/hooks/useTenantTheme";

export const Route = createFileRoute("/_authenticated/app/$slug/circle-report")({
  head: () => ({
    meta: [
      { title: "أنصبة وغيابات الحلقة — سُحُب" },
      {
        name: "description",
        content: "تقرير أنصبة كل حلقة مرتبطًا بمسارها مع الغيابات وحالات الإجازة خلال أي فترة.",
      },
      { property: "og:title", content: "أنصبة وغيابات الحلقة — سُحُب" },
      { property: "og:description", content: "متابعة أنصبة الحلقة وغياباتها وإجازات الطالبات على منصة سُحُب." },
    ],
  }),
  component: CircleReportPage,
});

function iso(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function CircleReportPage() {
  const { tenant, canRead, canManage, canRecord, loading, hasFeature, featuresLoading, canViewCircle, isCircleScopedOnly } =
    useTenantContext();
  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [circleId, setCircleId] = useState("");
  const [from, setFrom] = useState(iso(monthStart));
  const [to, setTo] = useState(iso(today));

  const circlesQuery = useQuery({
    queryKey: ["circles", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circles")
        .select("id, name, track_id, teacher_user_id, tracks(name)")
        .eq("tenant_id", tenant!.id)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const visibleCircles = (circlesQuery.data ?? []).filter((c) => canViewCircle(c));

  useEffect(() => {
    if (!circleId && visibleCircles.length) setCircleId(visibleCircles[0]!.id);
  }, [circleId, visibleCircles]);

  const rosterQuery = useQuery({
    queryKey: ["circle-roster", tenant?.id, circleId],
    enabled: canRead && !!tenant?.id && !!circleId,
    queryFn: async () => {
      const { data: links, error: linkErr } = await supabase
        .from("circle_students")
        .select("student_id")
        .eq("circle_id", circleId);
      if (linkErr) throw linkErr;
      const ids = (links ?? []).map((l) => l.student_id);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, status, leave_start, leave_end")
        .in("id", ids)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const progressQuery = useQuery({
    queryKey: ["circle-progress", tenant?.id, circleId, from, to],
    enabled: canRead && !!tenant?.id && !!circleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("progress_records")
        .select("student_id, amount, record_date")
        .eq("tenant_id", tenant!.id)
        .eq("circle_id", circleId)
        .gte("record_date", from)
        .lte("record_date", to);
      if (error) throw error;
      return data ?? [];
    },
  });

  const attendanceQuery = useQuery({
    queryKey: ["circle-attendance", tenant?.id, circleId, from, to],
    enabled: canRead && !!tenant?.id && !!circleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, status, record_date")
        .eq("tenant_id", tenant!.id)
        .eq("circle_id", circleId)
        .gte("record_date", from)
        .lte("record_date", to);
      if (error) throw error;
      return data ?? [];
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

  const selected = visibleCircles.find((c) => c.id === circleId);
  const roster = rosterQuery.data ?? [];

  // الطالبة في إجازة سارية على أي يوم داخل الفترة: لا تُحتسب غيابًا ولا
  // يُتوقّع لها نصاب — يظهر لها وسم "في إجازة" بدل أرقام الغياب.
  function onLeave(s: { status: string; leave_start: string | null; leave_end: string | null }) {
    if (s.status !== "on_leave") return false;
    const start = s.leave_start ?? "0000-00-00";
    const end = s.leave_end ?? "9999-12-31";
    return !(end < from || start > to);
  }

  const pagesByStudent = new Map<string, number>();
  for (const r of progressQuery.data ?? []) {
    pagesByStudent.set(r.student_id, (pagesByStudent.get(r.student_id) ?? 0) + Number(r.amount ?? 0));
  }
  const absentByStudent = new Map<string, number>();
  const presentByStudent = new Map<string, number>();
  for (const a of attendanceQuery.data ?? []) {
    const map = a.status === "absent" ? absentByStudent : presentByStudent;
    map.set(a.student_id, (map.get(a.student_id) ?? 0) + 1);
  }

  const busy = rosterQuery.isLoading || progressQuery.isLoading || attendanceQuery.isLoading;

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="أنصبة وغيابات الحلقة"
      logoUrl={tenant.logo_url}
      nav={visibleTenantNav(tenant.slug, hasFeature, canManage, canRecord, isCircleScopedOnly)}
      title="أنصبة وغيابات الحلقة"
      crumbs={[
        { label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } },
        { label: "أنصبة وغيابات الحلقة" },
      ]}
    >
      <div className="space-y-6">
        <section className="surface-panel grid gap-4 p-6 md:grid-cols-3">
          <div className="grid gap-1.5">
            <Label>الحلقة</Label>
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
            <p className="text-xs text-muted-foreground">
              {selected ? `المسار: ${selected.tracks?.name ?? "—"}` : "لا توجد حلقات متاحة لكِ"}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="from">من تاريخ</Label>
            <Input id="from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="to">إلى تاريخ</Label>
            <Input id="to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
        </section>

        {!selected ? (
          <EmptyState
            icon={<BookOpenText className="size-6" />}
            title="لا توجد حلقة"
            description="أنشئي حلقة واربطيها بمسار من صفحة الحلقات."
          />
        ) : busy ? (
          <LoadingBlock />
        ) : roster.length === 0 ? (
          <EmptyState
            icon={<CalendarRange className="size-6" />}
            title="لا توجد طالبات في هذه الحلقة"
            description="تُضاف الطالبات إلى الحلقة من صفحة الطالبات."
          />
        ) : (
          <section className="surface-panel p-4">
            <div className="overflow-x-auto">
              <Table className="min-w-[34rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الطالبة</TableHead>
                    <TableHead className="text-right">الأوجه المنجزة</TableHead>
                    <TableHead className="text-right">أيام الحضور</TableHead>
                    <TableHead className="text-right">الغياب</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roster.map((s) => {
                    const leave = onLeave(s);
                    return (
                      <TableRow key={s.id} className={leave ? "opacity-70" : ""}>
                        <TableCell className="font-medium">{s.full_name}</TableCell>
                        <TableCell>{leave ? "—" : (pagesByStudent.get(s.id) ?? 0)}</TableCell>
                        <TableCell>{leave ? "—" : (presentByStudent.get(s.id) ?? 0)}</TableCell>
                        <TableCell>
                          {leave ? (
                            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">
                              في إجازة
                            </span>
                          ) : (absentByStudent.get(s.id) ?? 0) > 0 ? (
                            <span className="rounded-full bg-destructive-soft px-2 py-0.5 text-xs text-destructive">
                              {absentByStudent.get(s.id)}
                            </span>
                          ) : (
                            "0"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              الطالبات الموقوفات لا يظهرن هنا، والطالبة في إجازة خلال الفترة لا يُحتسب لها غياب ولا نصاب.
            </p>
          </section>
        )}
      </div>
    </AppShell>
  );
}
