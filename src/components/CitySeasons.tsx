"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/types";
import type { Continent } from "@/lib/countries";
import { CONTINENT_ORDER } from "@/components/DestinationFilters";
import { searchMatches } from "@/lib/search";
import { countLabel } from "@/lib/format";
import Photo from "@/components/Photo";
import Icon from "@/components/ui/Icon";

/**
 * "When should I travel?", city by city.
 *
 * Two questions, two layouts, both always one tap away:
 *   by month  "Where is good in March?"    → only the cities in season then
 *   by city   "When should I go to Kyoto?" → one city's best months, who says
 *                                             so, and all twelve months
 *
 * The page opens on this month's cities rather than on a question: the tabs
 * at the top name both questions, so nobody has to answer one before seeing
 * anything, and the common case — "where now?" — costs no click.
 *
 * Best months come from a tourism board or a named guide (see
 * src/data/citySeasonSources.ts); what kind of month it is comes from the
 * weather (src/lib/citySeasons.ts).
 */

type SeasonKindName = "winter" | "spring" | "summer" | "autumn" | "wet" | "dry";

export interface SeasonCity {
  code: string;
  slug: string;
  name: string;
  countryName: string;
  /** Both languages' names of the city and country, for search. */
  keywords: string;
  continent: Continent;
  photo?: string;
  /** Mean daily high, °C, Jan–Dec. */
  high: number[];
  /** Mean rainy days (≥ 1 mm), Jan–Dec. */
  rainyDays: number[];
  /** Season kind per month, Jan–Dec. */
  kind: SeasonKindName[];
  /** In season per month, Jan–Dec. */
  inSeason: boolean[];
  /** Who names the best months; absent when no source was found. */
  season?: {
    source: string;
    official: boolean;
    url: string;
    broad: boolean;
    dropped: { month: number; high: number }[];
  };
  /** The weather figures are WMO normals, not NASA POWER. */
  weatherFromWmo: boolean;
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
  citySearch: string;
  cityNoMatch: string;
  pickCity: string;
  cityYearTitle: string;
  bestMonths: string;
  sourceLabel: string;
  sourceBroad: string;
  dropped: string;
  noSource: string;
  inSeasonLabel: string;
  high: string;
  rainOne: string;
  rainTwo: string;
  rainFew: string;
  rainMany: string;
  rainNone: string;
  kinds: Record<SeasonKindName, string>;
  methodTitle: string;
  methodSource: string;
  methodWeather: string;
  methodNone: string;
  methodKind: string;
  weatherSource: string;
  weatherSourceWmo: string;
  allContinents: string;
  continents: Record<Continent, string>;
  viewCity: string;
  openSource: string;
  officialBadge: string;
}

const KIND_STYLE: Record<SeasonKindName, string> = {
  winter: "bg-sky-100 text-sky-900",
  spring: "bg-emerald-100 text-emerald-900",
  summer: "bg-amber-100 text-amber-900",
  autumn: "bg-orange-100 text-orange-900",
  wet: "bg-sea-100 text-sea-900",
  dry: "bg-sun-100 text-sun-900",
};
const KIND_ICON: Record<SeasonKindName, string> = {
  winter: "❄️",
  spring: "🌸",
  summer: "☀️",
  autumn: "🍂",
  wet: "🌧",
  dry: "🌤",
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function CitySeasons({
  locale,
  cities,
  currentMonth,
  unsourcedCount,
  dict,
}: {
  locale: Locale;
  cities: SeasonCity[];
  currentMonth: number;
  unsourcedCount: number;
  dict: Dict;
}) {
  const [mode, setMode] = useState<"month" | "city">("month");
  const [month, setMonth] = useState(currentMonth);
  const [continent, setContinent] = useState<Continent | "all">("all");
  const [query, setQuery] = useState("");
  const [citySlug, setCitySlug] = useState("");
  const top = useRef<HTMLDivElement>(null);
  const isAr = locale === "ar";
  const listSep = isAr ? "، " : ", ";

  const rain = (days: number) => {
    const n = Math.round(days);
    if (n === 0) return dict.rainNone;
    return countLabel(n, { one: dict.rainOne, two: dict.rainTwo, few: dict.rainFew, many: dict.rainMany });
  };

  const inMonth = useMemo(() => {
    const score = (c: SeasonCity) => Math.abs(c.high[month - 1] - 25) + c.rainyDays[month - 1] * 0.5;
    return cities
      .filter((c) => c.inSeason[month - 1] && (continent === "all" || c.continent === continent))
      .sort((a, b) => score(a) - score(b));
  }, [cities, month, continent]);

  const cityMatches = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return cities.filter((c) => searchMatches([c.keywords, c.slug], q)).slice(0, 8);
  }, [cities, query]);

  const city = cities.find((c) => c.slug === citySlug);

  const openCity = (slug: string) => {
    setCitySlug(slug);
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

  return (
    <div ref={top} className="scroll-mt-24">
      {/* The two questions, as tabs. Each says which question it answers. */}
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
          {/* January to December, all visible, this month marked. */}
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
            {MONTHS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={m === month}
                onClick={() => setMonth(m)}
                className={`relative px-1 text-center ${pill(m === month)}`}
              >
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
          <div className="mt-3 flex flex-wrap gap-2">
            {(["all", ...CONTINENT_ORDER] as (Continent | "all")[]).map((c) => (
              <button key={c} type="button" aria-pressed={continent === c} onClick={() => setContinent(c)} className={`text-xs ${pill(continent === c)}`}>
                {c === "all" ? dict.allContinents : dict.continents[c]}
              </button>
            ))}
          </div>

          <h2 className="mb-4 mt-6 font-display text-xl font-extrabold text-navy-900">
            {dict.inSeasonInMonth.replace("{month}", dict.monthNames[month - 1]).replace("{count}", String(inMonth.length))}
          </h2>

          {inMonth.length === 0 ? (
            <p className="rounded-xl bg-mist-50 px-4 py-10 text-center text-sm text-navy-500">{dict.noneInMonth}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {inMonth.map((c) => {
                const kind = c.kind[month - 1];
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => openCity(c.slug)}
                    className="group relative isolate block aspect-[4/5] overflow-hidden rounded-2xl text-start sm:aspect-[4/3] ring-1 ring-navy-950/5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
                  >
                    <Photo
                      src={c.photo}
                      className="absolute inset-0 -z-10 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      fallback={<div className="absolute inset-0 -z-10 bg-gradient-to-br from-navy-700 to-navy-990" />}
                    />
                    <div className="scrim-soft absolute inset-0 -z-10" />
                    <span className={`absolute start-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${KIND_STYLE[kind]}`}>
                      <span aria-hidden="true">{KIND_ICON[kind]}</span>
                      {dict.kinds[kind]}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="truncate font-display font-extrabold text-white">{c.name}</p>
                      <p className="truncate text-xs text-white/70">{c.countryName}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <span className="rounded-full bg-navy-990/65 px-2 py-0.5 text-xs font-bold text-sun-300">
                          {dict.high.replace("{high}", String(Math.round(c.high[month - 1])))}
                        </span>
                        <span className="rounded-full bg-navy-990/65 px-2 py-0.5 text-xs font-bold text-sea-200">
                          {rain(c.rainyDays[month - 1])}
                        </span>
                      </div>
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
                <Link
                  href={`/${locale}/attractions/${city.code}/${city.slug}`}
                  className="inline-flex items-center gap-1 text-sm font-bold text-sea-600 hover:underline"
                >
                  {dict.viewCity} <span aria-hidden="true">{isAr ? "←" : "→"}</span>
                </Link>
              </div>

              {city.season && city.inSeason.some(Boolean) ? (
                <div className="mt-4 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-800">{dict.bestMonths}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {MONTHS.filter((m) => city.inSeason[m - 1]).map((m) => (
                      <span key={m} className="rounded-full bg-white px-3 py-1 text-sm font-extrabold text-emerald-900 ring-1 ring-emerald-300">
                        {dict.monthNames[m - 1]}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-navy-700">
                    <span className="font-bold">{dict.sourceLabel}:</span>{" "}
                    <a
                      href={city.season.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={dict.openSource}
                      className="font-bold text-sea-700 underline decoration-sea-300 underline-offset-2 hover:decoration-sea-600"
                    >
                      {city.season.source} <span aria-hidden="true">↗</span>
                    </a>
                    {city.season.official && (
                      <span className="ms-2 inline-flex items-center gap-0.5 rounded-full bg-navy-900 px-2 py-0.5 align-middle text-[11px] font-bold text-white">
                        <Icon name="shield" className="h-3 w-3" />
                        {dict.officialBadge}
                      </span>
                    )}
                  </p>
                  {city.season.broad && <p className="mt-1 text-xs text-navy-500">{dict.sourceBroad}</p>}
                  {city.season.dropped.length > 0 && (
                    <p className="mt-2 text-xs leading-relaxed text-amber-900">
                      {dict.dropped.replace(
                        "{list}",
                        city.season.dropped.map((x) => `${dict.monthNames[x.month - 1]} (${Math.round(x.high)}°)`).join(listSep)
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-4 rounded-xl bg-sun-50 px-4 py-3 text-sm leading-relaxed text-sun-900 ring-1 ring-sun-200">{dict.noSource}</p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {MONTHS.map((m) => {
                  const kind = city.kind[m - 1];
                  const good = city.inSeason[m - 1];
                  return (
                    <div key={m} className={`rounded-xl p-3 ring-1 ${good ? "bg-emerald-50 ring-emerald-300" : "bg-mist-50 ring-mist-200"}`}>
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-sm font-extrabold text-navy-900">
                          {dict.monthNames[m - 1]}
                          {m === currentMonth && <span className="ms-1 text-[10px] font-bold text-sun-700">• {dict.nowLabel}</span>}
                        </p>
                        {good && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-800">
                            <Icon name="check" className="h-3.5 w-3.5" />
                            {dict.inSeasonLabel}
                          </span>
                        )}
                      </div>
                      <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${KIND_STYLE[kind]}`}>
                        <span aria-hidden="true">{KIND_ICON[kind]}</span>
                        {dict.kinds[kind]}
                      </span>
                      <p className="mt-1.5 text-sm font-bold text-navy-800">{dict.high.replace("{high}", String(Math.round(city.high[m - 1])))}</p>
                      <p className="text-xs text-navy-600">{rain(city.rainyDays[m - 1])}</p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-navy-500">{city.weatherFromWmo ? dict.weatherSourceWmo : dict.weatherSource}</p>
            </section>
          )}
        </div>
      )}

      <details className="group mt-8 rounded-xl bg-mist-100 px-4 py-3 text-sm text-navy-700 ring-1 ring-mist-200">
        <summary className="cursor-pointer list-none font-bold text-navy-900">
          <span className="inline-block transition group-open:rotate-90 rtl:group-open:-rotate-90" aria-hidden="true">
            {isAr ? "◂" : "▸"}
          </span>{" "}
          {dict.methodTitle}
        </summary>
        <ul className="mt-2 list-disc space-y-1.5 ps-5 text-xs leading-relaxed">
          <li>{dict.methodSource}</li>
          <li>{dict.methodWeather}</li>
          <li>{dict.methodNone.replace("{count}", String(unsourcedCount))}</li>
          <li>{dict.methodKind}</li>
          <li>{dict.weatherSource}</li>
        </ul>
      </details>
    </div>
  );
}
