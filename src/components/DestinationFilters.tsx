"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { searchMatches } from "@/lib/search";
import type { Locale } from "@/lib/types";
import type { Continent } from "@/lib/countries";
import { MONTHS } from "@/lib/seasons";

export const CONTINENT_ORDER: Continent[] = [
  "asia",
  "africa",
  "europe",
  "northAmerica",
  "southAmerica",
  "oceania",
];

export interface CityOption {
  countryCode: string;
  slug: string;
  name: string;
  countryName: string;
}

export interface FiltersDict {
  searchPlaceholder: string;
  allContinents: string;
  byMonth: string;
  allMonths: string;
  byCity: string;
  cityPlaceholder: string;
  noMatches: string;
  clear: string;
  /** e.g. "{count} countries" — shown under the controls. */
  countriesCount: string;
  continents: Record<Continent, string>;
}

export interface FilterState {
  query: string;
  continent: Continent | "all";
  month: number | "all";
}

/**
 * Search, continent, month — the three questions someone actually arrives
 * with, plus a city jump.
 *
 * The city control is deliberately not a filter: narrowing a grid of
 * countries down to the one containing Antalya is a slower way of getting to
 * Antalya than going straight there, so picking a city navigates. The other
 * three narrow what's on screen.
 */
export default function DestinationFilters({
  locale,
  state,
  onChange,
  cities,
  cityHrefBase,
  dict,
  resultCount,
  resultLabel,
}: {
  locale: Locale;
  state: FilterState;
  onChange: (next: FilterState) => void;
  cities: CityOption[];
  /** A picked city goes to `${cityHrefBase}/${countryCode}/${slug}`. */
  cityHrefBase: string;
  dict: FiltersDict;
  resultCount: number;
  /** e.g. "{count} countries" */
  resultLabel: string;
}) {
  const router = useRouter();
  const [focused, setFocused] = useState(false);

  // One box for both: typing narrows the countries below, and the cities
  // that match are offered right under it — picking one goes straight there.
  const cityMatches = useMemo(() => {
    const q = state.query.trim();
    if (!q) return [];
    return cities.filter((c) => searchMatches([c.name, c.countryName, c.slug], q)).slice(0, 6);
  }, [cities, state.query]);

  const isFiltered =
    state.query.trim() !== "" || state.continent !== "all" || state.month !== "all";

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
      active
        ? "bg-navy-900 text-white shadow-sm"
        : "bg-white text-navy-700 ring-1 ring-mist-200 hover:ring-navy-300"
    }`;

  return (
    <div className="rounded-3xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 sm:p-5">
      {/* Search: countries and cities. */}
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-lg">
          🔎
        </span>
        <input
          type="search"
          value={state.query}
          onChange={(e) => onChange({ ...state, query: e.target.value })}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          placeholder={dict.searchPlaceholder}
          aria-label={dict.searchPlaceholder}
          className="w-full rounded-full border-2 border-mist-200 bg-mist-50 py-3.5 pe-5 ps-12 text-base font-semibold text-navy-900 outline-none transition placeholder:font-normal placeholder:text-navy-400 focus:border-sun-400 focus:bg-white focus:ring-4 focus:ring-sun-400/20"
        />
        {focused && cityMatches.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl bg-white py-1 shadow-[var(--shadow-lift)] ring-1 ring-mist-200">
            <li className="px-4 pb-1 pt-2 text-xs font-bold text-navy-400">{dict.byCity}</li>
            {cityMatches.map((c) => (
              <li key={`${c.countryCode}/${c.slug}`}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => router.push(`${cityHrefBase}/${c.countryCode}/${c.slug}`)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-start text-sm hover:bg-mist-50"
                >
                  <span aria-hidden="true">🏙️</span>
                  <span className="font-bold text-navy-900">{c.name}</span>
                  <span className="text-navy-500">· {c.countryName}</span>
                  <span className="ms-auto text-navy-300" aria-hidden="true">
                    {locale === "ar" ? "←" : "→"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Continents: one row, scrolls sideways on a phone. */}
      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <button
          type="button"
          onClick={() => onChange({ ...state, continent: "all" })}
          className={chipClass(state.continent === "all")}
        >
          🌍 {dict.allContinents}
        </button>
        {CONTINENT_ORDER.map((continent) => (
          <button
            key={continent}
            type="button"
            onClick={() => onChange({ ...state, continent })}
            className={chipClass(state.continent === continent)}
          >
            {dict.continents[continent]}
          </button>
        ))}
      </div>

      {/* The month, the count, and the way back to everything. */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-mist-200 pt-4">
        <label className="relative inline-flex items-center">
          <span className="sr-only">{dict.byMonth}</span>
          <span aria-hidden="true" className="pointer-events-none absolute start-3.5 text-base">
            🗓
          </span>
          <select
            value={state.month}
            onChange={(e) =>
              onChange({ ...state, month: e.target.value === "all" ? "all" : Number(e.target.value) })
            }
            className={`appearance-none rounded-full py-2 pe-9 ps-10 text-sm font-bold outline-none ring-1 transition focus:ring-4 focus:ring-sun-400/20 ${
              state.month === "all" ? "bg-white text-navy-800 ring-mist-200 hover:ring-navy-300" : "bg-navy-900 text-white ring-navy-900"
            }`}
          >
            <option value="all">{dict.allMonths}</option>
            {MONTHS.map((m) => (
              <option key={m.number} value={m.number}>
                {locale === "ar" ? m.nameAr : m.nameEn}
              </option>
            ))}
          </select>
          <svg
            viewBox="0 0 24 24"
            className={`pointer-events-none absolute end-3 h-4 w-4 ${state.month === "all" ? "text-navy-400" : "text-white/80"}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </label>

        <p className="ms-auto rounded-full bg-sun-50 px-3 py-1.5 text-xs font-extrabold text-sun-800 ring-1 ring-sun-200">
          {resultLabel.replace("{count}", String(resultCount))}
        </p>
        {isFiltered && (
          <button
            type="button"
            onClick={() => onChange({ query: "", continent: "all", month: "all" })}
            className="text-xs font-bold text-sea-700 hover:underline"
          >
            ✕ {dict.clear}
          </button>
        )}
      </div>
    </div>
  );
}
