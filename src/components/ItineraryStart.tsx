"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import type { SectionHero } from "@/lib/heroPhotos";
import PageHero from "@/components/ui/PageHero";
import HotelCityInput, { findHotelCity } from "@/components/HotelCityInput";
import DateRangeInput from "@/components/DateRangeInput";
import { COUNTRY_CITIES, type CityEntry } from "@/lib/cities";
import { findAirport } from "@/lib/airports";
import { track } from "@/lib/analytics";

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
  const dict = getDictionary(locale);
  const t = dict.tripPlan;
  const sp = useSearchParams();
  const router = useRouter();

  // Arriving from a flight search: its destination and dates.
  const incoming = useMemo(() => {
    const raw = sp.get("city") || sp.get("destination") || "";
    const airport = findAirport(raw);
    const name = airport ? (locale === "ar" ? airport.cityAr : airport.cityEn) : raw;
    return findHotelCity(name);
  }, [sp, locale]);
  const [text, setText] = useState(incoming ? (locale === "ar" ? incoming.nameAr : incoming.nameEn) : "");
  const [city, setCity] = useState<CityEntry | undefined>(incoming);
  const [code, setCode] = useState<string | undefined>(incoming ? countryOf(incoming) : undefined);
  const [from, setFrom] = useState(sp.get("departDate") || sp.get("from") || "");
  const [to, setTo] = useState(sp.get("returnDate") || sp.get("to") || "");
  const [error, setError] = useState("");
  const back = sp.get("back") || "";
  const backHref = back.startsWith("/") && !back.startsWith("//") ? back : "";

  const go = (mode: "auto" | "pick") => {
    if (!city || !code) {
      setError(dict.hotelForm.errorPickCity);
      document.getElementById("plan-city")?.focus();
      return;
    }
    if (!from || !to) {
      setError(t.datesNeeded);
      return;
    }
    track("search", { search_type: "itinerary", destination: city.nameEn });
    const q = new URLSearchParams({ from, to, plan: "1" });
    if (mode === "auto") q.set("mode", "auto");
    if (backHref) q.set("back", backHref);
    router.push(`/${locale}/attractions/${code}/${city.slug}?${q.toString()}#trip-plan`);
  };

  return (
    <div>
      <PageHero {...hero} size="sm" title={dict.itinerary.title} subtitle={dict.itinerary.subtitle}>
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
      <div className="mx-auto max-w-2xl px-4 pb-12 pt-8 sm:px-6">
        <div className="space-y-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-7">
          <div>
            <label htmlFor="plan-city" className="mb-1.5 block text-sm font-bold text-navy-900">
              {dict.itinerary.cityLabel}
            </label>
            <HotelCityInput
              id="plan-city"
              locale={locale}
              value={text}
              onType={(v) => {
                setText(v);
                setCity(undefined);
                setCode(undefined);
                setError("");
              }}
              onPick={(c, cc) => {
                setText(locale === "ar" ? c.nameAr : c.nameEn);
                setCity(c);
                setCode(cc);
                setError("");
              }}
              placeholder={dict.itinerary.cityPlaceholder}
              emptyText={dict.hotelForm.noCityMatch}
              invalid={Boolean(error) && !city}
              className="w-full rounded-xl border border-mist-300 bg-white px-4 py-3 text-base text-navy-900 outline-none focus:border-sun-400 focus:ring-4 focus:ring-sun-400/20"
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-bold text-navy-900">🗓 {t.datesTitle}</p>
            <DateRangeInput
              locale={locale}
              departDate={from}
              returnDate={to}
              withReturn
              onChange={({ departDate, returnDate }) => {
                setFrom(departDate);
                setTo(returnDate);
                setError("");
              }}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => go("auto")}
              className="rounded-2xl bg-sun-400 px-5 py-4 text-start font-display text-base font-extrabold text-navy-950 shadow-[var(--shadow-sun)] transition hover:bg-sun-300"
            >
              ✨ {t.autoMode}
              <span className="mt-0.5 block text-xs font-semibold text-navy-800/75">{t.autoModeHint}</span>
            </button>
            <button
              type="button"
              onClick={() => go("pick")}
              className="rounded-2xl bg-navy-900 px-5 py-4 text-start font-display text-base font-extrabold text-white transition hover:bg-navy-800"
            >
              ✋ {t.pickMode}
              <span className="mt-0.5 block text-xs font-semibold text-white/70">{t.pickModeHint}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
