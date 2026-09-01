import * as ExcelJS from "exceljs";
import type { AttendanceStatus, TenantProgressMode } from "@/lib/types";

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "حاضرة",
  absent: "غائبة",
  excused: "معذورة",
};

export const ATTENDANCE_STATUS_KEYS: AttendanceStatus[] = ["present", "absent", "excused"];

export const PROGRESS_MODE_LABELS: Record<TenantProgressMode, string> = {
  teacher: "المعلمة فقط",
  supervisor: "المشرفة فقط",
  both: "المعلمة والمشرفة",
};

export const PROGRESS_MODE_OPTIONS: { value: TenantProgressMode; title: string; hint: string }[] = [
  { value: "teacher", title: "المعلمة", hint: "كل معلمة تُدخل الأنصبة والتقدم والحضور لطالبات حلقاتها." },
  { value: "supervisor", title: "المشرفة", hint: "المشرفة فقط تُدخل الأنصبة والتقدم والحضور على مستوى المقرأة." },
  { value: "both", title: "المعلمة والمشرفة", hint: "كلتاهما قادرتان على الإدخال." },
];

/** تصدير ملف إكسل وتنزيله من المتصفح */
async function downloadWorkbook(filename: string, build: (wb: ExcelJS.Workbook) => void) {
  const wb = new ExcelJS.Workbook();
  build(wb);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function wbSheet(wb: ExcelJS.Workbook, name: string) {
  const ws = wb.addWorksheet(name);
  ws.views = [{ rightToLeft: true } as unknown as ExcelJS.WorksheetViewNormal];
  return ws;
}

function styleHeader(ws: ExcelJS.Worksheet, row: number) {
  const header = ws.getRow(row);
  header.font = { bold: true };
  header.eachCell((c: ExcelJS.Cell) => {
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E7D8F" } };
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
  });
}

export type TrackExport = { name: string; category: string; oruj: number; absences: number };

export async function exportReportExcel(opts: {
  madrasa: string;
  periodLabel: string;
  students: number;
  staff: number;
  volunteers: number;
  totalOruj: number;
  totalAbsences: number;
  attendanceRatio: number | null;
  quotaStudents: number;
  metQuota: number;
  tracks: TrackExport[];
}) {
  await downloadWorkbook(`تقرير-${opts.madrasa}.xlsx`, (wb) => {
    const ws = wbSheet(wb, "الإحصائيات");
    ws.addRow(["تقرير إحصائيات — " + opts.madrasa]);
    ws.addRow(["الفترة: " + opts.periodLabel]);
    ws.addRow([]);
    const rows: [string, string | number][] = [
      ["عدد الطالبات", opts.students],
      ["عدد الموظفات/المتطوعات", opts.staff],
      ["عدد المتطوعات", opts.volunteers],
      ["إجمالي الأوجه المنجزة", opts.totalOruj],
      ["طالبات لديهن نصاب", opts.quotaStudents],
      ["أنجزن نصابهن في الفترة", opts.metQuota],
      ["إجمالي الغياب", opts.totalAbsences],
      ["نسبة الغياب", opts.attendanceRatio === null ? "—" : Math.round(opts.attendanceRatio * 100) + "%"],
    ];
    for (const [k, v] of rows) ws.addRow([k, v]);
    ws.addRow([]);
    ws.addRow(["التفاصيل حسب المسار"]);
    ws.addRow(["المسار", "الفئة", "الأوجه المنجزة", "الغياب"]);
    for (const t of opts.tracks) ws.addRow([t.name, t.category, t.oruj, t.absences]);
    ws.columns.forEach((c) => (c.width = 24));
    styleHeader(ws, 1);
  });
}

export async function exportStudentsExcel(opts: {
  madrasa: string;
  rows: { name: string; guardian: string; phone: string; dob: string; circles: string; status: string }[];
}) {
  await downloadWorkbook(`طالبات-${opts.madrasa}.xlsx`, (wb) => {
    const ws = wbSheet(wb, "الطالبات");
    ws.addRow(["اسم الطالبة", "ولي الأمر", "جوال ولي الأمر", "تاريخ الميلاد", "الحلقات", "الحالة"]);
    for (const r of opts.rows) ws.addRow([r.name, r.guardian, r.phone, r.dob, r.circles, r.status]);
    ws.columns.forEach((c) => (c.width = 22));
    styleHeader(ws, 1);
  });
}

export async function exportVolunteersExcel(opts: {
  madrasa: string;
  rows: { name: string; email: string; role: string; volunteer: boolean }[];
}) {
  await downloadWorkbook(`طاقم-${opts.madrasa}.xlsx`, (wb) => {
    const ws = wbSheet(wb, "الطاقم");
    ws.addRow(["الاسم", "البريد", "الدور", "متطوعة"]);
    for (const r of opts.rows) ws.addRow([r.name, r.email, r.role, r.volunteer ? "نعم" : "لا"]);
    ws.columns.forEach((c) => (c.width = 22));
    styleHeader(ws, 1);
  });
}

export type TenantCompareRow = {
  name: string;
  slug: string;
  status: string;
  plan: string;
  students: number;
  circles: number;
  teachers: number;
  volunteers: number;
  pages30d: number;
};

/** تصدير مقارنة المقارئ (لمالكة المنصة) إلى إكسل */
export async function exportTenantComparisonExcel(opts: { rows: TenantCompareRow[] }) {
  await downloadWorkbook(`مقارنة-المقارئ-${new Date().toISOString().slice(0, 10)}.xlsx`, (wb) => {
    const ws = wbSheet(wb, "المقارنة");
    ws.addRow(["مقارنة المقارئ — سُحُب"]);
    ws.addRow([`أُنشئ في ${new Date().toLocaleDateString("ar-SA")}`]);
    ws.addRow([]);
    ws.addRow(["المقرأة", "الرابط", "الحالة", "الباقة", "الطالبات", "الحلقات", "المعلمات", "المتطوعات", "الأوجه (٣٠ يوم)"]);
    for (const r of opts.rows)
      ws.addRow([r.name, r.slug, r.status, r.plan, r.students, r.circles, r.teachers, r.volunteers, r.pages30d]);
    ws.columns.forEach((c) => (c.width = 20));
    styleHeader(ws, 4);
  });
}

export type RecordExportRow = {
  date: string;
  student: string;
  circle: string;
  track: string;
  category: string;
  range: string;
  amount: number;
  notes: string;
};

export type QuotaExportRow = {
  student: string;
  track: string;
  category: string;
  period: string;
  range: string;
  target: number;
  notes: string;
};

const RECORD_HEADERS = ["التاريخ", "الطالبة", "الحلقة", "المسار", "المنهج", "النطاق", "الأوجه", "ملاحظات"];
const QUOTA_HEADERS = ["الطالبة", "المسار", "المنهج", "الفترة", "النطاق", "النصاب (أوجه)", "ملاحظات"];

/** تصدير سجلات التقدم والأنصبة إلى إكسل */
export async function exportRecordsExcel(opts: {
  madrasa: string;
  filterLabel: string;
  progress: RecordExportRow[];
  quotas: QuotaExportRow[];
}) {
  await downloadWorkbook(`سجلات-${opts.madrasa}.xlsx`, (wb) => {
    const ws = wbSheet(wb, "التقدم");
    ws.addRow([`سجلات التقدم — ${opts.madrasa}`]);
    ws.addRow([opts.filterLabel]);
    ws.addRow([]);
    ws.addRow(RECORD_HEADERS);
    for (const r of opts.progress)
      ws.addRow([r.date, r.student, r.circle, r.track, r.category, r.range, r.amount, r.notes]);
    ws.columns.forEach((c) => (c.width = 20));
    styleHeader(ws, 4);

    const qs = wbSheet(wb, "الأنصبة");
    qs.addRow([`الأنصبة — ${opts.madrasa}`]);
    qs.addRow([opts.filterLabel]);
    qs.addRow([]);
    qs.addRow(QUOTA_HEADERS);
    for (const q of opts.quotas)
      qs.addRow([q.student, q.track, q.category, q.period, q.range, q.target, q.notes]);
    qs.columns.forEach((c) => (c.width = 20));
    styleHeader(qs, 4);
  });
}

function csvCell(value: string | number) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** تنزيل ملف CSV (بترميز UTF-8 مع BOM ليفتح بالعربية في إكسل) */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const body = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function progressCsv(madrasa: string, rows: RecordExportRow[]) {
  downloadCsv(
    `تقدم-${madrasa}.csv`,
    RECORD_HEADERS,
    rows.map((r) => [r.date, r.student, r.circle, r.track, r.category, r.range, r.amount, r.notes]),
  );
}

export function quotasCsv(madrasa: string, rows: QuotaExportRow[]) {
  downloadCsv(
    `أنصبة-${madrasa}.csv`,
    QUOTA_HEADERS,
    rows.map((q) => [q.student, q.track, q.category, q.period, q.range, q.target, q.notes]),
  );
}
