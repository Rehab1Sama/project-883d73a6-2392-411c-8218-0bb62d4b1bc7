import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  ArrowLeft,
  HeartHandshake,
  Users,
  CalendarCheck,
  Sparkles,
  Mail,
  Phone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { useTenantLogo } from "@/lib/tenant-branding";

type PublicTenantRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  short_description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
  registration_open: boolean;
  volunteering_open: boolean | null;
};

const HIGHLIGHTS = [
  { icon: BookOpen, label: "متابعة الحفظ والمراجعة يوميًا" },
  { icon: Users, label: "حلقات مرتّبة بمسارات واضحة" },
  { icon: CalendarCheck, label: "حضور وغياب منظّم" },
  { icon: HeartHandshake, label: "فرص تطوّع للمعلمات والمشرفات" },
] as const;

export const Route = createFileRoute("/m/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `مقرأة ${params.slug} — سُحُب` },
      { name: "description", content: "صفحة المقرأة على منصة سُحُب: التعريف بالمقرأة والتسجيل ودخول المنتسبات." },
      { property: "og:title", content: `مقرأة ${params.slug} — سُحُب` },
      { property: "og:description", content: "صفحة المقرأة على منصة سُحُب للتسجيل ودخول المنتسبات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TenantPublicPage,
});

function TenantPublicPage() {
  const { slug } = useParams({ from: "/m/$slug" });

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => {
      const { data, error } = (await supabase
        .from("tenants")
        .select(
          "id, name, slug, logo_url, primary_color, accent_color, short_description, contact_email, contact_phone, status, registration_open, volunteering_open",
        )
        .eq("slug", slug)
        .maybeSingle()) as { data: PublicTenantRow | null; error: Error | null };
      if (error) throw error;
      return data;
    },
  });

  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);
  const logoUrl = useTenantLogo(tenant?.logo_url);

  if (isLoading) return <LoadingBlock />;

  if (!tenant || tenant.status === "suspended") {
    return (
      <main className="gradient-sky flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-lg">
          <EmptyState
            icon={<BookOpen className="size-6" />}
            title={tenant ? "هذه المقرأة موقوفة حاليًا" : "لم نجد هذه المقرأة"}
            description="تأكدي من الرابط أو تواصلي مع إدارة المقرأة."
            action={
              <Button asChild variant="outline">
                <Link to="/">الصفحة الرئيسية</Link>
              </Button>
            }
          />
        </div>
      </main>
    );
  }

  const hasContact = Boolean(tenant.contact_email || tenant.contact_phone);

  return (
    <main className="gradient-sky min-h-screen px-5 py-14">
      <div className="mx-auto max-w-3xl text-center">
        <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-gold" />
          مقرأة على منصة سُحُب
        </span>

        {logoUrl ? (
          <img src={logoUrl} alt={tenant.name} className="mx-auto mt-6 size-20 rounded-2xl bg-card object-contain p-2 shadow-soft" />
        ) : (
          <span className="mx-auto mt-6 grid size-20 place-items-center rounded-2xl gradient-primary font-display text-2xl font-bold text-primary-foreground">
            {tenant.name.slice(0, 1)}
          </span>
        )}
        <h1 className="mt-5 font-display text-3xl font-bold sm:text-4xl">{tenant.name}</h1>
        {tenant.short_description ? (
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{tenant.short_description}</p>
        ) : null}

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth" search={{ next: `/app/${tenant.slug}` }}>
              دخول المنتسبات
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" disabled={!tenant.registration_open}>
            <Link to="/s/$slug" params={{ slug: tenant.slug }}>
              {tenant.registration_open ? "التسجيل في المقرأة" : "التسجيل مغلق حاليًا"}
            </Link>
          </Button>
          {tenant.volunteering_open ? (
            <Button asChild size="lg" variant="secondary">
              <Link to="/v/$slug" params={{ slug: tenant.slug }}>
                تسجيل المتطوعات
                <HeartHandshake className="size-4" />
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 text-right sm:grid-cols-4">
          {HIGHLIGHTS.map(({ icon: Icon, label }) => (
            <div key={label} className="surface-panel p-4 text-center">
              <span className="mx-auto grid size-10 place-items-center rounded-xl gradient-primary text-primary-foreground">
                <Icon className="size-5" />
              </span>
              <p className="mt-3 text-xs font-medium leading-relaxed">{label}</p>
            </div>
          ))}
        </div>

        {hasContact ? (
          <div className="surface-panel mx-auto mt-8 flex max-w-md flex-wrap items-center justify-center gap-x-6 gap-y-2 p-4 text-sm text-muted-foreground">
            {tenant.contact_phone ? (
              <span className="flex items-center gap-2">
                <Phone className="size-4 text-primary" />
                <span dir="ltr">{tenant.contact_phone}</span>
              </span>
            ) : null}
            {tenant.contact_email ? (
              <span className="flex items-center gap-2">
                <Mail className="size-4 text-primary" />
                <span dir="ltr">{tenant.contact_email}</span>
              </span>
            ) : null}
          </div>
        ) : null}

        <p className="mt-10 text-xs text-muted-foreground">
          مُشغّلة بواسطة{" "}
          <Link to="/" className="text-primary hover:underline">
            منصة سُحُب
          </Link>
        </p>
      </div>
    </main>
  );
}
