import type { NavItem } from "@/components/layout/AppShell";
import { LayoutDashboard, Building2, Inbox, Layers, CircleDot, GraduationCap, Heart, BookOpenText, FileBarChart2, FileSpreadsheet, Wallet, CreditCard, Scale, Settings, Link2, BarChart3, Users } from "lucide-react";

export const platformNav: NavItem[] = [
  { label: "لوحة المنصة", to: "/platform", icon: <LayoutDashboard className="size-4" /> },
  { label: "المقارئ", to: "/platform/tenants", icon: <Building2 className="size-4" /> },
  { label: "مقارنة المقارئ", to: "/platform/compare", icon: <Scale className="size-4" /> },
  { label: "طلبات الاشتراك", to: "/platform/requests", icon: <Inbox className="size-4" /> },
  { label: "الباقات والأسعار", to: "/platform/plans", icon: <CreditCard className="size-4" /> },
  { label: "الفواتير والإيرادات", to: "/platform/billing", icon: <Wallet className="size-4" /> },
];

export function tenantNav(slug: string): NavItem[] {
  return [
    { label: "لوحة المقرأة", to: "/app/$slug", params: { slug }, icon: <LayoutDashboard className="size-4" /> },
    { label: "المسارات", to: "/app/$slug/tracks", params: { slug }, icon: <Layers className="size-4" />, feature: "tracks" },
    { label: "الحلقات", to: "/app/$slug/circles", params: { slug }, icon: <CircleDot className="size-4" />, feature: "circles", circleScoped: true },
    { label: "الطالبات", to: "/app/$slug/students", params: { slug }, icon: <GraduationCap className="size-4" />, feature: "students" },
    { label: "الأنصبة والتقدم", to: "/app/$slug/progress", params: { slug }, icon: <BookOpenText className="size-4" />, feature: "progress", recordOnly: true, circleScoped: true },
    { label: "السجلات والتصدير", to: "/app/$slug/records", params: { slug }, icon: <FileSpreadsheet className="size-4" />, feature: "exports" },
    // الإحصائيات متاحة لكل المقارئ في كل الباقات (بدون قيد ميزة)
    { label: "الإحصائيات", to: "/app/$slug/stats", params: { slug }, icon: <BarChart3 className="size-4" /> },
    { label: "التقارير", to: "/app/$slug/reports", params: { slug }, icon: <FileBarChart2 className="size-4" />, feature: "reports_basic" },
    { label: "المتطوعات", to: "/app/$slug/volunteers", params: { slug }, icon: <Heart className="size-4" />, feature: "volunteers" },
    { label: "أنصبة وغيابات الحلقة", to: "/app/$slug/circle-report", params: { slug }, icon: <FileBarChart2 className="size-4" />, circleScoped: true },
    { label: "الحسابات", to: "/app/$slug/accounts", params: { slug }, icon: <Users className="size-4" />, managerOnly: true },
    { label: "إدارة المقرأة", to: "/app/$slug/management", params: { slug }, icon: <Building2 className="size-4" />, managerOnly: true },
    { label: "روابط التسجيل", to: "/app/$slug/links", params: { slug }, icon: <Link2 className="size-4" />, managerOnly: true },
    // لوحة المقرأة والإعدادات والاشتراك متاحة دائمًا (لازم تقدر توصل لها لتدير الاشتراك حتى لو مقرأتها مغفولة الميزات)
    { label: "الاشتراك والفواتير", to: "/app/$slug/subscription", params: { slug }, icon: <CreditCard className="size-4" />, managerOnly: true },
    { label: "الإعدادات", to: "/app/$slug/settings", params: { slug }, icon: <Settings className="size-4" />, managerOnly: true },
  ];
}

/**
 * نفس tenantNav لكن مُصفّاة حسب الميزات المفعّلة فعليًا لهذه المقرأة، وحسب
 * صلاحية الإدارة للروابط المخصصة للقيادة (managerOnly)، وحسب صلاحية
 * الإدخال الحالية للمعلمة/المشرفة وفق إعداد progress_entry_mode
 * (recordOnly) — تُستخدم هذه بدل tenantNav() مباشرة في كل صفحات
 * /app/$slug حتى تختفي روابط الصفحات المعطّلة أو الإدارية أو غير
 * المسموح بها حاليًا من القائمة الجانبية بدل ما تظهر وتؤدي لصفحة محجوبة.
 *
 * ⚠️ "الأنصبة والتقدم" (recordOnly) صفحة مقصورة على المعلمة/المشرفة
 * المسموح لها بالإدخال حاليًا وفق إعداد المقرأة فقط — لا تظهر إطلاقًا
 * للقيادة أو النائبة الأكاديمية أو مالكة المنصة، بعكس بقية الروابط.
 */
export function visibleTenantNav(
  slug: string,
  hasFeature: (key: string) => boolean,
  canManage = false,
  canRecord = false,
  /**
   * المعلمة/المشرفة المقصورة على حلقتها: لا ترى إلا صفحة حلقتها وصفحة
   * رفع الأنصبة (إن كان إعداد المقرأة يسمح لها بالإدخال). كل ما عدا ذلك
   * — بما فيه الاشتراك والفواتير — مقصور على القيادة.
   */
  circleScopedOnly = false,
): NavItem[] {
  return tenantNav(slug).filter(
    (item) =>
      (!item.feature || hasFeature(item.feature)) &&
      (!item.managerOnly || canManage) &&
      (!item.recordOnly || canRecord) &&
      (!circleScopedOnly || item.circleScoped === true),
  );
}
