"use client";

import { countLabel } from "@/lib/format";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useDictionary } from "@/lib/dict/context";
import type { RoomType, Locale, MultiCityLegInput, SearchParams, TripType } from "@/lib/types";
import TripCurrencyInline from "@/components/TripCurrencyInline";
import FlightMetasearch, { warmFlightSearch } from "@/components/FlightMetasearch";
import FlightResultsGuide from "@/components/FlightResultsGuide";
import NextStepTabs, { markStep } from "@/components/NextStepTabs";
import MultiCityTabs from "@/components/MultiCityTabs";
import VisaBadge from "@/components/VisaBadge";
import VisaRequirementsDialog from "@/components/VisaRequirementsDialog";
import { visaStatusFor } from "@/data/visaStatus";
import Icon from "@/components/ui/Icon";
import { currencyForCountry, findCurrency } from "@/lib/currencies";
import { parseChildrenAges, serializeChildrenAges } from "@/lib/searchParamsUtil";
import { findAirport } from "@/lib/airports";
import { flightSearchCode, parseFlightSearchCode } from "@/lib/flightSearchCode";
import { findCityByName } from "@/lib/cities";
import { findCountryByEnglishName } from "@/lib/countries";
import ComboHotelSection from "@/components/ComboHotelSection";
import { comboParams, readCombo } from "@/lib/combo";


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
  const dict = useDictionary();
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



  // ── A multi-city trip: one tab per flight, each a live search here ──
  // `legs` (every flight) and `leg` (the one on screen) ride along with the
  // search. The budget is for the whole trip: the flight on screen gets it
  // minus the fares the traveller went to book on the other flights, kept
  // for this browser tab only (sessionStorage).
  const legsRaw = q.get("legs") || "";
  const mcLegs = useMemo<MultiCityLegInput[]>(() => {
    try {
      const parsed = JSON.parse(legsRaw || "[]");
      return Array.isArray(parsed) ? parsed.filter((l) => l && l.origin && l.destination && l.date) : [];
    } catch {
      return [];
    }
  }, [legsRaw]);
  const mcActive = Math.max(0, Math.min(mcLegs.length - 1, Number(q.get("leg") || 0)));
  const isMulti = mcLegs.length >= 2;
  const mcKey = `sfr-mc:${legsRaw}`;
  const [mcPicks, setMcPicks] = useState<Record<number, number>>({});
  useEffect(() => {
    if (!isMulti) return;
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(mcKey) || "{}");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from storage
      setMcPicks(saved && typeof saved === "object" ? saved : {});
    } catch {
      setMcPicks({});
    }
  }, [isMulti, mcKey]);
  const savePick = useCallback(
    (fare: number) => {
      if (!isMulti) return;
      setMcPicks((prev) => {
        const next = { ...prev, [mcActive]: fare };
        try {
          window.sessionStorage.setItem(mcKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [isMulti, mcActive, mcKey]
  );
  const pickedElsewhere = Object.entries(mcPicks)
    .filter(([i]) => Number(i) !== mcActive)
    .reduce((a, [, v]) => a + v, 0);
  // Never 0 when a budget was given: 0 means "no budget" to the results.
  const flightBudget =
    isMulti && search.budgetTotal > 0 ? Math.max(1, search.budgetTotal - pickedElsewhere) : search.budgetTotal;
  const mcHref = useCallback(
    (i: number) => {
      const leg = mcLegs[i];
      const p = new URLSearchParams(query);
      p.delete("flightSearch");
      p.set("origin", leg.origin);
      p.set("destination", leg.destination);
      p.set("departDate", leg.date);
      p.set("returnDate", "");
      p.set("leg", String(i));
      return `/${locale}/results?${p.toString()}`;
    },
    [mcLegs, query, locale]
  );

  // The night the stay ends, for the hotel tab: the return date, or on a
  // multi-city trip the day the next flight leaves; one way → no hotel tab.
  const stayEnd = search.returnDate || (isMulti && mcLegs[mcActive + 1]?.date) || "";

  // Everyone the fare has to cover. Flight prices are already priced for the
  // whole party (adults at full fare, children and infants at their usual
  // weights), so this is only used to *say so* — a total with no headcount
  // beside it reads as a per-person price and gets doubled in someone's head.
  const travelers = search.adults + (search.childrenAges?.length ?? 0) + (search.infants ?? 0);

  // "17 – 24 نوفمبر", or "28 نوفمبر – 3 ديسمبر": short enough for a phone
  // line, so the return date is never cut off.
  const dateRange = (a: string, b?: string) => {
    if (!a) return "";
    if (!b) return shortDate(a);
    const sameMonth = a.slice(0, 7) === b.slice(0, 7);
    return sameMonth ? `${Number(a.slice(8))} – ${shortDate(b)}` : `${shortDate(a)} – ${shortDate(b)}`;
  };
  // "25 أكتوبر" — the header's one line has no room for the weekday.
  const shortDate = (iso: string) =>
    iso
      ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale === "ar" ? "ar-u-ca-gregory-nu-latn" : "en-GB", {
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        })
      : "";


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
  // The traveller's own money: the currency they searched in (their budget's),
  // not the currency of the city this flight leaves from — on a multi-city
  // trip's second flight that was "1 Turkish lira = …" (13 Oct).
  const homeCurrency = findCurrency(search.currency) ?? currencyForCountry(originCountry?.code);
  // A trip inside the traveller's own country needs no visa line at all
  // (it was hidden only for Saudi Arabia, so Dubai → Abu Dhabi showed one).
  const sameCountry = Boolean(destinationCountry && (destinationCountry.code === "SA" || destinationCountry.code === originCountry?.code));
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

  // «طيران + فندق»: the hotel half rides in the same address (see combo.ts).
  const isCombo = q.get("combo") === "1" && !isMulti;
  const combo = useMemo(() => readCombo(q), [q]);
  const money = (n: number) => `${Math.round(n).toLocaleString("en-US")} ${search.currency}`;

  const editSearchParams = useMemo(() => {
    const p = new URLSearchParams({
      mode: "known",
      tripRoute: isMulti ? "multicity" : search.returnDate ? "roundtrip" : "oneway",
      ...(isMulti ? { legs: legsRaw } : {}),
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
    if (isMulti) {
      p.set("origin", mcLegs[0].origin);
      p.set("departDate", mcLegs[0].date);
    }
    if (isCombo) for (const [k, v] of comboParams(q)) p.set(k, v);
    return p.toString();
  }, [search, isMulti, legsRaw, mcLegs, isCombo, q]);

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

            {/* The trip, and what decides whether it can happen, in ONE row
                (wrapping only on a narrow phone): the dates and party with the
                way to change them, the visa, its requirements, and what a
                riyal is worth there. Owner, 13 Oct: each on its own line made
                the header tall for nothing. */}
            {/* Phone: the trip card full width, then visa · requirements ·
                currency as one swipeable line. Wider: all in one row. */}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
              <Link
                href={`/${locale}?${editSearchParams}#plan`}
                className="group flex w-full items-center gap-2.5 rounded-xl bg-white py-1.5 pe-1.5 ps-3 text-[13px] font-bold text-navy-950 shadow-sm transition hover:ring-2 hover:ring-sun-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 sm:inline-flex sm:w-auto"
              >
                <Icon name="calendar" className="h-4 w-4 shrink-0 text-navy-500" />
                <span className="whitespace-nowrap">{dateRange(search.departDate, search.returnDate)}</span>
                <span className="h-4 w-px shrink-0 bg-mist-300" aria-hidden="true" />
                <Icon name="users" className="h-4 w-4 shrink-0 text-navy-500" />
                {/* Phone: the number alone (the label was cut off); wider: in words. */}
                <span className="sm:hidden" aria-label={countLabel(travelers, { one: dict.results.travelersOne, two: dict.results.travelersTwo, few: dict.results.travelersFew, many: dict.results.travelersMany })}>
                  {travelers}
                </span>
                <span className="hidden whitespace-nowrap sm:inline">
                  {countLabel(travelers, { one: dict.results.travelersOne, two: dict.results.travelersTwo, few: dict.results.travelersFew, many: dict.results.travelersMany })}
                </span>
                <span className="ms-auto inline-flex shrink-0 items-center gap-1 rounded-lg bg-sun-400 px-2.5 py-1 text-xs font-extrabold text-navy-950 transition group-hover:bg-sun-300 sm:ms-0">
                  <span aria-hidden="true">✎</span>
                  {dict.results.editSearch}
                </span>
              </Link>

              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0 [&>*]:whitespace-nowrap">
              {destinationCountry && !sameCountry && (
                <>
                  {visa ? (
                    <VisaBadge
                      category={visa.category}
                      label={visaLabels[visa.category]}
                      className="!rounded-xl !px-3 !py-2 !text-[13px]"
                    />
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-[13px] font-bold text-white ring-1 ring-white/15">
                      🛂 {dict.results.visaCheckTitle}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setVisaOpen(true)}
                    aria-haspopup="dialog"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sun-400 px-3 py-2 text-[13px] font-extrabold text-navy-950 shadow-[var(--shadow-sun)] transition hover:bg-sun-300"
                  >
                    📋 {dict.results.visaReqShort}
                  </button>
                </>
              )}
              {showCurrencyStrip && homeCurrency && tripCurrency && (
                <TripCurrencyInline from={homeCurrency} to={tripCurrency} locale={locale} />
              )}
              </div>
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
      {/* Flight + hotel: the two halves and their budgets, one tap apart. */}
      {isCombo && (
        <nav className="sticky top-20 z-20 mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-white/95 p-2 shadow-sm ring-1 ring-black/5 backdrop-blur" aria-label={dict.combo.productTitle}>
          <a href="#combo-flight" className="rounded-xl bg-navy-950 px-3 py-2 text-center text-white">
            <span className="block text-sm font-extrabold">{dict.combo.jumpFlight}</span>
            <span className="block text-[11px] font-semibold text-white/75">{dict.combo.budgetFlight.replace("{amount}", money(search.budgetTotal))}</span>
          </a>
          <a href="#combo-hotel" className="rounded-xl bg-sun-400 px-3 py-2 text-center text-navy-950">
            <span className="block text-sm font-extrabold">{dict.combo.jumpHotel}</span>
            <span className="block text-[11px] font-semibold text-navy-800">
              {Number(combo.budget) > 0 ? dict.combo.budgetHotel.replace("{amount}", money(Number(combo.budget))) : "—"}
            </span>
          </a>
        </nav>
      )}
      <div id="combo-flight" className="scroll-mt-28" />
      {/* 2. The answer: the flight picked within the budget, and the way
          to the others — see FlightResultsGuide. */}
      {isMulti && (
        <MultiCityTabs
          locale={locale}
          legs={mcLegs}
          active={mcActive}
          hrefFor={mcHref}
          picks={mcPicks}
          budget={search.budgetTotal}
          currency={search.currency}
        />
      )}
      <FlightResultsGuide
        locale={locale}
        budget={flightBudget}
        onPicked={(fare) => {
          if (isMulti) savePick(fare);
          if (destinationCity) markStep(destinationCity.slug, "flight");
        }}
        currency={search.currency}
        travelers={travelers}
        cityName={destinationCityName ?? search.destination}
        editHref={`/${locale}?${editSearchParams}#plan`}
        directOnly={Boolean(search.directFlightsOnly)}
        bagIncluded={Boolean(search.baggageIncluded)}
        route={
          search.origin && search.destination && search.departDate
            ? {
                origin: search.origin,
                destination: search.destination,
                departDate: search.departDate,
                returnDate: isMulti ? "" : search.returnDate || "",
                adults: search.adults,
                children: search.childrenAges?.length ?? 0,
                infants: search.infants ?? 0,
              }
            : undefined
        }
      />


      {/* 3. The flights themselves — the live search, for these exact dates
          and this party; the fare on the card is the fare at the agency. */}
      <div className="mt-5">
        <FlightMetasearch locale={locale} prefill={flightSearchCode(search)} hideSearchForm />
      </div>

      {isCombo && (destinationCity || destinationAirport) && search.returnDate && (
        <ComboHotelSection
          locale={locale}
          combo={combo}
          city={{
            nameEn: destinationCity?.nameEn ?? destinationAirport?.cityEn ?? search.destination,
            label: destinationCityName ?? (locale === "ar" ? destinationAirport?.cityAr : destinationAirport?.cityEn) ?? search.destination,
            slug: destinationCity?.slug,
          }}
          checkIn={search.departDate}
          checkOut={search.returnDate}
          adults={search.adults}
          childrenAges={search.childrenAges ?? []}
          infants={search.infants ?? 0}
        />
      )}
      </>
      )}

      {visaOpen && destinationCountry && (
        <VisaRequirementsDialog countryCode={destinationCountry.code} locale={locale} onClose={() => setVisaOpen(false)} />
      )}

      {/* What comes next for this trip: hotel, services, a plan, the
          attractions — four tabs in one row (owner, 13 Oct), replacing the
          four stacked blocks that were here. */}
      {destinationCity && destinationCountry && !searchProblem && (
        <NextStepTabs
          locale={locale}
          current="flight"
          city={{
            countryCode: destinationCountry.code,
            slug: destinationCity.slug,
            nameAr: destinationCity.nameAr,
            nameEn: destinationCity.nameEn,
          }}
          checkIn={search.departDate}
          checkOut={stayEnd}
          adults={search.adults}
          childrenAges={search.childrenAges}
          infants={search.infants}
          withCompensation
        />
      )}
      </div>
    </div>
  );
}
