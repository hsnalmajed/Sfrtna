"use client";

import { Suspense, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import type { Locale } from "@/lib/types";
import Photo from "@/components/Photo";
import { countLabel } from "@/lib/format";
import Icon, { type IconName } from "@/components/ui/Icon";
import { PLAN_EVENT, type PlanProduct } from "@/lib/planEvents";
import TripPlanner from "@/components/TripPlanner";
import HotelPlanner from "@/components/HotelPlanner";
import VisaBadge, { VISA_STYLES } from "@/components/VisaBadge";
import VisaRequirementsDialog from "@/components/VisaRequirementsDialog";
import OriginPicker from "@/components/OriginPicker";
import type { VisaCategory } from "@/data/visaStatus";

/** A city in season this month, with the two numbers that put it there. */
export interface ShowcaseCity {
  code: string;
  slug: string;
  name: string;
  countryName: string;
  photo?: string;
  high: number;
  rainyDays: number;
  /** The homepage planner, pointed at this city's airport (see cityAirports.ts). */
  flightHref?: string;
  flightAirport?: string;
  flightKm?: number;
  /** What the month is there, with its icon ("🌧️ Rainy winter", "☀️ Dry season"). */
  seasonKind?: string;
  /** The travel-season rating with its dot ("🟢 Best time to visit"). */
  classLabel?: string;
  /** Typical average low, °C; null when unknown. */
  low?: number | null;
  /** "Mild and mostly dry" — from the normals, by rule. */
  weatherSummary?: string;
  /** Why the month got its rating. */
  reason?: string;
  /** The city's in-season months, already named and joined. */
  bestMonths: string;
  /** Who names those months (a tourism board or a guide). */
  /** Confirmed entry status for a Saudi passport; absent when unconfirmed. */
  /** Confirmed at the official source only; `short` is the card's wording. */
  visa?: { category: VisaCategory; label: string; short: string };
  currency?: { code: string; name: string; rateLine?: string };
  /** The country guide's best-known sights. */
  landmarks: string[];
  /** The city's English name, which the hotel partners search by. */
  hotelCity: string;
  /** Lowest one-way fare seen from Riyadh this month or next, per person, SAR. */
  fare?: number;
}

export interface ShowcaseTool {
  href: string;
  icon: string;
  title: string;
  body: string;
}

export interface ShowcaseStep {
  n: string;
  title: string;
  body: string;
}

interface ShowcaseDict {
  tabSeason: string;
  tabTools: string;
  tabHow: string;
  tabPlan: string;
  planSubtitle: string;
  flightsTitle: string;
  flightsHint: string;
  hotelsTitle: string;
  hotelsHint: string;
  seasonTitle: string;
  seasonSubtitle: string;
  seasonCta: string;
  seasonAllCities: string;
  seasonFewerCities: string;
  seasonCityWeather: string;
  seasonFlight: string;
  seasonFlightTitle: string;
  seasonHigh: string;
  seasonRainNone: string;
  seasonRainOne: string;
  seasonRainTwo: string;
  seasonRainFew: string;
  seasonRainMany: string;
  seasonTapHint: string;
  seasonFare: string;
  seasonFareNote: string;
  summaryFare: string;
  originFrom: string;
  originChange: string;
  originSearch: string;
  originNoMatches: string;
  monthName: string;
  summaryWeather: string;
  summaryBestMonths: string;
  highLow: string;
  summaryVisa: string;
  summaryVisaUnknown: string;
  summaryVisaMore: string;
  summaryCurrency: string;
  summaryLandmarks: string;
  summaryAllPlaces: string;
  summaryMap: string;
  summaryBook: string;
  summaryHotels: string;
  summaryAirport: string;
  summaryClose: string;
  summaryBackTo: string;
  cardVisaUnknown: string;
  toolsSubtitle: string;
  toolCta: string;
  stepsTitle: string;
}

type TabKey = "season" | "tools" | "how" | "plan";

/**
 * Everything the site is, on one screen.
 *
 * The homepage used to run four full-height sections deep — favourites, then
 * this month, then the tools, then how it works — so seeing what Sfrtna
 * actually offers meant scrolling past three screens of it. A visitor who
 * doesn't scroll never learns the site has visa rules, city maps and currency
 * in it at all, which is most of its value and all of its difference.
 *
 * So the four sections are four tabs in one panel of fixed height. Nothing was
 * cut; it is the same content, reachable in a tap instead of a scroll, and the
 * page is a third of the length it was.
 *
 * The panel is deliberately a constant height across tabs. A tab strip that
 * makes the page jump as you move between tabs feels broken, and the jump is
 * worse than the empty row it avoids.
 *
 * It is navy, not white. A white card under a sunset photograph reads as a
 * different website pasted over the first one — the palette here is navy and
 * sunset orange, and the panel is the biggest surface on the page, so it is
 * the last thing that should be neutral. Dark, it continues the photograph
 * instead of interrupting it, and the destination photos inside it sit on the
 * dark ground they were shot against.
 */
export default function HomeShowcase({
  locale,
  seasonCities,
  initialPlan = null,
  tools,
  steps,
  dict,
  origin,
}: {
  locale: Locale;
  seasonCities: ShowcaseCity[];
  /** The airport the fares are from — the visitor's own (src/lib/origin.ts). */
  origin?: { iata: string; name: string };
  /** Open on the booking tab, on this search (from the URL). */
  initialPlan?: PlanProduct | null;
  tools: ShowcaseTool[];
  steps: ShowcaseStep[];
  dict: ShowcaseDict;
}) {
  // The cities in season this month are what a visitor sees first — a page
  // of places is the better welcome. Arriving to search (a search asked for
  // in the address, or /#plan) opens the search instead.
  const [active, setActive] = useState<TabKey>(initialPlan || seasonCities.length === 0 ? "plan" : "season");
  // The season tab runs every city in season past as a moving strip; the
  // button lays them all out as a still grid, in place rather than on
  // another page.
  const [allCities, setAllCities] = useState(false);
  // "Book your trip": which search is open inside the tab, if any.
  const [planProduct, setPlanProduct] = useState<PlanProduct | null>(initialPlan);
  // A trip handed to the form by a city summary, and a counter that
  // remounts the form so it starts from that trip.
  const [planPreset, setPlanPreset] = useState<string | undefined>(undefined);
  const [planKey, setPlanKey] = useState(0);
  // The season city whose summary is open.
  const [openCity, setOpenCity] = useState<ShowcaseCity | null>(null);
  // Its visa details, opened over the summary; closing them returns to it.
  const [visaOpen, setVisaOpen] = useState(false);

  useEffect(() => {
    if (!openCity || visaOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenCity(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCity, visaOpen]);

  /** From a city summary into the booking tab, with that city filled in. */
  function bookCity(c: ShowcaseCity, product: PlanProduct) {
    const preset =
      product === "flights"
        ? new URLSearchParams({ mode: "known", destination: c.flightAirport ?? "" })
        : new URLSearchParams({ hmode: "discover", city: c.hotelCity });
    setOpenCity(null);
    setPlanPreset(preset.toString());
    setPlanKey((k) => k + 1);
    setPlanProduct(product);
    setActive("plan");
    requestAnimationFrame(() =>
      document.getElementById("plan")?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }

  // The header's "book your trip" (see planEvents.ts), and arriving on
  // /#plan from another page: both mean "show me the search".
  useEffect(() => {
    function show(product?: PlanProduct) {
      setActive("plan");
      if (product) setPlanProduct(product);
      requestAnimationFrame(() =>
        document.getElementById("plan")?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    }
    function onOpen(e: Event) {
      const p = (e as CustomEvent<PlanProduct | undefined>).detail;
      show(p === "flights" || p === "hotels" ? p : undefined);
    }
    function onHash() {
      if (window.location.hash === "#plan") show();
    }
    // Deferred, not called here: no synchronous setState in an effect body.
    const arrived = initialPlan ? undefined : window.setTimeout(onHash, 0);
    window.addEventListener(PLAN_EVENT, onOpen);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.clearTimeout(arrived);
      window.removeEventListener(PLAN_EVENT, onOpen);
      window.removeEventListener("hashchange", onHash);
    };
  }, [initialPlan]);
  const isAr = locale === "ar";
  const arrow = isAr ? "←" : "→";

  // "Book your trip" first: it is the site's search now, and on a phone
  // the strip scrolls, so a tab at the far end is a tab nobody finds.
  const tabs: { key: TabKey; label: string; hidden?: boolean }[] = [
    { key: "plan", label: dict.tabPlan },
    { key: "season", label: dict.tabSeason, hidden: seasonCities.length === 0 },
    { key: "tools", label: dict.tabTools },
    { key: "how", label: dict.tabHow },
  ];

  const blurb: Record<TabKey, string> = {
    season: dict.seasonSubtitle,
    tools: dict.toolsSubtitle,
    how: dict.stepsTitle,
    plan: dict.planSubtitle,
  };

  // The tab the visitor is on: a Travel Blue pill, its words in the brand's
  // gold, with a sky-blue glow. The blue runs Travel Blue to navy rather
  // than sky blue, because gold on sky blue is barely readable (about 1.6:1)
  // and gold on this is comfortably so.
  const selectedClass =
    "bg-gradient-to-l from-sea-600 to-navy-900 text-sun-400 ring-2 ring-sea-400/70 shadow-[0_0_28px_-4px_var(--sea-400)]";

  const tabClass = (on: boolean) =>
    `shrink-0 rounded-full px-4 py-2.5 text-sm font-bold transition duration-200 sm:px-5 sm:text-base ${
      on ? selectedClass : "text-white/60 hover:bg-white/10 hover:text-white"
    }`;

  // "Book your trip" is not another thing to browse — it is the way out of
  // browsing and into a search — so it is always the orange of the header's
  // "Book your trip" button, whichever tab is open. Chosen, it keeps the
  // orange and gains the selected tab's blue ring and glow.
  const planTabClass = (on: boolean) =>
    `relative inline-flex shrink-0 items-center gap-2 rounded-full bg-sun-400 px-5 py-2.5 text-sm font-extrabold text-navy-950 transition duration-200 hover:bg-sun-300 sm:px-6 sm:text-base ${
      on
        ? "ring-2 ring-sea-400 shadow-[0_0_28px_-4px_var(--sea-400)]"
        : "shadow-[var(--shadow-sun)] hover:-translate-y-0.5"
    }`;

  const planChoices: { value: PlanProduct; icon: IconName; title: string; hint: string }[] = [
    { value: "flights", icon: "plane", title: dict.flightsTitle, hint: dict.flightsHint },
    { value: "hotels", icon: "hotel", title: dict.hotelsTitle, hint: dict.hotelsHint },
  ];

  const rainText = (days: number) => {
    const n = Math.round(days);
    return n === 0
      ? dict.seasonRainNone
      : countLabel(n, { one: dict.seasonRainOne, two: dict.seasonRainTwo, few: dict.seasonRainFew, many: dict.seasonRainMany });
  };

  // A season city is a question — "should I go there?" — so tapping it
  // opens its summary rather than leaving the page: weather, visa, currency,
  // sights, and the way into booking it.
  const cityCard = (c: ShowcaseCity) => (
    <button
      key={`${c.code}-${c.slug}`}
      type="button"
      onClick={() => {
        setVisaOpen(false);
        setOpenCity(c);
      }}
      aria-haspopup="dialog"
      className="group relative isolate block aspect-[3/4] w-full overflow-hidden rounded-2xl text-start ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:ring-sun-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400"
    >
      <Photo
        src={c.photo}
        className="absolute inset-0 -z-10 h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
        fallback={<div className="absolute inset-0 -z-10 bg-gradient-to-br from-navy-700 to-navy-990" />}
      />
      <div className="scrim-soft absolute inset-0 -z-10" />
      {/* Top: the month's rating there, in the site-wide wording, and under
          it the entry status for a Saudi passport. */}
      <div className="absolute start-2 top-2 flex max-w-[calc(100%-1rem)] flex-col items-start gap-1">
        {c.classLabel && (
          <span className="max-w-full truncate rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-extrabold text-navy-900 shadow-sm backdrop-blur-sm">
            {c.classLabel}
          </span>
        )}
        {/* Entry for a Saudi passport: the confirmed status, or a plain
            "check" where we have not confirmed one. */}
        <span
          className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-0.5 text-xs font-bold shadow-sm ring-1 ${
            c.visa ? VISA_STYLES[c.visa.category].chip : "bg-white/85 text-navy-800 ring-white/40"
          }`}
        >
          <span aria-hidden="true">{c.visa ? VISA_STYLES[c.visa.category].icon : "🛂"}</span>
          <span className="truncate">{c.visa ? c.visa.short : dict.cardVisaUnknown}</span>
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="truncate font-display text-sm font-extrabold text-white drop-shadow-sm sm:text-base">{c.name}</p>
        <p className="truncate text-xs font-semibold text-white/70">{c.countryName}</p>
        {/* The season and its temperatures, side by side on one line. */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {c.seasonKind && (
            <span className="inline-flex rounded-full bg-navy-990/65 px-2 py-0.5 text-xs font-bold text-sun-200 backdrop-blur-sm">
              {c.seasonKind}
            </span>
          )}
          <span className="inline-flex rounded-full bg-navy-990/65 px-2 py-0.5 text-xs font-bold text-sun-300 backdrop-blur-sm" dir="ltr">
            🌡 {c.low !== null && c.low !== undefined ? dict.highLow.replace("{low}", String(Math.round(c.low))).replace("{high}", String(Math.round(c.high))) : `${Math.round(c.high)}°`}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {/* The fare matters more than the rain; the rain only shows where
              no fare was seen, so the card is never left with one number. */}
          {c.fare ? (
            <span className="inline-flex rounded-full bg-sun-400 px-2 py-0.5 text-xs font-extrabold text-navy-950">
              {dict.seasonFare.replace("{price}", c.fare.toLocaleString("en-US"))}
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-navy-990/65 px-2 py-0.5 text-xs font-bold text-sea-200 backdrop-blur-sm">
              {rainText(c.rainyDays)}
            </span>
          )}
        </div>
      </div>
    </button>
  );

  const fill = (template: string, c: ShowcaseCity) =>
    template.replace("{city}", c.name).replace("{country}", c.countryName);

  const summary = openCity && (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-990/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={() => setOpenCity(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={openCity.name}
        onClick={(e) => e.stopPropagation()}
        className="tab-fade max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-navy-950 text-start shadow-2xl ring-1 ring-white/15 sm:rounded-3xl"
      >
        {/* The place first: its photograph, its name, its country. */}
        <div className="relative h-44 sm:h-56">
          <Photo
            src={openCity.photo}
            className="absolute inset-0 h-full w-full object-cover"
            fallback={<div className="absolute inset-0 bg-gradient-to-br from-navy-700 to-navy-990" />}
          />
          <div className="scrim-soft absolute inset-0" />
          <button
            type="button"
            onClick={() => setOpenCity(null)}
            aria-label={dict.summaryClose}
            className="absolute end-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-navy-990/70 text-lg text-white ring-1 ring-white/30 transition hover:bg-navy-990"
          >
            ✕
          </button>
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="font-display text-h2 font-black text-white drop-shadow">{openCity.name}</p>
            <p className="text-sm font-semibold text-white/80">{openCity.countryName}</p>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {/* Weather this month, and when else it is good. */}
          <section className="rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10">
            <h3 className="text-xs font-bold text-white/60">
              {dict.summaryWeather.replace("{month}", dict.monthName)}
              {openCity.seasonKind && <span className="text-sun-300"> · {openCity.seasonKind}</span>}
            </h3>
            {openCity.classLabel && <p className="mt-2 text-base font-extrabold text-white">{openCity.classLabel}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-navy-990/70 px-3 py-1 text-sm font-bold text-sun-300" dir="ltr">
                🌡 {openCity.low !== null && openCity.low !== undefined ? dict.highLow.replace("{low}", String(Math.round(openCity.low))).replace("{high}", String(Math.round(openCity.high))) : `${Math.round(openCity.high)}°`}
              </span>
              {openCity.weatherSummary && (
                <span className="rounded-full bg-navy-990/70 px-3 py-1 text-sm font-bold text-white">{openCity.weatherSummary}</span>
              )}
              <span className="rounded-full bg-navy-990/70 px-3 py-1 text-sm font-bold text-sea-200">
                {rainText(openCity.rainyDays)}
              </span>
            </div>
            {openCity.reason && <p className="mt-2 text-sm text-white/80">{openCity.reason}</p>}
            {openCity.bestMonths && (
              <p className="mt-2 text-sm text-white/75">
                {dict.summaryBestMonths.replace("{months}", openCity.bestMonths)}
              </p>
            )}
          </section>

          {openCity.fare && (
            <p className="rounded-2xl bg-sun-400/10 px-4 py-3 text-sm font-bold text-sun-200 ring-1 ring-sun-400/30">
              ✈️ {dict.summaryFare.replace("{price}", openCity.fare.toLocaleString("en-US"))}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Visa: only a status we confirmed at the source. */}
            <section className="rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10">
              <h3 className="text-xs font-bold text-white/60">{dict.summaryVisa}</h3>
              <div className="mt-2">
                {openCity.visa ? (
                  <VisaBadge category={openCity.visa.category} label={openCity.visa.label} />
                ) : (
                  <p className="text-sm text-white/75">{dict.summaryVisaUnknown}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setVisaOpen(true)}
                aria-haspopup="dialog"
                className="mt-2 inline-block text-start text-xs font-bold text-sea-300 underline-offset-2 hover:underline"
              >
                {arrow} {dict.summaryVisaMore}
              </button>
            </section>

            <section className="rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10">
              <h3 className="text-xs font-bold text-white/60">{dict.summaryCurrency}</h3>
              {openCity.currency ? (
                <>
                  <p className="mt-2 text-base font-bold text-white">
                    {openCity.currency.name} <span className="text-white/50">({openCity.currency.code})</span>
                  </p>
                  {openCity.currency.rateLine && (
                    <p className="mt-1 text-sm text-sun-300">{openCity.currency.rateLine}</p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-white/60">—</p>
              )}
            </section>
          </div>

          {openCity.landmarks.length > 0 && (
            <section className="rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10">
              <h3 className="text-xs font-bold text-white/60">{fill(dict.summaryLandmarks, openCity)}</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {openCity.landmarks.map((l) => (
                  <li key={l} className="rounded-full bg-navy-990/70 px-3 py-1 text-sm font-semibold text-white">
                    🏛 {l}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold">
                <Link href={`/${locale}/attractions/${openCity.code}/${openCity.slug}`} className="text-sea-300 hover:underline">
                  {arrow} {fill(dict.summaryAllPlaces, openCity)}
                </Link>
                <Link href={`/${locale}/maps/${openCity.code}/${openCity.slug}`} className="text-sea-300 hover:underline">
                  {arrow} {fill(dict.summaryMap, openCity)}
                </Link>
              </div>
            </section>
          )}

          {/* The way out of reading and into booking. */}
          <div className="space-y-2 pt-1">
            {openCity.flightAirport && (
              <>
                <button
                  type="button"
                  onClick={() => bookCity(openCity, "flights")}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sun-400 px-5 py-4 font-display text-base font-extrabold text-navy-950 shadow-[var(--shadow-sun)] transition hover:bg-sun-300"
                >
                  <Icon name="plane" className="h-5 w-5" />
                  {fill(dict.summaryBook, openCity)}
                </button>
                <p className="text-center text-xs text-white/55">
                  {dict.summaryAirport
                    .replace("{airport}", openCity.flightAirport)
                    .replace("{km}", String(openCity.flightKm ?? 0))}
                </p>
              </>
            )}
            <button
              type="button"
              onClick={() => bookCity(openCity, "hotels")}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/20"
            >
              <Icon name="hotel" className="h-4 w-4" />
              {fill(dict.summaryHotels, openCity)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div id="plan" className="mx-auto max-w-7xl scroll-mt-24 px-3 sm:px-6">
      <div className="rounded-[2rem] bg-gradient-to-b from-navy-900 to-navy-990 shadow-[0_30px_80px_-20px_rgba(4,24,47,0.6)] ring-1 ring-white/10">
        {/* ── The strip ─────────────────────────────────────────────── */}
        <div className="rail rail-fade flex items-center gap-2 overflow-x-auto rounded-t-[2rem] border-b border-white/10 bg-white/[0.04] px-3 py-3 sm:px-5">
          {tabs
            .filter((t) => !t.hidden)
            .map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActive(t.key)}
                aria-pressed={active === t.key}
                className={t.key === "plan" ? planTabClass(active === t.key) : tabClass(active === t.key)}
              >
                {t.key === "plan" && (
                  <>
                    {/* A small beacon, so the eye finds it even in passing.
                        Still when the visitor prefers reduced motion. */}
                    {active !== "plan" && (
                      <span className="absolute -top-0.5 -end-0.5 flex h-3 w-3" aria-hidden="true">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-sea-400 opacity-75 motion-safe:animate-ping" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-sea-400 ring-2 ring-navy-900" />
                      </span>
                    )}
                    <Icon name="plane" className="h-[1.1rem] w-[1.1rem]" />
                  </>
                )}
                {t.key === "season" ? dict.seasonTitle : t.label}
              </button>
            ))}
        </div>

        {/* ── The panel ─────────────────────────────────────────────── */}
        <div className="p-4 sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-sm leading-relaxed text-white/65">{blurb[active]}</p>
              {active === "season" && origin && (
                <div className="mt-2">
                  <OriginPicker
                    locale={locale}
                    iata={origin.iata}
                    cityName={origin.name}
                    labels={{ from: dict.originFrom, change: dict.originChange, search: dict.originSearch, noMatches: dict.originNoMatches }}
                  />
                </div>
              )}
            </div>
            {active === "season" && seasonCities.length > 6 && (
              <button
                type="button"
                onClick={() => setAllCities((v) => !v)}
                aria-expanded={allCities}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/20"
              >
                {allCities
                  ? dict.seasonFewerCities
                  : dict.seasonAllCities.replace("{count}", String(seasonCities.length))}
                <span aria-hidden="true" className={`transition ${allCities ? "-rotate-90" : ""}`}>
                  {arrow}
                </span>
              </button>
            )}
          </div>

          {/* Keyed on the tab so the fade replays on every switch. The floor
              on the height is what stops the page jumping under the strip
              when a shorter panel replaces a taller one — a jump reads as a
              glitch, and is worse than the blank inch it saves. */}
          <div key={active} className="tab-fade min-h-[16rem] sm:min-h-[15rem]">
            {active === "season" && (
              <>
                {allCities || seasonCities.length <= 6 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
                    {seasonCities.map((c) => cityCard(c))}
                  </div>
                ) : (
                  // Every city in season, drifting past (see .marquee in
                  // globals.css). The second copy is only there to close the
                  // loop, so it is inert: screen readers and the Tab key meet
                  // each city once.
                  <div className="marquee -mx-4 px-4 py-1 sm:-mx-7 sm:px-7">
                    <div
                      className="marquee-track"
                      style={{ "--marquee-duration": `${seasonCities.length * 5}s` } as CSSProperties}
                    >
                      {[0, 1].map((copy) => (
                        <div
                          key={copy}
                          className={`flex gap-3 pe-3 sm:gap-4 sm:pe-4 ${copy === 1 ? "marquee-copy" : ""}`}
                          aria-hidden={copy === 1 || undefined}
                          inert={copy === 1}
                        >
                          {seasonCities.map((c) => (
                            <div key={`${c.code}-${c.slug}`} className="w-40 shrink-0 sm:w-48">
                              {cityCard(c)}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="mt-3 text-sm font-semibold text-white/75">👆 {dict.seasonTapHint}</p>
                {seasonCities.some((c) => c.fare) && <p className="mt-1 text-xs text-white/60">{dict.seasonFareNote}</p>}
                <p className="mt-2 text-xs text-white/45">
                  <Link href={`/${locale}/seasons`} className="font-bold text-white/70 underline-offset-2 hover:underline">
                    {dict.seasonCta}
                  </Link>
                </p>
              </>
            )}

            {active === "tools" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                {tools.map((t) => (
                  <Link
                    key={t.href}
                    href={t.href}
                    className="group relative flex flex-col overflow-hidden rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.12] hover:ring-sun-400/40"
                  >
                    <span
                      className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-sun-300 to-sun-600 transition-transform duration-300 group-hover:scale-x-100 rtl:origin-right"
                      aria-hidden="true"
                    />
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sun-400/15 text-xl ring-1 ring-sun-400/30">
                      {t.icon}
                    </span>
                    <h3 className="mt-3.5 font-display text-base font-extrabold text-white">
                      {t.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/60">{t.body}</p>
                    <span className="mt-auto inline-flex items-center gap-1 pt-3.5 text-sm font-bold text-sun-300">
                      {dict.toolCta}
                      <span
                        className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
                        aria-hidden="true"
                      >
                        {arrow}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {active === "plan" && (
              <div>
                {/* Flights or hotels, then that search opens right here —
                    the choice shrinks to a switch once a form is showing. */}
                <div
                  role="radiogroup"
                  aria-label={dict.tabPlan}
                  className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:gap-4"
                >
                  {planChoices.map((c) => {
                    const on = planProduct === c.value;
                    const compact = planProduct !== null;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          setPlanPreset(undefined);
                          setPlanProduct(c.value);
                        }}
                        className={`group flex items-center gap-3 rounded-2xl text-start ring-1 transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 sm:gap-4 ${
                          compact ? "justify-center px-4 py-3" : "p-5 hover:-translate-y-1 sm:p-8"
                        } ${
                          on
                            ? "bg-white text-navy-950 ring-white"
                            : "bg-white/[0.06] text-white ring-white/10 hover:bg-white/[0.12] hover:ring-sun-400/50"
                        }`}
                      >
                        <span
                          className={`flex shrink-0 items-center justify-center rounded-full ${
                            compact ? "h-9 w-9" : "h-12 w-12 sm:h-14 sm:w-14"
                          } ${on || !compact ? "bg-sun-400 text-navy-950" : "bg-white/10 text-sun-400"}`}
                        >
                          <Icon name={c.icon} className={compact ? "h-[1.125rem] w-[1.125rem]" : "h-6 w-6 sm:h-7 sm:w-7"} />
                        </span>
                        <span className="min-w-0">
                          <span className={`block font-display font-extrabold ${compact ? "text-base" : "text-lg sm:text-h3"}`}>
                            {c.title}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {planProduct !== null && (
                  // Top margin: each planner's own two tabs sit half outside
                  // its panel's top edge. No overflow-hidden anywhere above —
                  // the calendar and travellers counter hang below the panel.
                  <div className="mt-12 rounded-2xl bg-navy-990/60 px-4 pb-5 ring-1 ring-white/15 sm:px-6 sm:pb-6">
                    <Suspense fallback={null}>
                      {planProduct === "flights" ? (
                        <TripPlanner key={`f${planKey}`} locale={locale} tone="dark" preset={planPreset} />
                      ) : (
                        <HotelPlanner key={`h${planKey}`} locale={locale} tone="dark" preset={planPreset} />
                      )}
                    </Suspense>
                  </div>
                )}
              </div>
            )}

            {active === "how" && (
              <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
                {steps.map((s) => (
                  <li
                    key={s.n}
                    className="relative rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sun-400 font-display text-base font-black text-navy-950">
                      {s.n}
                    </span>
                    <h3 className="mt-3.5 font-display text-base font-extrabold text-white">
                      {s.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/60">{s.body}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
      {/* Portalled to <body>: the showcase sits in a stacking context under
          the fixed header, and the summary has to cover both. */}
      {summary && createPortal(summary, document.body)}
      {openCity && visaOpen && (
        <VisaRequirementsDialog
          countryCode={openCity.code}
          locale={locale}
          onBack={() => setVisaOpen(false)}
          backLabel={dict.summaryBackTo.replace("{city}", openCity.name)}
          onClose={() => {
            setVisaOpen(false);
            setOpenCity(null);
          }}
        />
      )}
    </div>
  );
}
