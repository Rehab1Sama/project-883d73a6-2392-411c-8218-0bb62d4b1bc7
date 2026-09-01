/** فئات المسارات (المناهج) — ثابتة، تختار منها كل مقرأة ما يناسبها */
export const TRACK_CATEGORY_LABELS: Record<string, string> = {
  hifz_new: "حفظ جديد",
  thabit_new: "تثبيت جديد",
  review_general: "مراجعة عامة",
  review_recent: "مراجعة قريبة",
  review_distant: "مراجعة بعيدة",
  tilawa: "تلاوة",
} as const;

export const TRACK_CATEGORY_KEYS = Object.keys(TRACK_CATEGORY_LABELS);

export function trackCategoryLabel(category: string | null | undefined): string {
  return TRACK_CATEGORY_LABELS[category ?? ""] ?? "—";
}

/** مسار واحد قد يجمع أكثر من منهج — نُرجع أسماء المناهج مرتبة */
export function trackCategoryList(track: {
  category?: string | null;
  categories?: string[] | null;
}): string[] {
  const list = track.categories && track.categories.length > 0
    ? track.categories
    : track.category
      ? [track.category]
      : [];
  return TRACK_CATEGORY_KEYS.filter((k) => list.includes(k)).map((k) => TRACK_CATEGORY_LABELS[k]!);
}

/** نص مختصر لعرض مناهج المسار في سطر واحد */
export function trackCategoriesLabel(track: {
  category?: string | null;
  categories?: string[] | null;
}): string {
  const list = trackCategoryList(track);
  return list.length > 0 ? list.join(" · ") : "—";
}
