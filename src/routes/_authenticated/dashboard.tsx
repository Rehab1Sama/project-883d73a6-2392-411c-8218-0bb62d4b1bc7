import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/roles";
import { TenantLogo } from "@/components/TenantLogo";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardRouter,
});

/** يوجّه كل مستخدمة إلى مساحتها حسب دورها */
function DashboardRouter() {
  const { roles, isPlatformOwner, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const tenantIds = [...new Set(roles.filter((r) => r.tenant_id).map((r) => r.tenant_id!))];

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["my-tenants", tenantIds.join(",")],
    enabled: tenantIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, slug, name, logo_url, status")
        .in("id", tenantIds);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (loading) return;
    if (isPlatformOwner) {
      navigate({ to: "/platform", replace: true });
      return;
    }
    if (tenants && tenants.length === 1) {
      navigate({ to: "/app/$slug", params: { slug: tenants[0]!.slug }, replace: true });
    }
  }, [loading, isPlatformOwner, tenants, navigate]);

  if (loading || isLoading) return <LoadingBlock />;

  if (tenantIds.length === 0) {
    return (
      <div className="gradient-sky flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-lg">
          <EmptyState
            icon={<BookOpen className="size-6" />}
            title="لم يتم ربط حسابك بأي مقرأة بعد"
            description="تواصلي مع مديرة المقرأة لإضافتك، أو مع إدارة المنصة لإنشاء مقرأة جديدة."
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

  return (
    <div className="gradient-sky min-h-screen px-5 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-center font-display text-2xl font-bold">اختاري المقرأة</h1>
        <div className="grid gap-3 sm:grid-cols-2">
          {tenants?.map((t) => {
            const myRoles = roles.filter((r) => r.tenant_id === t.id).map((r) => ROLE_LABELS[r.role]);
            return (
              <Link
                key={t.id}
                to="/app/$slug"
                params={{ slug: t.slug }}
                className="surface-panel flex items-center gap-3 p-4 transition-shadow hover:shadow-lifted"
              >
                <TenantLogo name={t.name} logo={t.logo_url} className="size-12" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{myRoles.join("، ")}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
