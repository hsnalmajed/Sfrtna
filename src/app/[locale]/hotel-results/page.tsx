"use client";

import { Suspense, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import { parseChildrenAges } from "@/lib/searchParamsUtil";
import { hotelPartnerLinks } from "@/lib/affiliateLinks";
import { nightsBetween } from "@/components/PlannerFields";
import Icon from "@/components/ui/Icon";

/**
 * Hotel results — for now, the honest version.
 *
 * The hotel planner asks for everything a real comparison needs: the hotel
 * or the city, the nights, the party, and on the "suggest" tab the budget,
 * stars, room or apartment and breakfast. What this page can do with that
 * today is limited by one fact: there is no hotel price source. Hotellook,
 * the one this site was built on, closed in October 2025, and a price we do
 * not have is a price we do not print.
 *
 * So the page does the part that is true: it shows the search back, so the
 * traveller can check it, says plainly that the prices are at the partner,
 * and opens that partner's search with every filter it understands already
 * applied. When a real source arrives (a comparison widget or an API), it
 * slots in above the partner buttons and nothing else here has to change.
 */

export default function HotelResultsPage() {
  return (
    <Suspense fallback={null}>
      <HotelResultsContent />
    </Suspense>
  );
}

function HotelResultsContent() {
  const params = useParams();
  const locale = (params.locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(locale);
  const t = dict.hotelResults;
  const sp = useSearchParams();

  const mode = sp.get("hmode") === "discover" ? "discover" : "known";
  const query = (mode === "known" ? sp.get("hotel") : sp.get("city"))?.trim() || "";
  // What the heading shows, when it differs from what is searched: the
  // flight page sends the city's English name to search with and the
  // traveller's own-language name to show.
  const label = sp.get("label")?.trim() || "";
  const checkIn = sp.get("checkIn") || "";
  const checkOut = sp.get("checkOut") || "";
  const adults = Math.max(1, Number(sp.get("adults")) || 1);
  const childrenAges = useMemo(() => parseChildrenAges(sp.get("childrenAges")), [sp]);
  const guests = adults + childrenAges.length;
  const budget = Number(sp.get("budget")) || 0;
  const currency = sp.get("currency") || "SAR";
  const minStars = Number(sp.get("minStars")) || 0;
  const breakfast = sp.get("breakfast") === "true";
  const stayRaw = sp.get("stay");
  const stay = stayRaw === "room" || stayRaw === "apartment" ? stayRaw : undefined;

  const complete = Boolean(query && checkIn && checkOut);
  const nights = complete ? nightsBetween(checkIn, checkOut) : 0;

  const links = useMemo(
    () =>
      complete
        ? hotelPartnerLinks({
            query,
            checkIn,
            checkOut,
            adults,
            childrenAges,
            minStars: mode === "discover" ? minStars : undefined,
            breakfast: mode === "discover" ? breakfast : undefined,
            stay: mode === "discover" ? stay : undefined,
            isHotel: mode === "known",
            locale,
          })
        : [],
    [complete, query, checkIn, checkOut, adults, childrenAges, mode, minStars, breakfast, stay, locale]
  );

  // Back to the hotel planner, filled in. `product` opens the right planner
  // and `hmode` the right tab inside it.
  const editHref = useMemo(() => {
    const p = new URLSearchParams(sp.toString());
    p.set("product", "hotels");
    return `/${locale}?${p.toString()}#plan`;
  }, [sp, locale]);

  const money = (n: number) =>
    `${Math.round(n).toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US")} ${currency}`;

  const chips: string[] = [];
  if (nights) chips.push(nights === 1 ? t.oneNight : t.nights.replace("{count}", String(nights)));
  chips.push(t.guests.replace("{count}", String(guests)));
  if (mode === "discover") {
    if (budget > 0) {
      chips.push(t.budgetTotal.replace("{amount}", money(budget)));
      if (nights > 1) chips.push(t.budgetPerNight.replace("{amount}", money(budget / nights)));
    }
    chips.push(minStars ? t.stars.replace("{count}", String(minStars)) : t.anyStars);
    if (stay) chips.push(stay === "apartment" ? t.apartment : t.room);
    if (breakfast) chips.push(t.breakfast);
  }

  return (
    <div className="bg-mist-50">
      <section className="relative isolate overflow-hidden bg-gradient-to-b from-navy-900 to-navy-990 pb-9 pt-24 sm:pt-28">
        <div
          className="absolute inset-0 -z-10 bg-[radial-gradient(90%_60%_at_85%_0%,rgb(255_166_48/0.14),transparent_70%)]"
          aria-hidden="true"
        />
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-5 px-4 sm:px-6">
          <div className="min-w-0">
            <p className="eyebrow eyebrow-light mb-2.5">
              {mode === "known" ? t.eyebrowKnown : t.eyebrowDiscover}
            </p>
            <h1 className="flex items-center gap-3 font-display text-h1 font-extrabold text-white">
              <Icon name="hotel" className="h-8 w-8 shrink-0 text-sun-400" />
              <span className="min-w-0 break-words">{label || query || "—"}</span>
            </h1>
            {complete && (
              <p className="mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm font-semibold text-white/70">
                <span dir="ltr">{checkIn}</span>
                <span className="text-white/30" aria-hidden="true">
                  →
                </span>
                <span dir="ltr">{checkOut}</span>
              </p>
            )}
          </div>

          <Link
            href={editHref}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400"
          >
            <span aria-hidden="true">{locale === "ar" ? "→" : "←"}</span>
            {t.backToSearch}
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6">
        {!complete ? (
          <p className="rounded-2xl bg-white p-6 text-center font-semibold text-navy-700 shadow-sm ring-1 ring-black/5">
            {t.missing}
          </p>
        ) : (
          <div className="space-y-5">
            {/* The search, read back — the one thing to check before leaving. */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
              <p className="mb-3 text-sm font-bold text-navy-900">{t.yourSearch}</p>
              <ul className="flex flex-wrap gap-2">
                {chips.map((c) => (
                  <li
                    key={c}
                    className="rounded-full bg-mist-100 px-3 py-1.5 text-xs font-bold text-navy-800 ring-1 ring-mist-200"
                  >
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            {/* Said before the buttons, not after: this is the answer to
                "where are the prices?", and it should arrive before the
                question does. */}
            <div className="rounded-2xl border border-sea-400/30 bg-sea-400/10 p-5 sm:p-6">
              <p className="font-display font-extrabold text-navy-900">{t.honestTitle}</p>
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-navy-700">{t.honestBody}</p>
              {mode === "discover" && <p className="mt-2 max-w-3xl text-xs text-navy-600">{t.honestFilters}</p>}
            </div>

            {/* The first partner gets the full row; the rest share the row
                under it, however many there are for this search. */}
            <div className={`grid gap-3 ${links.length - 1 >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
              {links.map((l, i) => (
                <a
                  key={l.partner}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className={`flex items-center justify-center gap-2.5 rounded-xl px-6 py-4 text-base font-extrabold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 focus-visible:ring-offset-2 ${
                    i === 0
                      ? "col-span-full bg-sun-400 text-navy-950 shadow-[var(--shadow-sun)] hover:bg-sun-300"
                      : "bg-white text-navy-900 ring-1 ring-mist-200 hover:ring-navy-300"
                  }`}
                >
                  <Icon name="search" className="h-5 w-5" strokeWidth={2.4} />
                  {t.openAt.replace("{partner}", l.partner)}
                </a>
              ))}
            </div>
            <p className="text-center text-xs text-navy-500">{t.partnerNote}</p>
          </div>
        )}
      </div>
    </div>
  );
}
