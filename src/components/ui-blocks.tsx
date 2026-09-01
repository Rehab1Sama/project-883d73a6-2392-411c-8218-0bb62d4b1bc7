import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  tone?: "default" | "gold" | "success" | "warning";
}) {
  const toneClass = {
    default: "bg-primary-soft text-primary",
    gold: "bg-gold/15 text-gold-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
  }[tone];

  return (
    <div className="surface-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {icon ? (
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", toneClass)}>{icon}</span>
        ) : null}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="surface-panel flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon ? <div className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">{icon}</div> : null}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}

export function LoadingBlock({ label = "جارٍ التحميل…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
      <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      {label}
    </div>
  );
}

/** تُعرض بدل محتوى الصفحة إذا كانت ميزتها غير مفعّلة لباقة المقرأة الحالية */
export function FeatureLockedState({ tenantSlug }: { tenantSlug: string }) {
  return (
    <EmptyState
      icon={<Lock className="size-6" />}
      title="هذه الميزة غير مفعّلة لباقتك"
      description="باقة اشتراك مقرأتك الحالية لا تشمل هذه الصفحة. يمكنك الترقية لباقة أعلى من صفحة الاشتراك والفواتير."
      action={
        <Button asChild>
          <Link to="/app/$slug/subscription" params={{ slug: tenantSlug }}>
            عرض الاشتراك والباقات
          </Link>
        </Button>
      }
    />
  );
}
