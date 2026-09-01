/** أدوات ألوان بسيطة لتوليد هوية المقرأة من لون واحد */

type Rgb = { r: number; g: number; b: number };

export function parseHex(input?: string | null): Rgb | null {
  if (!input) return null;
  let hex = input.trim().replace(/^#/, "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: Rgb): string {
  const part = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  };
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 12, g: 18, b: 28 };

/** خلط اللون مع الأبيض (amount من 0 إلى 1) */
export function lighten(color: Rgb, amount: number): string {
  return toHex(mix(color, WHITE, amount));
}

/** خلط اللون مع الأسود المائل للأزرق */
export function darken(color: Rgb, amount: number): string {
  return toHex(mix(color, BLACK, amount));
}

/** سطوع نسبي مبسّط لاختيار لون النص المناسب */
export function luminance({ r, g, b }: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** أبيض أو داكن حسب خلفية اللون */
export function readableOn(color: Rgb): string {
  return luminance(color) > 0.5 ? "#111827" : "#ffffff";
}
