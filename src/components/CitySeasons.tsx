"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Locale } from "@/lib/types";
import type { Continent } from "@/lib/countries";
import { CONTINENT_ORDER } from "@/components/DestinationFilters";
import { searchMatches } from "@/lib/search";
import { CLASS_DOT } from "@/lib/travelSeason/labels";
import Photo from "@/components/Photo";
import FilterPill, { FilterToggle } from "@/components/ui/FilterPill";
import { getDictionary } from "@/lib/dictionaries";
import { VISA_STYLES } from "@/components/VisaBadge";
import type { VisaCategory } from "@/data/visaStatus";

/**
 * "When to travel?", city by city — a view onto the travel-season records
 * (src/data/climate/travelSeasons.json), never a calculation of its own.
 *
 *   by month  "Where is good in March?"    → destinations rated EXCELLENT /
 *                                             VERY_GOOD (optionally GOOD)
 *   by city   "When should I go to Kyoto?" → all twelve months with their
 *                                             rating, season, typical low–high,
 *                                             weather and why
 */

type Cls = "EXCELLENT" | "VERY_GOOD" | "GOOD" | "ACCEPTABLE" | "NOT_RECOMMENDED";
type SeasonName = "winter" | "spring" | "summer" | "autumn";
type Pattern = "rainy_season" | "dry_season" | "snow_season" | null;

export interface SeasonMonth {
  classification: Cls | null;
  finalScore: number | null;
  season: SeasonName;
  pattern: Pattern;
  /** What the month is there ("Rainy winter", "Dry season") and its icon. */
  seasonName: string;
  seasonIcon: string;
  phase: "start" | "peak" | "end" | null;
  high: number | null;
  low: number | null;
  rainDays: number | null;
  summary: string | null;
  reason: string | null;
}

export interface SeasonCity {
  code: string;
  slug: string;
  name: string;
  countryName: string;
  keywords: string;
  continent: Continent;
  photo?: string;
  /** For the booking forms: the city's airport and its English name (hotel search). */
  airport?: string;
  nameEn?: string;
  /** Entry for a Saudi passport, when confirmed. */
  visa?: { category: VisaCategory; short: string };
  /** January first. */
  months: SeasonMonth[];
}

interface Dict {
  modeMonthTitle: string;
  modeMonthQ: string;
  modeMonthHint: string;
  modeCityTitle: string;
  modeCityQ: string;
  modeCityHint: string;
  monthNames: string[];
  nowLabel: string;
  inSeasonInMonth: string;
  noneInMonth: string;
  showGood: string;
  citySearch: string;
  cityNoMatch: string;
  pickCity: string;
  cityYearTitle: string;
  bestMonths: string;
  noBestMonths: string;
  viewCity: string;
  viewYear: string;
  bookTrip: string;
  close: string;
  prevMonth: string;
  nextMonth: string;
  tapMonth: string;
  kinds: Record<string, string>;
  allContinents: string;
  continents: Record<Continent, string>;
  visaUnknown: string;
  ts: {
    classes: Record<Cls, string>;
    phases: Record<"start" | "peak" | "end", string>;
    patterns: Record<"rainy_season" | "dry_season" | "snow_season", string>;
    highLow: string;
    rainDays: string;
    rainDaysNone: string;
    reasonLabel: string;
  };
}

const CLASS_STYLE: Record<Cls, string> = {
  EXCELLENT: "bg-emerald-600 text-white",
  VERY_GOOD: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300",
  GOOD: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
  ACCEPTABLE: "bg-orange-100 text-orange-900 ring-1 ring-orange-300",
  NOT_RECOMMENDED: "bg-rose-100 text-rose-900 ring-1 ring-rose-300",
};
/** The coloured strip along the top of a month tile. */
const BAR_STYLE: Record<Cls, string> = {
  EXCELLENT: "bg-emerald-600",
  VERY_GOOD: "bg-emerald-400",
  GOOD: "bg-amber-400",
  ACCEPTABLE: "bg-orange-400",
  NOT_RECOMMENDED: "bg-rose-400",
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const GOOD_CLASSES: Cls[] = ["EXCELLENT", "VERY_GOOD"];

export default function CitySeasons({
  locale,
  cities,
  currentMonth,
  dict,
  initialCity,
}: {
  locale: Locale;
  cities: SeasonCity[];
  currentMonth: number;
  dict: Dict;
  /** Opens "by city" on this city (`?city=<slug>`, from a city page). */
  initialCity?: string;
}) {
  const startCity = initialCity && cities.some((c) => c.slug === initialCity) ? initialCity : "";
  // Nothing chosen on arrival: the visitor picks "by month" or "by city".
  const [mode, setMode] = useState<"month" | "city" | null>(startCity ? "city" : null);
  const [month, setMonth] = useState(currentMonth);
  const [continent, setContinent] = useState<Continent | "all">("all");
  const [withGood, setWithGood] = useState(false);
  const [query, setQuery] = useState("");
  const [citySlug, setCitySlug] = useState(startCity);
  // The month window: a city and one of its months, opened over the page.
  const [dialog, setDialog] = useState<{ slug: string; month: number } | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const isAr = locale === "ar";
  const t = dict.ts;
  const ft = getDictionary(locale).filters;

  const temps = (m: SeasonMonth) =>
    m.high === null
      ? null
      : m.low === null
        ? `${Math.round(m.high)}°`
        : t.highLow.replace("{low}", String(Math.round(m.low))).replace("{high}", String(Math.round(m.high)));
  const seasonText = (m: SeasonMonth) => `${m.seasonIcon} ${m.seasonName}`;
  const badge = (c: Cls) => `${CLASS_DOT[c]} ${t.classes[c]}`;

  const shownClasses: Cls[] = withGood ? [...GOOD_CLASSES, "GOOD"] : GOOD_CLASSES;
  const inMonth = useMemo(() => {
    return cities
      .filter((c) => {
        const r = c.months[month - 1];
        return r.classification && shownClasses.includes(r.classification) && (continent === "all" || c.continent === continent);
      })
      .sort((a, b) => (b.months[month - 1].finalScore ?? 0) - (a.months[month - 1].finalScore ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities, month, continent, withGood]);

  // Shown by continent, and within a continent country by country — the
  // best country first, its cities together, best city first — so a list
  // of seventy reads as a map rather than a ranking that jumps from Turkey
  // to Japan and back.
  const grouped = useMemo(() => {
    const score = (c: SeasonCity) => c.months[month - 1].finalScore ?? 0;
    const groups: { continent: Continent; cities: SeasonCity[] }[] = [];
    for (const cont of CONTINENT_ORDER) {
      const here = inMonth.filter((c) => c.continent === cont);
      if (!here.length) continue;
      const byCountry = new Map<string, SeasonCity[]>();
      for (const c of here) byCountry.set(c.code, [...(byCountry.get(c.code) ?? []), c]);
      const ordered = [...byCountry.values()]
        .map((list) => list.sort((a, b) => score(b) - score(a)))
        .sort((a, b) => score(b[0]) - score(a[0]))
        .flat();
      groups.push({ continent: cont, cities: ordered });
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inMonth]);

  const cityMatches = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return cities.filter((c) => searchMatches([c.keywords, c.slug], q)).slice(0, 8);
  }, [cities, query]);

  const city = cities.find((c) => c.slug === citySlug);

  /** "By city" for this city, from the search or a month window. */
  const openCity = (slug: string) => {
    setCitySlug(slug);
    setQuery("");
    setDialog(null);
    setMode("city");
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };


  const modes = [
    { m: "month" as const, icon: "🗓", title: dict.modeMonthTitle, q: dict.modeMonthQ, hint: dict.modeMonthHint },
    { m: "city" as const, icon: "🏙", title: dict.modeCityTitle, q: dict.modeCityQ, hint: dict.modeCityHint },
  ];


  return (
    <div ref={top} className="scroll-mt-24">
      <div role="tablist" className="grid gap-3 sm:grid-cols-2">
        {modes.map((o) => {
          const active = mode === o.m;
          return (
            <button
              key={o.m}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(o.m)}
              className={`flex items-start gap-3 rounded-2xl p-4 text-start transition sm:p-5 ${
                active
                  ? "bg-navy-900 text-white shadow-[var(--shadow-lift)]"
                  : "bg-white text-navy-900 shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 hover:ring-sea-400/50"
              }`}
            >
              <span className="text-3xl leading-none" aria-hidden="true">
                {o.icon}
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-display text-lg font-extrabold">{o.title}</span>
                  <span className={`text-sm font-bold ${active ? "text-sun-300" : "text-sea-600"}`}>{o.q}</span>
                </span>
                <span className={`mt-1 hidden text-sm leading-relaxed sm:block ${active ? "text-white/75" : "text-navy-600"}`}>
                  {o.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {mode === "month" && (
        <div className="mt-6">
          {/* The site's filter pills: the month, the continent, and whether
              "good" months count too — one short row instead of twelve month
              buttons and a row of continents filling the screen. */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill<number>
              locale={locale}
              icon="🗓"
              label={ft.month}
              value={month}
              onChange={(m) => m !== "all" && setMonth(m)}
              options={MONTHS.map((m) => ({ value: m, label: dict.monthNames[m - 1], note: m === currentMonth ? dict.nowLabel : undefined }))}
            />
            <FilterPill<Continent>
              locale={locale}
              icon="🌍"
              label={ft.continent}
              allLabel={dict.allContinents}
              value={continent}
              onChange={setContinent}
              options={CONTINENT_ORDER.map((c) => ({ value: c, label: dict.continents[c] }))}
            />
            <FilterToggle label={ft.withGood} on={withGood} onChange={setWithGood} />
          </div>

          <h2 className="mb-1 mt-6 font-display text-xl font-extrabold text-navy-900">
            {dict.inSeasonInMonth.replace("{month}", dict.monthNames[month - 1]).replace("{count}", String(inMonth.length))}
          </h2>
          <div className="mb-4" />

          {inMonth.length === 0 ? (
            <p className="rounded-xl bg-mist-50 px-4 py-10 text-center text-sm text-navy-500">{dict.noneInMonth}</p>
          ) : (
            <div className="space-y-6">
              {grouped.map((g) => (
                <section key={g.continent}>
                  <h3 className="mb-3 flex items-center gap-2 font-display text-base font-extrabold text-navy-900">
                    {dict.continents[g.continent]}
                    <span className="rounded-full bg-mist-100 px-2 py-0.5 text-2xs font-bold text-navy-500">{g.cities.length}</span>
                  </h3>
                  {/* Two to a row on a phone: picture on top, the facts under it. */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {g.cities.map((c) => {
                      const r = c.months[month - 1];
                      return (
                        <button
                          key={c.slug}
                          type="button"
                          onClick={() => setDialog({ slug: c.slug, month })}
                          aria-haspopup="dialog"
                          className="group relative isolate flex aspect-[3/4] w-full flex-col justify-between overflow-hidden rounded-2xl text-start ring-1 ring-navy-950/10 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] active:scale-[0.98]"
                        >
                          {/* The homepage's season card: the picture behind,
                              the month's rating and the visa at the top, the
                              city, its season and temperatures at the bottom. */}
                          <div className="absolute inset-0 -z-10">
                            <Photo
                              placeholder
                              src={c.photo}
                              className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
                              fallback={<div className="absolute inset-0 bg-gradient-to-br from-navy-700 to-navy-990" />}
                            />
                            <div className="scrim-soft absolute inset-0" />
                          </div>
                          <div className="flex min-w-0 flex-col items-start gap-1 p-2">
                            {r.classification && (
                              <span className="max-w-full truncate rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-extrabold text-navy-900 shadow-sm">
                                {badge(r.classification)}
                              </span>
                            )}
                            <span
                              className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-0.5 text-xs font-bold shadow-sm ring-1 ${
                                c.visa ? VISA_STYLES[c.visa.category].chip : "bg-white/85 text-navy-800 ring-white/40"
                              }`}
                            >
                              <span aria-hidden="true">{c.visa ? VISA_STYLES[c.visa.category].icon : "🛂"}</span>
                              <span className="truncate">{c.visa ? c.visa.short : dict.visaUnknown}</span>
                            </span>
                          </div>
                          <div className="min-w-0 p-3 pt-2">
                            <p className="truncate font-display text-base font-extrabold text-white drop-shadow-sm">{c.name}</p>
                            <p className="truncate text-xs font-semibold text-white/75">{c.countryName}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1">
                              <span className="inline-flex max-w-full truncate rounded-full bg-navy-990/65 px-2 py-0.5 text-xs font-bold text-sun-200 backdrop-blur-sm">
                                {seasonText(r)}
                              </span>
                              {temps(r) && (
                                <span className="inline-flex rounded-full bg-navy-990/65 px-2 py-0.5 text-xs font-bold text-sun-300 backdrop-blur-sm" dir="ltr">
                                  🌡 {temps(r)}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "city" && (
        <div className="mt-6">
          <div className="relative mx-auto max-w-xl">
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-lg">
              🔎
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dict.citySearch}
              aria-label={dict.citySearch}
              className="w-full rounded-full border-2 border-mist-200 bg-white py-3.5 pe-5 ps-12 text-base font-semibold text-navy-900 shadow-[var(--shadow-card)] outline-none transition placeholder:font-normal placeholder:text-navy-400 focus:border-sun-400 focus:ring-4 focus:ring-sun-400/20"
            />
            {query.trim() && (
              <ul className="absolute inset-x-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-2xl bg-white shadow-[var(--shadow-lift)] ring-1 ring-mist-200">
                {cityMatches.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-navy-500">{dict.cityNoMatch}</li>
                ) : (
                  cityMatches.map((c) => (
                    <li key={c.slug}>
                      <button type="button" onClick={() => openCity(c.slug)} className="w-full px-4 py-2.5 text-start text-sm hover:bg-mist-50">
                        <span className="font-bold text-navy-900">{c.name}</span>
                        <span className="text-navy-500"> · {c.countryName}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          {!city ? (
            <p className="mx-auto mt-4 max-w-xl text-center text-sm text-navy-500">{dict.pickCity}</p>
          ) : (
            <section className="mt-6 overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-card)] ring-1 ring-navy-950/5">
              {/* The city: its photograph, name and country, and when it is at its best. */}
              <div className="relative isolate h-44 sm:h-56">
                <Photo
                  placeholder
                  src={city.photo}
                  className="absolute inset-0 -z-10 h-full w-full object-cover"
                  fallback={<div className="absolute inset-0 -z-10 bg-gradient-to-br from-navy-700 to-navy-990" />}
                />
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-990/90 via-navy-990/40 to-transparent" />
                <div className="flex h-full flex-wrap items-end justify-between gap-3 p-5 sm:p-6">
                  <div>
                    <p className="text-sm font-bold text-sun-300">{city.countryName}</p>
                    <h2 className="font-display text-2xl font-black text-white drop-shadow sm:text-3xl">
                      {dict.cityYearTitle.replace("{city}", city.name)}
                    </h2>
                  </div>
                  <Link
                    href={`/${locale}/attractions/${city.code}/${city.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/30 backdrop-blur-md transition hover:bg-white/25"
                  >
                    🏛 {dict.viewCity} <span aria-hidden="true">{isAr ? "←" : "→"}</span>
                  </Link>
                </div>
              </div>

              <div className="p-4 sm:p-6">
                {(() => {
                  const best = MONTHS.filter((m) => {
                    const c = city.months[m - 1].classification;
                    return c !== null && GOOD_CLASSES.includes(c);
                  });
                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="me-1 text-sm font-extrabold text-navy-900">⭐ {dict.bestMonths}:</span>
                      {best.length ? (
                        best.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setDialog({ slug: city.slug, month: m })}
                            aria-haspopup="dialog"
                            className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-extrabold text-emerald-900 ring-1 ring-emerald-200 transition hover:bg-emerald-100 hover:ring-emerald-400"
                          >
                            {CLASS_DOT[city.months[m - 1].classification as Cls]} {dict.monthNames[m - 1]}
                          </button>
                        ))
                      ) : (
                        <span className="text-sm text-navy-600">{dict.noBestMonths}</span>
                      )}
                    </div>
                  );
                })()}

                <p className="mt-5 text-xs font-semibold text-navy-500">👆 {dict.tapMonth}</p>

                {/* All twelve months, January to December; each opens its details. */}
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {MONTHS.map((m) => {
                    const r = city.months[m - 1];
                    const now = m === currentMonth;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDialog({ slug: city.slug, month: m })}
                        aria-haspopup="dialog"
                        className={`group relative overflow-hidden rounded-2xl bg-white p-4 pt-5 text-start shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] ${
                          now ? "ring-2 ring-sun-400" : "ring-mist-200"
                        }`}
                      >
                        <span
                          className={`absolute inset-x-0 top-0 h-1.5 ${r.classification ? BAR_STYLE[r.classification] : "bg-mist-200"}`}
                          aria-hidden="true"
                        />
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-display text-base font-extrabold text-navy-900">{dict.monthNames[m - 1]}</span>
                          {now && (
                            <span className="rounded-full bg-sun-400 px-2 py-0.5 text-[10px] font-extrabold text-navy-990">{dict.nowLabel}</span>
                          )}
                        </span>
                        {r.classification && (
                          <span className="mt-1 block text-xs font-extrabold leading-snug text-navy-800">{badge(r.classification)}</span>
                        )}
                        <span className="mt-3 flex items-end justify-between gap-2">
                          {temps(r) && (
                            <span className="font-display text-lg font-black leading-none text-navy-900" dir="ltr">
                              {temps(r)}
                            </span>
                          )}
                          <span className="text-xl leading-none" aria-hidden="true">
                            {r.seasonIcon}
                          </span>
                        </span>
                        <span className="mt-1.5 block truncate text-xs font-semibold text-navy-500">{r.seasonName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {dialog &&
        (() => {
          const c = cities.find((x) => x.slug === dialog.slug);
          return c ? (
            <MonthDialog
              city={c}
              month={dialog.month}
              currentMonth={currentMonth}
              locale={locale}
              dict={dict}
              onMonth={(m) => setDialog({ slug: c.slug, month: m })}
              onClose={() => setDialog(null)}
            />
          ) : null;
        })()}
    </div>
  );
}

/**
 * One month in one city, in a window over the page: the rating, the season,
 * the typical low–high, the weather and why — with the months before and
 * after a tap away, so a traveller weighing dates never leaves the page.
 */
function MonthDialog({
  city,
  month,
  currentMonth,
  locale,
  dict,
  onMonth,
  onClose,
}: {
  city: SeasonCity;
  month: number;
  currentMonth: number;
  locale: Locale;
  dict: Dict;
  onMonth: (m: number) => void;
  onClose: () => void;
}) {
  const isAr = locale === "ar";
  const t = dict.ts;
  const r = city.months[month - 1];
  const prev = month === 1 ? 12 : month - 1;
  const next = month === 12 ? 1 : month + 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = before;
    };
  }, [onClose]);

  const temps =
    r.high === null
      ? null
      : r.low === null
        ? `${Math.round(r.high)}°`
        : t.highLow.replace("{low}", String(Math.round(r.low))).replace("{high}", String(Math.round(r.high)));
  const rain =
    r.rainDays === null
      ? null
      : Math.round(r.rainDays) === 0
        ? t.rainDaysNone
        : t.rainDays.replace("{days}", String(Math.round(r.rainDays)));
  const best = MONTHS.filter((m) => {
    const c = city.months[m - 1].classification;
    return c !== null && GOOD_CLASSES.includes(c);
  });
  const navBtn =
    "flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg font-bold text-white ring-1 ring-white/30 transition hover:bg-white/25";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-990/70 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${city.name} — ${dict.monthNames[month - 1]}`}
        onClick={(e) => e.stopPropagation()}
        className="tab-fade max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white text-start shadow-2xl sm:rounded-3xl"
      >
        <div className="relative isolate h-40">
          <Photo
            placeholder
            src={city.photo}
            className="absolute inset-0 -z-10 h-full w-full object-cover"
            fallback={<div className="absolute inset-0 -z-10 bg-gradient-to-br from-navy-700 to-navy-990" />}
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-990/90 via-navy-990/40 to-navy-990/10" />
          <button
            type="button"
            onClick={onClose}
            aria-label={dict.close}
            className="absolute end-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-navy-990/60 text-lg text-white ring-1 ring-white/30 transition hover:bg-navy-990"
          >
            ✕
          </button>
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="text-sm font-bold text-sun-300">{city.countryName}</p>
            <p className="font-display text-2xl font-black text-white drop-shadow">{city.name}</p>
          </div>
        </div>

        <div className="p-5">
          {/* The month, with the ones either side of it. */}
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-navy-900 px-3 py-2.5">
            <button type="button" onClick={() => onMonth(prev)} aria-label={dict.prevMonth} className={navBtn}>
              {isAr ? "›" : "‹"}
            </button>
            <p className="font-display text-lg font-extrabold text-white">
              {dict.monthNames[month - 1]}
              {month === currentMonth && (
                <span className="ms-2 rounded-full bg-sun-400 px-2 py-0.5 align-middle text-[10px] font-extrabold text-navy-990">
                  {dict.nowLabel}
                </span>
              )}
            </p>
            <button type="button" onClick={() => onMonth(next)} aria-label={dict.nextMonth} className={navBtn}>
              {isAr ? "‹" : "›"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {r.classification && (
              <span className={`rounded-full px-3 py-1 text-sm font-extrabold ${CLASS_STYLE[r.classification]}`}>
                {CLASS_DOT[r.classification]} {t.classes[r.classification]}
              </span>
            )}
            {r.phase && <span className="text-xs font-bold text-emerald-800">{t.phases[r.phase]}</span>}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-mist-50 p-3 ring-1 ring-mist-200">
              <p className="text-2xl leading-none" aria-hidden="true">
                {r.seasonIcon}
              </p>
              <p className="mt-1.5 text-sm font-extrabold text-navy-900">{r.seasonName}</p>
            </div>
            {temps && (
              <div className="rounded-2xl bg-mist-50 p-3 ring-1 ring-mist-200">
                <p className="text-2xl leading-none" aria-hidden="true">
                  🌡️
                </p>
                <p className="mt-1.5 font-display text-base font-black text-navy-900" dir="ltr">
                  {temps}
                </p>
              </div>
            )}
            {r.summary && (
              <div className="rounded-2xl bg-mist-50 p-3 ring-1 ring-mist-200">
                <p className="text-2xl leading-none" aria-hidden="true">
                  🌦️
                </p>
                <p className="mt-1.5 text-sm font-bold text-navy-800">{r.summary}</p>
              </div>
            )}
            {rain && (
              <div className="rounded-2xl bg-mist-50 p-3 ring-1 ring-mist-200">
                {/* The wording starts with its own icon (🌧 / ☀️): shown large, once. */}
                <p className="text-2xl leading-none" aria-hidden="true">
                  {rain.split(" ")[0]}
                </p>
                <p className="mt-1.5 text-sm font-bold text-navy-800">{rain.split(" ").slice(1).join(" ")}</p>
              </div>
            )}
          </div>

          {r.reason && (
            <p className="mt-4 rounded-2xl bg-sea-50 px-4 py-3 text-sm leading-relaxed text-navy-800 ring-1 ring-sea-100">
              <span className="font-extrabold">{t.reasonLabel}:</span> {r.reason}
            </p>
          )}

          {best.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-extrabold text-navy-500">⭐ {dict.bestMonths}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {best.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onMonth(m)}
                    aria-pressed={m === month}
                    className={`rounded-full px-3 py-1 text-xs font-extrabold ring-1 transition ${
                      m === month
                        ? "bg-emerald-600 text-white ring-emerald-600"
                        : "bg-emerald-50 text-emerald-900 ring-emerald-200 hover:ring-emerald-400"
                    }`}
                  >
                    {dict.monthNames[m - 1]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Two ways on: read about the city, or book it — the booking form
              opens with this city already filled in. */}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link
              href={`/${locale}/attractions/${city.code}/${city.slug}`}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-3 text-center text-sm font-extrabold text-navy-900 ring-2 ring-navy-900 transition hover:bg-navy-50"
            >
              🏛 {dict.viewCity}
            </Link>
            <Link
              href={`/${locale}?${new URLSearchParams({
                ...(city.airport ? { destination: city.airport } : {}),
                ...(city.nameEn ? { city: city.nameEn } : {}),
              }).toString()}#plan`}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-sun-400 px-4 py-3 text-center text-sm font-extrabold text-navy-950 shadow-[var(--shadow-sun)] transition hover:bg-sun-300"
            >
              ✈️ {dict.bookTrip}
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
