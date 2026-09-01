import { Link } from "@tanstack/react-router";
import { Mail, Send } from "lucide-react";
import {
  SITE_NAV,
  CONTACT_EMAIL,
  CONTACT_TELEGRAM,
  CONTACT_TELEGRAM_URL,
  REPLY_TIME_TEXT,
} from "@/lib/site-content";
import suhubLogo from "@/assets/suhub-logo.png";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <img
              src={suhubLogo}
              alt="شعار منصة سُحُب"
              width={1024}
              height={1024}
              loading="lazy"
              className="size-10 object-contain"
            />
            <span className="font-display text-xl font-bold">سُحُب</span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            منصة هادئة لإدارة المقارئ: حضور وغياب، مسارات، وإحصائيات دقيقة — كل مقرأة ببياناتها
            ورابطها وحساباتها الخاصة.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold">تنقّل</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {SITE_NAV.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold">تواصل</h2>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-3 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Mail className="size-4" />
            <span dir="ltr">{CONTACT_EMAIL}</span>
          </a>
          <a
            href={CONTACT_TELEGRAM_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Send className="size-4" />
            <span dir="ltr">{CONTACT_TELEGRAM}</span>
          </a>
          <p className="mt-2 text-sm text-muted-foreground">{REPLY_TIME_TEXT}</p>
        </div>
      </div>

      <p className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        جميع الحقوق محفوظة — سُحُب ٢٠٢٦
      </p>
    </footer>
  );
}
