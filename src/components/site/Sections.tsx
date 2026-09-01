import * as Icons from "lucide-react";
import type { FeatureItem } from "@/lib/site-content";

type IconName = keyof typeof Icons;

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="text-center">
      <span className="inline-flex rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
        {eyebrow}
      </span>
      <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl">{title}</h2>
      {subtitle ? (
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export function IconCardGrid({ items }: { items: FeatureItem[] }) {
  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2">
      {items.map((item) => {
        const Icon = (Icons[item.icon as IconName] ?? Icons.Sparkles) as Icons.LucideIcon;
        return (
          <article key={item.title} className="surface-panel p-6">
            <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
              <Icon className="size-5" />
            </span>
            <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
          </article>
        );
      })}
    </div>
  );
}
