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
import HotelPrices from "@/components/HotelPrices";
import Stay22HotelMap from "@/components/Stay22HotelMap";
import { hotelCityPlace } from "@/components/HotelCityInput";
import PartnerLink from "@/components/PartnerLink";

/**
 * Hotel results: the search read back, then live prices from our partners.
 *
 * Prices come from Google Hotels (through SerpApi, see HotelPrices) and only
 * for the booking sites we earn from, each next to its own booking button.
 * Checked on 6 Oct 2026 against Booking.com's own pages, Google's figure for
 * Booking was within 0.3% on three hotels of four; on the fourth Booking ran
 * a 10% deal, so the price we showed was the higher one, never the lower.
 *
 * When no price can be checked — the month's searches paced out, Google
 * down, no partner selling the hotel on those dates — the page falls back to
 * what it showed before: every partner's search, filled in, and no number.
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
  // Where a hotel picked from the suggestions is: shown under its name and
  // added to the price search, so the right one of several namesakes is found.
  const hotelArea = mode === "known" ? sp.get("hotelArea")?.trim().slice(0, 120) || "" : "";
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
  // Arabic counts nights like any noun: ليلة واحدة · ليلتان · 3–10 ليالٍ · 11+ ليلة.
  const nightsText =
    nights === 1
      ? t.oneNight
      : nights === 2
        ? t.twoNights
        : (nights <= 10 ? t.nights : t.nightsMany).replace("{count}", String(nights));

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
            area: hotelArea || undefined,
            locale,
          })
        : [],
    [complete, query, checkIn, checkOut, adults, childrenAges, mode, minStars, breakfast, stay, locale, hotelArea]
  );

  // Back to the hotel planner, filled in. `product` opens the right planner
  // and `hmode` the right tab inside it.
  const editHref = useMemo(() => {
    const p = new URLSearchParams(sp.toString());
    p.set("product", "hotels");
    return `/${locale}?${p.toString()}#plan`;
  }, [sp, locale]);

  // Isolated (FSI…PDI) so the amount and its code keep their order inside
  // an Arabic sentence.
  const money = (n: number) =>
    `\u2068${Math.round(n).toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US")} ${currency}\u2069`;

  const shortDate = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale === "ar" ? "ar-u-ca-gregory-nu-latn" : "en-GB", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });

  // The filters the traveller set, read back under the search.
  const chips: string[] = [];
  if (mode === "discover") {
    if (budget > 0) {
      chips.push(t.budgetTotal.replace("{amount}", money(budget)));
      if (nights > 1) chips.push(t.budgetPerNight.replace("{amount}", money(budget / nights)));
    }
    chips.push(minStars ? t.stars.replace("{count}", String(minStars)) : t.anyStars);
    if (stay) chips.push(stay === "apartment" ? t.apartment : t.room);
    if (breakfast) chips.push(t.breakfast);
  }

  const partnerButtons = (
      <div className={`grid gap-3 text-start ${links.length - 1 >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {links.map((l, i) => (
          <PartnerLink
            key={l.partner}
            partner={l.partner}
            href={l.url}
            className={`flex items-center justify-center gap-2.5 rounded-xl px-6 py-4 text-base font-extrabold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 focus-visible:ring-offset-2 ${
              i === 0
                ? "col-span-full bg-sun-400 text-navy-950 shadow-[var(--shadow-sun)] hover:bg-sun-300"
                : "bg-white text-navy-900 ring-1 ring-mist-200 hover:ring-navy-300"
            }`}
          >
            <Icon name="search" className="h-5 w-5" strokeWidth={2.4} />
            {t.openAt.replace("{partner}", l.partner)}
          </PartnerLink>
        ))}
      </div>
  );

  return (
    <div className="bg-mist-50">
      {/* The same band as the flight results: navy, the place as the
          heading, and the search as a pill you tap to change it. */}
      <section className="relative isolate overflow-hidden bg-gradient-to-b from-navy-900 to-navy-990 hero-pad pb-9 pt-24 sm:pt-28">
        <div
          className="absolute inset-0 -z-10 bg-[radial-gradient(90%_60%_at_85%_0%,rgb(255_166_48/0.14),transparent_70%)]"
          aria-hidden="true"
        />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="eyebrow eyebrow-light mb-2.5">{mode === "known" ? t.eyebrowKnown : t.eyebrowDiscover}</p>
          <h1 className="flex items-center gap-3 font-display text-h1 font-extrabold text-white">
            <Icon name="hotel" className="h-8 w-8 shrink-0 text-sun-400" />
            <bdi className="min-w-0 break-words">{label || query || "—"}</bdi>
          </h1>
          {hotelArea && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-white/70">
              <Icon name="pin" className="h-4 w-4 shrink-0 text-white/50" />
              <bdi>{hotelArea}</bdi>
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href={editHref}
              className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-white py-1.5 pe-1.5 ps-3.5 text-[13px] font-bold text-navy-950 shadow-sm transition hover:ring-2 hover:ring-sun-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400"
            >
              {complete && (
                <>
                  <Icon name="calendar" className="h-4 w-4 text-navy-500" />
                  <span>{shortDate(checkIn)}</span>
                  <span className="text-navy-400" aria-hidden="true">
                    {locale === "ar" ? "←" : "→"}
                  </span>
                  <span>{shortDate(checkOut)}</span>
                  <span className="text-navy-500">({nightsText})</span>
                  <span className="h-4 w-px bg-mist-300" aria-hidden="true" />
                </>
              )}
              <Icon name="users" className="h-4 w-4 text-navy-500" />
              <span>{t.guests.replace("{count}", String(guests))}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-sun-400 px-3 py-1 text-xs font-extrabold text-navy-950 transition group-hover:bg-sun-300">
                <span aria-hidden="true">✎</span>
                {t.backToSearch}
              </span>
            </Link>
            {chips.map((c) => (
              <span
                key={c}
                className="inline-flex items-center rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white ring-1 ring-white/15"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6">
        {!complete ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
            <p className="font-semibold text-navy-700">{t.missing}</p>
            <Link
              href={editHref}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-sun-400 px-5 py-2.5 text-sm font-extrabold text-navy-950 hover:bg-sun-300"
            >
              ✎ {t.backToSearch}
            </Link>
          </div>
        ) : (
          <>
            {mode === "known" ? (
              <HotelPrices
                query={query}
                priceQuery={hotelArea ? `${query} ${hotelArea}` : query}
                budget={0}
                checkIn={checkIn}
                checkOut={checkOut}
                adults={adults}
                childrenAges={childrenAges}
                nights={nights}
                locale={locale}
                t={t}
                fallback={partnerButtons}
              />
            ) : (
              <div>
                <div className="mb-4">
                  <h2 className="font-display text-xl font-extrabold text-navy-950">
                    {(budget > 0 ? t.discoverTitleBudget : t.discoverTitle).replace("{city}", label || query)}
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm leading-relaxed text-navy-600">
                    {t.discoverNote.replace("{nights}", nightsText)}
                  </p>
                  {locale === "ar" && <p className="mt-1 text-xs text-navy-500">{t.discoverEnglish}</p>}
                </div>
                <Stay22HotelMap
                  title={(budget > 0 ? t.discoverTitleBudget : t.discoverTitle).replace("{city}", label || query)}
                  address={hotelCityPlace(query) ?? query}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  adults={adults}
                  kids={childrenAges.length}
                  budget={budget}
                  currency={currency}
                  nights={nights}
                  minStars={minStars}
                  labels={{ list: t.viewList, map: t.viewMap, choose: t.viewChoose }}
                />
                <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                  <p className="text-sm font-bold text-navy-900">{t.otherPartners}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {links.map((l) => (
                      <PartnerLink
                        key={l.partner}
                        partner={l.partner}
                        href={l.url}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-navy-900 ring-1 ring-mist-200 transition hover:ring-navy-300"
                      >
                        <Icon name="search" className="h-3.5 w-3.5 text-navy-500" />
                        {t.openAt.replace("{partner}", l.partner)}
                      </PartnerLink>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <p className="mt-8 text-center text-xs text-navy-500">{t.partnerNote}</p>
          </>
        )}
      </div>
    </div>
  );
}
