import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, PauseCircle, Users, GraduationCap, BookOpen, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { platformNav } from "@/components/layout/nav";
import { StatCard, LoadingBlock } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { TENANT_STATUS_LABELS } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/platform/")({
  component: PlatformDashboard,
});

async function countOf(table: "tenants" | "profiles", filters?: Record<string, string>) {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [k, v] of Object.entries(filters ?? {})) q = q.eq(k, v);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

function PlatformDashboard() {
  const { isPlatformOwner, loading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["platform-stats"],
    enabled: isPlatformOwner,
    queryFn: async () => {
      const [total, active, suspended, users, students, teachers, subs, recent] = await Promise.all([
        countOf("tenants"),
        countOf("tenants", { status: "active" }),
        countOf("tenants", { status: "suspended" }),
        countOf("profiles"),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "teacher"),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).in("status", ["active", "trialing"]),
        supabase
          .from("tenants")
          .select("id, name, slug, status, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      return {
        total,
        active,
        suspended,
        users,
        students: students.count ?? 0,
        teachers: teachers.count ?? 0,
        subs: subs.count ?? 0,
        recent: recent.data ?? [],
      };
    },
  });

  if (loading) return <LoadingBlock />;

  if (!isPlatformOwner) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5 text-center">
        <div>
          <h1 className="text-xl font-semibold">لا تملكين صلاحية الوصول</h1>
          <p className="mt-2 text-sm text-muted-foreground">هذه اللوحة مخصصة لإدارة المنصة.</p>
          <Button asChild className="mt-4">
            <Link to="/dashboard">العودة للوحتي</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      brandName="سُحُب"
      brandSubtitle="إدارة المنصة"
      nav={platformNav}
      title="لوحة المنصة"
      crumbs={[{ label: "سُحُب" }, { label: "لوحة المنصة" }]}
      actions={
        <Button asChild size="sm">
          <Link to="/platform/tenants">إدارة المقارئ</Link>
        </Button>
      }
    >
      {isLoading ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <section className="surface-panel gradient-sky p-6">
            <h2 className="font-display text-xl font-bold">لوحة إدارة منصة سُحُب</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              نظرة شاملة على المقارئ والاشتراكات والمستخدمات، مع وصول سريع لطلبات الانضمام والفوترة.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <Link to="/platform/requests" className="rounded-full bg-card px-3 py-1 transition-colors hover:text-primary">
                طلبات المقارئ
              </Link>
              <Link to="/platform/plans" className="rounded-full bg-card px-3 py-1 transition-colors hover:text-primary">
                الباقات
              </Link>
              <Link to="/platform/billing" className="rounded-full bg-card px-3 py-1 transition-colors hover:text-primary">
                الفوترة
              </Link>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="المقارئ المشتركة" value={data?.total ?? 0} icon={<Building2 className="size-5" />} />
            <StatCard label="المقارئ النشطة" value={data?.active ?? 0} tone="success" icon={<CheckCircle2 className="size-5" />} />
            <StatCard label="المقارئ الموقوفة" value={data?.suspended ?? 0} tone="warning" icon={<PauseCircle className="size-5" />} />
            <StatCard label="الاشتراكات الفعّالة" value={data?.subs ?? 0} tone="gold" icon={<CreditCard className="size-5" />} />
          </div>


          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="إجمالي المستخدمات" value={data?.users ?? 0} icon={<Users className="size-5" />} />
            <StatCard label="الطالبات" value={data?.students ?? 0} icon={<GraduationCap className="size-5" />} />
            <StatCard label="المعلمات" value={data?.teachers ?? 0} icon={<BookOpen className="size-5" />} />
          </div>

          <section className="surface-panel overflow-hidden">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold">أحدث المقارئ</h2>
              <Link to="/platform/tenants" className="text-sm text-primary hover:underline">
                عرض الكل
              </Link>
            </header>
            {data?.recent.length ? (
              <ul className="divide-y divide-border">
                {data.recent.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.name}</p>
                      <p className="truncate text-xs text-muted-foreground" dir="ltr">
                        /m/{t.slug}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs">
                      {TENANT_STATUS_LABELS[t.status] ?? t.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">لا توجد مقارئ بعد.</p>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
