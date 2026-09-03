import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * حفظ/حذف المسارات والحلقات عبر الخادم بعد التحقق من أن المستخدمة قائدة
 * (is_tenant_manager) — بدل الاعتماد على سياسات RLS من المتصفح التي كانت
 * ترفض الإدراج وتعطي "تعذّر الحفظ" بدون سبب واضح.
 */

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9-]+$/);

const trackCategoryEnum = z.enum([
  "hifz_new",
  "review_distant",
  "review_general",
  "review_recent",
  "thabit_new",
  "tilawa",
]);

const trackSchema = z.object({
  slug: slugSchema,
  id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  category: trackCategoryEnum,
  categories: z.array(trackCategoryEnum).min(1),
  age_group: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const circleSchema = z.object({
  slug: slugSchema,
  id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  track_id: z.string().uuid().nullable().optional(),
  teacher_name: z.string().trim().max(200).nullable().optional(),
  teacher_user_id: z.string().uuid().nullable().optional(),
  schedule: z.unknown().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const idSchema = z.object({ slug: slugSchema, id: z.string().uuid() });
const statusSchema = z.object({
  slug: slugSchema,
  id: z.string().uuid(),
  status: z.enum(["active", "inactive"]),
});

type AuthedContext = { supabase: any; userId: string };

async function requireManagerTenant(context: AuthedContext, slug: string) {
  const { supabase, userId } = context;
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!tenant) throw new Error("المقرأة غير موجودة");

  const { data: isManager } = await supabase.rpc("is_tenant_manager", {
    _user_id: userId,
    _tenant_id: tenant.id,
  });
  if (!isManager) throw new Error("غير مصرح لكِ بهذا الإجراء");
  return tenant.id as string;
}

export const saveTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => trackSchema.parse(input))
  .handler(async ({ data, context }) => {
    const tenantId = await requireManagerTenant(context as AuthedContext, data.slug);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      name: data.name,
      category: data.category,
      categories: data.categories,
      age_group: data.age_group || null,
      notes: data.notes || null,
    };

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("tracks")
        .update(payload)
        .eq("id", data.id)
        .eq("tenant_id", tenantId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: row, error } = await supabaseAdmin
      .from("tracks")
      .insert({ ...payload, tenant_id: tenantId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const setTrackStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => statusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const tenantId = await requireManagerTenant(context as AuthedContext, data.slug);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("tracks")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const tenantId = await requireManagerTenant(context as AuthedContext, data.slug);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("tracks")
      .delete()
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => circleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const tenantId = await requireManagerTenant(context as AuthedContext, data.slug);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      name: data.name,
      track_id: data.track_id || null,
      teacher_name: data.teacher_name || null,
      teacher_user_id: data.teacher_user_id || null,
      schedule: (data.schedule ?? null) as never,
      notes: data.notes || null,
    };

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("circles")
        .update(payload)
        .eq("id", data.id)
        .eq("tenant_id", tenantId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: allowed } = await supabaseAdmin.rpc("tenant_within_limit", {
      _tenant_id: tenantId,
      _kind: "circles",
    });
    if (allowed === false) {
      throw new Error("بلغتِ الحد الأقصى لعدد الحلقات في باقتك، رقّي الباقة للمتابعة");
    }

    const { data: row, error } = await supabaseAdmin
      .from("circles")
      .insert({ ...payload, tenant_id: tenantId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const tenantId = await requireManagerTenant(context as AuthedContext, data.slug);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("circles")
      .delete()
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
