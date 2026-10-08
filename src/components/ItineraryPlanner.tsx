"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { getDictionary } from "@/lib/dictionaries";
import type { ItineraryResult, Locale } from "@/lib/types";
import { findAirport } from "@/lib/airports";
import { findCountry, findCountryByEnglishName } from "@/lib/countries";
import PlanActions from "@/components/PlanActions";
import PageHero from "@/components/ui/PageHero";
import PrintHeader from "@/components/PrintHeader";
import type { SectionHero } from "@/lib/heroPhotos";
import { countLabel } from "@/lib/format";
import { track } from "@/lib/analytics";
import HotelCityInput from "@/components/HotelCityInput";
import { COUNTRY_CITIES } from "@/lib/cities";
import { searchEquals } from "@/lib/search";

/**
 * The planner, lifted out of the route so the route can be a server component.
 *
 * It has to stay a client component — the whole page is a form with state —
 * but its hero photograph is resolved on the server, and that belongs on the
 * server. So the route resolves the picture and hands it down as a prop, and
 * the heading stays here where the city name lives: a visitor who arrived from
 * a Riyadh → Istanbul search should read "Istanbul" at the top, and that word
 * is only known once the query string has been parsed in the browser.
 */
export default function ItineraryPlanner({ hero }: { hero?: SectionHero }) {
  return (
    <Suspense fallback={null}>
      <ItineraryContent hero={hero} />
    </Suspense>
  );
}

/**
 * Only a relative path on this site is allowed back.
 *
 * `back` arrives in the query string, which anyone can write, so it is checked
 * rather than trusted: a single leading slash and no second one, which rules
 * out "//evil.example" and any absolute URL. A visitor should not be able to
 * be handed a link that looks like this site and leaves it.
 */
function safeBackHref(raw: string | null): string | undefined {
  if (!raw) return undefined;
  if (!raw.startsWith("/") || raw.startsWith("//")) return undefined;
  return raw;
}

/**
 * The plan, built for one named city.
 *
 * Three things this page gets asked for by name.
 *
 * It talks about the city, not "your destination": someone arrives here from a
 * Riyadh → Istanbul search and the word on the screen should be Istanbul.
 *
 * It belongs to the trip they searched. The route, the dates and the party
 * size come along and are shown above the form, and the way back to their own
 * results is the first thing on the page — this is a step in their trip, not a
 * detour onto a page about cities in general. Nothing here is written anywhere
 * shared; it is all in their own link.
 *
 * And the budget starts empty and is required, because it is a different
 * number from the one they typed into the search — that one bought the flight
 * and the hotel, this one is what is left for the days in between, and
 * pre-filling it with the old figure would quietly plan a trip against money
 * already spent.
 */
function ItineraryContent({ hero }: { hero?: SectionHero }) {
  const params = useParams();
  const locale = (params.locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(locale);
  const sp = useSearchParams();

  // The link in from the results page carries an airport code. A code is not
  // a place name, so resolve it to the city — and to the country, which is
  // what the map exports are keyed on.
  const incoming = sp.get("city") || sp.get("destination") || "";
  const resolved = useMemo(() => {
    const airport = findAirport(incoming);
    const countryFromParam = findCountry(sp.get("country") || "");
    if (airport) {
      return {
        city: locale === "ar" ? airport.cityAr : airport.cityEn,
        country: countryFromParam ?? findCountryByEnglishName(airport.countryEn),
      };
    }
    return { city: incoming, country: countryFromParam };
  }, [incoming, sp, locale]);

  const [city, setCity] = useState(resolved.city);
  // The city must be one of ours, picked from the list (a city's name, or a
  // country's name listing its cities): a plan is only as good as knowing
  // exactly which place it is for (owner, 8 Oct). An arriving city that
  // matches one of ours counts as picked.
  const [pickedCountry, setPickedCountry] = useState<string | null>(() => {
    const n = resolved.city.trim();
    if (!n) return null;
    for (const [code, list] of Object.entries(COUNTRY_CITIES)) {
      if (list.some((c) => searchEquals(c.nameAr, n) || searchEquals(c.nameEn, n))) return code;
    }
    return null;
  });
  const [cityError, setCityError] = useState(false);
  // The browser's own form check runs before ours and stops at the first
  // field it finds wrong; telling it the city box is wrong until a city is
  // picked keeps the city first, where it is on screen.
  useEffect(() => {
    const el = document.getElementById("plan-city") as HTMLInputElement | null;
    el?.setCustomValidity(pickedCountry ? "" : dict.hotelForm.errorPickCity);
  }, [pickedCountry, dict.hotelForm.errorPickCity]);
  const country = (pickedCountry ? findCountry(pickedCountry) : undefined) ?? resolved.country;
  const [days, setDays] = useState(Number(sp.get("nights") || 3));
  // Deliberately a string, and deliberately empty: a number field seeded with
  // 0 reads as "already answered" and gets submitted untouched.
  const [budget, setBudget] = useState("");
  const [currency] = useState(sp.get("currency") || "SAR");
  const [interests, setInterests] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ItineraryResult | null>(null);
  const [failed, setFailed] = useState(false);

  const countryName = country ? (locale === "ar" ? country.nameAr : country.nameEn) : undefined;

  // The trip this plan is for, printed above the form so the page reads as a
  // step in their own booking rather than a generic tool they wandered into.
  const backHref = safeBackHref(sp.get("back"));
  const tripSummary = useMemo(() => {
    const parts: string[] = [];
    const originAirport = findAirport(sp.get("origin") || "");
    if (originAirport) {
      const originCity = locale === "ar" ? originAirport.cityAr : originAirport.cityEn;
      parts.push(`${originCity} ${locale === "ar" ? "←" : "→"} ${resolved.city}`);
    }
    const depart = sp.get("departDate");
    const back = sp.get("returnDate");
    if (depart) parts.push(back ? `${depart} – ${back}` : depart);
    const party = Number(sp.get("travelers") || 0);
    if (party > 0) {
      parts.push(
        countLabel(party, {
          one: dict.itinerary.travelersOne,
          two: dict.itinerary.travelersTwo,
          few: dict.itinerary.travelersFew,
          many: dict.itinerary.travelersMany,
        })
      );
    }
    return parts.join(" · ");
  }, [sp, locale, resolved.city, dict.itinerary]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!pickedCountry) {
      setCityError(true);
      document.getElementById("plan-city")?.focus();
      return;
    }
    track("search", {
      search_type: "itinerary",
      destination: city,
      nights: days,
      budget: Number(budget) || undefined,
      currency,
    });
    setLoading(true);
    try {
      const res = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // The city with its country: "Antalya" alone is ambiguous to
          // whoever writes the plan; "أنطاليا، تركيا" is not.
          destination: countryName ? `${city}${locale === "ar" ? "، " : ", "}${countryName}` : city,
          days,
          budget: Number(budget),
          currency,
          interests,
          locale,
        }),
      });
      const data = (await res.json().catch(() => null)) as ItineraryResult | null;
      // A refused or failed request must say so, not leave the page blank
      // (or break on a plan that is not there).
      if (!res.ok || !data || !Array.isArray(data.plan)) {
        setResult(null);
        setFailed(true);
        return;
      }
      setFailed(false);
      setResult(data);
    } catch {
      setResult(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  // Everything written in the plan, as plain lines — what the map export
  // searches for real place names in.
  const planLines = useMemo(() => {
    if (!result) return [];
    return result.plan.flatMap((day) => [day.title, ...day.activities, day.mealsSuggestion ?? ""]);
  }, [result]);

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.75 text-sm text-gray-800 shadow-sm transition outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 hover:border-gray-300";
  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";

  const heading = city
    ? dict.itinerary.titleForCity.replace("{city}", city)
    : dict.itinerary.title;

  return (
    <div>
      {/* Hidden when printing: the plan someone prints should start at the
          plan, not at a full-bleed photograph of Norway. */}
      <div className="print:hidden">
        <PageHero {...hero} size="sm" title={heading} subtitle={dict.itinerary.subtitle}>
          <div className="flex flex-wrap items-center gap-2.5">
            {/* The way back to their own results, first. Someone who came here
                from a booking is mid-decision, and a plan page with no exit
                turns a side-step into a dead end. */}
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/20"
              >
                <span aria-hidden="true">{locale === "ar" ? "→" : "←"}</span>
                {dict.itinerary.backToResults}
              </Link>
            )}

            {/* Their route, their dates, their party — so the page is visibly
                about the trip they just searched. Set as ordinary text rather
                than in the hero's eyebrow style, whose wide letter-spacing
                pulls Arabic words apart at the joins. */}
            {tripSummary && (
              <span className="rounded-full bg-black/25 px-3.5 py-2 text-sm font-semibold text-white/85 ring-1 ring-white/15 backdrop-blur-md">
                {tripSummary}
              </span>
            )}
          </div>
        </PageHero>
      </div>

      <div className="mx-auto max-w-4xl px-4 pb-10 pt-8 sm:px-6">
      <form
        onSubmit={generate}
        className="print:hidden overflow-hidden rounded-3xl bg-white shadow-xl shadow-brand-950/5 ring-1 ring-black/5"
      >
        <div className="h-1.5 bg-gradient-to-r from-brand-700 via-accent-500 to-brand-700" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-7">
          <div>
            <label className={labelClass} htmlFor="plan-city">
              {dict.itinerary.cityLabel}
            </label>
            <HotelCityInput
              id="plan-city"
              locale={locale}
              className={inputClass}
              value={city}
              onType={(text) => {
                setCity(text);
                setPickedCountry(null);
                setCityError(false);
              }}
              onPick={(picked, code) => {
                setCity(locale === "ar" ? picked.nameAr : picked.nameEn);
                setPickedCountry(code);
                setCityError(false);
              }}
              placeholder={dict.itinerary.cityPlaceholder}
              invalid={cityError}
              emptyText={dict.hotelForm.noCityMatch}
            />
            {cityError && (
              <p role="alert" className="mt-1.5 text-xs font-semibold text-red-600">
                {dict.hotelForm.errorPickCity}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="plan-days">
              {dict.itinerary.daysLabel}
            </label>
            <input
              id="plan-days"
              type="number"
              min={1}
              max={21}
              className={inputClass}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="plan-budget">
              {dict.itinerary.budgetLabel}
            </label>
            <input
              id="plan-budget"
              type="number"
              min={1}
              // Not a multiple of anything: with min=1 a step of 50 makes
              // 1,500 invalid and the browser rejects it with a message about
              // "the two nearest valid values", which reads as a bug.
              step={1}
              inputMode="numeric"
              className={inputClass}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder={dict.itinerary.budgetPlaceholder}
              required
            />
            <p className="mt-1.5 text-xs leading-relaxed text-gray-400">{dict.itinerary.budgetHint}</p>
          </div>

          <div>
            <label className={labelClass} htmlFor="plan-currency">
              {dict.form.currency}
            </label>
            <input id="plan-currency" className={inputClass} value={currency} disabled />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="plan-interests">
              {dict.itinerary.interests}
            </label>
            <input
              id="plan-interests"
              className={inputClass}
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder={dict.itinerary.interestsPlaceholder}
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-accent-600 to-accent-700 px-6 py-4 text-base font-bold text-white shadow-lg shadow-accent-600/25 transition hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.99] disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {loading ? dict.itinerary.generating : `${dict.itinerary.generate} 🗺️`}
            </button>
          </div>
        </div>
      </form>

      {failed && !loading && (
        <p role="alert" className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 ring-1 ring-rose-200">
          {dict.itinerary.failed}
        </p>
      )}

      {result && (
        <div className="mt-8 space-y-4">
          <PrintHeader
            locale={locale}
            title={dict.itinerary.planTitleForCity.replace("{city}", city)}
            subtitle={[
              dict.itinerary.daysCount.replace("{count}", String(days)),
              Number(budget) > 0 ? `${Number(budget).toLocaleString()} ${currency}` : "",
              tripSummary,
            ]
              .filter(Boolean)
              .join(" · ")}
          />

          <PlanActions
            locale={locale}
            countryCode={country?.code}
            countryName={countryName}
            planLines={planLines}
            fileBase={`sfrtna-plan-${country?.code ?? "trip"}`}
            title={dict.itinerary.planTitleForCity.replace("{city}", city)}
          />

          {result.isMock && (
            <div className="print:hidden rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {dict.itinerary.mockNotice}
            </div>
          )}

          {/* The printed document starts here. */}
          <div className="space-y-4">
            <div className="print-block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              {/* On paper the letterhead above already says both of these,
                  and a document that opens by repeating its own title twice
                  reads as a mistake. */}
              <h2 className="print:hidden text-lg font-extrabold text-gray-900">
                {dict.itinerary.planTitleForCity.replace("{city}", city)}
              </h2>
              <p className="print:hidden mt-1 text-sm font-semibold text-gray-500">
                {dict.itinerary.daysCount.replace("{count}", String(days))}
                {Number(budget) > 0 ? ` · ${Number(budget).toLocaleString()} ${currency}` : ""}
              </p>
              <p className="mt-3 leading-relaxed text-gray-700">{result.summary}</p>
            </div>

            {result.plan.map((day) => (
              <div
                key={day.day}
                className="print-block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition hover:shadow-md hover:ring-brand-100"
              >
                <h3 className="mb-2.5 flex items-center gap-2 font-bold text-gray-900">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-900 text-xs font-bold text-white">
                    {day.day}
                  </span>
                  {dict.itinerary.day} {day.day}
                  <span className="font-semibold text-gray-500">
                    — {day.title.replace(/^Day \d+:\s*/i, "").replace(/^اليوم \d+:\s*/, "")}
                  </span>
                </h3>

                <ul className="space-y-1.5 text-sm text-gray-700">
                  {day.activities.map((a, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" aria-hidden="true" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>

                {day.mealsSuggestion && (
                  <p className="mt-3 rounded-xl bg-accent-50/70 px-3.5 py-2.5 text-sm text-accent-900">
                    <span aria-hidden="true">🍽️ </span>
                    {day.mealsSuggestion}
                  </p>
                )}

                {day.estimatedCost && (
                  <p className="mt-2.5 text-xs font-semibold text-gray-500">
                    {dict.itinerary.estimatedCost}: {day.estimatedCost}
                  </p>
                )}
              </div>
            ))}

            {result.tips.length > 0 && (
              <div className="print-block rounded-2xl bg-brand-50 p-5 ring-1 ring-brand-100">
                <h3 className="mb-2 font-bold text-brand-900">{dict.itinerary.tips}</h3>
                <ul className="list-disc space-y-1 ps-5 text-sm text-brand-900">
                  {result.tips.map((t, idx) => (
                    <li key={idx}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="print-signoff hidden print:block">{dict.plan.printedFrom}</p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
