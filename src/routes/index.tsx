import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SectionHeading, IconCardGrid } from "@/components/site/Sections";
import { PricingSection } from "@/components/site/PricingSection";
import { FEATURES, ROLES, HERO_STATS } from "@/lib/site-content";
import { tenantFromHostname } from "@/lib/tenant";
import heroClouds from "@/assets/hero-clouds.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "سُحُب — منصة إدارة المقارئ القرآنية" },
      {
        name: "description",
        content:
          "سُحُب منصة سحابية لإدارة المقارئ القرآنية: حضور وغياب، مسارات وحلقات، متابعة الحفظ، وإحصائيات دقيقة — لكل مقرأة رابطها وبياناتها الخاصة.",
      },
      { property: "og:title", content: "سُحُب — منصة إدارة المقارئ القرآنية" },
      {
        property: "og:description",
        content: "أديري مقرأتك بهدوء وإتقان: حضور، مسارات، إنجاز وإحصائيات في لوحة واحدة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  // دعم النطاق الفرعي: slug.suhub.app يفتح صفحة المقرأة مباشرة
  useEffect(() => {
    const locator = tenantFromHostname(window.location.hostname);
    if (locator?.kind === "slug") {
      navigate({ to: "/m/$slug", params: { slug: locator.value }, replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        {/* البطل */}
        <section className="gradient-sky border-b border-border">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
            <div className="text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground">
                <Sparkles className="size-3.5 text-gold" />
                نظام متعدد المقارئ — كل مقرأة برابطها الخاص
              </span>
              <h1 className="mt-6 font-display text-4xl font-bold leading-tight sm:text-6xl">
                أَدِيري مقرأتك بهدوء وإتقان
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                سُحُب تجمع حضور الطالبات، متابعة الحفظ، إدارة المسارات، والإحصائيات في لوحة واحدة
                واضحة — بصلاحيات منفصلة لكل دور داخل المقرأة.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg">
                  <Link to="/plans">
                    ابدئي مقرأتك
                    <ArrowLeft className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/features">استعرضي المميزات</Link>
                </Button>
              </div>

              <dl className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-3">
                {HERO_STATS.map((s) => (
                  <div key={s.label} className="surface-panel px-4 py-4">
                    <dt className="text-xs text-muted-foreground">{s.label}</dt>
                    <dd className="mt-1 font-display text-2xl font-bold">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative mx-auto mt-12 max-w-5xl">
              <img
                src={heroClouds}
                alt="سماء هادئة بسحب زرقاء وخطوط ذهبية تعبّر عن هوية منصة سُحُب"
                width={1600}
                height={1008}
                className="w-full rounded-3xl border border-border object-cover shadow-lg"
              />
              <div className="surface-panel absolute bottom-4 start-4 hidden w-64 p-4 sm:block">
                <p className="text-xs text-muted-foreground">تسجيل حلقة الفجر</p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-success" /> ريم — حاضرة
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-success" /> سارة — حاضرة
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-muted-foreground" /> نورة — غائبة
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* المميزات */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <SectionHeading
            eyebrow="المميزات"
            title="كل ما تحتاجه المقرأة"
            subtitle="سريعة في الاستخدام، دقيقة في الأرقام، وهادئة في التصميم."
          />
          <IconCardGrid items={FEATURES} />
        </section>

        {/* الأدوار */}
        <section className="gradient-sky border-y border-border">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <SectionHeading
              eyebrow="الأدوار"
              title="ست صلاحيات داخل المقرأة"
              subtitle="كل حساب يدخل على ما يخصّه فقط: من القائدة إلى الطالبة."
            />
            <IconCardGrid items={ROLES} />
          </div>
        </section>

        {/* الأسعار */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <SectionHeading
            eyebrow="الأسعار"
            title="خطة تنمو مع مقرأتك"
            subtitle="ادفعي شهريًا أو سنويًا، أو اشتري النظام بالكامل دفعة واحدة."
          />
          <PricingSection />
        </section>

        {/* دعوة للتجربة */}
        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="gradient-sky rounded-3xl border border-border px-6 py-14 text-center">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              جاهزة لتجربة سُحُب في مقرأتك؟
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              نجهّز حساب مقرأتك ورابطها الخاص، وننقل بياناتك الحالية معك.
            </p>
            <Button asChild size="lg" className="mt-7">
              <Link to="/contact">
                اطلبي مقرأتك الآن
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
