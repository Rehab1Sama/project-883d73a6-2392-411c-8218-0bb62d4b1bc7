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

  /**
   * يستنتج مسار الحلقة عندما لا تذكر القائدة اسم المسار في الملف:
   *  1) اسم مسار صريح في الملف → يُستخدم كما هو (ويُنشأ إن لم يوجد).
   *  2) حلقة موجودة بنفس الاسم في المقرأة → يُستخدم مسارها.
   *  3) مسار موجود اسمه بداية اسم الحلقة (مثال: حلقة "البهور ١" → مسار
   *     "البهور") → أطول تطابق يفوز.
   *  4) وإلا: يُشتق اسم المسار بحذف الترقيم من آخر اسم الحلقة
   *     ("البهور ١" → "البهور") ويُنشأ المسار بهذا الاسم.
   */
  async function resolveTrackForCircle(
    circleName: string,
    explicitTrackName?: string | null,
  ): Promise<string> {
    if (explicitTrackName && explicitTrackName.trim()) {
      return resolveTrackId(explicitTrackName);
    }

    const trimmed = circleName.trim();
    if (!trimmed) throw new Error("اسم الحلقة مطلوب");

    const { data: existingCircle } = await admin
      .from("circles")
      .select("track_id")
      .eq("tenant_id", tenantId)
      .ilike("name", trimmed)
      .not("track_id", "is", null)
      .maybeSingle();
    if (existingCircle?.track_id) return existingCircle.track_id;

    const { data: tracks } = await admin
      .from("tracks")
      .select("id, name")
      .eq("tenant_id", tenantId);

    const lower = trimmed.toLowerCase();
    let best: { id: string; len: number } | null = null;
    for (const t of tracks ?? []) {
      const tn = String(t.name ?? "").trim().toLowerCase();
      if (!tn) continue;
      if (lower === tn || lower.startsWith(tn)) {
        if (!best || tn.length > best.len) best = { id: t.id, len: tn.length };
      }
    }
    if (best) return best.id;

    return resolveTrackId(stripTrailingIndex(trimmed));
  }

  return { resolveTrackId, resolveCircleId, resolveTrackForCircle };
}


/** يحذف الترقيم من آخر اسم الحلقة: "البهور ١" → "البهور"، "Nour 2" → "Nour" */
export function stripTrailingIndex(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\s\-_/]*(?:رقم|no\.?|#)?[\s\-_/]*[0-9\u0660-\u0669\u06F0-\u06F9]+$/u, "")
    .trim();
  return cleaned || name.trim();
}
