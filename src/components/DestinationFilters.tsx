"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { searchMatches } from "@/lib/search";
import type { Locale } from "@/lib/types";
import type { Continent } from "@/lib/countries";
import { MONTHS } from "@/lib/seasons";
import { getDictionary } from "@/lib/dictionaries";
import FilterPill from "@/components/ui/FilterPill";

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

  const t = getDictionary(locale).filters;

  return (
    <div className="rounded-3xl bg-white p-3.5 shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 sm:p-5">
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
          className="w-full rounded-full border-2 border-mist-200 bg-mist-50 py-3 pe-5 ps-12 text-base font-semibold text-navy-900 outline-none transition placeholder:font-normal placeholder:text-navy-400 focus:border-sun-400 focus:bg-white focus:ring-4 focus:ring-sun-400/20"
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

      {/* The filters, as the same pills every list page uses: each says
          what it filters and what is chosen, and opens all its options. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FilterPill<Continent>
          locale={locale}
          icon="🌍"
          label={t.continent}
          allLabel={dict.allContinents}
          value={state.continent}
          onChange={(continent) => onChange({ ...state, continent })}
          options={CONTINENT_ORDER.map((c) => ({ value: c, label: dict.continents[c] }))}
        />
        <FilterPill<number>
          locale={locale}
          icon="🗓"
          label={t.month}
          allLabel={dict.allMonths}
          value={state.month}
          onChange={(month) => onChange({ ...state, month })}
          options={MONTHS.map((m) => ({
            value: m.number,
            label: locale === "ar" ? m.nameAr : m.nameEn,
            note: m.number === new Date().getMonth() + 1 ? t.now : undefined,
          }))}
        />
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
