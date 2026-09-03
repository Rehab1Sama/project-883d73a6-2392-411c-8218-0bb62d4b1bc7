import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AccountStatus } from "@/lib/account-status.functions";

const schema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
});

export type AccountMember = {
  id: string;
  user_id: string;
  role: string;
  is_volunteer: boolean;
  track_id: string | null;
  circle_id: string | null;
  account_status: AccountStatus;
  leave_start: string | null;
  leave_end: string | null;
  full_name: string | null;
  email: string | null;
  circle_name: string | null;
  track_name: string | null;
};

export type AccountStudent = {
  id: string;
  full_name: string;
  email: string | null;
  user_id: string;
  status: AccountStatus;
  leave_start: string | null;
  leave_end: string | null;
  circle_id: string | null;
  circle_name: string | null;
  track_name: string | null;
};

/**
 * قائمة حسابات المقرأة (الكادر + الطالبات صاحبات حسابات الدخول) مع الأسماء
 * والبُرد وأسماء الحلقات والمسارات.
 *
 * تُقرأ من الخادم بمفتاح إداري لأن سياسات الحماية تمنع القائدة من قراءة صفوف
 * `profiles` الخاصة بالعضوات الأخريات من المتصفح، فتظهر الصفوف بلا اسم ولا بريد.
 */
export const listTenantAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, slug")
      .eq("slug", data.slug)
      .maybeSingle();
    if (tenantError) throw new Error(tenantError.message);
    if (!tenant) throw new Error("المقرأة غير موجودة");

    const { data: isManager } = await supabase.rpc("is_tenant_manager", {
      _user_id: userId,
      _tenant_id: tenant.id,
    });
    if (!isManager) throw new Error("غير مصرح لك بهذا الإجراء");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [rolesRes, circlesRes, tracksRes, studentsRes] = await Promise.all([
      supabaseAdmin
        .from("user_roles")
        .select("id, user_id, role, is_volunteer, track_id, circle_id, account_status, leave_start, leave_end")
        .eq("tenant_id", tenant.id),
      supabaseAdmin.from("circles").select("id, name, track_id").eq("tenant_id", tenant.id).order("name"),
      supabaseAdmin.from("tracks").select("id, name").eq("tenant_id", tenant.id).order("name"),
      supabaseAdmin
        .from("students")
        .select("id, full_name, user_id, status, leave_start, leave_end, circle_students(circle_id)")
        .eq("tenant_id", tenant.id)
        .not("user_id", "is", null)
        .order("full_name"),
    ]);
    if (rolesRes.error) throw new Error(rolesRes.error.message);
    if (circlesRes.error) throw new Error(circlesRes.error.message);
    if (tracksRes.error) throw new Error(tracksRes.error.message);
    if (studentsRes.error) throw new Error(studentsRes.error.message);

    const roles = (rolesRes.data ?? []) as unknown as Omit<
      AccountMember,
      "full_name" | "email" | "circle_name" | "track_name"
    >[];
    const circles = (circlesRes.data ?? []) as { id: string; name: string; track_id: string | null }[];
    const tracks = (tracksRes.data ?? []) as { id: string; name: string }[];
    const students = (studentsRes.data ?? []) as unknown as {
      id: string;
      full_name: string;
      user_id: string;
      status?: string | null;
      leave_start?: string | null;
      leave_end?: string | null;
      circle_students?: { circle_id: string }[] | null;
    }[];

    const circleById = new Map(circles.map((c) => [c.id, c]));
    const trackById = new Map(tracks.map((t) => [t.id, t]));

    const userIds = [...new Set([...roles.map((r) => r.user_id), ...students.map((s) => s.user_id)])].filter(Boolean);
    const profileById = new Map<string, { full_name: string | null; email: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      if (profilesError) throw new Error(profilesError.message);
      for (const p of (profiles ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
        profileById.set(p.id, { full_name: p.full_name, email: p.email });
      }
    }

    const trackNameFor = (circleId: string | null, trackId: string | null): string | null => {
      const fromCircle = circleId ? circleById.get(circleId)?.track_id ?? null : null;
      const id = trackId ?? fromCircle;
      return id ? trackById.get(id)?.name ?? null : null;
    };

    const members: AccountMember[] = roles.map((r) => {
      const p = profileById.get(r.user_id);
      return {
        ...r,
        account_status: (r.account_status ?? "active") as AccountStatus,
        full_name: p?.full_name ?? null,
        email: p?.email ?? null,
        circle_name: r.circle_id ? circleById.get(r.circle_id)?.name ?? null : null,
        track_name: trackNameFor(r.circle_id, r.track_id),
      };
    });

    const studentAccounts: AccountStudent[] = students.map((s) => {
      const circleId = s.circle_students?.[0]?.circle_id ?? null;
      const p = profileById.get(s.user_id);
      return {
        id: s.id,
        full_name: s.full_name,
        email: p?.email ?? null,
        user_id: s.user_id,
        status: (s.status ?? "active") as AccountStatus,
        leave_start: s.leave_start ?? null,
        leave_end: s.leave_end ?? null,
        circle_id: circleId,
        circle_name: circleId ? circleById.get(circleId)?.name ?? null : null,
        track_name: trackNameFor(circleId, null),
      };
    });

    return { members, students: studentAccounts, circles, tracks };
  });
