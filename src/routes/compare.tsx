import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Minus, Users, BookOpen, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SectionHeading } from "@/components/site/Sections";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui-blocks";
import { cn } from "@/lib/utils";
import {
  BILLING_OPTIONS,
  planPrice,
  planPriceLabel,
  planComparePrice,
  planDiscountPercent,
  type BillingPeriod,
  type PlanRow,
} from "@/lib/pricing";
import { PlanRequestDialog } from "@/components/site/PlanRequestDialog";
import { CompareFaq } from "@/components/site/CompareFaq";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "مقارنة الباقات — سُحُب" },
      {
        name: "description",
        content:
          "مقارنة تفصيلية بين باقات سُحُب: نسمة وغيمة وسحابة وغيث وسماء — الحدود والمزايا والأسعار في جدول واحد.",
      },
      { property: "og:title", content: "مقارنة الباقات — سُحُب" },
      {
        property: "og:description",
        content: "قارني حدود الطالبات والحلقات والمعلمات ومزايا كل باقة قبل الاشتراك.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComparePage,
});

type FeatureCatalogRow = { key: string; name_ar: string; description_ar: string | null };

function fmtLimit(n: number) {
  return n > 0 ? n.toLocaleString("ar-EG") : "بلا حدود";
}

type PlanCta =
  | { kind: "trial"; label: string }
  | { kind: "contact"; label: string }
  | { kind: "request"; label: string };

/** زر الاختيار المناسب لكل باقة: تجربة مجانية / تواصل / اشتراك */
function planCta(plan: PlanRow, period: BillingPeriod): PlanCta {
  if (plan.is_custom_priced) return { kind: "contact", label: "تواصلي معنا" };
  if (planPrice(plan, period) === 0) return { kind: "trial", label: "ابدئي مجانًا" };
  return { kind: "request", label: "اشتركي الآن" };
}

function PlanCtaButton({
  plan,
  period,
  onRequest,
  className,
}: {
  plan: PlanRow;
  period: BillingPeriod;
  onRequest: (plan: PlanRow) => void;
  className?: string;
}) {
  const cta = planCta(plan, period);
  const variant = plan.is_featured ? "default" : "outline";

  if (cta.kind === "trial") {
    return (
      <Button asChild size="sm" variant={variant} className={cn("w-full", className)}>
        <Link to="/auth">{cta.label}</Link>
      </Button>
    );
  }
  if (cta.kind === "contact") {
    return (
      <Button asChild size="sm" variant={variant} className={cn("w-full", className)}>
        <Link to="/contact">{cta.label}</Link>
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant={variant}
      className={cn("w-full", className)}
      onClick={() => onRequest(plan)}
    >
      {cta.label}
    </Button>
  );
}


function useCompareData() {
  return useQuery({
    queryKey: ["plan-comparison"],
    queryFn: async () => {
      const [plansRes, featuresRes, linksRes] = await Promise.all([
        supabase.from("plans").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("features").select("key, name_ar, description_ar").order("sort_order"),
        supabase.from("plan_features").select("plan_id, feature_key"),
      ]);
      if (plansRes.error) throw plansRes.error;
      if (featuresRes.error) throw featuresRes.error;
      if (linksRes.error) throw linksRes.error;

      const included = new Set(
        (linksRes.data ?? []).map((l) => `${l.plan_id}::${l.feature_key}`),
      );
      return {
        plans: (plansRes.data ?? []) as PlanRow[],
        features: (featuresRes.data ?? []) as FeatureCatalogRow[],
        included,
      };
    },
  });
}

function ComparePage() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [selected, setSelected] = useState<PlanRow | null>(null);
  const { data, isLoading } = useCompareData();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-16">
        <SectionHeading
          eyebrow="مقارنة"
          title="أي باقة تناسب مقرأتك؟"
          subtitle="جدول واحد يوضّح الحدود والمزايا والفروق بين كل الباقات، لتختاري بثقة."
        />

        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-xl border border-border bg-card p-1">
            {BILLING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriod(opt.value)}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm transition-colors",
                  period === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading || !data ? (
          <LoadingBlock />
        ) : (
          <div className="mt-10 hidden md:block">
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky start-0 z-10 w-44 bg-card p-4 text-start align-bottom text-xs font-medium text-muted-foreground">
                    الباقة
                  </th>
                  {data.plans.map((plan) => {
                    const price = planPriceLabel(plan, period);
                    const before = planComparePrice(plan, period);
                    const discount = planDiscountPercent(plan, period);
                    return (
                      <th
                        key={plan.id}
                        className={cn(
                          "border-s border-border p-4 text-center align-bottom",
                          plan.is_featured && "bg-primary-soft",
                        )}
                      >
                        {plan.is_featured ? (
                          <span className="mb-2 inline-block rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-medium text-gold-foreground">
                            الأكثر اختيارًا
                          </span>
                        ) : null}
                        <div className="font-display text-lg font-bold">{plan.name_ar}</div>
                        <div className="mt-1 text-xs font-normal leading-relaxed text-muted-foreground">
                          {plan.description_ar}
                        </div>
                        <div className="mt-3 font-semibold tabular-nums">{price.amount}</div>
                        {price.suffix ? (
                          <div className="text-[11px] font-normal text-muted-foreground">
                            {price.suffix}
                          </div>
                        ) : null}
                        {before ? (
                          <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-normal">
                            <span className="text-muted-foreground line-through tabular-nums">
                              {before.toLocaleString("ar-EG")}
                            </span>
                            {discount ? (
                              <span className="rounded-full bg-gold px-1.5 py-0.5 font-medium text-gold-foreground">
                                −{discount.toLocaleString("ar-EG")}%
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                <tr className="bg-muted/40">
                  <td
                    colSpan={data.plans.length + 1}
                    className="border-t border-border px-4 py-2 text-xs font-semibold text-muted-foreground"
                  >
                    الحدود
                  </td>
                </tr>
                {(
                  [
                    { label: "عدد الطالبات", icon: Users, get: (p: PlanRow) => p.max_students },
                    { label: "عدد الحلقات", icon: BookOpen, get: (p: PlanRow) => p.max_circles },
                    {
                      label: "عدد المعلمات",
                      icon: GraduationCap,
                      get: (p: PlanRow) => p.max_teachers,
                    },
                  ] as const
                ).map((row) => (
                  <tr key={row.label} className="border-t border-border/70">
                    <th className="sticky start-0 z-10 bg-card p-4 text-start font-medium">
                      <span className="flex items-center gap-2">
                        <row.icon className="size-4 text-primary" />
                        {row.label}
                      </span>
                    </th>
                    {data.plans.map((plan) => (
                      <td
                        key={plan.id}
                        className={cn(
                          "border-s border-border/70 p-4 text-center font-semibold tabular-nums",
                          plan.is_featured && "bg-primary-soft/60",
                        )}
                      >
                        {fmtLimit(row.get(plan))}
                      </td>
                    ))}
                  </tr>
                ))}

                <tr className="bg-muted/40">
                  <td
                    colSpan={data.plans.length + 1}
                    className="border-t border-border px-4 py-2 text-xs font-semibold text-muted-foreground"
                  >
                    المزايا
                  </td>
                </tr>
                {data.features.map((feature) => (
                  <tr key={feature.key} className="border-t border-border/70">
                    <th className="sticky start-0 z-10 bg-card p-4 text-start font-medium">
                      <span className="block">{feature.name_ar}</span>
                      {feature.description_ar ? (
                        <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                          {feature.description_ar}
                        </span>
                      ) : null}
                    </th>
                    {data.plans.map((plan) => {
                      const has = data.included.has(`${plan.id}::${feature.key}`);
                      return (
                        <td
                          key={plan.id}
                          className={cn(
                            "border-s border-border/70 p-4 text-center",
                            plan.is_featured && "bg-primary-soft/60",
                          )}
                        >
                          {has ? (
                            <Check
                              className="mx-auto size-4 text-success"
                              aria-label="متوفرة"
                            />
                          ) : (
                            <Minus
                              className="mx-auto size-4 text-muted-foreground/50"
                              aria-label="غير متوفرة"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                <tr className="border-t border-border">
                  <td className="sticky start-0 z-10 bg-card p-4" />
                  {data.plans.map((plan) => (
                    <td
                      key={plan.id}
                      className={cn(
                        "border-s border-border/70 p-4 text-center",
                        plan.is_featured && "bg-primary-soft/60",
                      )}
                    >
                      <PlanCtaButton plan={plan} period={period} onRequest={setSelected} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* بطاقات الجوال */}
        {!isLoading && data ? (
          <div className="mt-8 grid gap-4 md:hidden">
            {data.plans.map((plan) => {
              const price = planPriceLabel(plan, period);
              const before = planComparePrice(plan, period);
              const discount = planDiscountPercent(plan, period);
              return (
                <div
                  key={plan.id}
                  className={cn(
                    "rounded-2xl border border-border bg-card p-5",
                    plan.is_featured && "border-primary/40 bg-primary-soft/40 shadow-sm",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display text-lg font-bold">{plan.name_ar}</div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {plan.description_ar}
                      </p>
                    </div>
                    {plan.is_featured ? (
                      <span className="shrink-0 rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-medium text-gold-foreground">
                        الأكثر اختيارًا
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap items-baseline gap-2">
                    <span className="text-xl font-bold tabular-nums">{price.amount}</span>
                    {price.suffix ? (
                      <span className="text-xs text-muted-foreground">{price.suffix}</span>
                    ) : null}
                    {before ? (
                      <>
                        <span className="text-xs text-muted-foreground line-through tabular-nums">
                          {before.toLocaleString("ar-EG")}
                        </span>
                        {discount ? (
                          <span className="rounded-full bg-gold px-1.5 py-0.5 text-[11px] font-medium text-gold-foreground">
                            −{discount.toLocaleString("ar-EG")}%
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {(
                      [
                        { label: "طالبة", icon: Users, value: plan.max_students },
                        { label: "حلقة", icon: BookOpen, value: plan.max_circles },
                        { label: "معلمة", icon: GraduationCap, value: plan.max_teachers },
                      ] as const
                    ).map((l) => (
                      <div
                        key={l.label}
                        className="rounded-xl border border-border/70 bg-background/60 p-2.5 text-center"
                      >
                        <l.icon className="mx-auto size-4 text-primary" />
                        <div className="mt-1 text-sm font-semibold tabular-nums">
                          {fmtLimit(l.value)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{l.label}</div>
                      </div>
                    ))}
                  </div>

                  <ul className="mt-4 space-y-1.5">
                    {data.features
                      .filter((f) => data.included.has(`${plan.id}::${f.key}`))
                      .map((f) => (
                        <li key={f.key} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 size-4 shrink-0 text-success" />
                          <span>{f.name_ar}</span>
                        </li>
                      ))}
                  </ul>

                  <PlanCtaButton
                    plan={plan}
                    period={period}
                    onRequest={setSelected}
                    className="mt-5 h-11"
                  />
                </div>
              );
            })}
          </div>
        ) : null}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          تحتاجين تفاصيل الأسعار كاملة؟{" "}
          <Link to="/plans" className="font-medium text-primary hover:underline">
            صفحة الباقات والأسعار
          </Link>
        </p>

        <CompareFaq />

      </main>
      <SiteFooter />

      <PlanRequestDialog
        open={selected !== null}
        onOpenChange={(v) => !v && setSelected(null)}
        planId={selected?.id ?? null}
        planName={selected?.name_ar ?? ""}
        period={period}
      />
    </div>
  );
}
