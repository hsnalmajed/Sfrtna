import Link from "next/link";
import type { Locale } from "@/lib/types";
import { quickTools } from "@/lib/quickTools";
import Icon from "@/components/ui/Icon";

/**
 * Home: our six tools under the best destinations (owner, 21 Nov 2026) —
 * on the page's own background, no band or frame; each one an app-style
 * navy tile with a gold line icon (the logo's colours) and a one-word name,
 * so all six sit in one row on a phone with nothing to scroll. Wider
 * screens show the full names.
 */
export default function QuickTools({ locale, dict }: { locale: Locale; dict: Parameters<typeof quickTools>[1] & { nav: { menu: string } } }) {
  const tools = quickTools(locale, dict);
  return (
    <nav aria-label={dict.nav.menu} className="mx-auto max-w-3xl px-3 pb-6 pt-8 sm:px-6">
      <ul className="grid grid-cols-6 gap-1 sm:gap-4">
        {tools.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              prefetch={false}
              aria-label={t.label}
              className="group flex flex-col items-center gap-1.5 rounded-2xl py-1 text-center text-[0.72rem] font-extrabold leading-tight text-navy-900 sm:text-sm"
            >
              <span className="grid h-12 w-12 place-items-center rounded-[1rem] bg-navy-950 text-[#f8b840] shadow-[0_10px_22px_-12px_rgba(6,38,83,0.65)] ring-1 ring-white/10 transition group-hover:-translate-y-0.5 group-hover:shadow-[0_14px_26px_-12px_rgba(6,38,83,0.7)] group-active:scale-95 sm:h-14 sm:w-14">
                <Icon name={t.glyph} className="h-6 w-6 sm:h-7 sm:w-7" />
              </span>
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
