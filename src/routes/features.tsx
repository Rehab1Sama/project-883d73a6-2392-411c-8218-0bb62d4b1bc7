import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SectionHeading, IconCardGrid } from "@/components/site/Sections";
import { FEATURES, WORKFLOW } from "@/lib/site-content";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "مميزات سُحُب — حضور، مسارات وتقارير المقرأة" },
      {
        name: "description",
        content:
          "تعرّفي على مميزات سُحُب: تسجيل الحضور والغياب، متابعة الحفظ والمراجعة، إدارة المسارات والحلقات، والتقارير والإحصائيات.",
      },
      { property: "og:title", content: "مميزات سُحُب — حضور، مسارات وتقارير المقرأة" },
      {
        property: "og:description",
        content: "أدوات المقرأة كاملة في مكان واحد: حضور، حفظ، مسارات، تقارير وصلاحيات.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeaturesPage,
});

function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-16">
        <SectionHeading
          eyebrow="المميزات"
          title="أدوات المقرأة كاملة"
          subtitle="كل شاشة صُمّمت لتقليل الخطوات: تسجيل أسرع، أرقام أوضح، وقرارات أدق."
        />
        <IconCardGrid items={FEATURES} />

        <div className="mt-20">
          <SectionHeading eyebrow="كيف يعمل" title="ثلاث خطوات للبدء" />
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {WORKFLOW.map((step, i) => (
              <li key={step.title} className="surface-panel p-6">
                <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="gradient-sky mt-20 rounded-3xl border border-border px-6 py-12 text-center">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">جرّبي سُحُب في مقرأتك</h2>
          <Button asChild size="lg" className="mt-6">
            <Link to="/plans">
              استعرضي الباقات
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
