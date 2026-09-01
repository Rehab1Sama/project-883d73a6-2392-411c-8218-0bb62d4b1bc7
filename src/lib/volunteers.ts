import type { AppRole } from "@/lib/roles";

/** الأدوار المتاحة لتسجيل المتطوعات (لا تشمل مالكة المنصة أو مديرة المقرأة) */
export type VolunteerRole = Exclude<AppRole, "platform_owner" | "tenant_admin" | "student">;

/** الأدوار المتاحة في نموذج تسجيل المتطوعات */
export const VOLUNTEER_ROLE_OPTIONS: { value: VolunteerRole; label: string; hint: string }[] = [
  { value: "teacher", label: "معلمة", hint: "تحفيظ ومتابعة حلقة" },
  { value: "supervisor", label: "مشرفة", hint: "متابعة المعلمات والحلقات" },
  { value: "academic_deputy", label: "مسؤولة مسار", hint: "الإشراف على مسار وخططه" },
  { value: "admin_deputy", label: "مسؤولة إدارية", hint: "التنظيم والمهام الإدارية" },
];

export const VOLUNTEER_ROLES = VOLUNTEER_ROLE_OPTIONS;

export const VOLUNTEER_ROLE_LABELS: Record<string, string> = Object.fromEntries(
  VOLUNTEER_ROLE_OPTIONS.map((o) => [o.value, o.label]),
);

export const VOLUNTEER_STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  contacted: "تمت المتابعة",
  approved: "معتمد",
  rejected: "مرفوض",
};

/** تطبيع الدور القادم من ملف إكسل إلى دور معتمد في النظام */
export function normalizeRoleLabel(input: string): VolunteerRole {
  const v = (input ?? "").trim();
  if (/مشرف/.test(v)) return "supervisor";
  if (/مسار|أكاديم|اكاديم/.test(v)) return "academic_deputy";
  if (/إدار|ادار/.test(v)) return "admin_deputy";
  return "teacher";
}

export type ImportedVolunteer = {
  full_name: string;
  phone: string | null;
  email: string | null;
  preferred_role: VolunteerRole;
  note: string | null;
};
