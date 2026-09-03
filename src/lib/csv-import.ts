/**
 * أدوات ملفات CSV للاستيراد الدفعي (الطالبات والمتطوعات).
 *
 * الفكرة: القائدة تحمّل نموذجًا جاهزًا بالأعمدة العربية، تعبّيه، ثم ترفعه —
 * والقراءة تعتمد على أسماء الأعمدة في الترويسة لا على ترتيبها، حتى لا ينكسر
 * الاستيراد إذا غيّرت ترتيب الأعمدة أو أضافت عمودًا زائدًا.
 */

/** يفكّك نص CSV إلى صفوف/خلايا مع دعم علامات الاقتباس والفواصل داخلها */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === "," || ch === ";") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** يبني نص CSV (مع BOM حتى يفتح صحيحًا في Excel العربي) */
export function buildCsv(headers: string[], sampleRows: string[][] = []): string {
  const escape = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [headers, ...sampleRows].map((r) => r.map(escape).join(","));
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

/** ينزّل ملف CSV في المتصفح */
export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * يحوّل صفوف CSV إلى كائنات بمفاتيح إنجليزية اعتمادًا على أسماء الترويسة،
 * حيث `aliases` تربط المفتاح بأسماء الأعمدة المقبولة (عربية أو إنجليزية).
 */
export function mapRows(
  rows: string[][],
  aliases: Record<string, string[]>,
): Record<string, string>[] {
  const header = (rows[0] ?? []).map((h) => h.trim().replace(/\s+/g, " "));
  const index: Record<string, number> = {};
  for (const [key, names] of Object.entries(aliases)) {
    const i = header.findIndex((h) => names.some((n) => n.trim() === h));
    if (i >= 0) index[key] = i;
  }
  return rows.slice(1).map((r) => {
    const out: Record<string, string> = {};
    for (const [key, i] of Object.entries(index)) out[key] = (r[i] ?? "").trim();
    return out;
  });
}

/** أعمدة ملف الطالبات */
export const STUDENT_HEADERS = [
  "الاسم",
  "البريد",
  "كلمة السر",
  "المسار",
  "الحلقة",
  "المستوى",
  "العمر",
  "البلد",
  "اسم ولي الأمر",
  "جوال ولي الأمر",
  "تاريخ الميلاد",
];

export const STUDENT_ALIASES: Record<string, string[]> = {
  full_name: ["الاسم", "اسم الطالبة", "full_name", "name"],
  email: ["البريد", "الايميل", "الإيميل", "email"],
  password: ["كلمة السر", "كلمة المرور", "password"],
  track_name: ["المسار", "track"],
  circle_name: ["الحلقة", "circle"],
  level: ["المستوى", "level"],
  age: ["العمر", "age"],
  country: ["البلد", "الدولة", "country"],
  guardian_name: ["اسم ولي الأمر", "ولي الأمر", "guardian_name"],
  guardian_phone: ["جوال ولي الأمر", "الجوال", "guardian_phone", "phone"],
  date_of_birth: ["تاريخ الميلاد", "date_of_birth", "dob"],
};

export const STUDENT_SAMPLE = [
  ["نورة أحمد", "noura@example.com", "Sahab12345", "البهور", "البهور ١", "المستوى الأول", "14", "السعودية", "أحمد", "0500000000", "2012-01-01"],
];

/** أعمدة ملف المتطوعات */
export const VOLUNTEER_HEADERS = [
  "الاسم",
  "البريد",
  "كلمة السر",
  "الدور",
  "المسار",
  "الحلقة",
  "العمر",
  "البلد",
];

export const VOLUNTEER_ALIASES: Record<string, string[]> = {
  full_name: ["الاسم", "الاسم الكامل", "full_name", "name"],
  email: ["البريد", "الايميل", "الإيميل", "email"],
  password: ["كلمة السر", "كلمة المرور", "password"],
  role_label: ["الدور", "role"],
  track_name: ["المسار", "track"],
  circle_name: ["الحلقة", "circle"],
  age: ["العمر", "age"],
  country: ["البلد", "الدولة", "country"],
};

export const VOLUNTEER_SAMPLE = [
  ["سارة محمد", "sara@example.com", "Sahab12345", "معلمة", "البهور", "البهور ١", "25", "السعودية"],
];

/** يحوّل نصًا إلى رقم أو null */
export function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
