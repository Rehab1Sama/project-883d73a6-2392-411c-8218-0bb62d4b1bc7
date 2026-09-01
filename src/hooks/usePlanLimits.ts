import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LimitKind } from "@/lib/billing";

export type PlanLimits = {
  planName: string | null;
  limits: Record<LimitKind, number>;
  usage: Record<LimitKind, number>;
};

/** حدود باقة المقرأة الحالية مقابل الاستخدام الفعلي (0 أو أقل = بلا حدود) */
export function usePlanLimits(tenantId: string | undefined) {
  const query = useQuery({
    queryKey: ["plan-limits", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<PlanLimits> => {
      const [limitsRes, usageRes] = await Promise.all([
        supabase.rpc("tenant_plan_limits", { _tenant_id: tenantId! }),
        supabase.rpc("tenant_usage", { _tenant_id: tenantId! }),
      ]);
      if (limitsRes.error) throw limitsRes.error;
      if (usageRes.error) throw usageRes.error;
      const l = limitsRes.data?.[0] ?? null;
      const u = usageRes.data?.[0] ?? null;
      return {
        planName: l?.plan_name ?? null,
        limits: {
          students: l?.max_students ?? 0,
          circles: l?.max_circles ?? 0,
          teachers: l?.max_teachers ?? 0,
        },
        usage: {
          students: u?.students ?? 0,
          circles: u?.circles ?? 0,
          teachers: u?.teachers ?? 0,
        },
      };
    },
  });

  const data = query.data;

  /** هل يمكن إضافة عنصر جديد من هذا النوع؟ */
  function canAdd(kind: LimitKind): boolean {
    if (!data) return true;
    const limit = data.limits[kind];
    if (!limit || limit <= 0) return true;
    return data.usage[kind] < limit;
  }

  function remaining(kind: LimitKind): number | null {
    if (!data) return null;
    const limit = data.limits[kind];
    if (!limit || limit <= 0) return null;
    return Math.max(0, limit - data.usage[kind]);
  }

  return { ...query, data, canAdd, remaining };
}
