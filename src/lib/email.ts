/** توحيد صيغة البريد للمقارنة (مسافات، حالة الأحرف، نقاط وعلامة + في جيميل) */
export function normalizeEmail(value: string | null | undefined): string {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  const at = raw.lastIndexOf("@");
  if (at < 1) return raw;
  let name = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    name = name.split("+")[0]!.replace(/\./g, "");
    return `${name}@gmail.com`;
  }
  const plus = name.indexOf("+");
  if (plus > 0) name = name.slice(0, plus);
  return `${name}@${domain}`;
}
