import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FeatureRow = {
  key: string;
  name_ar: string;
  description_ar: string | null;
  default_enabled: boolean;
  sort_order: number;
};

/** دليل الميزات المتاحة في المنصة */
export function useFeatureCatalog() {
  return useQuery({
    queryKey: ["features"],
    queryFn: async (): Promise<FeatureRow[]> => {
      const { data, error } = await supabase
        .from("features")
        .select("key, name_ar, description_ar, default_enabled, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * الميزات الفعلية لمقرأة محددة = ميزات باقتها النشطة عبر plan_features
 * + أي استثناء يدوي صريح من مالكة المنصة عبر tenant_features (يطغى دائمًا
 * على الباقة). بلا اشتراك نشط = بلا ميزات إطلاقًا إلا الممنوح يدويًا.
 *
 * يستدعي دالة قاعدة البيانات الموحّدة tenant_effective_features() حتى
 * تعطي نافذة تفعيل الميزات (لمالكة المنصة) وصفحات المقرأة نفسها نفس
 * النتيجة دائمًا، بدل ما يكون فيه منطقين مختلفين متضاربين.
 */
export function useTenantFeatures(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ["tenant-features", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<Record<string, boolean>> => {
      const { data, error } = await supabase.rpc("tenant_effective_features", {
        _tenant_id: tenantId!,
      });
      if (error) throw error;

      const map: Record<string, boolean> = {};
      for (const row of data ?? []) map[row.feature_key] = row.enabled;
      return map;
    },
  });
}
