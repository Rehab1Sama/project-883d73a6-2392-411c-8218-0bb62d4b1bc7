import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SectionHeading, IconCardGrid } from "@/components/site/Sections";
import { ROLES } from "@/lib/site-content";

export const Route = createFileRoute("/roles")({
  head: () => ({
    meta: [
      { title: "الصلاحيات والأدوار في سُحُب" },
      {
        name: "description",
        content:
          "ست صلاحيات داخل المقرأة: القائدة، المشرفة العامة، مسؤولة المسار، المعلمة، المشرفة، والطالبة — كل حساب يرى ما يخصّه فقط.",
      },
      { property: "og:title", content: "الصلاحيات والأدوار في سُحُب" },
      {
        property: "og:description",
        content: "توزيع واضح للمسؤوليات داخل المقرأة بست صلاحيات منفصلة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RolesPage,
});

function RolesPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-16">
        <SectionHeading
          eyebrow="الأدوار"
          title="ست صلاحيات داخل المقرأة"
          subtitle="لكل دور نطاقه المحدّد؛ لا تتقاطع البيانات ولا تُرى إلا من صاحبة الصلاحية."
        />
        <IconCardGrid items={ROLES} />

        <div className="surface-panel mt-16 p-6">
          <h2 className="text-lg font-semibold">كيف تُمنح الصلاحيات؟</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            تُدار الصلاحيات من داخل لوحة المقرأة: القائدة تدعو الحسابات وتحدّد دور كل حساب ونطاقه
            (المقرأة كاملة، أو مسار، أو حلقة). يمكن تعديل الدور أو إيقاف الحساب في أي وقت، ويُطبّق
            التغيير فورًا على ما يظهر لصاحبة الحساب.
          </p>
        </div>

        <div className="gradient-sky mt-16 rounded-3xl border border-border px-6 py-12 text-center">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">ابدئي بتوزيع فريقك</h2>
          <Button asChild size="lg" className="mt-6">
            <Link to="/plans">
              اختاري باقتك
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
