import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type TenantRow = Database["public"]["Tables"]["tenants"]["Row"];
export type PlanRow = Database["public"]["Tables"]["plans"]["Row"];

export const ROLE_LABELS: Record<AppRole, string> = {
  platform_owner: "مالكة المنصة",
  tenant_admin: "مديرة المقرأة",
  admin_deputy: "نائبة إدارية",
  academic_deputy: "نائبة أكاديمية",
  supervisor: "مشرفة",
  teacher: "معلمة",
  student: "طالبة",
};

export const TENANT_STATUS_LABELS: Record<string, string> = {
  active: "نشطة",
  suspended: "موقوفة",
  pending: "قيد التهيئة",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  trialing: "فترة تجريبية",
  active: "اشتراك فعّال",
  past_due: "متأخرة السداد",
  canceled: "ملغاة",
  expired: "منتهية",
};

/** الأدوار التي تملك صلاحيات إدارية داخل المقرأة */
export const MANAGER_ROLES: AppRole[] = ["tenant_admin", "admin_deputy"];

export function isManagerRole(role: AppRole): boolean {
  return MANAGER_ROLES.includes(role);
}
