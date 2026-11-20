import Link from "next/link";
import type { Locale } from "@/lib/types";
import { quickTools } from "@/lib/quickTools";
import ScrollRow from "@/components/ui/ScrollRow";

/**
 * Home: our tools in one row under the best destinations (owner, 21 Nov
 * 2026), the same six as the app's «المزيد». Phones scroll the row sideways
 * (the next tile peeks in); wider screens show all six side by side.
 */
export default function QuickTools({ locale, dict }: { locale: Locale; dict: Parameters<typeof quickTools>[1] & { nav: { menu: string } } }) {
  const tools = quickTools(locale, dict);
  return (
    <nav aria-label={dict.nav.menu} className="mx-auto max-w-6xl px-4 pb-4 pt-8 sm:px-6">
      <ScrollRow outerClassName="-mx-4 sm:mx-0" className="flex snap-x snap-mandatory gap-2.5 px-4 pb-2 sm:grid sm:grid-cols-6 sm:gap-3 sm:px-0">
        {tools.map((t) => (
          <div key={t.href} className="w-[5.6rem] shrink-0 snap-start sm:w-auto">
            <Link
              href={t.href}
              prefetch={false}
              className="flex h-full min-h-[5.75rem] flex-col items-center justify-center gap-2 rounded-2xl bg-white px-2 py-3 text-center text-[0.8rem] font-extrabold leading-snug text-navy-900 shadow-sm ring-1 ring-navy-900/5 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-sun-300 active:scale-[0.98] sm:text-sm"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-sun-50 text-2xl leading-none ring-1 ring-sun-200" aria-hidden="true">
                {t.icon}
              </span>
              {t.label}
            </Link>
          </div>
        ))}
      </ScrollRow>
    </nav>
  );
}
