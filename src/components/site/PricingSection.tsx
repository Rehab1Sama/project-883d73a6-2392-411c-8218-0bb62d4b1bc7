import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Users, BookOpen, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui-blocks";
import { cn } from "@/lib/utils";
import {
  BILLING_OPTIONS,
  planPriceLabel,
  planComparePrice,
  planDiscountPercent,
  planLimits,
  planYearlySavingsPercent,
  planSetupFeeLabel,
  type BillingPeriod,
  type PlanRow,
} from "@/lib/pricing";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { PlanRequestDialog } from "@/components/site/PlanRequestDialog";

const LIMIT_ICONS = [Users, BookOpen, GraduationCap];

export function PricingSection() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [selected, setSelected] = useState<PlanRow | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as PlanRow[];
    },
  });
  const { data: planFeatures } = usePlanFeatures();

  return (
    <div>
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
              {opt.hint ? (
                <span
                  className={cn(
                    "ms-1.5 text-[11px]",
                    period === opt.value ? "opacity-80" : "text-gold-foreground",
                  )}
                >
                  {opt.hint}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : (
        <div className="mt-10 grid items-start gap-5 md:grid-cols-2 lg:grid-cols-4">
          {plans?.map((plan) => {
            const price = planPriceLabel(plan, period);
            const before = planComparePrice(plan, period);
            const discount = planDiscountPercent(plan, period);
            const savings = period === "yearly" ? planYearlySavingsPercent(plan) : null;
            const highlights = (plan.features as string[] | null) ?? [];
            const linked = planFeatures?.[plan.id] ?? [];
            const limits = planLimits(plan);

            return (
              <article
                key={plan.id}
                className={cn(
                  "surface-panel relative flex flex-col p-6",
                  plan.is_featured && "ring-2 ring-primary lg:-mt-3 lg:pb-8",
                )}
              >
                {plan.is_featured ? (
                  <span className="absolute -top-3 start-6 rounded-full bg-gold px-3 py-1 text-xs font-medium text-gold-foreground">
                    الأكثر اختيارًا
                  </span>
                ) : null}

                <h3 className="text-xl font-semibold">{plan.name_ar}</h3>
                {plan.description_ar ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {plan.description_ar}
                  </p>
                ) : null}

                <p className="mt-5 font-display text-3xl font-bold tabular-nums">
                  {price.amount}
                  {price.suffix ? (
                    <span className="ms-2 text-sm font-normal text-muted-foreground">
                      {price.suffix}
                    </span>
                  ) : null}
                </p>

                <div className="mt-1.5 flex min-h-6 flex-wrap items-center gap-2 text-sm">
                  {before ? (
                    <>
                      <span className="text-muted-foreground line-through tabular-nums">
                        {before.toLocaleString("ar-EG")} {plan.currency}
                      </span>
                      {discount ? (
                        <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-medium text-gold-foreground">
                          خصم {discount.toLocaleString("ar-EG")}%
                        </span>
                      ) : null}
                    </>
                  ) : null}
                  {savings ? (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                      توفير {savings.toLocaleString("ar-EG")}% عن الشهري
                    </span>
                  ) : null}
                  {plan.is_custom_priced ? (
                    <span className="text-xs text-muted-foreground">اتفاق شهري أو سنوي</span>
                  ) : null}
                </div>

                {planSetupFeeLabel(plan) ? (
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {planSetupFeeLabel(plan)}
                  </p>
                ) : null}

                <dl className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/40 p-3 text-center">
                  {limits.map((limit, i) => {
                    const Icon = LIMIT_ICONS[i] ?? Users;
                    return (
                      <div key={limit.label}>
                        <Icon className="mx-auto size-4 text-primary" />
                        <dd className="mt-1 text-sm font-semibold tabular-nums">{limit.value}</dd>
                        <dt className="text-[11px] text-muted-foreground">{limit.label}</dt>
                      </div>
                    );
                  })}
                </dl>

                {highlights.length > 0 ? (
                  <ul className="mt-5 space-y-2.5 text-sm">
                    {highlights.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-success" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {linked.length > 0 ? (
                  <div className="mt-5 flex-1">
                    <p className="text-xs font-medium text-muted-foreground">تشمل الباقة</p>
                    <ul className="mt-2.5 space-y-2 text-sm">
                      {linked.map((f) => (
                        <li key={f.key} className="flex items-start gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                          <span>{f.name_ar}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="flex-1" />
                )}

                <Button
                  className="mt-6 w-full"
                  variant={plan.is_featured ? "default" : "outline"}
                  onClick={() => setSelected(plan)}
                >
                  {plan.is_custom_priced ? "تواصلي معنا" : "اطلبي هذه الخطة"}
                </Button>
              </article>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        جميع الباقات تشمل التحديثات والدعم الفني، ويمكن الترقية أو التغيير في أي وقت.
      </p>

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
