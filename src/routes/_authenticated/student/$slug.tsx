import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarCheck, CalendarX, GraduationCap, Sparkles, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LoadingBlock, EmptyState, StatCard } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { TenantLogo } from "@/components/TenantLogo";

export const Route = createFileRoute("/_authenticated/student/$slug")({
  component: StudentPortalPage,
});

type PortalData = {
  found: boolean;
  reason?: string;
  tenant?: { id: string; name: string; slug: string; logo_url: string | null };
  student?: { id: string; full_name: string; status: string | null; age: number | null; country: string | null };
  circle?: { id: string; name: string; schedule: string | null; teacher_name: string | null; supervisor_name: string | null } | null;
  track?: { id: string; name: string; category: string | null } | null;
  attendance?: { present: number; absent: number; excused: number; total: number };
  attendance_recent?: { record_date: string; status: string; notes: string | null }[];
  progress_by_category?: { category: string; total: number }[];
  progress_recent?: {
    record_date: string;
    amount: number;
    category: string;
    from_surah: string | null;
    from_ayah: number | null;
    to_surah: string | null;
    to_ayah: number | null;
    notes: string | null;
  }[];
  progress_monthly?: { month: string; total: number }[];
  progress_total?: number;
};

const ATTENDANCE_LABELS: Record<string, string> = {
  present: "حاضرة",
  absent: "غائبة",
  excused: "غياب بعذر",
  late: "متأخرة",
};

const CATEGORY_LABELS: Record<string, string> = {
  memorization: "حفظ",
  revision: "مراجعة",
  recitation: "تلاوة",
  tajweed: "تجويد",
  other: "أخرى",
};

function StudentPortalPage() {
  const { slug } = Route.useParams();
  const { profile, signOut } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["student-portal", slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("student_portal" as never, { _slug: slug } as never);
      if (error) throw error;
      return data as unknown as PortalData;
    },
  });

  if (isLoading) return <LoadingBlock />;

  if (error || !data?.found) {
    return (
      <div className="gradient-sky flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-lg">
          <EmptyState
            icon={<BookOpen className="size-6" />}
            title={data?.reason === "not_linked" ? "لم يتم ربط حسابك بصفّك بعد" : "لا توجد بيانات لعرضها"}
            description="تواصلي مع معلمتك أو مديرة المقرأة لربط حسابك بسجلك في المقرأة."
            action={
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link to="/">الرئيسية</Link>
                </Button>
                <Button variant="ghost" onClick={() => void signOut()}>
                  تسجيل الخروج
                </Button>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  const att = data.attendance ?? { present: 0, absent: 0, excused: 0, total: 0 };
  const rate = att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;
  const maxMonth = Math.max(1, ...(data.progress_monthly ?? []).map((m) => Number(m.total) || 0));

  return (
    <div className="gradient-sky min-h-screen px-5 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* ترويسة */}
        <header className="surface-panel flex flex-wrap items-center gap-4 p-5">
          <TenantLogo name={data.tenant?.name ?? ""} logo={data.tenant?.logo_url ?? null} className="size-14" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{data.tenant?.name}</p>
            <h1 className="truncate font-display text-2xl font-bold">
              {data.student?.full_name ?? profile?.full_name ?? "الطالبة"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {data.circle?.name ? `حلقة ${data.circle.name}` : "لم تُسجّل في حلقة بعد"}
              {data.track?.name ? ` • مسار ${data.track.name}` : ""}
            </p>
          </div>
          <Button variant="ghost" onClick={() => void signOut()}>
            تسجيل الخروج
          </Button>
        </header>

        {/* المعلمة والمشرفة */}
        <section className="grid gap-3 sm:grid-cols-3">
          <InfoCard icon={<UserRound className="size-5" />} label="المعلمة" value={data.circle?.teacher_name ?? "—"} />
          <InfoCard icon={<GraduationCap className="size-5" />} label="المشرفة" value={data.circle?.supervisor_name ?? "—"} />
          <InfoCard icon={<CalendarCheck className="size-5" />} label="موعد الحلقة" value={data.circle?.schedule ?? "—"} />
        </section>

        {/* إحصائيات */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="نسبة الحضور" value={`${rate}%`} tone="success" icon={<CalendarCheck className="size-5" />} hint={`${att.total} لقاء مسجّل`} />
          <StatCard label="حضور" value={att.present} icon={<CalendarCheck className="size-5" />} />
          <StatCard label="غياب" value={att.absent} tone="warning" icon={<CalendarX className="size-5" />} hint={`${att.excused} بعذر`} />
          <StatCard label="إجمالي التقدّم" value={Number(data.progress_total ?? 0)} tone="gold" icon={<Sparkles className="size-5" />} hint="مجموع الوحدات المسجّلة" />
        </section>

        {/* التقدّم حسب النوع */}
        {(data.progress_by_category?.length ?? 0) > 0 ? (
          <section className="surface-panel p-5">
            <h2 className="mb-4 font-display text-lg font-semibold">التقدّم حسب النوع</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {data.progress_by_category!.map((c) => (
                <div key={c.category} className="rounded-xl bg-muted/60 p-4">
                  <p className="text-sm text-muted-foreground">{CATEGORY_LABELS[c.category] ?? c.category}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{Number(c.total)}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* مستوى التقدّم الشهري */}
        {(data.progress_monthly?.length ?? 0) > 0 ? (
          <section className="surface-panel p-5">
            <h2 className="mb-4 font-display text-lg font-semibold">مستوى التقدّم آخر ٦ أشهر</h2>
            <div className="flex items-end gap-3">
              {data.progress_monthly!.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-32 w-full items-end">
                    <div
                      className="w-full rounded-t-lg bg-primary/80"
                      style={{ height: `${Math.max(6, (Number(m.total) / maxMonth) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{m.month}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* آخر سجلات التقدّم */}
        <section className="surface-panel p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">آخر سجلات التقدّم</h2>
          {(data.progress_recent?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد سجلات بعد.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.progress_recent!.map((p, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span className="text-muted-foreground tabular-nums">{p.record_date}</span>
                  <span className="font-medium">{CATEGORY_LABELS[p.category] ?? p.category}</span>
                  <span className="text-muted-foreground">
                    {p.from_surah ? `${p.from_surah} ${p.from_ayah ?? ""} — ${p.to_surah ?? ""} ${p.to_ayah ?? ""}` : ""}
                  </span>
                  <span className="font-semibold tabular-nums">{Number(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* سجل الحضور */}
        <section className="surface-panel p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">آخر سجل للحضور والغياب</h2>
          {(data.attendance_recent?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد سجلات بعد.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.attendance_recent!.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="text-muted-foreground tabular-nums">{a.record_date}</span>
                  <span
                    className={
                      a.status === "present"
                        ? "font-medium text-success"
                        : a.status === "absent"
                          ? "font-medium text-warning-foreground"
                          : "font-medium text-muted-foreground"
                    }
                  >
                    {ATTENDANCE_LABELS[a.status] ?? a.status}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-end text-xs text-muted-foreground">{a.notes ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="surface-panel flex items-center gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
    </div>
  );
}
