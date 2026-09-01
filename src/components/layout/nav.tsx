import type { NavItem } from "@/components/layout/AppShell";
import { LayoutDashboard, Building2, Inbox, Layers, CircleDot, GraduationCap, Heart, BookOpenText, FileBarChart2, FileSpreadsheet, Wallet, CreditCard, Scale } from "lucide-react";

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
    { label: "الحلقات", to: "/app/$slug/circles", params: { slug }, icon: <CircleDot className="size-4" />, feature: "circles" },
    { label: "الطالبات", to: "/app/$slug/students", params: { slug }, icon: <GraduationCap className="size-4" />, feature: "students" },
    { label: "الأنصبة والتقدم", to: "/app/$slug/progress", params: { slug }, icon: <BookOpenText className="size-4" />, feature: "progress" },
    { label: "السجلات والتصدير", to: "/app/$slug/records", params: { slug }, icon: <FileSpreadsheet className="size-4" />, feature: "exports" },
    { label: "التقارير", to: "/app/$slug/reports", params: { slug }, icon: <FileBarChart2 className="size-4" />, feature: "reports_basic" },
    { label: "المتطوعات", to: "/app/$slug/volunteers", params: { slug }, icon: <Heart className="size-4" />, feature: "volunteers" },
    // لوحة المقرأة والإعدادات والاشتراك متاحة دائمًا (لازم تقدر توصل لها لتدير الاشتراك حتى لو مقرأتها مغفولة الميزات)
    { label: "الاشتراك والفواتير", to: "/app/$slug/subscription", params: { slug }, icon: <CreditCard className="size-4" /> },
  ];
}

/**
 * نفس tenantNav لكن مُصفّاة حسب الميزات المفعّلة فعليًا لهذه المقرأة —
 * تُستخدم هذه بدل tenantNav() مباشرة في كل صفحات /app/$slug حتى تختفي
 * روابط الصفحات المعطّلة من القائمة الجانبية بدل ما تظهر وتؤدي لصفحة محجوبة.
 */
export function visibleTenantNav(slug: string, hasFeature: (key: string) => boolean): NavItem[] {
  return tenantNav(slug).filter((item) => !item.feature || hasFeature(item.feature));
}
