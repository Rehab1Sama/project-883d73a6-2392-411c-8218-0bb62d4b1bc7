/**
 * تحديد المقرأة الحالية من الرابط.
 * يدعم نمطين:
 *  1) مسار داخل الموقع:  /m/<slug>/...
 *  2) نطاق فرعي:         <slug>.suhub.app  (أو نطاق مخصص للمقرأة)
 * لا يتطلب إضافة مقرأة جديدة أي تعديل برمجي أو إعادة نشر.
 */

/** نطاقات المنصة نفسها — أي نطاق آخر يُعامل كنطاق مخصص لمقرأة */
export const PLATFORM_HOSTS = [
  "localhost",
  "suhub.app",
  "www.suhub.app",
] as const;

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "id-preview",
  "project",
]);

export type TenantLocator =
  | { kind: "slug"; value: string }
  | { kind: "domain"; value: string }
  | null;

function isPlatformHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (PLATFORM_HOSTS.includes(host as (typeof PLATFORM_HOSTS)[number])) return true;
  // بيئات لوفابل والمعاينة والنشر التجريبي
  return host.endsWith(".lovable.app") || host.endsWith(".vercel.app") || host.endsWith(".lovable.dev");
}

/** استخراج المقرأة من اسم النطاق (نطاق فرعي أو نطاق مخصص) */
export function tenantFromHostname(hostname: string | undefined | null): TenantLocator {
  if (!hostname) return null;
  const host = hostname.toLowerCase().split(":")[0]!;
  if (isPlatformHost(host)) {
    const parts = host.split(".");
    // slug.suhub.app
    if (parts.length >= 3 && host.endsWith("suhub.app")) {
      const sub = parts[0]!;
      if (!RESERVED_SUBDOMAINS.has(sub)) return { kind: "slug", value: sub };
    }
    return null;
  }
  return { kind: "domain", value: host };
}

/** استخراج المقرأة من المسار /m/<slug> */
export function tenantFromPathname(pathname: string): TenantLocator {
  const match = /^\/m\/([a-z0-9-]+)/i.exec(pathname);
  return match ? { kind: "slug", value: match[1]!.toLowerCase() } : null;
}

/** تحديد المقرأة من الرابط الكامل (المسار له الأولوية) */
export function resolveTenantLocator(hostname: string, pathname: string): TenantLocator {
  return tenantFromPathname(pathname) ?? tenantFromHostname(hostname);
}

/** تحويل نص عربي/إنجليزي إلى رابط مختصر صالح */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9\u0621-\u064A-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
