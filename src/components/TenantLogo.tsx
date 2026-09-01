import { useTenantLogo } from "@/lib/tenant-branding";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  logo?: string | null | undefined;
  className?: string;
};

/** يعرض شعار المقرأة كصورة حقيقية، أو الحرف الأول عند عدم وجود شعار */
export function TenantLogo({ name, logo, className }: Props) {
  const url = useTenantLogo(logo);
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        loading="lazy"
        className={cn("shrink-0 rounded-xl border border-border bg-card object-contain p-1", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-xl bg-primary-soft font-bold text-primary",
        className,
      )}
    >
      {name.trim().slice(0, 1)}
    </span>
  );
}
