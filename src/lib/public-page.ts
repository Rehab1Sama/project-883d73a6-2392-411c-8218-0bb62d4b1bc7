/**
 * محتوى "الصفحة التعريفية" (ميزة public_page) — يُخزَّن داخل عمود
 * tenants.settings (jsonb) تحت المفتاح public_page، بدل إضافة أعمدة
 * جديدة. المحتوى حرّ بالكامل: القائدة تكتب فقرة تعريفية + أقسامًا
 * بعنوان ونص، وترتّبها كما تريد، ولكل قسم درجة لون مأخوذة من هوية
 * المقرأة نفسها (الأساسي/المميّز) بدل ألوان عشوائية منفصلة.
 *
 * الظهور الفعلي على الرابط m/[slug] مشروط دائمًا بتفعيل ميزة
 * public_page للمقرأة (عبر tenant_effective_features) — وجود محتوى
 * محفوظ لا يعني ظهوره لو الميزة متوقفة. نفس الشرط مفروض أيضًا على
 * مستوى القاعدة (enforce_tenant_branding_gate) كخط دفاع ثانٍ ضد أي
 * تعديل مباشر يتجاوز الواجهة.
 */

import { darken, lighten, parseHex, readableOn } from "@/lib/theme-color";

export type PublicPageShade = "neutral" | "primary-soft" | "primary" | "accent-soft" | "accent";

export const PUBLIC_PAGE_SHADE_OPTIONS: { id: PublicPageShade; label: string }[] = [
  { id: "neutral", label: "محايد" },
  { id: "primary-soft", label: "الأساسي — فاتح" },
  { id: "primary", label: "الأساسي" },
  { id: "accent-soft", label: "المميّز — فاتح" },
  { id: "accent", label: "المميّز" },
];

const DEFAULT_SHADE: PublicPageShade = "neutral";
const SHADE_IDS = new Set<PublicPageShade>(PUBLIC_PAGE_SHADE_OPTIONS.map((o) => o.id));

function isPublicPageShade(v: unknown): v is PublicPageShade {
  return typeof v === "string" && SHADE_IDS.has(v as PublicPageShade);
}

export type PublicPageBlock = {
  id: string;
  title: string;
  body: string;
  shade: PublicPageShade;
};

export type PublicPageContent = {
  intro: string;
  blocks: PublicPageBlock[];
};

export const PUBLIC_PAGE_LIMITS = {
  maxBlocks: 6,
  maxIntro: 400,
  maxTitle: 60,
  maxBody: 600,
} as const;

export function emptyPublicPageContent(): PublicPageContent {
  return { intro: "", blocks: [] };
}

function newBlockId(): string {
  return `blk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newPublicPageBlock(): PublicPageBlock {
  return { id: newBlockId(), title: "", body: "", shade: DEFAULT_SHADE };
}

/** يحوّل درجة لون + هوية المقرأة (أساسي/مميّز) إلى ألوان جاهزة للعرض */
export function resolveShadeStyle(
  shade: PublicPageShade,
  primaryHex?: string | null,
  accentHex?: string | null,
): { background: string; border: string; foreground: string } | null {
  if (shade === "neutral") return null;

  const usesAccent = shade === "accent" || shade === "accent-soft";
  const soft = shade === "primary-soft" || shade === "accent-soft";
  const rgb = parseHex(usesAccent ? accentHex : primaryHex);
  if (!rgb) return null;

  if (soft) {
    return {
      background: lighten(rgb, 0.88),
      border: lighten(rgb, 0.7),
      foreground: darken(rgb, 0.35),
    };
  }
  return {
    background: usesAccent ? accentHex!.trim() : primaryHex!.trim(),
    border: darken(rgb, 0.12),
    foreground: readableOn(rgb),
  };
}

/** يقرأ محتوى الصفحة التعريفية من settings بأمان (بلا افتراض شكل صحيح دائمًا) */
export function parsePublicPageContent(settings: unknown): PublicPageContent {
  const raw =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)["public_page"]
      : null;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyPublicPageContent();

  const r = raw as Record<string, unknown>;
  const intro = typeof r["intro"] === "string" ? r["intro"].slice(0, PUBLIC_PAGE_LIMITS.maxIntro) : "";

  const blocksRaw = Array.isArray(r["blocks"]) ? r["blocks"] : [];
  const blocks: PublicPageBlock[] = blocksRaw
    .slice(0, PUBLIC_PAGE_LIMITS.maxBlocks)
    .map((b): PublicPageBlock | null => {
      if (!b || typeof b !== "object") return null;
      const bo = b as Record<string, unknown>;
      const title = typeof bo["title"] === "string" ? bo["title"].slice(0, PUBLIC_PAGE_LIMITS.maxTitle) : "";
      const body = typeof bo["body"] === "string" ? bo["body"].slice(0, PUBLIC_PAGE_LIMITS.maxBody) : "";
      const id = typeof bo["id"] === "string" && bo["id"] ? bo["id"] : newBlockId();
      const shade = isPublicPageShade(bo["shade"]) ? bo["shade"] : DEFAULT_SHADE;
      return { id, title, body, shade };
    })
    .filter((b): b is PublicPageBlock => b !== null);

  return { intro, blocks };
}

/** يدمج محتوى الصفحة التعريفية داخل settings الحالي دون فقد مفاتيح أخرى مستقبلية */
export function withPublicPageContent(settings: unknown, content: PublicPageContent): Record<string, unknown> {
  const base =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? { ...(settings as Record<string, unknown>) }
      : {};
  base["public_page"] = {
    intro: content.intro.trim().slice(0, PUBLIC_PAGE_LIMITS.maxIntro),
    blocks: content.blocks
      .map((b) => ({
        id: b.id,
        title: b.title.trim().slice(0, PUBLIC_PAGE_LIMITS.maxTitle),
        body: b.body.trim().slice(0, PUBLIC_PAGE_LIMITS.maxBody),
        shade: isPublicPageShade(b.shade) ? b.shade : DEFAULT_SHADE,
      }))
      .filter((b) => b.title || b.body)
      .slice(0, PUBLIC_PAGE_LIMITS.maxBlocks),
  };
  return base;
}

/** هل هناك محتوى فعلي يستحق العرض؟ */
export function hasPublicPageContent(content: PublicPageContent): boolean {
  return Boolean(content.intro.trim()) || content.blocks.some((b) => b.title.trim() || b.body.trim());
}

