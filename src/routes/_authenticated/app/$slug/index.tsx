import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, CircleDot, Layers, Heart, CalendarCheck, BookMarked } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { visibleTenantNav } from "@/components/layout/nav";
import { StatCard, LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { ROLE_LABELS, SUBSCRIPTION_STATUS_LABELS } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/app/$slug/")({
  component: TenantDashboard,
});

function TenantDashboard() {
  const { slug } = useParams({ from: "/_authenticated/app/$slug/" });
  const { roles, isPlatformOwner, loading } = useAuth();

  const tenantQuery = useQuery({
    queryKey: ["tenant", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select(
          "id, name, slug, logo_url, primary_color, accent_color, short_description, status, subscriptions(status, expires_at, plans(name_ar, max_students, max_circles))",
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const tenant = tenantQuery.data;
  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);
  const featuresQuery = useTenantFeatures(tenant?.id);
  function hasFeature(key: string): boolean {
    if (isPlatformOwner) return true;
    return featuresQuery.data?.[key] ?? false;
  }

  const statsQuery = useQuery({
    queryKey: ["tenant-stats", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const count = async (q: ReturnType<typeof supabase.from>) => {
        const { count, error } = await q;
        if (error) throw error;
        return count ?? 0;
      };
      const [tracks, circles, students, volunteers] = await Promise.all([
        count(
          supabase.from("tracks").select("id", { count: "exact", head: true }).eq("tenant_id", tenant!.id).eq("status", "active"),
        ),
        count(
          supabase.from("circles").select("id", { count: "exact", head: true }).eq("tenant_id", tenant!.id).eq("status", "active"),
        ),
        count(
          supabase.from("students").select("id", { count: "exact", head: true }).eq("tenant_id", tenant!.id).eq("status", "active"),
        ),
        count(
          supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("tenant_id", tenant!.id).eq("is_volunteer", true),
        ),
      ]);
      return { tracks, circles, students, volunteers };
    },
  });

  if (loading || tenantQuery.isLoading) return <LoadingBlock />;

  const myRoles = tenant ? roles.filter((r) => r.tenant_id === tenant.id).map((r) => r.role) : [];
  const canView = isPlatformOwner || myRoles.length > 0;

  if (!tenant || !canView) {
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

  const sub = tenant.subscriptions?.[0];
  const plan = sub?.plans;

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle={myRoles.length ? ROLE_LABELS[myRoles[0]!] : "مالكة المنصة"}
      logoUrl={tenant.logo_url}
      nav={visibleTenantNav(slug, hasFeature)}
      title="لوحة المقرأة"
      crumbs={[{ label: tenant.name }, { label: "لوحة المقرأة" }]}
    >
      <div className="space-y-6">
        <section className="surface-panel gradient-sky p-6">
          <h2 className="font-display text-xl font-bold">{tenant.name}</h2>
          {tenant.short_description ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{tenant.short_description}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-card px-3 py-1">
              الباقة: {plan?.name_ar ?? "غير محددة"}
            </span>
            <span className="rounded-full bg-card px-3 py-1">
              الاشتراك: {sub ? (SUBSCRIPTION_STATUS_LABELS[sub.status] ?? sub.status) : "—"}
            </span>
            <span className="rounded-full bg-card px-3 py-1" dir="ltr">
              /m/{tenant.slug}
            </span>
          </div>
        </section>

        {statsQuery.isLoading ? (
          <LoadingBlock />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="المسارات"
              value={statsQuery.data?.tracks ?? 0}
              {...(plan?.max_circles ? { hint: `الحد الأعلى للحلقات ${plan.max_circles}` } : {})}
              icon={<Layers className="size-5" />}
            />
            <StatCard label="الحلقات" value={statsQuery.data?.circles ?? 0} tone="success" icon={<CircleDot className="size-5" />} />
            <StatCard label="الطالبات" value={statsQuery.data?.students ?? 0} tone="gold" icon={<GraduationCap className="size-5" />} />
            <StatCard label="المتطوعات" value={statsQuery.data?.volunteers ?? 0} icon={<Heart className="size-5" />} />
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <Link
            to="/app/$slug/progress"
            params={{ slug }}
            className="surface-panel group flex items-start justify-between gap-4 p-6 transition-colors hover:border-primary/50"
          >
            <div>
              <h3 className="font-display text-lg font-bold">الأنصبة والتقدم</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                حدّدي النصاب المستهدف لكل طالبة وسجّلي إنجازها اليومي من الحفظ والمراجعة والتلاوة.
              </p>
            </div>
            <BookMarked className="size-6 shrink-0 text-primary transition-transform group-hover:scale-110" />
          </Link>
          <Link
            to="/app/$slug/reports"
            params={{ slug }}
            className="surface-panel group flex items-start justify-between gap-4 p-6 transition-colors hover:border-primary/50"
          >
            <div>
              <h3 className="font-display text-lg font-bold">التقارير والإحصائيات</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                تابع أوجه الحفظ والغياب لكل مسار وللمقرأة، وصدّري التقارير إلى إكسل.
              </p>
            </div>
            <CalendarCheck className="size-6 shrink-0 text-primary transition-transform group-hover:scale-110" />
          </Link>
          <Link
            to="/app/$slug/volunteers"
            params={{ slug }}
            className="surface-panel group flex items-start justify-between gap-4 p-6 transition-colors hover:border-primary/50"
          >
            <div>
              <h3 className="font-display text-lg font-bold">المتطوعات وطلبات التسجيل</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                اعتمدي تسجيل المعلمات والمشرفات ومسؤولات المسارات، أو استوردي قائمتهن من ملف إكسل.
              </p>
            </div>
            <Heart className="size-6 shrink-0 text-primary transition-transform group-hover:scale-110" />
          </Link>
        </div>

      </div>
    </AppShell>
  );
}
