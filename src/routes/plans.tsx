import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SectionHeading } from "@/components/site/Sections";
import { PricingSection } from "@/components/site/PricingSection";

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: "الباقات والأسعار — سُحُب" },
      {
        name: "description",
        content:
          "باقات سُحُب لإدارة المقارئ القرآنية: غيمة وسحابة وغيث، باشتراك شهري أو سنوي (شهران مجانًا) مع رسوم تجهيز مرة واحدة.",
      },
      { property: "og:title", content: "الباقات والأسعار — سُحُب" },
      {
        property: "og:description",
        content: "اشتراك شهري أو سنوي بشهرين مجانًا، مع رسوم تجهيز مرة واحدة — وترقّي في أي وقت.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlansPage,
});

function PlansPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-16">
        <SectionHeading
          eyebrow="الأسعار"
          title="خطة تنمو مع مقرأتك"
          subtitle="اختاري نوع الاشتراك المناسب: شهري أو سنوي بشهرين مجانًا، مع رسوم تجهيز تُدفع مرة واحدة عند الاشتراك. والترقية متاحة في أي وقت."
        />
        <PricingSection />

        <section className="mt-12">
          <article className="surface-panel flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">تجهيز مستقل</h3>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                باقة خاصة للمقارئ ذات الاحتياج المختلف: تجهيز وإعداد مخصّص لمقرأتك، ويُناقش تفصيليًا
                عبر التواصل المباشر لتحديد النطاق والمدة والتكلفة المناسبة.
              </p>
            </div>
            <Link
              to="/contact"
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              تواصلي معنا
            </Link>
          </article>
        </section>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          تبغين مقارنة تفصيلية بين الباقات؟{" "}
          <Link to="/compare" className="font-medium text-primary hover:underline">
            جدول مقارنة الباقات
          </Link>
        </p>


        <div className="mt-20">
          <SectionHeading eyebrow="أسئلة متكررة" title="قبل أن تبدئي" />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              {
                q: "ما الفرق بين الاشتراك الشهري والسنوي؟",
                a: "الاشتراك الشهري يُجدَّد كل شهر، والسنوي يُجدَّد كل عام بسعر عشرة أشهر فقط — أي شهران مجانًا.",
              },
              {
                q: "ما هي رسوم التجهيز؟",
                a: "مبلغ يُدفع مرة واحدة عند الاشتراك لتجهيز مقرأتك: إعداد الحساب والمسارات والحلقات وتدريب الفريق.",
              },
              {
                q: "هل يمكن الترقية لاحقًا؟",
                a: "نعم، يمكن الترقية في أي وقت ويُحسب الفرق فقط عن المدة المتبقية.",
              },
              {
                q: "هل لكل مقرأة رابط خاص؟",
                a: "نعم، لكل مقرأة رابطها المستقل وبياناتها وحساباتها المنفصلة تمامًا.",
              },
              {
                q: "كيف يتم الدفع؟",
                a: "بعد إرسال الطلب نتواصل معك لتأكيد التفاصيل وإتمام الدفع وتجهيز حساب المقرأة.",
              },
            ].map((item) => (
              <article key={item.q} className="surface-panel p-6">
                <h3 className="font-semibold">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
