/**
 * حدّ المحاولات للمسارات المفتوحة للعامة (بدون تسجيل دخول).
 * العدّاد محفوظ في قاعدة البيانات لأن الخوادم بلا حالة (stateless).
 */
export function clientIp(request: Request): string {
  const headers = request.headers;
  // ملاحظة أمنية: لا نثق إلا بهيدر تضمن منصة الاستضافة كتابته هي بنفسه.
  // على Vercel (وهو استضافة هذا المشروع حسب DEPLOY.md، بدون بروكسي خارجي
  // أمامه): توثيق Vercel الرسمي يؤكد أنها تستبدل قيمة `x-forwarded-for`
  // بالكامل بعنوان العميل الحقيقي ولا تمرّر أي قيمة يرسلها العميل نفسه —
  // فهو الهيدر الموثوق الوحيد هنا.
  // أما `cf-connecting-ip` فهو هيدر عادي غير محمي إطلاقًا ما لم يكن
  // Cloudflare فعليًا أمام التطبيق (غير الحال حاليًا) — وأي زائر يقدر
  // يرسله بنفسه بقيمة عشوائية ليحصل على "هوية" جديدة بكل طلب، فيتحايل
  // على كل حدود المعدّل بالتطبيق (نماذج التواصل، الدعوات، الـ webhook).
  // احذفي هذا التعليق وأعيدي تفعيل `cf-connecting-ip` فقط لو نقلتِ
  // التطبيق فعليًا خلف Cloudflare.
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();

  return headers.get("x-real-ip") ?? "unknown";
}

/** true = مسموح، false = تجاوز الحد */
export async function checkRateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("rate_limit_hit", {
      _bucket: bucket,
      _identifier: identifier.slice(0, 200),
      _limit: limit,
      _window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] failed", error.message);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.error("[rate-limit] error", e instanceof Error ? e.message : e);
    return true;
  }
}

export function tooManyRequests(): Response {
  return new Response("Too many requests", { status: 429, headers: { "retry-after": "60" } });
}
