"use client";

import { countLabel } from "@/lib/format";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getDictionary } from "@/lib/dictionaries";
import type { RoomType, DestinationCategory, DestinationSuggestion, Locale, RouteSuggestion, TripType } from "@/lib/types";
import DestinationCard from "@/components/DestinationCard";
import PricesUnavailable from "@/components/PricesUnavailable";
import RouteCard from "@/components/RouteCard";
import ResultsBand from "@/components/ResultsBand";
import { VISA_STYLES } from "@/components/VisaBadge";
import { VISA_ORDER, type VisaCategory } from "@/data/visaStatus";
import { CLASS_DOT, CLASS_RANKING as CLASS_ORDER } from "@/lib/travelSeason/labels";
import type { Classification } from "@/lib/travelSeason/config";
import { findAirport } from "@/lib/airports";
import { parseChildrenAges } from "@/lib/searchParamsUtil";

export default function DiscoverResultsPage() {
  return (
    <Suspense fallback={null}>
      <DiscoverResultsContent />
    </Suspense>
  );
}

function DiscoverResultsContent() {
  const params = useParams();
  const locale = (params.locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(locale);
  const sp = useSearchParams();

  const tripType = (sp.get("tripType") as TripType) || "both";
  const origin = sp.get("origin") || "";
  const budget = sp.get("budget") || "0";
  const currency = sp.get("currency") || "SAR";
  const departDate = sp.get("departDate") || "";
  const returnDate = sp.get("returnDate") || "";
  const nights = sp.get("nights") || "5";
  const adults = sp.get("adults") || "1";
  const childrenAges = parseChildrenAges(sp.get("childrenAges"));
  const infants = sp.get("infants") || "0";
  const directOnly = sp.get("directOnly") === "true";
  const minStars = sp.get("minStars") || "0";
  const roomType = (sp.get("roomType") || undefined) as RoomType | undefined;
  const multiDestination = sp.get("multiDestination") === "true";
  const oneWayOnly = sp.get("oneWayOnly") === "true";
  const baggageIncluded = sp.get("baggageIncluded") === "true";
  const breakfastIncluded = sp.get("breakfastIncluded") === "true";
  const preferenceCategory = (sp.get("preferenceCategory") || undefined) as DestinationCategory | undefined;
  const continentsParam = sp.get("continents") || "";
  const editSearchParams = sp.toString();

  const stops = sp.get("stops") === "3" ? 3 : 2;
  const [mode, setMode] = useState<"single" | "routes">(multiDestination ? "routes" : "single");
  const [singleSuggestions, setSingleSuggestions] = useState<DestinationSuggestion[]>([]);
  // In-season cities no fare was seen for on these dates — shown without a price.
  const [unpriced, setUnpriced] = useState<DestinationSuggestion[]>([]);
  const [routes, setRoutes] = useState<RouteSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // City photographs, fetched on their own so the fares never wait for them.
  const [photos, setPhotos] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch("/api/destination-photos")
      .then((r) => (r.ok ? r.json() : {}))
      .then((p: Record<string, string>) => setPhotos(p))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!origin || !departDate) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    fetch("/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin,
        tripType,
        budgetTotal: Number(budget),
        currency,
        departDate,
        returnDate,
        nights: Number(nights),
        adults: Number(adults),
        childrenAges,
        infants: Number(infants),
        directFlightsOnly: directOnly,
        minHotelStars: Number(minStars),
        roomType,
        multiDestination,
        stops,
        oneWayOnly,
        baggageIncluded,
        breakfastIncluded,
        preferenceCategory,
        continents: continentsParam ? continentsParam.split(",") : [],
      }),
    })
      // A refused or failed search is an error to say so — never an empty
      // list that reads as "no destinations fit your budget".
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        setMode(data.mode);
        if (data.mode === "routes") {
          setRoutes(data.routes || []);
        } else {
          setSingleSuggestions(data.suggestions || []);
          setUnpriced(data.unpriced || []);
        }
      })
      .catch(() => setError("error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    origin,
    tripType,
    budget,
    currency,
    departDate,
    returnDate,
    nights,
    adults,
    directOnly,
    minStars,
    roomType,
    multiDestination,
    stops,
    oneWayOnly,
    baggageIncluded,
    breakfastIncluded,
    preferenceCategory,
    continentsParam,
  ]);

  // Generated prices never reach a visitor — see the note in results/page.tsx.
  // Suggestions are *made of* prices here, so when they are generated there is
  // nothing honest left to show and the whole list is replaced.
  const isGeneratedData = useMemo(() => {
    if (mode === "routes") return false;
    return singleSuggestions.some((s) => s.flight?.isMock || s.hotel?.isMock);
  }, [mode, singleSuggestions]);
  const showGenerated = process.env.NODE_ENV === "development";
  const pricesUnavailable = isGeneratedData && !showGenerated;

  const hasResults = mode === "routes" ? routes.length > 0 : singleSuggestions.length + unpriced.length > 0;
  // "RUH مطار الملك خالد الدولي - الرياض" → "الرياض": the city, as the
  // route line names it.
  const originAirport = findAirport(origin.slice(0, 3));
  const originLabel = origin.includes(" - ")
    ? origin.split(" - ").pop()!.trim()
    : originAirport
      ? locale === "ar"
        ? originAirport.cityAr
        : originAirport.cityEn
      : origin.slice(0, 3).toUpperCase();
  // ── Filters: season and visa, on what the search found ─────────────
  // Every season rating and every visa kind is offered, each a toggle;
  // nothing chosen in a row means that row does not filter.
  const [seasonPick, setSeasonPick] = useState<Classification[]>([]);
  const [visaPick, setVisaPick] = useState<VisaCategory[]>([]);
  const [showOver, setShowOver] = useState(false);
  type Place = DestinationSuggestion["place"];
  const placeOk = (p: Place) =>
    (seasonPick.length === 0 || (p?.classification !== undefined && seasonPick.includes(p.classification))) &&
    (visaPick.length === 0 || (p?.visa !== undefined && visaPick.includes(p.visa)));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const singles = singleSuggestions.filter((s) => placeOk(s.place));
  const unpricedShown = unpriced.filter((s) => placeOk(s.place));
  const routeList = routes.filter((r) => r.stops.every((st) => placeOk(st.place)));
  const items = mode === "routes" ? routeList : singles;
  const within = items.filter((x) => x.withinBudget);
  const over = items.filter((x) => !x.withinBudget).sort((a, b) => a.totalPrice - b.totalPrice);
  const filtered = seasonPick.length > 0 || visaPick.length > 0;
  const money = (n: number) => `${Math.abs(n).toLocaleString("en-US")} ${currency}`;
  const d = dict.discoverResults;

  // How many results each choice would keep, so a chip with nothing behind
  // it says so before it is tapped.
  const allPlaces: Place[] =
    mode === "routes"
      ? routes.flatMap((r) => r.stops.map((st) => st.place))
      : [...singleSuggestions, ...unpriced].map((x) => x.place);
  const seasonCount = (c: Classification) => allPlaces.filter((p) => p?.classification === c).length;
  const visaCount = (v: VisaCategory) => allPlaces.filter((p) => p?.visa === v).length;
  const visaLabels: Record<VisaCategory, string> = {
    free: dict.visa.statusFree,
    arrival: dict.visa.statusArrival,
    eta: dict.visa.statusEta,
    required: dict.visa.statusRequired,
  };
  const pretty = (iso: string) =>
    iso
      ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale === "ar" ? "ar-u-ca-gregory-nu-latn" : "en-GB", {
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        })
      : "";
  const travellers = Number(adults) + childrenAges.length + Number(infants);

  const chip = (on: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-bold ring-1 transition ${
      on ? "bg-navy-900 text-white ring-navy-900" : "bg-white text-navy-800 ring-mist-300 hover:ring-navy-300"
    }`;

  const renderSingle = (list: DestinationSuggestion[]) => (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
      {list.map((s) => (
        <DestinationCard
          key={s.destinationCode}
          suggestion={s}
          locale={locale}
          origin={origin}
          departDate={departDate}
          returnDate={returnDate}
          travelers={{ adults: Number(adults), childrenAges, infants: Number(infants) }}
          currency={currency}
          directOnly={directOnly}
          baggageIncluded={baggageIncluded}
          photo={s.place ? photos[`${s.place.countryCode}/${s.place.citySlug}`] : undefined}
        />
      ))}
    </div>
  );
  const renderRoutes = (list: RouteSuggestion[]) => (
    <div className="space-y-5">
      {list.map((r) => (
        <RouteCard
          key={r.stops.map((x) => x.code).join("-")}
          route={r}
          locale={locale}
          originLabel={originLabel}
          travelers={{ adults: Number(adults), childrenAges, infants: Number(infants) }}
          currency={currency}
          directOnly={directOnly}
          baggageIncluded={baggageIncluded}
          photos={photos}
        />
      ))}
    </div>
  );

  return (
    <div className="bg-mist-50">
      <ResultsBand
        locale={locale}
        eyebrow={d.eyebrow}
        title={mode === "routes" ? d.titleRoutes : d.title}
        facts={[
          dict.discoverResults.searchLine.split(" · ")[0].replace("{origin}", originLabel),
          returnDate ? `${pretty(departDate)} ${locale === "ar" ? "←" : "→"} ${pretty(returnDate)}` : pretty(departDate),
          countLabel(travellers, { one: dict.results.travelersOne, two: dict.results.travelersTwo, few: dict.results.travelersFew, many: dict.results.travelersMany }),
          d.budgetFact.replace("{budget}", money(Number(budget))),
        ]}
        backHref={`/${locale}?${editSearchParams}#plan`}
        backLabel={d.backToSearch}
      />

      <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6">
        {showGenerated && isGeneratedData && !loading && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Generated data (no provider key configured). Hidden in production.
          </div>
        )}

        {!loading && !error && pricesUnavailable && (
          <PricesUnavailable
            locale={locale}
            dict={dict}
            exploreHref={`/${locale}/attractions`}
            planHref={`/${locale}/itinerary`}
          />
        )}

        {/* The filters, first: in season, and the visa a Saudi passport needs. */}
        {!loading && !error && !pricesUnavailable && hasResults && (
          <div className="mb-5 space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            {/* One swipeable line on a phone (a wrapped list of chips was
                a screen tall); wrapped on wider screens. */}
            <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
              <span className="me-1 shrink-0 text-xs font-bold text-navy-500">{d.filterSeason}</span>
              <button type="button" aria-pressed={seasonPick.length === 0} onClick={() => setSeasonPick([])} className={chip(seasonPick.length === 0)}>
                {d.seasonAll}
              </button>
              {CLASS_ORDER.map((c) => (
                <button key={c} type="button" aria-pressed={seasonPick.includes(c)} onClick={() => setSeasonPick((l) => toggle(l, c))} className={chip(seasonPick.includes(c))}>
                  <span aria-hidden="true">{CLASS_DOT[c]}</span>
                  {dict.travelSeasons.classes[c]}
                  <span className="text-xs font-semibold opacity-60">{seasonCount(c)}</span>
                </button>
              ))}
            </div>
            {/* One swipeable line on a phone (a wrapped list of chips was
                a screen tall); wrapped on wider screens. */}
            <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
              <span className="me-1 shrink-0 text-xs font-bold text-navy-500">{d.filterVisa}</span>
              <button type="button" aria-pressed={visaPick.length === 0} onClick={() => setVisaPick([])} className={chip(visaPick.length === 0)}>
                {d.visaAll}
              </button>
              {VISA_ORDER.map((v) => (
                <button key={v} type="button" aria-pressed={visaPick.includes(v)} onClick={() => setVisaPick((l) => toggle(l, v))} className={chip(visaPick.includes(v))}>
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${VISA_STYLES[v].dot}`} aria-hidden="true" />
                  {visaLabels[v]}
                  <span className="text-xs font-semibold opacity-60">{visaCount(v)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* The fares that chose these are seen ones, not live: they pick,
            they are not shown. The live price is one tap away on each. */}
        {!loading && hasResults && !pricesUnavailable && (mode === "routes" || singleSuggestions.length > 0) && (
          <div className="mb-5 rounded-xl bg-sea-50 px-4 py-3 text-sm leading-relaxed text-navy-800 ring-1 ring-sea-100">
            ℹ️ {d.pickedNotice.replace("{budget}", money(Number(budget)))}
            {mode === "routes" && <> {d.routesNotice}</>}
            {mode !== "routes" && tripType === "both" && <> {d.pickedNoticeHotel}</>}
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-white ring-1 ring-black/5" />
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="py-4 text-center text-sm text-red-600">
            {locale === "ar" ? "حدث خطأ أثناء البحث، حاول مرة أخرى." : "Something went wrong while searching. Please try again."}
          </p>
        )}

        {!loading && !error && !pricesUnavailable && !hasResults && (
          <p className="py-10 text-center text-navy-500">{d.noResults}</p>
        )}

        {/* Within budget: the answer. */}
        {!loading && !pricesUnavailable && within.length > 0 &&
          (mode === "routes" ? renderRoutes(within as RouteSuggestion[]) : renderSingle(within as DestinationSuggestion[]))}

        {/* Nothing fits: say what it would take. */}
        {!loading && !pricesUnavailable && hasResults && within.length === 0 && over.length > 0 && (
          <div className="rounded-2xl bg-rose-50 p-5 text-sm leading-relaxed text-rose-900 ring-1 ring-rose-200">
            {d.noneWithinFiltered}
          </div>
        )}
        {!loading && !pricesUnavailable && hasResults && items.length === 0 && unpricedShown.length === 0 && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
            <p className="text-navy-600">{d.noMatch}</p>
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setSeasonPick([]);
                  setVisaPick([]);
                }}
                className="mt-3 rounded-full bg-navy-900 px-4 py-2 text-sm font-bold text-white"
              >
                {d.clearFilters}
              </button>
            )}
          </div>
        )}

        {/* In season, but no fare seen for these dates: no price, no budget claim. */}
        {!loading && !pricesUnavailable && mode !== "routes" && unpricedShown.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-lg font-extrabold text-navy-900">{d.unpricedTitle}</h2>
            <p className="mb-4 mt-1 max-w-3xl text-sm leading-relaxed text-navy-600">{tripType === "hotel" ? d.unpricedBodyHotel : d.unpricedBody}</p>
            {renderSingle(unpricedShown)}
          </section>
        )}

        {/* Over budget: there, on request. */}
        {!loading && !pricesUnavailable && over.length > 0 && (
          <div className="mt-8">
            <button
              type="button"
              aria-expanded={showOver}
              onClick={() => setShowOver((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-rose-800 shadow-sm ring-1 ring-rose-200 transition hover:ring-rose-300"
            >
              {showOver
                ? d.hideOver
                : (mode === "routes" ? d.showOverRoutes : d.showOverDest).replace("{count}", String(over.length))}
              <span aria-hidden="true" className={`transition ${showOver ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>
            {showOver && (
              <div className="mt-4">
                {mode === "routes" ? renderRoutes(over as RouteSuggestion[]) : renderSingle(over as DestinationSuggestion[])}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
