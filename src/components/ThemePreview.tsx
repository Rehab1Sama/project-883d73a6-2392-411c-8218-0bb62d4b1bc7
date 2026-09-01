import { BookOpen, CalendarCheck, Users } from "lucide-react";
import { TenantLogo } from "@/components/TenantLogo";

type Props = {
  name: string;
  logo?: string | null | undefined;
  primary: string;
  accent: string;
};

/**
 * معاينة حيّة لهوية المقرأة: تعتمد على متغيّرات الثيم المطبّقة فورًا
 * من useTenantTheme، فتظهر الألوان الجديدة قبل الحفظ.
 */
export function ThemePreview({ name, logo, primary, accent }: Props) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border shadow-soft">
        {/* شريط جانبي مصغّر + محتوى */}
        <div className="flex">
          <div className="w-24 space-y-2 bg-sidebar p-3">
            <div className="flex items-center gap-1.5">
              <span className="grid size-6 place-items-center rounded-lg bg-sidebar-primary text-[10px] font-bold text-sidebar-primary-foreground">
                {name.trim().slice(0, 1)}
              </span>
              <span className="truncate text-[9px] text-sidebar-foreground/80">{name}</span>
            </div>
            <div className="rounded-lg bg-sidebar-accent px-2 py-1 text-[9px] text-sidebar-accent-foreground">
              لوحة المقرأة
            </div>
            <div className="px-2 py-1 text-[9px] text-sidebar-foreground/70">الحلقات</div>
            <div className="px-2 py-1 text-[9px] text-sidebar-foreground/70">الطالبات</div>
          </div>

          <div className="gradient-sky flex-1 space-y-3 p-4">
            <div className="flex items-center gap-2">
              <TenantLogo name={name} logo={logo} className="size-9" />
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-bold">{name}</p>
                <p className="text-[10px] text-muted-foreground">معاينة الهوية</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: <Users className="size-3" />, label: "الطالبات", value: "٤٨" },
                { icon: <BookOpen className="size-3" />, label: "الحلقات", value: "٦" },
                { icon: <CalendarCheck className="size-3" />, label: "الحضور", value: "٩٢٪" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-card p-2">
                  <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    {s.icon}
                    {s.label}
                  </span>
                  <p className="font-display text-sm font-bold text-primary">{s.value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="gradient-primary rounded-full px-3 py-1 text-[10px] font-medium text-primary-foreground">
                زر رئيسي
              </span>
              <span className="rounded-full bg-accent px-3 py-1 text-[10px] text-accent-foreground">
                زر ثانوي
              </span>
              <span className="rounded-full bg-gold px-3 py-1 text-[10px] font-medium text-gold-foreground">
                شارة مميّزة
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/3 rounded-full bg-primary" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-4 rounded-full border border-border" style={{ background: primary }} />
          الأساسي
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-4 rounded-full border border-border" style={{ background: accent }} />
          المميّز
        </span>
      </div>
    </div>
  );
}
