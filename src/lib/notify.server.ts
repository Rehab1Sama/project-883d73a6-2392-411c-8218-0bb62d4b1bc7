/**
 * تنبيهات بريدية لمالكة المنصة عند وصول طلب باقة أو رسالة تواصل.
 * البريد يُرسل عبر بريد Lovable المُدار (يتطلب نطاق بريد مُهيّأ).
 * إن لم يكن مُهيّأً بعد فلا يفشل الطلب — يُسجّل تحذيرًا فقط.
 */
type NotifyInput = { subject: string; lines: string[]; replyTo?: string | null };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** يقبل EMAIL_FROM بأي صيغة ويُرجع صيغة صحيحة بحروف لاتينية (Resend يرفض بعض الأسماء غير اللاتينية) */
function normalizeFrom(raw: string): string | null {
  const address = raw.match(/[^<>\s,"']+@[^<>\s,"']+\.[a-zA-Z]{2,}/)?.[0];
  if (!address) return null;
  return `Suhub <${address}>`;
}

export async function notifyPlatformOwner({ subject, lines, replyTo }: NotifyInput): Promise<void> {
  const to = process.env["ADMIN_NOTIFY_EMAIL"];
  const fromRaw = process.env["EMAIL_FROM"];
  // في حال عدم ضبط نطاق مُوثَّق، نستخدم مُرسل Resend الافتراضي (يوصّل لصاحبة الحساب فقط — وهو المطلوب هنا)
  const from = (fromRaw ? normalizeFrom(fromRaw) : null) ?? "Suhub <onboarding@resend.dev>";
  const apiKey = process.env["RESEND_API_KEY"];

  const html = `<div dir="rtl" style="font-family:system-ui,-apple-system,Segoe UI,Tahoma,sans-serif;line-height:1.8;color:#1f2937">
  <h2 style="margin:0 0 12px">${escapeHtml(subject)}</h2>
  ${lines.map((l) => `<p style="margin:4px 0">${escapeHtml(l)}</p>`).join("")}
  <p style="margin-top:16px;font-size:12px;color:#6b7280">تنبيه تلقائي من منصة سُحُب</p>
</div>`;

  if (!to || !from || !apiKey) {
    console.warn("[notify] تنبيه البريد غير مُهيّأ — تم تخطي الإرسال:", subject);
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!response.ok) {
      console.error("[notify] فشل إرسال التنبيه", response.status, (await response.text()).slice(0, 300));
    }
  } catch (error) {
    console.error("[notify] خطأ في الإرسال", error instanceof Error ? error.message : error);
  }
}
