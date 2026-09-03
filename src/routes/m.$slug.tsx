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
  GraduationCap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { useTenantLogo } from "@/lib/tenant-branding";
import { hasPublicPageContent, parsePublicPageContent, resolveShadeStyle } from "@/lib/public-page";

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
  settings: unknown;
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
          "id, name, slug, logo_url, primary_color, accent_color, short_description, contact_email, contact_phone, status, registration_open, volunteering_open, settings",
        )
        .eq("slug", slug)
        .maybeSingle()) as { data: PublicTenantRow | null; error: Error | null };
      if (error) throw error;
      return data;
    },
  });

  // هل ميزة "الصفحة التعريفية" مفعّلة لهالمقرأة؟ بلا هالميزة، المحتوى
  // الحر المخزّن في settings["public_page"] لا يظهر إطلاقًا مهما كان موجودًا.
  const { data: features } = useQuery({
    queryKey: ["public-tenant-features", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async (): Promise<Record<string, boolean>> => {
      const { data, error } = await supabase.rpc("tenant_effective_features", {
        _tenant_id: tenant!.id,
      });
      if (error) throw error;
      const map: Record<string, boolean> = {};
      for (const row of data ?? []) map[row.feature_key] = row.enabled;
      return map;
    },
  });

  const publicPageEnabled = Boolean(features?.["public_page"]);
  const publicPageContent = parsePublicPageContent(tenant?.settings);
  const showPublicPageContent = publicPageEnabled && hasPublicPageContent(publicPageContent);

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
    <main className="min-h-screen bg-background">
      {/* غلاف علوي: مكان الشعار + هوية المقرأة */}
      <section className="gradient-sky relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute -top-24 right-[-10%] size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-[-10%] size-80 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative mx-auto max-w-5xl px-5 py-14 sm:py-20">
          <div className="flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="size-3.5 text-gold" />
              مقرأة على منصة سُحُب
            </span>

            {/* مكان الشعار */}
            <div className="mt-7 rounded-[28px] border border-border bg-card/90 p-3 shadow-soft backdrop-blur">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`شعار ${tenant.name}`}
                  className="size-24 rounded-2xl object-contain sm:size-28"
                  loading="lazy"
                />
              ) : (
                <span className="grid size-24 place-items-center rounded-2xl gradient-primary font-display text-3xl font-bold text-primary-foreground sm:size-28">
                  {tenant.name.slice(0, 1)}
                </span>
              )}
            </div>

            <h1 className="mt-6 font-display text-3xl font-bold leading-tight sm:text-5xl">{tenant.name}</h1>
            {tenant.short_description ? (
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
                {tenant.short_description}
              </p>
            ) : null}

            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
              {tenant.registration_open ? (
                <Button asChild size="lg">
                  <Link to="/s/$slug" params={{ slug: tenant.slug }}>
                    <GraduationCap className="size-4" />
                    التسجيل في المقرأة
                  </Link>
                </Button>
              ) : (
                <Button size="lg" disabled>
                  التسجيل مغلق حاليًا
                </Button>
              )}
              {tenant.volunteering_open ? (
                <Button asChild size="lg" variant="secondary">
                  <Link to="/v/$slug" params={{ slug: tenant.slug }} search={{}}>
                    <HeartHandshake className="size-4" />
                    تسجيل المتطوعات
                  </Link>
                </Button>
              ) : null}
              <Button asChild size="lg" variant="outline">
                <Link to="/auth" search={{ next: `/app/${tenant.slug}` }}>
                  دخول المنتسبات
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* مزايا المقرأة */}
      <section className="mx-auto max-w-5xl px-5 py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HIGHLIGHTS.map(({ icon: Icon, label }) => (
            <div key={label} className="surface-panel flex items-start gap-3 p-5 text-right">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl gradient-primary text-primary-foreground">
                <Icon className="size-5" />
              </span>
              <p className="text-sm font-medium leading-relaxed">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* المحتوى التعريفي (ميزة الصفحة التعريفية) */}
      {showPublicPageContent ? (
        <section className="mx-auto max-w-4xl px-5 pb-14">
          {publicPageContent.intro ? (
            <div className="surface-panel mb-5 p-6 text-right">
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground sm:text-base">
                {publicPageContent.intro}
              </p>
            </div>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            {publicPageContent.blocks.map((block) => {
              if (!block.title && !block.body) return null;
              const shadeStyle = resolveShadeStyle(block.shade, tenant.primary_color, tenant.accent_color);
              return (
                <article
                  key={block.id}
                  className="surface-panel p-6 text-right"
                  style={
                    shadeStyle
                      ? {
                          backgroundColor: shadeStyle.background,
                          borderColor: shadeStyle.border,
                          color: shadeStyle.foreground,
                        }
                      : undefined
                  }
                >
                  {block.title ? (
                    <h2
                      className="font-display text-lg font-bold"
                      style={shadeStyle ? { color: shadeStyle.foreground } : undefined}
                    >
                      {block.title}
                    </h2>
                  ) : null}
                  {block.body ? (
                    <p
                      className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground"
                      style={shadeStyle ? { color: shadeStyle.foreground, opacity: 0.9 } : undefined}
                    >
                      {block.body}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* التواصل */}
      {hasContact ? (
        <section className="mx-auto max-w-3xl px-5 pb-14">
          <div className="surface-panel flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:justify-center sm:gap-8">
            {tenant.contact_phone ? (
              <a href={`tel:${tenant.contact_phone}`} className="flex items-center gap-2 text-sm hover:text-primary">
                <Phone className="size-4 text-primary" />
                <span dir="ltr">{tenant.contact_phone}</span>
              </a>
            ) : null}
            {tenant.contact_email ? (
              <a href={`mailto:${tenant.contact_email}`} className="flex items-center gap-2 text-sm hover:text-primary">
                <Mail className="size-4 text-primary" />
                <span dir="ltr">{tenant.contact_email}</span>
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        مُشغّلة بواسطة{" "}
        <Link to="/" className="text-primary hover:underline">
          منصة سُحُب
        </Link>
      </footer>
    </main>
  );
}
