import { getRequest } from "@tanstack/react-start-server";
import { clientIp, checkRateLimit } from "@/lib/rate-limit.server";

/** يرفض الطلب برمز 429 عند تجاوز الحد — للاستخدام داخل دوال الخادم العامة */
export async function guardPublicRate(bucket: string, limit: number, windowSeconds: number) {
  let ip = "unknown";
  try {
    ip = clientIp(getRequest());
  } catch {
    // لا يوجد طلب متاح (تشغيل أثناء البناء) — نتجاوز الحد
    return;
  }
  const allowed = await checkRateLimit(bucket, ip, limit, windowSeconds);
  if (!allowed) {
    throw new Response("محاولات كثيرة، حاولي بعد قليل", {
      status: 429,
      headers: { "retry-after": "60" },
    });
  }
}
