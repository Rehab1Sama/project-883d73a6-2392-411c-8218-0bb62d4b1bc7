import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarCheck,
  CalendarX,
  Clock,
  GraduationCap,
  Repeat2,
  Sparkles,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LoadingBlock, EmptyState, StatCard } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/_authenticated/student/$slug")({
  head: () => ({
    meta: [
      { title: "صفحتي — بوابة الطالبة" },
      {
        name: "description",
        content: "صفحة الطالبة: حلقتك ومعلمتك وحضورك وغيابك وسجلات الحفظ والمراجعة ومستوى تقدّمك.",
      },
      { property: "og:title", content: "صفحتي — بوابة الطالبة" },
      {
        property: "og:description",
        content: "متابعة الحضور والغياب وسجلات الحفظ والمراجعة ومستوى التقدّم في مكان واحد.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentPortalPage,
});

type PortalData = {
  found: boolean;
  reason?: string;
  tenant?: { id: string; name: string; slug: string; logo_url: string | null };
  student?: { id: string; full_name: string; status: string | null; age: number | null; country: string | null };
  circle?: { id: string; name: string; schedule: string | null; teacher_name: string | null; supervisor_name: string | null } | null;
  track?: { id: string; name: string; category: string | null } | null;
  attendance?: { present: number; absent: number; excused: number; late?: number; total: number };
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
  hifz_new: "حفظ جديد",
  revision: "مراجعة",
  murajaa: "مراجعة",
  recitation: "تلاوة",
  tajweed: "تجويد",
  other: "أخرى",
};

const catLabel = (c: string) => CATEGORY_LABELS[c] ?? c;

const isRevision = (c: string) => /revision|murajaa|مراجعة/i.test(c);

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
            title={data?.reason === "not_linked" ? "لم يتم ربط حسابك بسجلك بعد" : "لا توجد بيانات لعرضها"}
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

  const att = data.attendance ?? { present: 0, absent: 0, excused: 0, late: 0, total: 0 };
  const rate = att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;
  const monthly = data.progress_monthly ?? [];
  const maxMonth = Math.max(1, ...monthly.map((m) => Number(m.total) || 0));
  const byCat = data.progress_by_category ?? [];
  const memTotal = byCat.filter((c) => !isRevision(c.category)).reduce((s, c) => s + Number(c.total || 0), 0);
  const revTotal = byCat.filter((c) => isRevision(c.category)).reduce((s, c) => s + Number(c.total || 0), 0);
  const studentName = data.student?.full_name ?? profile?.full_name ?? "الطالبة";
  const recent = data.progress_recent ?? [];

  return (
    <AppShell
      brandName={data.tenant?.name ?? "مقرأتي"}
      brandSubtitle="بوابة الطالبة"
      logoUrl={data.tenant?.logo_url ?? null}
      nav={[]}
      minimal
      title="صفحتي"
      description={`مرحبًا ${studentName} — هذه صفحتك الكاملة: حلقتك، حضورك، وسجلات حفظك ومراجعتك.`}
    >
      <div className="space-y-6">
        {/* بطاقة التعريف */}
        <section className="surface-panel grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <IdentityRow label="الاسم" value={studentName} icon={<UserRound className="size-5" />} />
          <IdentityRow
            label="الحلقة"
            value={data.circle?.name ?? "لم تُسجّل في حلقة بعد"}
            icon={<BookOpen className="size-5" />}
          />
          <IdentityRow label="المعلمة" value={data.circle?.teacher_name ?? "—"} icon={<GraduationCap className="size-5" />} />
          <IdentityRow label="المشرفة" value={data.circle?.supervisor_name ?? "—"} icon={<UserRound className="size-5" />} />
          <IdentityRow label="المسار" value={data.track?.name ?? "—"} icon={<Sparkles className="size-5" />} />
          <IdentityRow label="موعد الحلقة" value={data.circle?.schedule ?? "—"} icon={<Clock className="size-5" />} />
          <IdentityRow label="العمر" value={data.student?.age ? `${data.student.age} سنة` : "—"} icon={<UserRound className="size-5" />} />
          <IdentityRow label="البلد" value={data.student?.country ?? "—"} icon={<UserRound className="size-5" />} />
        </section>

        {/* الإحصائيات */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="نسبة الحضور"
            value={`${rate}%`}
            tone="success"
            icon={<CalendarCheck className="size-5" />}
            hint={`${att.total} لقاء مسجّل`}
          />
          <StatCard label="أيام الحضور" value={att.present} icon={<CalendarCheck className="size-5" />} />
          <StatCard
            label="أيام الغياب"
            value={att.absent}
            tone="warning"
            icon={<CalendarX className="size-5" />}
            hint={`${att.excused} بعذر`}
          />
          <StatCard
            label="إجمالي الإنجاز"
            value={Number(data.progress_total ?? 0)}
            tone="gold"
            icon={<Sparkles className="size-5" />}
            hint="مجموع الوحدات المسجّلة"
          />
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <StatCard label="إجمالي الحفظ" value={memTotal} icon={<BookOpen className="size-5" />} />
          <StatCard label="إجمالي المراجعة" value={revTotal} icon={<Repeat2 className="size-5" />} />
        </section>

        {/* التقدّم حسب النوع + الرسم الشهري */}
        <div className="grid gap-6 lg:grid-cols-2">
          {byCat.length > 0 ? (
            <section className="surface-panel p-5">
              <h2 className="mb-4 font-display text-lg font-semibold">التقدّم حسب النوع</h2>
              <ul className="space-y-3">
                {byCat.map((c) => {
                  const total = Number(c.total) || 0;
                  const max = Math.max(1, ...byCat.map((x) => Number(x.total) || 0));
                  return (
                    <li key={c.category}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{catLabel(c.category)}</span>
                        <span className="font-semibold tabular-nums">{total}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(total / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {monthly.length > 0 ? (
            <section className="surface-panel p-5">
              <h2 className="mb-4 font-display text-lg font-semibold">مستوى التقدّم آخر ٦ أشهر</h2>
              <div className="flex items-end gap-3">
                {monthly.map((m) => (
                  <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-[11px] font-medium tabular-nums">{Number(m.total) || 0}</span>
                    <div className="flex h-28 w-full items-end">
                      <div
                        className="w-full rounded-t-lg bg-primary/80"
                        style={{ height: `${Math.max(6, ((Number(m.total) || 0) / maxMonth) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{m.month}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {/* سجلات الحفظ والمراجعة */}
        <section className="surface-panel overflow-hidden">
          <h2 className="border-b border-border px-5 py-4 font-display text-lg font-semibold">
            سجلات الحفظ والمراجعة
          </h2>
          {recent.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">لا توجد سجلات بعد.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2.5 text-start font-medium">التاريخ</th>
                    <th className="px-5 py-2.5 text-start font-medium">النوع</th>
                    <th className="px-5 py-2.5 text-start font-medium">المقدار</th>
                    <th className="px-5 py-2.5 text-start font-medium">من — إلى</th>
                    <th className="px-5 py-2.5 text-start font-medium">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recent.map((p, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-muted-foreground">{p.record_date}</td>
                      <td className="px-5 py-3 font-medium">{catLabel(p.category)}</td>
                      <td className="px-5 py-3 tabular-nums font-semibold">{Number(p.amount) || 0}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {p.from_surah
                          ? `${p.from_surah} ${p.from_ayah ?? ""} — ${p.to_surah ?? ""} ${p.to_ayah ?? ""}`
                          : "—"}
                      </td>
                      <td className="max-w-[16rem] truncate px-5 py-3 text-muted-foreground">{p.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* سجل الحضور والغياب */}
        <section className="surface-panel overflow-hidden">
          <h2 className="border-b border-border px-5 py-4 font-display text-lg font-semibold">
            سجل الحضور والغياب
          </h2>
          {(data.attendance_recent?.length ?? 0) === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">لا توجد سجلات بعد.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.attendance_recent!.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="tabular-nums text-muted-foreground">{a.record_date}</span>
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
    </AppShell>
  );
}

function IdentityRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
    </div>
  );
}
