import type { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * يبني دوال "أحضري المسار/الحلقة أو أنشئيها" لمقرأة معيّنة — تُستخدم من
 * عمليات الاستيراد الدفعي (متطوعات/طالبات) لتفادي تكرار نفس المسار أو
 * الحلقة عند ظهور اسمها أكثر من مرة بنفس الملف.
 */
export function createTrackCircleResolver(admin: typeof supabaseAdmin, tenantId: string) {
  const trackCache = new Map<string, string>();
  const circleCache = new Map<string, string>();

  async function resolveTrackId(name: string): Promise<string> {
    const trimmed = name.trim();
    const key = trimmed.toLowerCase();
    const cached = trackCache.get(key);
    if (cached) return cached;

    const { data: existing } = await admin
      .from("tracks")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("name", trimmed)
      .maybeSingle();
    if (existing) {
      trackCache.set(key, existing.id);
      return existing.id;
    }

    const { data: created, error } = await admin
      .from("tracks")
      .insert({
        tenant_id: tenantId,
        name: trimmed,
        // فئة افتراضية عند الإنشاء التلقائي من الاستيراد — يمكن تعديلها
        // لاحقًا من صفحة "المسارات" (حفظ جديد/مراجعة/تلاوة...).
        category: "hifz_new",
      })
      .select("id")
      .single();
    if (error) throw new Error(`تعذّر إنشاء المسار "${trimmed}": ${error.message}`);
    trackCache.set(key, created.id);
    return created.id;
  }

  async function resolveCircleId(trackId: string, name: string): Promise<string> {
    const trimmed = name.trim();
    const key = `${trackId}::${trimmed.toLowerCase()}`;
    const cached = circleCache.get(key);
    if (cached) return cached;

    const { data: existing } = await admin
      .from("circles")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("track_id", trackId)
      .ilike("name", trimmed)
      .maybeSingle();
    if (existing) {
      circleCache.set(key, existing.id);
      return existing.id;
    }

    const { data: created, error } = await admin
      .from("circles")
      .insert({ tenant_id: tenantId, track_id: trackId, name: trimmed })
      .select("id")
      .single();
    if (error) throw new Error(`تعذّر إنشاء الحلقة "${trimmed}": ${error.message}`);
    circleCache.set(key, created.id);
    return created.id;
  }

  return { resolveTrackId, resolveCircleId };
}
