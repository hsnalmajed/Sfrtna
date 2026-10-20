"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import HotelList from "@/components/HotelList";
import HotelPrices from "@/components/HotelPrices";
import { hotelCityPlace } from "@/components/HotelCityInput";
import { nightsBetween } from "@/components/PlannerFields";
import { comboHotelHref, type ComboHotel } from "@/lib/combo";
import Icon from "@/components/ui/Icon";

/**
 * The hotel half of a «طيران + فندق» search, under the flight results: a
 * named hotel's page (every site's price, «احجز الآن»), or the destination's
 * hotels within the hotel budget and preferences — the same blocks as the
 * hotel results page, so a fix there reaches here.
 */
export default function ComboHotelSection({
  locale,
  combo,
  city,
  checkIn,
  checkOut,
  adults,
  childrenAges,
  infants,
}: {
  locale: Locale;
  combo: ComboHotel;
  city: { nameEn: string; label: string; slug?: string };
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges: number[];
  infants: number;
}) {
  const dict = useDictionary();
  const t = dict.hotelResults;
  const c = dict.combo;
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const budget = Number(combo.budget) || 0;
  const common = useMemo(
    () => ({ checkIn, checkOut, adults, childrenAges, nights, locale, t, budget }),
    [checkIn, checkOut, adults, childrenAges, nights, locale, t, budget]
  );
  const named = Boolean(combo.name && combo.picked);
  const [down, setDown] = useState(false);
  const onDown = useCallback(() => setDown(true), []);
  const shortDate = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale === "ar" ? "ar-u-ca-gregory-nu-latn" : "en-GB", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  const fullHref = comboHotelHref(locale, combo, city, checkIn, checkOut, {
    adults: String(adults),
    childrenAges: childrenAges.join(","),
    infants: String(infants),
  });
  if (!checkIn || !checkOut || nights < 1) return null;

  return (
    <section id="combo-hotel" className="mt-10 scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-extrabold text-navy-950 sm:text-2xl">
            <Icon name="hotel" className="h-6 w-6 text-sun-600" />
            {named ? c.hotelSectionNamed : c.hotelSection.replace("{city}", city.label)}
          </h2>
          <p className="mt-1 text-sm text-navy-600">
            {c.hotelSectionSub.replace("{from}", shortDate(checkIn)).replace("{to}", shortDate(checkOut))}
          </p>
        </div>
        <Link href={fullHref} className="text-sm font-bold text-sea-700 hover:underline">
          {c.openHotelPage}
        </Link>
      </div>
      {named ? (
        <HotelPrices
          query={combo.name}
          priceQuery={combo.area ? `${combo.name} ${combo.area}` : combo.name}
          {...common}
          fallback={
            <Link href={fullHref} className="inline-flex rounded-full bg-sun-400 px-5 py-2.5 text-sm font-extrabold text-navy-950">
              {c.openHotelPage}
            </Link>
          }
        />
      ) : (
        <HotelList
          cityQuery={hotelCityPlace(city.nameEn) ?? city.nameEn}
          citySlug={city.slug}
          cityName={city.label}
          minStars={combo.minStars}
          maxPerNight={budget > 0 && nights > 0 ? budget / nights : 0}
          breakfast={combo.breakfast}
          prefs={combo.prefs}
          c={common}
          onUnavailable={onDown}
        />
      )}
      {!named && down && (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
          <p className="text-sm font-semibold text-navy-700">{t.listPartnersOnly}</p>
          <Link href={fullHref} className="mt-3 inline-flex rounded-full bg-sun-400 px-5 py-2.5 text-sm font-extrabold text-navy-950">
            {c.openHotelPage}
          </Link>
        </div>
      )}
    </section>
  );
}
