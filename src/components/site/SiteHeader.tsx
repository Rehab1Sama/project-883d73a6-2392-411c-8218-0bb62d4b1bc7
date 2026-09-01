import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstallAppButton } from "@/components/InstallAppButton";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { SITE_NAV } from "@/lib/site-content";
import suhubLogo from "@/assets/suhub-logo.png";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { mode, toggle } = useTheme();
  const { user, loading } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3.5">
        <Link to="/" className="flex items-center gap-2.5">
          <img
            src={suhubLogo}
            alt="شعار منصة سُحُب"
            width={1024}
            height={1024}
            className="size-11 object-contain"
          />
          <span className="leading-tight">
            <span className="block font-display text-xl font-bold">سُحُب</span>
            <span className="block text-[11px] text-muted-foreground">منصة إدارة المقارئ</span>
          </span>
        </Link>


        <nav className="hidden items-center gap-1 lg:flex">
          {SITE_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-primary-soft text-primary font-medium" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={mode === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>

          <div className="hidden items-center gap-2 sm:flex">
            {loading ? null : user ? (
              <Button asChild size="sm">
                <Link to="/dashboard">لوحة التحكم</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm" variant="outline">
                  <Link to="/auth">دخول</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/plans">ابدئي مقرأتك</Link>
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="القائمة"
            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground lg:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-border bg-background px-5 py-3 lg:hidden">
          <nav className="grid gap-1">
            {SITE_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-primary-soft text-primary font-medium" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {user ? (
              <Button asChild className="col-span-2">
                <Link to="/dashboard" onClick={() => setOpen(false)}>
                  لوحة التحكم
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="outline">
                  <Link to="/auth" onClick={() => setOpen(false)}>
                    دخول
                  </Link>
                </Button>
                <Button asChild>
                  <Link to="/plans" onClick={() => setOpen(false)}>
                    ابدئي مقرأتك
                  </Link>
                </Button>
              </>
            )}
          </div>
          <InstallAppButton className="mt-2 w-full" />
        </div>
      ) : null}
    </header>
  );
}
