import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

/**
 * المساعد الذكي داخل لوحة التحكم.
 * يجمع لمحة رقمية عن المقرأة (أو عن المنصة لمالكتها) ثم يُجيب بالعربية عبر Gemini API مباشرة.
 */
export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        slug: z.string().min(1).max(120).nullable().optional(),
        messages: z.array(messageSchema).min(1).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // حدّ استخدام لكل مستخدمة حتى لا يُستنزف رصيد المساعد
    const { checkRateLimit } = await import("@/lib/rate-limit.server");
    const allowed = await checkRateLimit("assistant_ask", context.userId, 20, 300);
    if (!allowed) {
      return { ok: false as const, reply: "وصلتِ حد استخدام المساعد مؤقتًا، حاولي بعد قليل." };
    }
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) {
      return {
        ok: false as const,
        reply:
          "المساعد غير مُفعّل بعد: أضيفي المتغيّر GEMINI_API_KEY في إعدادات البيئة (مفتاح من Google AI Studio) ثم أعيدي النشر.",
      };
    }

    const { supabase, userId } = context;
    let contextText = "";

    // مالكة المنصة يتخطى القيد دائمًا (للدعم الفني)؛ غيرها يحتاج تفعيل
    // ميزة "ai_assistant" لهذه المقرأة تحديدًا من إعدادات المنصة/الباقة.
    const { data: callerIsOwner } = await supabase.rpc("is_platform_owner", { _user_id: userId });

    if (data.slug) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id, name, slug, status")
        .eq("slug", data.slug)
        .maybeSingle();

      if (!tenant) return { ok: false as const, reply: "لم أتمكّن من الوصول لبيانات هذه المقرأة." };

      if (!callerIsOwner) {
        const { data: featureEnabled } = await supabase.rpc("tenant_has_feature", {
          _tenant_id: tenant.id,
          _feature_key: "ai_assistant",
        });
        if (!featureEnabled) {
          return {
            ok: false as const,
            reply: "المساعدة الذكية غير مفعّلة لمقرأتكِ حاليًا. تواصلي مع إدارة المنصة لتفعيلها.",
          };
        }
      }

      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const [students, circles, tracks, volunteers, progress, attendance] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("status", "active"),
        supabase.from("circles").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
        supabase.from("tracks").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("is_volunteer", true),
        supabase.from("progress_records").select("amount").eq("tenant_id", tenant.id).gte("record_date", since),
        supabase.from("attendance").select("status").eq("tenant_id", tenant.id).gte("record_date", since),
      ]);

      const totalOruj = (progress.data ?? []).reduce((a, r) => a + Number(r.amount ?? 0), 0);
      const att = attendance.data ?? [];
      const absent = att.filter((r) => r.status === "absent").length;

      contextText = [
        `المقرأة: ${tenant.name} (${tenant.slug}) — الحالة: ${tenant.status}`,
        `الطالبات النشطات: ${students.count ?? 0}`,
        `الحلقات: ${circles.count ?? 0} — المسارات: ${tracks.count ?? 0} — المتطوعات: ${volunteers.count ?? 0}`,
        `آخر ٣٠ يومًا: الأوجه المنجزة ${totalOruj}، سجلات الحضور ${att.length}، غياب ${absent}` +
          (att.length ? `، نسبة الغياب ${Math.round((absent / att.length) * 100)}%` : ""),
      ].join("\n");
    } else {
      if (!callerIsOwner) return { ok: false as const, reply: "هذه اللوحة متاحة لمالكة المنصة فقط." };

      const [tenants, active, requests] = await Promise.all([
        supabase.from("tenants").select("id", { count: "exact", head: true }),
        supabase.from("tenants").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("plan_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
      ]);
      contextText = [
        `عدد المقارئ: ${tenants.count ?? 0} — النشطة: ${active.count ?? 0}`,
        `طلبات الاشتراك المعلّقة: ${requests.count ?? 0}`,
      ].join("\n");
    }

    const system = [
      "أنتِ مساعدة ذكية داخل منصة «سُحُب» لإدارة مقارئ تحفيظ القرآن للفتيات.",
      "أجيبي دائمًا بالعربية الفصحى المبسّطة، بإيجاز ووضوح، وبصيغة المؤنث للمخاطَبة.",
      "استندي إلى الأرقام المرفقة عند الإجابة، ولا تختلقي بيانات غير موجودة.",
      "عند طلب تعديل أو ميزة غير متاحة، اشرحي الخطوات داخل اللوحة (الصفحة والزر) بدل الاعتذار العام.",
      "",
      "بيانات لحظية:",
      contextText,
    ].join("\n");

    const res = await fetch(
      // ملاحظة: Google أوقفت gemini-2.5-flash للمستخدمين الجدد (خطأ 404)
      // وتوصي رسميًا بـ gemini-3.6-flash. يمكن تجاوز هذا القيمة الافتراضية
      // عبر متغيّر البيئة GEMINI_MODEL بدون تعديل الكود مستقبلًا.
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env["GEMINI_MODEL"] ?? "gemini-3.6-flash"}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { role: "system", parts: [{ text: system }] },
          contents: data.messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          // ملاحظة: temperature/top_p/top_k أصبحت مُعطّلة (deprecated) بجيل
          // Gemini 3.x الجديد ولا تُطبَّق حتى لو أُرسلت — أُبقيت هنا فقط
          // maxOutputTokens لأنه المتاح الوحيد المدعوم بهذا الجيل.
          generationConfig: { maxOutputTokens: 1024 },
        }),
      },
    );

    if (res.status === 429) return { ok: false as const, reply: "تجاوزنا حدّ الاستخدام مؤقتًا، حاولي بعد قليل." };
    if (res.status === 400 || res.status === 403) {
      console.error("gemini api error", res.status, await res.text());
      return { ok: false as const, reply: "تعذّر التحقق من مفتاح Gemini، تأكدي من صحته." };
    }
    if (!res.ok) {
      console.error("gemini api error", res.status, await res.text());
      return { ok: false as const, reply: "تعذّر الوصول إلى المساعد الآن، حاولي مرة أخرى." };
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      promptFeedback?: { blockReason?: string };
    };
    if (json.promptFeedback?.blockReason) {
      return { ok: false as const, reply: "تعذّر توليد رد على هذا السؤال، حاولي صياغته بشكل مختلف." };
    }
    const reply = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") || "";
    return { ok: true as const, reply: reply || "لم أفهم السؤال، أعيدي صياغته." };
  });
