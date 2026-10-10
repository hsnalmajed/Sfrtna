"use client";

import { countLabel, nightsLabel } from "@/lib/format";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getDictionary } from "@/lib/dictionaries";
import type { RoomType, Locale, SearchParams, TripType } from "@/lib/types";
import TripCurrencyInline from "@/components/TripCurrencyInline";
import FlightMetasearch, { warmFlightSearch } from "@/components/FlightMetasearch";
import FlightResultsGuide from "@/components/FlightResultsGuide";
import TripEssentials from "@/components/TripEssentials";
import CityActivities from "@/components/CityActivities";
import VisaBadge from "@/components/VisaBadge";
import VisaRequirementsDialog from "@/components/VisaRequirementsDialog";
import { visaStatusFor } from "@/data/visaStatus";
import Icon from "@/components/ui/Icon";
import { currencyForCountry } from "@/lib/currencies";
import { parseChildrenAges, serializeChildrenAges } from "@/lib/searchParamsUtil";
import { findAirport } from "@/lib/airports";
import { flightSearchCode, parseFlightSearchCode } from "@/lib/flightSearchCode";
import { findCityByName } from "@/lib/cities";
import { findCountryByEnglishName, flagEmoji } from "@/lib/countries";

function nightsBetween(a: string, b: string) {
  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();
  return Math.max(1, Math.round((t2 - t1) / (1000 * 60 * 60 * 24)));
}

/**
 * The night the traveller checks out.
 *
 * A round trip says so with its return date. A one-way trip with a hotel in
 * it has no return date at all, and the hotel search was being handed the
 * departure date as the checkout — pricing a month in Paris as a single
 * night. The planner asks how long the stay is in that case, and this is
 * where the answer is used.
 */

export default function ResultsPage() {
  // Outside the Suspense boundary, so the static page's own <head> already
  // asks for the flight widget's script and opens its connections — fetched
  // alongside the page's code instead of after it has hydrated.
  warmFlightSearch();
  return (
    <Suspense fallback={null}>
      <ResultsContent />
    </Suspense>
  );
}

function ResultsContent() {
  const params = useParams();
  const locale = (params.locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(locale);
  const sp = useSearchParams();

  // Where the trip lives on this page, and why it moved.
  //
  // The flight widget reads the trip from `?flightSearch=` — but if the
  // address has anything else in its query string, the widget reloads the
  // whole page to an address of its own, with only its code in it and both
  // dates a day early. That reload is what emptied this page of the visa
  // panel, the currency strip and the route header, and what searched the
  // wrong day. With `flightSearch` alone in the query it leaves the page
  // alone and searches the right dates (checked on sfrtna.com, 26 Sep 2026).
  //
  // So FlightMetasearch moves our trip into the fragment — `?flightSearch=
  // RUH1110IST18102#origin=RUH&destination=IST&…` — before the widget loads,
  // and this reads it from there. Arriving links still use a normal query;
  // it is moved on arrival. If the widget later runs a search of its own and
  // reloads with only its code, the route is read back out of the code.
  const spText = sp.toString();
  const [query, setQuery] = useState(() =>
    new URLSearchParams(spText).get("destination") ? spText : ""
  );
  useEffect(() => {
    function read() {
      const fromHash = new URLSearchParams(window.location.hash.slice(1));
      if (fromHash.get("destination")) return setQuery(fromHash.toString());
      const fromQuery = new URLSearchParams(spText);
      if (fromQuery.get("destination")) return setQuery(spText);
      const fromCode = parseFlightSearchCode(fromQuery.get("flightSearch"));
      if (fromCode) setQuery(fromCode.toString());
    }
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [spText]);
  const q = useMemo(() => new URLSearchParams(query), [query]);

  const search: SearchParams = useMemo(
    () => ({
      tripType: (q.get("tripType") as TripType) || "both",
      origin: q.get("origin") || "",
      destination: q.get("destination") || "",
      departDate: q.get("departDate") || "",
      returnDate: q.get("returnDate") || undefined,
      adults: Number(q.get("adults") || 1),
      budgetTotal: Number(q.get("budget") || 0),
      currency: q.get("currency") || "SAR",
      directFlightsOnly: q.get("directOnly") === "true",
      minHotelStars: Number(q.get("minStars") || 0),
      baggageIncluded: q.get("baggageIncluded") === "true",
      breakfastIncluded: q.get("breakfastIncluded") === "true",
      childrenAges: parseChildrenAges(q.get("childrenAges")),
      infants: Number(q.get("infants") || 0),
      roomType: (q.get("roomType") || undefined) as RoomType | undefined,
    }),
    [q]
  );



  // Everyone the fare has to cover. Flight prices are already priced for the
  // whole party (adults at full fare, children and infants at their usual
  // weights), so this is only used to *say so* — a total with no headcount
  // beside it reads as a per-person price and gets doubled in someone's head.
  const travelers = search.adults + (search.childrenAges?.length ?? 0) + (search.infants ?? 0);
  const prettyDate = (iso: string) =>
    iso
      ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale === "ar" ? "ar-u-ca-gregory-nu-latn" : "en-GB", {
          weekday: "short",
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        })
      : "";

  // "25 أكتوبر" — the header's one line has no room for the weekday.
  const shortDate = (iso: string) =>
    iso
      ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale === "ar" ? "ar-u-ca-gregory-nu-latn" : "en-GB", {
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        })
      : "";

  const nights = search.returnDate ? nightsBetween(search.departDate, search.returnDate) : 0;

  // Bridges the destination airport to its country so we can link into the
  // "Tourist Attractions" guide. Airports in a non-UN territory (e.g. Hong
  // Kong, Taiwan) won't resolve — the explore card simply doesn't render.
  const destinationAirport = useMemo(() => findAirport(search.destination), [search.destination]);

  const destinationCountry = useMemo(
    () => (destinationAirport ? findCountryByEnglishName(destinationAirport.countryEn) : undefined),
    [destinationAirport]
  );

  // The city they are actually going to, when the guide covers it. This is
  // what the "attractions, activities & restaurants" card should open — a
  // country page is a list of cities to choose from, and someone who has just
  // booked Istanbul has already chosen.
  const destinationCity = useMemo(() => {
    if (!destinationCountry || !destinationAirport) return undefined;
    return findCityByName(
      destinationCountry.code,
      destinationAirport.cityEn,
      destinationAirport.cityAr
    );
  }, [destinationCountry, destinationAirport]);

  const destinationCityName = destinationCity
    ? locale === "ar"
      ? destinationCity.nameAr
      : destinationCity.nameEn
    : undefined;

  const originCountry = useMemo(() => {
    const airport = findAirport(search.origin);
    if (!airport) return undefined;
    return findCountryByEnglishName(airport.countryEn);
  }, [search.origin]);

  // The money they leave with and the money they'll spend. Both have to
  // resolve, and to different currencies, for the strip to have anything to
  // say — a Riyadh-to-Dammam trip doesn't need an exchange rate.
  const originAirport = findAirport(search.origin);
  const originCityName = originAirport ? (locale === "ar" ? originAirport.cityAr : originAirport.cityEn) : search.origin;
  const homeCurrency = currencyForCountry(originCountry?.code);
  const visa = destinationCountry ? visaStatusFor(destinationCountry.code) : undefined;
  const [visaOpen, setVisaOpen] = useState(false);
  const visaLabels = {
    free: dict.visa.statusFree,
    arrival: dict.visa.statusArrival,
    eta: dict.visa.statusEta,
    required: dict.visa.statusRequired,
  };
  const tripCurrency = currencyForCountry(destinationCountry?.code);
  const showCurrencyStrip =
    Boolean(homeCurrency && tripCurrency) && homeCurrency!.code !== tripCurrency!.code;

  // Today in the traveller's own clock, as YYYY-MM-DD.
  const todayIso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const searchProblem: "past" | "place" | null =
    search.tripType !== "hotel" && search.departDate && search.departDate < todayIso
      ? "past"
      : search.tripType !== "hotel" && search.origin && search.destination && !flightSearchCode(search)
        ? "place"
        : null;

  const editSearchParams = useMemo(() => {
    const p = new URLSearchParams({
      mode: "known",
      tripRoute: search.returnDate ? "roundtrip" : "oneway",
      tripType: search.tripType,
      origin: search.origin,
      destination: search.destination,
      departDate: search.departDate,
      returnDate: search.returnDate || "",
      adults: String(search.adults),
      budget: String(search.budgetTotal),
      currency: search.currency,
      directOnly: String(search.directFlightsOnly),
      minStars: String(search.minHotelStars),
      baggageIncluded: String(Boolean(search.baggageIncluded)),
      breakfastIncluded: String(Boolean(search.breakfastIncluded)),
      childrenAges: serializeChildrenAges(search.childrenAges || []),
      infants: String(search.infants || 0),
      roomType: search.roomType || "",
    });
    return p.toString();
  }, [search]);

  // Where "back" goes from anywhere this page sends the traveller. It is this
  // exact page with this exact search, so returning lands them on their own
  // results rather than on a blank search form.
  const backHref = `/${locale}/results?${query}`;

  const itineraryHref = useMemo(() => {
    const p = new URLSearchParams({
      city: search.destination,
      country: destinationCountry?.code ?? "",
      nights: String(nights || 3),
      currency: search.currency,
      origin: search.origin,
      departDate: search.departDate,
      returnDate: search.returnDate || "",
      travelers: String(travelers),
      back: backHref,
    });
    return `/${locale}/itinerary?${p.toString()}`;
  }, [
    locale,
    search.destination,
    search.currency,
    search.origin,
    search.departDate,
    search.returnDate,
    destinationCountry,
    nights,
    travelers,
    backHref,
  ]);

  // Straight to the city they searched for when the guide has it, and to the
  // country only when it doesn't. The trip length comes along so the day
  // planner there is already set to their stay, and so does the way back —
  // that page is part of their search, not somewhere else they got sent.
  const exploreHref = useMemo(() => {
    if (!destinationCountry) return undefined;
    const p = new URLSearchParams({ nights: String(nights || 3), back: backHref });
    return destinationCity
      ? `/${locale}/attractions/${destinationCountry.code}/${destinationCity.slug}?${p}`
      : `/${locale}/attractions/${destinationCountry.code}?${p}#guide`;
  }, [locale, destinationCountry, destinationCity, nights, backHref]);

  // The hotel search this flight implies. Only for a round trip — a one-way
  // flight says nothing about how long the stay is. The search uses the
  // city's English name (partners match it more reliably); the page shows
  // the traveller's own-language name.
  const hotelCityLabel =
    destinationCityName ?? (locale === "ar" ? destinationAirport?.cityAr : destinationAirport?.cityEn) ?? "";
  const hotelNextHref = useMemo(() => {
    const cityEn = destinationCity?.nameEn ?? destinationAirport?.cityEn;
    if (!cityEn || !search.departDate || !search.returnDate) return undefined;
    const p = new URLSearchParams({
      hmode: "discover",
      city: cityEn,
      label: hotelCityLabel,
      checkIn: search.departDate,
      checkOut: search.returnDate,
      adults: String(search.adults),
      childrenAges: serializeChildrenAges(search.childrenAges || []),
      infants: String(search.infants || 0),
    });
    return `/${locale}/hotel-results?${p.toString()}`;
  }, [locale, destinationCity, destinationAirport, hotelCityLabel, search]);

  return (
    <div className="bg-mist-50">
      {/* ── The trip band ───────────────────────────────────────────────
          Every other page on the site opens with a navy header; this one —
          the page a traveller spends the most time on and reaches through
          the most effort — opened with black text on white, which made the
          most important screen in the funnel look like the only unfinished
          one. It gets the same band, built from the search itself.

          No photograph. This is a client component with no server fetch, and
          a hero here would mean either a slow one or a wrong one; the navy
          gradient carries the brand on its own, and the route deserves to be
          read rather than looked through. */}
      <section className="relative isolate overflow-hidden bg-gradient-to-b from-navy-900 to-navy-990 hero-pad pb-9 pt-24 sm:pt-28">
        <div
          className="absolute inset-0 -z-10 bg-[radial-gradient(90%_60%_at_85%_0%,rgb(255_166_48/0.14),transparent_70%)]"
          aria-hidden="true"
        />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="min-w-0">
            <p className="eyebrow eyebrow-light mb-2.5">{dict.results.subtitle}</p>

            {/* The route as a route. Two airport codes with a rule and a
                plane between them say "this is your trip" faster than the
                same two codes in a sentence — and it is the one piece of
                the page the traveller scans to check they searched right. */}
            <h1 className="flex flex-wrap items-center gap-x-3.5 gap-y-1 font-display text-h1 font-extrabold text-white">
              {search.origin && (
                <>
                  <span>{originCityName}</span>
                  <span
                    className="inline-flex items-center gap-1.5 text-sun-400"
                    aria-hidden="true"
                  >
                    <span className="h-px w-6 bg-sun-400/50 sm:w-9" />
                    <span className="text-h3">✈</span>
                    <span className="h-px w-6 bg-sun-400/50 sm:w-9" />
                  </span>
                </>
              )}
              <span>{destinationCityName ?? search.destination}</span>
            </h1>

            {/* The trip, and what decides whether it can happen, in one line
                in the order it is checked: the days, how many are flying,
                the visa and its requirements, what a riyal is worth there,
                and a converter for any other amount. */}
            <div className="mt-4 max-w-2xl space-y-2.5">
              {/* The search, as a card: when and who on the start side, the
                  way to change it on the other — one tidy block on a phone
                  instead of a pill that ran off the screen. */}
              <Link
                href={`/${locale}?${editSearchParams}#plan`}
                className="group flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-navy-950 shadow-sm transition hover:ring-2 hover:ring-sun-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400"
              >
                <span className="min-w-0 space-y-1 text-[13px] font-bold">
                  <span className="flex items-center gap-2">
                    <Icon name="calendar" className="h-4 w-4 shrink-0 text-navy-500" />
                    <span className="truncate">
                      {shortDate(search.departDate)}
                      {search.returnDate && (
                        <>
                          <span className="mx-1.5 text-navy-400" aria-hidden="true">
                            {locale === "ar" ? "←" : "→"}
                          </span>
                          {shortDate(search.returnDate)}
                        </>
                      )}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Icon name="users" className="h-4 w-4 shrink-0 text-navy-500" />
                    <span className="truncate">
                      {countLabel(travelers, { one: dict.results.travelersOne, two: dict.results.travelersTwo, few: dict.results.travelersFew, many: dict.results.travelersMany })}
                    </span>
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-sun-400 px-3.5 py-2 text-xs font-extrabold text-navy-950 transition group-hover:bg-sun-300">
                  <span aria-hidden="true">✎</span>
                  {dict.results.editSearch}
                </span>
              </Link>

              {/* What decides whether the trip can happen: the visa and its
                  requirements side by side, then what a riyal is worth. */}
              {destinationCountry && destinationCountry.code !== "SA" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {visa ? (
                      <VisaBadge
                        category={visa.category}
                        label={visaLabels[visa.category]}
                        className="w-full justify-center !rounded-xl !px-3 !py-2 !text-[13px]"
                      />
                    ) : (
                      <span className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-[13px] font-bold text-white ring-1 ring-white/15">
                        🛂 {dict.results.visaCheckTitle}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setVisaOpen(true)}
                      aria-haspopup="dialog"
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-[13px] font-extrabold text-white ring-1 ring-white/20 transition hover:bg-white/20"
                    >
                      📋 {dict.results.visaReqShort}
                    </button>
                  </div>
                  {showCurrencyStrip && homeCurrency && tripCurrency && (
                    <TripCurrencyInline from={homeCurrency} to={tripCurrency} locale={locale} />
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6">
      {/* A trip that cannot be searched as asked — a departure day already
          gone (an old link), or a place we cannot turn into an airport —
          is said so, with the way back to the form. Searched anyway, the
          partner read a past day as next year's and showed those flights. */}
      {searchProblem ? (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
          <p className="font-display text-lg font-extrabold text-navy-950">
            {searchProblem === "past" ? dict.results.datePassedTitle : dict.results.placeUnknownTitle}
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-navy-600">
            {searchProblem === "past" ? dict.results.datePassedBody : dict.results.placeUnknownBody}
          </p>
          <a
            href={`/${locale}?${editSearchParams}#plan`}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-sun-400 px-5 py-2.5 text-sm font-extrabold text-navy-950 hover:bg-sun-300"
          >
            ✎ {dict.results.editTheSearch}
          </a>
        </div>
      ) : (
      <>
      {/* 2. The answer: the flight picked within the budget, and the way
          to the others — see FlightResultsGuide. */}
      <FlightResultsGuide
        locale={locale}
        budget={search.budgetTotal}
        currency={search.currency}
        travelers={travelers}
        cityName={destinationCityName ?? search.destination}
        editHref={`/${locale}?${editSearchParams}#plan`}
        directOnly={Boolean(search.directFlightsOnly)}
        bagIncluded={Boolean(search.baggageIncluded)}
      />


      {/* 3. The flights themselves — the live search, for these exact dates
          and this party; the fare on the card is the fare at the agency. */}
      <div className="mt-5">
        <FlightMetasearch locale={locale} prefill={flightSearchCode(search)} hideSearchForm />
      </div>
      </>
      )}

      {visaOpen && destinationCountry && (
        <VisaRequirementsDialog countryCode={destinationCountry.code} locale={locale} onClose={() => setVisaOpen(false)} />
      )}

      {/* The next half of the trip. We cannot see whether the flight was
          booked — that happens at the agency — so this is offered, not
          assumed: the same city, the same dates, the same party, carried to
          the hotels page so nothing is typed twice. */}
      {hotelNextHref && (
        <Link
          href={hotelNextHref}
          className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-l from-sea-600 to-navy-900 p-5 shadow-sm ring-1 ring-sea-400/40 transition hover:ring-sun-400/60 sm:p-6"
        >
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sun-400 text-navy-950">
              <Icon name="hotel" className="h-6 w-6" />
            </span>
            <div>
              <p className="font-display font-extrabold text-white">
                {dict.results.hotelNextTitle.replace("{city}", hotelCityLabel)}
              </p>
              <p className="mt-1 text-sm text-white/70">
                {dict.results.hotelNextBody
                  .replace("{checkIn}", prettyDate(search.departDate))
                  .replace("{checkOut}", prettyDate(search.returnDate || ""))
                  .replace("{nights}", nightsLabel(nights, dict.hotelResults))}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-xl bg-sun-400 px-5 py-3 text-sm font-extrabold text-navy-950 shadow-[var(--shadow-sun)]">
            {dict.results.hotelNextCta}
          </span>
        </Link>
      )}

      {/* Around the trip, at the destination: mobile data, a driver from
          the airport, a car, then tours and tickets. Shown only where we
          hold a checked partner page (TripEssentials hides itself). */}
      {destinationCity && destinationCountry && (
        <div className="mt-10">
          <TripEssentials
            locale={locale}
            countryCode={destinationCountry.code}
            citySlug={destinationCity.slug}
            cityName={destinationCityName ?? destinationCity.nameEn}
            countryName={locale === "ar" ? destinationCountry.nameAr : destinationCountry.nameEn}
            t={dict.attractions}
          />
          <CityActivities locale={locale} cityName={destinationCityName ?? destinationCity.nameEn} cityNameEn={destinationCity.nameEn} t={dict.attractions} />
        </div>
      )}

      <div className="mt-10 space-y-4">
          {/* Itinerary prompt — surfaced first, as requested, so the itinerary
              option always sits above the destination-exploration card. */}
          <div className="rounded-2xl bg-gradient-to-br from-brand-800 to-brand-950 p-5 sm:p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-bold text-white">{dict.results.itineraryPromptTitle}</p>
              <p className="text-sm text-white/70 mt-1 max-w-xl">{dict.results.itineraryPromptBody}</p>
            </div>
            <Link
              // Everything the plan page needs to belong to *this* trip: the
              // city, the country (for its map exports), the dates, and the
              // way back to these results. The search budget deliberately does
              // not travel — that money is already spent on the flight and the
              // hotel.
              href={itineraryHref}
              className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-bold text-brand-900 shadow-sm transition hover:bg-brand-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-900"
            >
              {dict.results.viewItinerary}
            </Link>
          </div>

          {destinationCountry && exploreHref && (
            <Link
              href={exploreHref}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 sm:p-6 shadow-sm ring-1 ring-black/5 transition hover:ring-brand-200 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl leading-none">{flagEmoji(destinationCountry.code)}</span>
                <div>
                  {/* Named, when we know the name. "Explore your destination"
                      is a slogan; "Attractions in Istanbul" is a promise the
                      next page actually keeps. */}
                  <p className="font-bold text-gray-900">
                    {destinationCityName
                      ? dict.results.exploreCityTitle.replace("{city}", destinationCityName)
                      : dict.results.exploreDestinationTitle}
                  </p>
                  <p className="text-sm text-gray-500 mt-1 max-w-xl">
                    {destinationCityName
                      ? dict.results.exploreCityBody.replace("{city}", destinationCityName)
                      : dict.results.exploreDestinationBody}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-xl border border-brand-200 px-5 py-3 text-sm font-bold text-brand-800">
                {dict.results.exploreDestinationCta}
              </span>
            </Link>
          )}
      </div>

      </div>
    </div>
  );
}
