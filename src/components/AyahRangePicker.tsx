import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SURAHS, ayahCount, countPages, type AyahRange } from "@/lib/quran";

export type RangeValue = {
  fromSurah: string;
  fromAyah: string;
  toSurah: string;
  toAyah: string;
};

export const emptyRange: RangeValue = { fromSurah: "", fromAyah: "", toSurah: "", toAyah: "" };

export function isCompleteRange(v: RangeValue) {
  return !!(v.fromSurah && v.fromAyah && v.toSurah && v.toAyah);
}

export function toRange(v: RangeValue): AyahRange | null {
  if (!isCompleteRange(v)) return null;
  return {
    fromSurah: Number(v.fromSurah),
    fromAyah: Number(v.fromAyah),
    toSurah: Number(v.toSurah),
    toAyah: Number(v.toAyah),
  };
}

export function rangePages(v: RangeValue): number | null {
  const r = toRange(v);
  return r ? countPages(r) : null;
}

function ayahOptions(surah: string) {
  const n = surah ? ayahCount(Number(surah)) : 0;
  return Array.from({ length: n }, (_, i) => i + 1);
}

export function AyahRangePicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: RangeValue;
  onChange: (v: RangeValue) => void;
  disabled?: boolean;
}) {
  const pages = rangePages(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm">{label}</Label>
        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">
          {pages === null ? "— أوجه" : `${pages} أوجه`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select
          disabled={!!disabled}
          value={value.fromSurah}
          onValueChange={(v) =>
            onChange({
              ...value,
              fromSurah: v,
              fromAyah: "1",
              toSurah: value.toSurah || v,
              toAyah: value.toSurah ? value.toAyah : "1",
            })
          }
        >
          <SelectTrigger><SelectValue placeholder="من سورة" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {SURAHS.map((s) => (
              <SelectItem key={s.number} value={String(s.number)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          disabled={!!disabled || !value.fromSurah}
          value={value.fromAyah}
          onValueChange={(v) => onChange({ ...value, fromAyah: v })}
        >
          <SelectTrigger><SelectValue placeholder="من آية" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {ayahOptions(value.fromSurah).map((a) => (
              <SelectItem key={a} value={String(a)}>آية {a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          disabled={!!disabled}
          value={value.toSurah}
          onValueChange={(v) => onChange({ ...value, toSurah: v, toAyah: "1" })}
        >
          <SelectTrigger><SelectValue placeholder="إلى سورة" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {SURAHS.map((s) => (
              <SelectItem key={s.number} value={String(s.number)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          disabled={!!disabled || !value.toSurah}
          value={value.toAyah}
          onValueChange={(v) => onChange({ ...value, toAyah: v })}
        >
          <SelectTrigger><SelectValue placeholder="إلى آية" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {ayahOptions(value.toSurah).map((a) => (
              <SelectItem key={a} value={String(a)}>آية {a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
