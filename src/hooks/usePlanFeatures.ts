import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FeatureRow } from "@/hooks/useTenantFeatures";

export type PlanFeature = Pick<FeatureRow, "key" | "name_ar" | "description_ar"> & {
  sort_order: number;
};

/** مزايا كل باقة (مفاتيح مرتبة) — key = plan_id */
export function usePlanFeatures() {
  return useQuery({
    queryKey: ["plan-features"],
    queryFn: async (): Promise<Record<string, PlanFeature[]>> => {
      const [links, catalog] = await Promise.all([
        supabase.from("plan_features").select("plan_id, feature_key, sort_order").order("sort_order"),
        supabase.from("features").select("key, name_ar, description_ar").order("sort_order"),
      ]);
      if (links.error) throw links.error;
      if (catalog.error) throw catalog.error;

      const byKey = new Map((catalog.data ?? []).map((f) => [f.key, f]));
      const map: Record<string, PlanFeature[]> = {};
      for (const link of links.data ?? []) {
        const feature = byKey.get(link.feature_key);
        if (!feature) continue;
        (map[link.plan_id] ??= []).push({ ...feature, sort_order: link.sort_order });
      }
      for (const list of Object.values(map)) list.sort((a, b) => a.sort_order - b.sort_order);
      return map;
    },
  });
}
