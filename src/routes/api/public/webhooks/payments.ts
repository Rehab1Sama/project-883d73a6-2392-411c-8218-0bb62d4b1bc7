import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * نقطة استقبال أحداث بوابة الدفع (Webhook) — المصدر الموثوق الوحيد لتفعيل الاشتراك.
 * لا تُربط ببوابة محددة بعد؛ العقد المتوقع:
 *   POST /api/public/webhooks/payments
 *   Headers: x-payment-provider, x-payment-signature (HMAC-SHA256 hex للنص الخام بمفتاح PAYMENTS_WEBHOOK_SECRET)
 *   Body: { "id": "<event id>", "type": "payment.succeeded" | "payment.failed" | ...,
 *           "data": { "intent_id": "<uuid>", "amount": 0, "customer_id": "", "subscription_id": "", "invoice_id": "" } }
 * كل حدث يُخزَّن مرة واحدة (provider + event id) فلا تتكرر المعالجة.
 */
const SUCCESS_TYPES = new Set([
  "payment.succeeded",
  "payment_intent.succeeded",
  "checkout.session.completed",
  "transaction.completed",
  "subscription.payment_succeeded",
]);
const FAILURE_TYPES = new Set([
  "payment.failed",
  "payment_intent.payment_failed",
  "transaction.payment_failed",
  "subscription.payment_failed",
]);

function verify(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature.replace(/^sha256=/, ""));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/webhooks/payments")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYMENTS_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });

        // حماية بسيطة: 60 طلبًا لكل دقيقة لكل عنوان (المسار مكشوف للعامة)
        const { clientIp, checkRateLimit, tooManyRequests } = await import("@/lib/rate-limit.server");
        if (!(await checkRateLimit("payments_webhook", clientIp(request), 60, 60))) {
          return tooManyRequests();
        }

        const rawBody = await request.text();
        const signature =
          request.headers.get("x-payment-signature") ??
          request.headers.get("x-signature") ??
          "";
        if (!signature || !verify(rawBody, signature, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const provider = request.headers.get("x-payment-provider") ?? String(payload["provider"] ?? "unknown");
        const eventId = String(payload["id"] ?? "");
        const eventType = String(payload["type"] ?? "");
        if (!eventId || !eventType) return new Response("Missing event id/type", { status: 400 });

        const eventData = (payload["data"] ?? {}) as Record<string, unknown>;
        const intentId = String(eventData["intent_id"] ?? eventData["intentId"] ?? "");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: event, error: insertError } = await supabaseAdmin
          .from("payment_webhook_events")
          .insert({
            provider,
            event_id: eventId,
            event_type: eventType,
            signature_verified: true,
            payload: payload as never,
            payment_intent_id: intentId || null,
          })
          .select("id")
          .single();

        // الحدث مُخزَّن مسبقًا => تمت معالجته، نردّ 200 لتجنّب إعادة الإرسال
        if (insertError) {
          if (insertError.code === "23505" || insertError.message.includes("duplicate")) {
            return new Response("Already processed", { status: 200 });
          }
          console.error("[payments-webhook] store failed", insertError.message);
          return new Response("Storage error", { status: 500 });
        }

        try {
          if (SUCCESS_TYPES.has(eventType)) {
            if (!intentId) throw new Error("intent_id مفقود في الحدث");
            const { activatePaidIntent } = await import("@/lib/billing.server");
            const result = await activatePaidIntent({
              intentId,
              provider,
              providerRef: eventData["reference"] ? String(eventData["reference"]) : null,
              providerCustomerId: eventData["customer_id"] ? String(eventData["customer_id"]) : null,
              providerSubscriptionId: eventData["subscription_id"] ? String(eventData["subscription_id"]) : null,
              providerInvoiceId: eventData["invoice_id"] ? String(eventData["invoice_id"]) : null,
              paidAmount: eventData["amount"] != null ? Number(eventData["amount"]) : null,
            });
            await supabaseAdmin
              .from("payment_webhook_events")
              .update({
                status: "processed",
                processed_at: new Date().toISOString(),
                tenant_id: result.tenantId ?? null,
                invoice_id: "invoiceId" in result ? result.invoiceId : null,
              })
              .eq("id", event.id);
          } else if (FAILURE_TYPES.has(eventType)) {
            if (intentId) {
              const { failIntent } = await import("@/lib/billing.server");
              await failIntent(intentId, String(eventData["reason"] ?? eventType), provider);
            }
            await supabaseAdmin
              .from("payment_webhook_events")
              .update({ status: "processed", processed_at: new Date().toISOString() })
              .eq("id", event.id);
          } else {
            await supabaseAdmin
              .from("payment_webhook_events")
              .update({ status: "ignored", processed_at: new Date().toISOString() })
              .eq("id", event.id);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "خطأ غير معروف";
          console.error("[payments-webhook] processing failed", message);
          await supabaseAdmin
            .from("payment_webhook_events")
            .update({ status: "error", error_message: message.slice(0, 500) })
            .eq("id", event.id);
          // 500 يجعل البوابة تعيد المحاولة لاحقًا
          return new Response("Processing error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
