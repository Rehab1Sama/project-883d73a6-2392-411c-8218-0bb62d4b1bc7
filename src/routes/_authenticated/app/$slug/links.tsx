import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, ExternalLink, GraduationCap, HeartHandshake, Link2, Sparkles, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { visibleTenantNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTenantContext } from "@/hooks/useTenantContext";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { VOLUNTEER_ROLE_OPTIONS } from "@/lib/volunteers";

export const Route = createFileRoute("/_authenticated/app/$slug/links")({
  head: () => ({
    meta: [
      { title: "روابط التسجيل — سُحُب" },
      {
        name: "description",
        content: "روابط تسجيل الطالبات والمتطوعات في المقرأة، جاهزة للنسخ والمشاركة، مربوطة مباشرة بقاعدة بيانات المقرأة.",
      },
      { property: "og:title", content: "روابط التسجيل — سُحُب" },
      { property: "og:description", content: "انسخي رابط تسجيل الطالبات أو المتطوعات وشاركيه." },
    ],
  }),
  component: LinksPage,
});

type TenantFlags = {
  registration_open: boolean;
  volunteering_open: boolean | null;
};

function LinksPage() {
  const { tenant, canManage, loading, hasFeature, featuresLoading, isCircleScopedOnly } = useTenantContext();
  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState<string | null>(null);

  const { data: flags } = useQuery({
    queryKey: ["tenant-registration-flags", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async (): Promise<TenantFlags> => {
      const { data, error } = await supabase
        .from("tenants")
        .select("registration_open, volunteering_open")
        .eq("id", tenant!.id)
        .single();
      if (error) throw error;
      return data as TenantFlags;
    },
  });

  const toggle = useMutation({
    mutationFn: async (values: { registration_open?: boolean; volunteering_open?: boolean }) => {
      const { error } = await supabase.from("tenants").update(values).eq("id", tenant!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث حالة التسجيل");
      queryClient.invalidateQueries({ queryKey: ["tenant-registration-flags", tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ["public-tenant", tenant?.slug] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر التحديث"),
  });

  if (loading) return <LoadingBlock />;

  if (!tenant) {
    return (
      <main className="gradient-sky flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-lg">
          <EmptyState icon={<Link2 className="size-6" />} title="لم نجد هذه المقرأة" description="تأكدي من الرابط." />
        </div>
      </main>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const studentUrl = `${origin}/s/${tenant.slug}`;
  const volunteerUrl = `${origin}/v/${tenant.slug}`;
  const publicUrl = `${origin}/m/${tenant.slug}`;
  const publicPageEnabled = hasFeature("public_page");

  async function copy(key: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(key);
      toast.success("تم نسخ الرابط");
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {
      toast.error("تعذّر النسخ، انسخي الرابط يدويًا");
    }
  }

  function LinkRow({ id, url, label }: { id: string; url: string; label?: string }) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 p-2">
        {label ? <span className="px-1 text-xs font-medium text-muted-foreground">{label}</span> : null}
        <code dir="ltr" className="min-w-0 flex-1 truncate rounded-lg bg-card px-3 py-2 text-xs">
          {url}
        </code>
        <Button size="sm" variant="secondary" onClick={() => copy(id, url)}>
          {copied === id ? <Check className="size-4" /> : <Copy className="size-4" />}
          نسخ
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            فتح
          </a>
        </Button>
      </div>
    );
  }

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="روابط التسجيل"
      logoUrl={tenant.logo_url}
      nav={visibleTenantNav(tenant.slug, hasFeature, canManage, false, isCircleScopedOnly)}
      title="روابط التسجيل"
      description="انسخي الرابط وشاركيه — كل تسجيل يدخل مباشرة إلى قاعدة بيانات مقرأتك."
      crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "روابط التسجيل" }]}
    >
      <div className="space-y-6">
        {/* الطالبات */}
        <section className="surface-panel space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl gradient-primary text-primary-foreground">
                <GraduationCap className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold">رابط تسجيل الطالبات</h2>
                <p className="text-xs text-muted-foreground">
                  الطالبة تسجّل بياناتها وتختار حلقتها، فتُضاف فورًا إلى طالبات المقرأة.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="reg-open" className="text-xs text-muted-foreground">
                التسجيل مفتوح
              </Label>
              <Switch
                id="reg-open"
                checked={Boolean(flags?.registration_open)}
                onCheckedChange={(v) => toggle.mutate({ registration_open: v })}
              />
            </div>
          </div>
          <LinkRow id="student" url={studentUrl} />
          {!flags?.registration_open ? (
            <p className="text-xs text-destructive">التسجيل مغلق حاليًا — الرابط لن يقبل تسجيلات جديدة حتى تفتحيه.</p>
          ) : null}
        </section>

        {/* المتطوعات */}
        <section className="surface-panel space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl gradient-primary text-primary-foreground">
                <HeartHandshake className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold">رابط تسجيل المتطوعات</h2>
                <p className="text-xs text-muted-foreground">
                  المتطوعة تختار دورها، ويصل طلبها إلى صفحة «المتطوعات» لاعتماده.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="vol-open" className="text-xs text-muted-foreground">
                التطوّع مفتوح
              </Label>
              <Switch
                id="vol-open"
                checked={Boolean(flags?.volunteering_open)}
                onCheckedChange={(v) => toggle.mutate({ volunteering_open: v })}
              />
            </div>
          </div>
          <LinkRow id="volunteer" url={volunteerUrl} label="عام (تختار الدور بنفسها)" />
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">روابط بدور محدد مسبقًا:</p>
            {VOLUNTEER_ROLE_OPTIONS.map((r) => (
              <LinkRow key={r.value} id={`vol-${r.value}`} url={`${volunteerUrl}?role=${r.value}`} label={r.label} />
            ))}
          </div>
          {!flags?.volunteering_open ? (
            <p className="text-xs text-destructive">تسجيل المتطوعات مغلق حاليًا — افتحيه ليعمل الرابط.</p>
          ) : null}
        </section>

        {/* الصفحة التعريفية */}
        <section className="surface-panel space-y-4 p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl gradient-primary text-primary-foreground">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold">الصفحة التعريفية للمقرأة</h2>
              <p className="text-xs text-muted-foreground">صفحة عامة تجمع التعريف بالمقرأة وروابط التسجيل والدخول.</p>
            </div>
          </div>
          <LinkRow id="public" url={publicUrl} />
          {!featuresLoading && !publicPageEnabled ? (
            <p className="text-xs text-muted-foreground">
              محتوى الصفحة التعريفية الحر ميزة إضافية غير مفعّلة في باقتكم حاليًا — الصفحة تعمل بالتعريف الأساسي فقط.{" "}
              <Link to="/app/$slug/subscription" params={{ slug: tenant.slug }} className="text-primary hover:underline">
                ترقية الباقة
              </Link>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              اكتبي محتوى الصفحة من{" "}
              <Link to="/app/$slug/settings" params={{ slug: tenant.slug }} className="text-primary hover:underline">
                الإعدادات
              </Link>
              .
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
