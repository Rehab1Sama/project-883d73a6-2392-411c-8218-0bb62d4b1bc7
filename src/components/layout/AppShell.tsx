import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, X, LogOut, ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTenantLogo } from "@/lib/tenant-branding";
import { Button } from "@/components/ui/button";
import { InstallAppButton } from "@/components/InstallAppButton";
import { AssistantWidget } from "@/components/AssistantWidget";
import { cn } from "@/lib/utils";

export type NavItem = {
  label: string;
  to: string;
  params?: Record<string, string>;
  icon: ReactNode;
  /** مفتاح الميزة المطلوبة لإظهار هذا الرابط (اختياري). راجعي visibleTenantNav في nav.tsx */
  feature?: string;
};

export type Crumb = { label: string; to?: string; params?: Record<string, string> };

type Props = {
  brandName: string;
  brandSubtitle?: string;
  logoUrl?: string | null;
  nav: NavItem[];
  title: string;
  description?: string;
  crumbs?: Crumb[];
  actions?: ReactNode;
  children: ReactNode;
};

export function AppShell({
  brandName,
  brandSubtitle,
  logoUrl,
  nav,
  title,
  description,
  crumbs = [],
  actions,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const logo = useTenantLogo(logoUrl);

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = brandName.trim().slice(0, 1);

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        {logo ? (
          <img
            src={logo}
            alt={brandName}
            className="size-12 shrink-0 rounded-2xl bg-sidebar-accent object-contain p-1.5 ring-1 ring-sidebar-border"
          />
        ) : (
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sidebar-primary font-display text-xl font-bold text-sidebar-primary-foreground shadow-soft">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold leading-tight">{brandName}</p>
          {brandSubtitle ? (
            <p className="truncate text-[11px] tracking-wide text-sidebar-foreground/65">
              {brandSubtitle}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mx-5 h-px bg-sidebar-border" />

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            params={item.params as never}
            onClick={() => setOpen(false)}
            className="group relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[13.5px] text-sidebar-foreground/85 transition-all hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
            activeProps={{
              className:
                "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-soft ring-1 ring-sidebar-border",
            }}
            activeOptions={{ exact: true }}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-sidebar-accent/50 text-sidebar-primary transition-colors group-hover:bg-sidebar-accent">
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="m-3 rounded-2xl bg-sidebar-accent/60 p-3 ring-1 ring-sidebar-border">
        <div className="mb-2 flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
            {(profile?.full_name ?? user?.email ?? "؟").trim().slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{profile?.full_name ?? "مستخدمة"}</p>
            <p className="truncate text-[11px] text-sidebar-foreground/65" dir="ltr">
              {profile?.email ?? user?.email}
            </p>
          </div>
        </div>
        <InstallAppButton className="mb-2 w-full" />
        <button
          onClick={handleSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-sidebar/60 px-3 py-2 text-xs text-sidebar-foreground/85 transition-colors hover:bg-sidebar"
        >
          <LogOut className="size-3.5" />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 right-0 hidden w-72 border-l border-sidebar-border lg:block">
        {sidebar}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="إغلاق القائمة"
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 w-72 shadow-lifted">{sidebar}</div>
        </div>
      ) : null}

      <div className="lg:mr-72">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3.5 sm:px-7">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="القائمة"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
            <div className="min-w-0 flex-1">
              {crumbs.length > 0 ? (
                <div className="mb-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                  {crumbs.map((c, i) => (
                    <span key={c.label} className="flex items-center gap-1">
                      {c.to ? (
                        <Link to={c.to} params={c.params as never} className="hover:text-foreground">
                          {c.label}
                        </Link>
                      ) : (
                        <span>{c.label}</span>
                      )}
                      {i < crumbs.length - 1 ? <ChevronLeft className="size-3" /> : null}
                    </span>
                  ))}
                </div>
              ) : null}
              <h1 className="truncate font-display text-xl font-bold sm:text-2xl">{title}</h1>
            </div>
            {actions}
          </div>
        </header>

        <main className={cn("gradient-sky min-h-[calc(100vh-4rem)]")}>
          <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-7">
            {description ? (
              <p className="mb-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
            {children}
          </div>
        </main>
      </div>

      <AssistantWidget />
    </div>
  );
}
