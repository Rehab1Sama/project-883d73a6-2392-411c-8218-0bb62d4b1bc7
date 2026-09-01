import { useEffect, useState } from "react";
import { darken, lighten, parseHex, readableOn } from "@/lib/theme-color";

/** يراقب الوضع الليلي حتى تُعاد توليد ألوان المقرأة عند التبديل */
function useDarkMode(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

/**
 * يطبّق هوية المقرأة اللونية على كل مستويات الواجهة:
 * الأزرار، الحلقات، الشريط الجانبي، الخلفيات الناعمة، والرسوم البيانية.
 */
export function useTenantTheme(primary?: string | null, accent?: string | null) {
  const dark = useDarkMode();

  useEffect(() => {
    const root = document.documentElement;
    const applied: string[] = [];
    const set = (prop: string, value: string) => {
      root.style.setProperty(prop, value);
      applied.push(prop);
    };

    const p = parseHex(primary);
    if (p) {
      const base = dark ? lighten(p, 0.18) : primary!.trim();
      set("--primary", base);
      set("--primary-foreground", dark ? darken(p, 0.78) : readableOn(p));
      set("--primary-soft", dark ? darken(p, 0.68) : lighten(p, 0.86));
      set("--ring", dark ? lighten(p, 0.2) : darken(p, 0.1));
      set("--accent", dark ? darken(p, 0.66) : lighten(p, 0.9));
      set("--accent-foreground", dark ? lighten(p, 0.82) : darken(p, 0.6));
      set("--chart-1", base);
      set("--chart-2", lighten(p, 0.35));
      set("--sidebar", darken(p, dark ? 0.8 : 0.66));
      set("--sidebar-foreground", lighten(p, 0.94));
      set("--sidebar-accent", darken(p, dark ? 0.66 : 0.5));
      set("--sidebar-accent-foreground", "#ffffff");
      set("--sidebar-border", darken(p, dark ? 0.7 : 0.55));
      set("--sidebar-ring", lighten(p, 0.3));
    }

    const a = parseHex(accent);
    if (a) {
      set("--gold", dark ? lighten(a, 0.12) : accent!.trim());
      set("--gold-foreground", readableOn(a));
      set("--chart-3", accent!.trim());
      set("--sidebar-primary", lighten(a, 0.16));
      set("--sidebar-primary-foreground", darken(a, 0.72));
    }

    return () => applied.forEach((prop) => root.style.removeProperty(prop));
  }, [primary, accent, dark]);
}
