import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { TenantLogo } from "@/components/TenantLogo";

export const Route = createFileRoute("/_authenticated/student/")({
  head: () => ({
    meta: [
      { title: "بوابة الطالبة — سُحُب" },
      { name: "description", content: "بوابة الطالبة: حلقتك ومسارك وحضورك وإنجازك اليومي في مقرأتك." },
      { property: "og:title", content: "بوابة الطالبة — سُحُب" },
      { property: "og:description", content: "تفتح بوابة الطالبة مقرأتها تلقائيًا لمتابعة حلقتها وإنجازها." },
    ],
  }),
  component: StudentHome,
});

/**
 * بوابة الطالبة بلا مقرأة محددة: تكتشف مقرأتها تلقائيًا من أدوارها وتفتحها،
 * حتى لو حفظت الرابط `/student` أو وصلت إليه من رابط تسجيل عام.
 */
function StudentHome() {
  const { roles, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const tenantIds = [...new Set(roles.filter((r) => r.tenant_id).map((r) => r.tenant_id!))];

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["student-tenants", tenantIds.join(",")],
    enabled: tenantIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, slug, name, logo_url")
        .in("id", tenantIds);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (loading || isLoading) return;
    if (tenants && tenants.length === 1) {
      navigate({ to: "/student/$slug", params: { slug: tenants[0]!.slug }, replace: true });
    }
  }, [loading, isLoading, tenants, navigate]);

  if (loading || isLoading) return <LoadingBlock />;

  if (tenantIds.length === 0 || (tenants && tenants.length === 0)) {
    return (
      <div className="gradient-sky flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-lg">
          <EmptyState
            icon={<BookOpen className="size-6" />}
            title="لم يتم ربط حسابك بأي مقرأة بعد"
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

  return (
    <div className="gradient-sky min-h-screen px-5 py-12">
      <div className="mx-auto w-full max-w-lg space-y-3">
        <h1 className="text-center text-lg font-semibold">اختاري مقرأتك</h1>
        {(tenants ?? []).map((t) => (
          <Link
            key={t.id}
            to="/student/$slug"
            params={{ slug: t.slug }}
            className="surface-panel flex items-center gap-3 p-4 transition hover:shadow-md"
          >
            <TenantLogo name={t.name} logo={t.logo_url} className="size-10" />
            <span className="font-medium">{t.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
