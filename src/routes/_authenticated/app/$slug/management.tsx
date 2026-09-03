import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layers, CircleDot, Users, GraduationCap, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { visibleTenantNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenantContext } from "@/hooks/useTenantContext";
import { useTenantTheme } from "@/hooks/useTenantTheme";

export const Route = createFileRoute("/_authenticated/app/$slug/management")({
  head: () => ({
    meta: [
      { title: "إدارة المقرأة — سُحُب" },
      { name: "description", content: "ضبط المسارات والحلقات وربطها بالحسابات والطالبات من مكان واحد." },
      { property: "og:title", content: "إدارة المقرأة — سُحُب" },
      { property: "og:description", content: "لوحة إدارة المسارات والحلقات والحسابات في منصة سُحُب." },
    ],
  }),
  component: ManagementPage,
});

function ManagementPage() {
  const { tenant, canRead, canManage, canRecord, loading, hasFeature, featuresLoading, isCircleScopedOnly } =
    useTenantContext();
  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  const structureQuery = useQuery({
    queryKey: ["tenant-structure", tenant?.id],
    enabled: canManage && !!tenant?.id,
    queryFn: async () => {
      const [tracks, circles, links, roles] = await Promise.all([
        supabase.from("tracks").select("id, name, status").eq("tenant_id", tenant!.id).order("name"),
        supabase
          .from("circles")
          .select("id, name, track_id, status, teacher_user_id")
          .eq("tenant_id", tenant!.id)
          .order("name"),
        supabase.from("circle_students").select("circle_id, student_id"),
        supabase.from("user_roles").select("id, role, circle_id, track_id").eq("tenant_id", tenant!.id),
      ]);
      if (tracks.error) throw tracks.error;
      if (circles.error) throw circles.error;
      if (links.error) throw links.error;
      if (roles.error) throw roles.error;
      return {
        tracks: tracks.data ?? [],
        circles: circles.data ?? [],
        links: links.data ?? [],
        roles: roles.data ?? [],
      };
    },
  });

  if (loading || featuresLoading) return <LoadingBlock />;

  if (!tenant || !canManage) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <EmptyState
          title={tenant ? "هذه الصفحة مقصورة على قيادة المقرأة" : "المقرأة غير موجودة"}
          description="تواصلي مع قائدة المقرأة إن كنتِ تحتاجين صلاحيات إدارية."
          action={
            <Button asChild>
              <Link to="/dashboard">العودة للوحتي</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const data = structureQuery.data;
  const tracks = data?.tracks ?? [];
  const circles = data?.circles ?? [];
  const studentsPerCircle = new Map<string, number>();
  for (const l of data?.links ?? []) {
    studentsPerCircle.set(l.circle_id, (studentsPerCircle.get(l.circle_id) ?? 0) + 1);
  }
  const staffPerCircle = new Map<string, number>();
  for (const r of data?.roles ?? []) {
    if (r.circle_id) staffPerCircle.set(r.circle_id, (staffPerCircle.get(r.circle_id) ?? 0) + 1);
  }

  const cards = [
    { label: "المسارات", to: "/app/$slug/tracks" as const, icon: <Layers className="size-5" />, value: tracks.length },
    { label: "الحلقات", to: "/app/$slug/circles" as const, icon: <CircleDot className="size-5" />, value: circles.length },
    { label: "الحسابات", to: "/app/$slug/accounts" as const, icon: <Users className="size-5" />, value: (data?.roles ?? []).length },
    {
      label: "الطالبات في الحلقات",
      to: "/app/$slug/students" as const,
      icon: <GraduationCap className="size-5" />,
      value: (data?.links ?? []).length,
    },
  ];

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="إدارة المقرأة"
      logoUrl={tenant.logo_url}
      nav={visibleTenantNav(tenant.slug, hasFeature, canManage, canRecord, isCircleScopedOnly)}
      title="إدارة المقرأة"
      crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "إدارة المقرأة" }]}
    >
      {structureQuery.isLoading ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <Link
                key={c.label}
                to={c.to}
                params={{ slug: tenant.slug }}
                className="surface-panel flex items-center justify-between p-4 transition hover:border-primary/40"
              >
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  {c.icon}
                  {c.label}
                </span>
                <span className="text-xl font-semibold">{c.value}</span>
              </Link>
            ))}
          </div>

          <section className="surface-panel space-y-3 p-4">
            <h2 className="font-medium">المسارات وحلقاتها</h2>
            {tracks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                لا توجد مسارات بعد — أنشئي مسارًا ثم اربطي به حلقاته.
              </p>
            ) : (
              <div className="space-y-4">
                {tracks.map((t) => {
                  const own = circles.filter((c) => c.track_id === t.id);
                  return (
                    <div key={t.id} className="rounded-xl border border-border/70 p-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-medium">{t.name}</h3>
                        <span className="text-xs text-muted-foreground">{own.length} حلقة</span>
                      </div>
                      {own.length === 0 ? (
                        <p className="text-sm text-muted-foreground">لا توجد حلقات مرتبطة بهذا المسار.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table className="min-w-[26rem]">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-right">الحلقة</TableHead>
                                <TableHead className="text-right">الطالبات</TableHead>
                                <TableHead className="text-right">الطاقم</TableHead>
                                <TableHead className="text-right">الحالة</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {own.map((c) => (
                                <TableRow key={c.id}>
                                  <TableCell className="font-medium">{c.name}</TableCell>
                                  <TableCell>{studentsPerCircle.get(c.id) ?? 0}</TableCell>
                                  <TableCell>{staffPerCircle.get(c.id) ?? 0}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {c.status === "active" ? "نشطة" : "متوقفة"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {circles.some((c) => !c.track_id) ? (
            <section className="surface-panel space-y-2 p-4">
              <h2 className="font-medium">حلقات بلا مسار</h2>
              <p className="text-sm text-muted-foreground">
                اربطي هذه الحلقات بمسار حتى تُحسب أنصبتها بشكل صحيح:
                {" "}
                {circles.filter((c) => !c.track_id).map((c) => c.name).join("، ")}
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/app/$slug/circles" params={{ slug: tenant.slug }}>
                  فتح صفحة الحلقات
                </Link>
              </Button>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/app/$slug/settings" params={{ slug: tenant.slug }}>
                <Settings className="size-4" /> إعدادات المقرأة
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/$slug/accounts" params={{ slug: tenant.slug }}>
                <Users className="size-4" /> الحسابات
              </Link>
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
