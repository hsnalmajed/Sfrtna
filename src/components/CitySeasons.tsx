"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/types";
import type { Continent } from "@/lib/countries";
import { CONTINENT_ORDER } from "@/components/DestinationFilters";
import { searchMatches } from "@/lib/search";
import { CLASS_DOT } from "@/lib/travelSeason/labels";
import Photo from "@/components/Photo";

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
  tourismListed: boolean;
}

export interface SeasonCity {
  code: string;
  slug: string;
  name: string;
  countryName: string;
  keywords: string;
  continent: Continent;
  photo?: string;
  /** January first. */
  months: SeasonMonth[];
  tourism: { name: string; url: string; official: boolean; broad: boolean } | null;
  climate: { station: string | null; distanceKm: number; period: string };
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
  sourceBroad: string;
  officialBadge: string;
  viewCity: string;
  openSource: string;
  kinds: Record<string, string>;
  allContinents: string;
  continents: Record<Continent, string>;
  ts: {
    classes: Record<Cls, string>;
    phases: Record<"start" | "peak" | "end", string>;
    patterns: Record<"rainy_season" | "dry_season" | "snow_season", string>;
    highLow: string;
    rainDays: string;
    rainDaysNone: string;
    reasonLabel: string;
    climateNote: string;
    sourceAndMethod: string;
    climateSourceLabel: string;
    climateSourceValue: string;
    climateSourceStation: string;
    climatePeriodLabel: string;
    methodologyLabel: string;
    methodologyLink: string;
    lastUpdatedLabel: string;
    tourismLabel: string;
    tourismNone: string;
  };
}

const CLASS_STYLE: Record<Cls, string> = {
  EXCELLENT: "bg-emerald-600 text-white",
  VERY_GOOD: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300",
  GOOD: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
  ACCEPTABLE: "bg-orange-100 text-orange-900 ring-1 ring-orange-300",
  NOT_RECOMMENDED: "bg-rose-100 text-rose-900 ring-1 ring-rose-300",
};
const TILE_STYLE: Record<Cls, string> = {
  EXCELLENT: "bg-emerald-50 ring-emerald-400",
  VERY_GOOD: "bg-emerald-50/60 ring-emerald-200",
  GOOD: "bg-amber-50/60 ring-amber-200",
  ACCEPTABLE: "bg-orange-50/60 ring-orange-200",
  NOT_RECOMMENDED: "bg-rose-50/60 ring-rose-200",
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const GOOD_CLASSES: Cls[] = ["EXCELLENT", "VERY_GOOD"];

export default function CitySeasons({
  locale,
  cities,
  currentMonth,
  updated,
  dict,
}: {
  locale: Locale;
  cities: SeasonCity[];
  currentMonth: number;
  updated: string;
  dict: Dict;
}) {
  const [mode, setMode] = useState<"month" | "city">("month");
  const [month, setMonth] = useState(currentMonth);
  const [continent, setContinent] = useState<Continent | "all">("all");
  const [withGood, setWithGood] = useState(false);
  const [query, setQuery] = useState("");
  const [citySlug, setCitySlug] = useState("");
  const [cityMonth, setCityMonth] = useState(currentMonth);
  const top = useRef<HTMLDivElement>(null);
  const isAr = locale === "ar";
  const t = dict.ts;

  const temps = (m: SeasonMonth) =>
    m.high === null
      ? null
      : m.low === null
        ? `${Math.round(m.high)}°`
        : t.highLow.replace("{low}", String(Math.round(m.low))).replace("{high}", String(Math.round(m.high)));
  const rain = (m: SeasonMonth) =>
    m.rainDays === null ? null : Math.round(m.rainDays) === 0 ? t.rainDaysNone : t.rainDays.replace("{days}", String(Math.round(m.rainDays)));
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

  const cityMatches = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return cities.filter((c) => searchMatches([c.keywords, c.slug], q)).slice(0, 8);
  }, [cities, query]);

  const city = cities.find((c) => c.slug === citySlug);

  const openCity = (slug: string, m?: number) => {
    setCitySlug(slug);
    setCityMonth(m ?? currentMonth);
    setQuery("");
    setMode("city");
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const pill = (active: boolean) =>
    `rounded-full px-3 py-2 text-sm font-bold transition ${
      active ? "bg-navy-900 text-white shadow-sm" : "bg-white text-navy-700 ring-1 ring-mist-200 hover:ring-navy-200"
    }`;

  const modes = [
    { m: "month" as const, icon: "🗓", title: dict.modeMonthTitle, q: dict.modeMonthQ, hint: dict.modeMonthHint },
    { m: "city" as const, icon: "🏙", title: dict.modeCityTitle, q: dict.modeCityQ, hint: dict.modeCityHint },
  ];

  const sourceAndMethod = (c: SeasonCity) => (
    <details className="group mt-4 rounded-xl bg-mist-50 px-4 py-3 text-sm text-navy-700 ring-1 ring-mist-200">
      <summary className="cursor-pointer list-none font-bold text-navy-900">
        <span aria-hidden="true">ⓘ</span> {t.sourceAndMethod}
      </summary>
      <dl className="mt-2 space-y-1.5 text-xs leading-relaxed">
        <div>
          <dt className="inline font-bold">{t.climateSourceLabel}: </dt>
          <dd className="inline">
            {c.climate.station
              ? t.climateSourceStation.replace("{station}", c.climate.station).replace("{km}", String(c.climate.distanceKm))
              : t.climateSourceValue.replace("{km}", String(c.climate.distanceKm))}
          </dd>
        </div>
        <div>
          <dt className="inline font-bold">{t.climatePeriodLabel}: </dt>
          <dd className="inline">{c.climate.period}</dd>
        </div>
        <div>
          <dt className="inline font-bold">{t.tourismLabel}: </dt>
          <dd className="inline">
            {c.tourism ? (
              <a href={c.tourism.url} target="_blank" rel="noopener noreferrer" className="font-bold text-sea-700 underline">
                {c.tourism.name} <span aria-hidden="true">↗</span>
              </a>
            ) : (
              t.tourismNone
            )}
          </dd>
        </div>
        <div>
          <dt className="inline font-bold">{t.methodologyLabel}: </dt>
          <dd className="inline">
            <Link href={`/${locale}/methodology/travel-seasons`} className="font-bold text-sea-700 underline">
              {t.methodologyLink}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="inline font-bold">{t.lastUpdatedLabel}: </dt>
          <dd className="inline">{updated}</dd>
        </div>
        <p className="pt-1 text-navy-500">{t.climateNote}</p>
      </dl>
    </details>
  );

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
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
            {MONTHS.map((m) => (
              <button key={m} type="button" aria-pressed={m === month} onClick={() => setMonth(m)} className={`relative px-1 text-center ${pill(m === month)}`}>
                {dict.monthNames[m - 1]}
                {m === currentMonth && (
                  <span
                    className={`absolute -top-2 start-1/2 -translate-x-1/2 rounded-full px-1.5 text-[10px] font-extrabold leading-4 rtl:translate-x-1/2 ${
                      m === month ? "bg-sun-400 text-navy-990" : "bg-sun-100 text-sun-900 ring-1 ring-sun-300"
                    }`}
                  >
                    {dict.nowLabel}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(["all", ...CONTINENT_ORDER] as (Continent | "all")[]).map((c) => (
              <button key={c} type="button" aria-pressed={continent === c} onClick={() => setContinent(c)} className={`text-xs ${pill(continent === c)}`}>
                {c === "all" ? dict.allContinents : dict.continents[c]}
              </button>
            ))}
            <label className="ms-auto inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-navy-700">
              <input type="checkbox" checked={withGood} onChange={(e) => setWithGood(e.target.checked)} className="h-4 w-4 accent-navy-900" />
              {dict.showGood}
            </label>
          </div>

          <h2 className="mb-1 mt-6 font-display text-xl font-extrabold text-navy-900">
            {dict.inSeasonInMonth.replace("{month}", dict.monthNames[month - 1]).replace("{count}", String(inMonth.length))}
          </h2>
          <p className="mb-4 text-xs text-navy-500">
            {t.climateNote}{" "}
            <Link href={`/${locale}/methodology/travel-seasons`} className="font-bold text-sea-700 hover:underline">
              {t.methodologyLink}
            </Link>
          </p>

          {inMonth.length === 0 ? (
            <p className="rounded-xl bg-mist-50 px-4 py-10 text-center text-sm text-navy-500">{dict.noneInMonth}</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
              {inMonth.map((c) => {
                const r = c.months[month - 1];
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => openCity(c.slug, month)}
                    className="group flex overflow-hidden rounded-2xl bg-white text-start shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
                  >
                    <div className="relative w-24 shrink-0 sm:w-28">
                      <Photo
                        src={c.photo}
                        className="absolute inset-0 h-full w-full object-cover"
                        fallback={<div className="absolute inset-0 bg-gradient-to-br from-navy-700 to-navy-990" />}
                      />
                    </div>
                    <div className="min-w-0 flex-1 p-3">
                      <p className="truncate font-display font-extrabold text-navy-900">
                        {c.name} <span className="text-xs font-semibold text-navy-500">· {c.countryName}</span>
                      </p>
                      {r.classification && (
                        <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-extrabold ${CLASS_STYLE[r.classification]}`}>
                          {badge(r.classification)}
                        </span>
                      )}
                      <p className="mt-1.5 text-xs font-semibold text-navy-700">{seasonText(r)}</p>
                      <p className="mt-0.5 text-xs text-navy-700">
                        {temps(r) && <span dir="ltr">🌡️ {temps(r)}</span>}
                        {r.summary && <span> · {r.summary}</span>}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {mode === "city" && (
        <div className="mt-6">
          <div className="relative max-w-md">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dict.citySearch}
              aria-label={dict.citySearch}
              className="w-full rounded-xl border border-mist-200 bg-white px-4 py-3 text-sm text-navy-900 outline-none focus:border-sea-400 focus:ring-4 focus:ring-sea-100"
            />
            {query.trim() && (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl bg-white shadow-[var(--shadow-lift)] ring-1 ring-mist-200">
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
            <p className="mt-6 rounded-xl bg-mist-50 px-4 py-10 text-center text-sm text-navy-500">{dict.pickCity}</p>
          ) : (
            <section className="mt-6 rounded-2xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="font-display text-xl font-extrabold text-navy-900">
                  {dict.cityYearTitle.replace("{city}", city.name)}
                  <span className="ms-2 text-sm font-semibold text-navy-500">{city.countryName}</span>
                </h2>
                <Link href={`/${locale}/attractions/${city.code}/${city.slug}`} className="inline-flex items-center gap-1 text-sm font-bold text-sea-600 hover:underline">
                  {dict.viewCity} <span aria-hidden="true">{isAr ? "←" : "→"}</span>
                </Link>
              </div>

              {/* Best months, and who else names them. */}
              {(() => {
                const best = MONTHS.filter((m) => {
                  const c = city.months[m - 1].classification;
                  return c !== null && GOOD_CLASSES.includes(c);
                });
                return (
                  <div className="mt-4 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                    <p className="text-xs font-extrabold text-emerald-800">{dict.bestMonths}</p>
                    {best.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {best.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setCityMonth(m)}
                            className="rounded-full bg-white px-3 py-1 text-sm font-extrabold text-emerald-900 ring-1 ring-emerald-300 hover:ring-emerald-500"
                          >
                            {CLASS_DOT[city.months[m - 1].classification as Cls]} {dict.monthNames[m - 1]}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-navy-700">{dict.noBestMonths}</p>
                    )}
                    <p className="mt-3 text-sm text-navy-700">
                      <span className="font-bold">{t.tourismLabel}:</span>{" "}
                      {city.tourism ? (
                        <>
                          <a
                            href={city.tourism.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={dict.openSource}
                            className="font-bold text-sea-700 underline decoration-sea-300 underline-offset-2 hover:decoration-sea-600"
                          >
                            {city.tourism.name} <span aria-hidden="true">↗</span>
                          </a>
                          {city.tourism.official && (
                            <span className="ms-2 rounded-full bg-navy-900 px-2 py-0.5 align-middle text-[11px] font-bold text-white">
                              {dict.officialBadge}
                            </span>
                          )}
                        </>
                      ) : (
                        t.tourismNone
                      )}
                    </p>
                    {city.tourism?.broad && <p className="mt-1 text-xs text-navy-500">{dict.sourceBroad}</p>}
                  </div>
                );
              })()}

              {/* The chosen month in full. */}
              {(() => {
                const r = city.months[cityMonth - 1];
                return (
                  <div className="mt-4 rounded-xl p-4 ring-1 ring-mist-200">
                    <p className="font-display text-lg font-extrabold text-navy-900">
                      {city.name} — {dict.monthNames[cityMonth - 1]}
                    </p>
                    {r.classification && (
                      <span className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-extrabold ${CLASS_STYLE[r.classification]}`}>
                        {badge(r.classification)}
                      </span>
                    )}
                    {r.phase && <span className="ms-2 text-xs font-bold text-emerald-800">{t.phases[r.phase]}</span>}
                    <ul className="mt-2 space-y-1 text-sm text-navy-800">
                      <li>{seasonText(r)}</li>
                      {temps(r) && (
                        <li>
                          🌡️ <span dir="ltr">{temps(r)}</span>
                        </li>
                      )}
                      {r.summary && <li>🌦️ {r.summary}</li>}
                      {rain(r) && <li>{rain(r)}</li>}
                    </ul>
                    {r.reason && (
                      <p className="mt-2 text-sm text-navy-700">
                        <span className="font-bold">{t.reasonLabel}:</span> {r.reason}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* All twelve months, January to December. */}
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {MONTHS.map((m) => {
                  const r = city.months[m - 1];
                  const selected = m === cityMonth;
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setCityMonth(m)}
                      className={`rounded-xl p-3 text-start ring-1 transition ${r.classification ? TILE_STYLE[r.classification] : "bg-mist-50 ring-mist-200"} ${
                        selected ? "ring-2 ring-navy-900" : ""
                      }`}
                    >
                      <p className="text-sm font-extrabold text-navy-900">
                        {dict.monthNames[m - 1]}
                        {m === currentMonth && <span className="ms-1 text-[10px] font-bold text-sun-700">• {dict.nowLabel}</span>}
                      </p>
                      {r.classification && <p className="mt-1 text-[11px] font-extrabold leading-snug text-navy-900">{badge(r.classification)}</p>}
                      <p className="mt-1 text-xs text-navy-700">{seasonText(r)}</p>
                      {temps(r) && (
                        <p className="mt-1 text-sm font-bold text-navy-800" dir="ltr">
                          {temps(r)}
                        </p>
                      )}
                      {r.summary && <p className="text-[11px] leading-snug text-navy-600">{r.summary}</p>}
                    </button>
                  );
                })}
              </div>

              {sourceAndMethod(city)}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
