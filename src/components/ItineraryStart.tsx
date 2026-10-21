"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useDictionary } from "@/lib/dict/context";
import type { Locale } from "@/lib/types";
import type { SectionHero } from "@/lib/heroPhotos";
import PageHero from "@/components/ui/PageHero";
import { findHotelCity } from "@/components/HotelCityInput";
import SmartPlanner from "@/components/smart/SmartPlanner";
import { COUNTRY_CITIES, type CityEntry } from "@/lib/cities";
import { findAirport } from "@/lib/airports";

/**
 * Travel tools → the trip plan (owner's section 3: ONE plan engine). The
 * traveller picks a city and dates here; «أنشئ لي خطة» / «أختار بنفسي» open
 * that city's page with the planner (CityPlacesPlanner) — real named places,
 * restaurants nearby, days by proximity, no invented cost, PDF and Google
 * Maps — the same engine the destination pages use. The old generator
 * (canned text and an estimated cost) is no longer linked.
 */
export default function ItineraryStart({ hero }: { hero?: SectionHero }) {
  return (
    <Suspense fallback={null}>
      <Start hero={hero} />
    </Suspense>
  );
}

function countryOf(city: CityEntry): string | undefined {
  return Object.entries(COUNTRY_CITIES).find(([, list]) => list.some((c) => c.slug === city.slug))?.[0];
}

function Start({ hero }: { hero?: SectionHero }) {
  const params = useParams();
  const locale = (params.locale === "en" ? "en" : "ar") as Locale;
  const dict = useDictionary();
  const sp = useSearchParams();

  // Arriving from a flight search: its destination and dates.
  const incoming = useMemo(() => {
    const raw = sp.get("city") || sp.get("destination") || "";
    const airport = findAirport(raw);
    const name = airport ? (locale === "ar" ? airport.cityAr : airport.cityEn) : raw;
    return findHotelCity(name);
  }, [sp, locale]);
  const back = sp.get("back") || "";
  const backHref = back.startsWith("/") && !back.startsWith("//") ? back : "";
  const iso = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

  return (
    <div>
      <PageHero {...hero} size="sm" title={dict.smart.pageTitle} subtitle={dict.itinerary.subtitle}>
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/20"
          >
            <span aria-hidden="true">{locale === "ar" ? "→" : "←"}</span>
            {dict.itinerary.backToResults}
          </Link>
        )}
      </PageHero>
      <div className="mx-auto max-w-2xl px-4 pb-12 pt-6 sm:px-6">
        {/* Owner, 21 Oct: opening the trip plan opens our planner straight
            away — the city first, then the questions, then the plan. */}
        <SmartPlanner
          locale={locale}
          standalone
          initial={{
            code: incoming ? countryOf(incoming) : undefined,
            slug: incoming?.slug,
            cityName: incoming ? (locale === "ar" ? incoming.nameAr : incoming.nameEn) : undefined,
            from: iso(sp.get("departDate") || sp.get("from")),
            to: iso(sp.get("returnDate") || sp.get("to")),
          }}
        />
        <p className="mt-5 text-center text-sm text-navy-600">
          {dict.tripPlan.pickModeHint}{" "}
          <Link href={`/${locale}/destinations`} className="font-bold text-sea-700 hover:underline">
            {dict.tripPlan.pickMode} ←
          </Link>
        </p>
      </div>
    </div>
  );
}
