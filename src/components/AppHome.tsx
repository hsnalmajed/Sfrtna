"use client";

import Link from "next/link";
import { getDictionary } from "@/lib/dictionaries";
import { openPlanner, type PlanProduct } from "@/lib/planEvents";
import Icon, { type IconName } from "@/components/ui/Icon";
import type { Locale } from "@/lib/types";

/**
 * The homepage's opening in the phone app.
 *
 * The website opens on a photograph and a headline; an app opens on what
 * you came to do. So in the app (html.in-app — these render as app-only)
 * the first screen asks one question and answers it with two large
 * buttons — flights, hotels — that open the search right there. The
 * season cities follow, then the tools (AppHomeTools, after them).
 */
export function AppHomeIntro({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const choices: { product: PlanProduct; icon: IconName; title: string; hint: string }[] = [
    { product: "flights", icon: "plane", title: dict.productSelect.flightsTitle, hint: dict.productSelect.flightsHint },
    { product: "hotels", icon: "hotel", title: dict.productSelect.hotelsTitle, hint: dict.productSelect.hotelsHint },
  ];
  return (
    <div className="app-only w-full text-start">
      <h1 className="font-display text-[1.6rem] font-extrabold leading-tight text-navy-900">{dict.appHome.greeting}</h1>
      <p className="mt-1 text-sm text-[#5d6b80]">{dict.appHome.lead}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {choices.map((c) => (
          <button
            key={c.product}
            type="button"
            onClick={() => openPlanner(c.product)}
            className="flex flex-col items-start gap-3 rounded-2xl bg-white p-4 text-start shadow-[0_1px_2px_rgb(11_45_91/0.06),0_8px_20px_-14px_rgb(11_45_91/0.35)] ring-1 ring-navy-900/5 transition active:scale-[0.98]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sun-400 text-navy-950">
              <Icon name={c.icon} className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-display text-lg font-extrabold text-navy-900">{c.title}</span>
              <span className="mt-0.5 block text-xs leading-snug text-[#5d6b80]">{c.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AppHomeTools({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const tools = [
    { href: `/${locale}/visa`, icon: "🛂", label: dict.nav.visa },
    { href: `/${locale}/currency`, icon: "💱", label: dict.nav.currency },
    { href: `/${locale}/itinerary`, icon: "🗓️", label: dict.nav.itinerary },
    { href: `/${locale}/maps`, icon: "🗺️", label: dict.nav.maps },
  ];
  return (
    <section className="app-only mx-auto max-w-7xl px-4 pb-8">
      <h2 className="font-display text-lg font-extrabold text-navy-900">{dict.appHome.toolsTitle}</h2>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {tools.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="flex flex-col items-center gap-2 rounded-2xl bg-white px-1 py-3 text-center ring-1 ring-navy-900/5 transition active:scale-[0.97]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mist-100 text-xl" aria-hidden="true">
              {t.icon}
            </span>
            <span className="text-[0.7rem] font-bold leading-tight text-navy-900">{t.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
