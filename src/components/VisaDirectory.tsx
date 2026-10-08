"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/types";
import type { Continent } from "@/lib/countries";
import { flagImageUrl } from "@/lib/visaProviders";
import { CONTINENT_ORDER } from "@/components/DestinationFilters";
import { searchMatches, searchEquals } from "@/lib/search";
import Photo from "@/components/Photo";
import VisaBadge from "@/components/VisaBadge";
import { VISA_ORDER, type VisaCategory } from "@/data/visaStatus";
import FilterPill from "@/components/ui/FilterPill";
import { getDictionary } from "@/lib/dictionaries";

export interface VisaCountry {
  code: string;
  nameAr: string;
  nameEn: string;
  continent: Continent;
  /** A photograph of the place, when Pexels has a fitting one. */
  photo?: string;
  /** Entry status for a Saudi passport, from the country's official source. */
  category: VisaCategory;
  /** We hold a verified link to the country's own government visa portal. */
  official: boolean;
  /** Direct (visa.directksa.com) has a page for this country. */
  direct: boolean;
}

interface DirectoryDict {
  searchPlaceholder: string;
  countriesCount: string;
  noResults: string;
  continents: Record<Continent, string>;
  badgeOfficial: string;
  badgeDirect: string;
  statusFilterLabel: string;
  allStatuses: string;
  labels: Record<VisaCategory, string>;
}

/**
 * Pick a destination by what it takes to get in.
 *
 * The status on each card is the point of the grid: "Georgia" tells a
 * traveller nothing, "Georgia — no visa" turns browsing into deciding. The
 * filter above turns it round entirely: instead of checking countries one at
 * a time to find one you can simply fly to, you ask for all of them at once.
 *
 * Every status here was read from the country's official source (see
 * src/data/visaStatus.ts); a country we could not confirm is not listed. The
 * apply routes sit under the name, smaller: the official portal in navy with
 * a building, Direct in orange with a document.
 */
export default function VisaDirectory({
  locale,
  countries,
  dict,
}: {
  locale: Locale;
  countries: VisaCountry[];
  dict: DirectoryDict;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<VisaCategory | "all">("all");
  const [continent, setContinent] = useState<Continent | "all">("all");
  const ft = getDictionary(locale).filters;

  const counts = useMemo(() => {
    const c = { free: 0, arrival: 0, eta: 0, required: 0 } as Record<VisaCategory, number>;
    for (const country of countries) c[country.category]++;
    return c;
  }, [countries]);

  const filtered = useMemo(() => {
    const q = query.trim();
    return countries.filter(
      (c) =>
        (category === "all" || c.category === category) &&
        (continent === "all" || c.continent === continent) &&
        (!q || searchMatches([c.nameAr, c.nameEn], q) || searchEquals(c.code, q))
    );
  }, [countries, query, category, continent]);

  const grouped = useMemo(() => {
    const map = new Map<Continent, VisaCountry[]>();
    for (const continent of CONTINENT_ORDER) map.set(continent, []);
    for (const country of filtered) map.get(country.continent)?.push(country);
    // Easiest to enter first within each continent.
    for (const list of map.values()) {
      list.sort((a, b) => VISA_ORDER.indexOf(a.category) - VISA_ORDER.indexOf(b.category));
    }
    return map;
  }, [filtered]);

  return (
    <div>
      {/* The same filter block as the destinations page: a search, then
          the pills (ui/FilterPill), then how many match. */}
      <div className="rounded-3xl bg-white p-3.5 shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 sm:p-5">
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-lg">
            🔎
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={dict.searchPlaceholder}
            aria-label={dict.searchPlaceholder}
            className="w-full rounded-full border-2 border-mist-200 bg-mist-50 py-3 pe-5 ps-12 text-base font-semibold text-navy-900 outline-none transition placeholder:font-normal placeholder:text-navy-400 focus:border-sun-400 focus:bg-white focus:ring-4 focus:ring-sun-400/20"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FilterPill<VisaCategory>
            locale={locale}
            icon="🛂"
            label={ft.entry}
            allLabel={ft.allVisas}
            value={category}
            onChange={setCategory}
            options={VISA_ORDER.filter((c) => counts[c] > 0).map((c) => ({ value: c, label: dict.labels[c], count: counts[c] }))}
          />
          <FilterPill<Continent>
            locale={locale}
            icon="🌍"
            label={ft.continent}
            allLabel={ft.allContinents}
            value={continent}
            onChange={setContinent}
            options={CONTINENT_ORDER.map((c) => ({ value: c, label: dict.continents[c] }))}
          />
          <p className="ms-auto rounded-full bg-sun-50 px-3 py-1.5 text-xs font-extrabold text-sun-800 ring-1 ring-sun-200">
            {dict.countriesCount.replace("{count}", String(filtered.length))}
          </p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 rounded-xl bg-mist-50 px-4 py-10 text-center text-sm text-navy-500">{dict.noResults}</p>
      ) : (
        <div className="mt-6 space-y-10">
          {CONTINENT_ORDER.map((continent) => {
            const inContinent = grouped.get(continent) ?? [];
            if (inContinent.length === 0) return null;

            return (
              <section key={continent}>
                <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-extrabold text-navy-900">
                  <span className="h-4 w-1 rounded-full bg-sun-400" aria-hidden="true" />
                  {dict.continents[continent]}
                  <span className="text-sm font-normal text-navy-400">({inContinent.length})</span>
                </h2>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
                  {inContinent.map((c) => {
                    const name = locale === "ar" ? c.nameAr : c.nameEn;
                    return (
                      <Link
                        key={c.code}
                        href={`/${locale}/visa/${c.code}`}
                        className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] hover:ring-sea-400/40"
                      >
                        <div className="relative h-24 sm:h-28">
                          <Photo
                            placeholder
                            src={c.photo}
                            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            fallback={<div className="absolute inset-0 bg-gradient-to-br from-navy-700 to-navy-990" />}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-navy-990/40 to-transparent" />
                          {/* The answer, on the picture — the first thing read. */}
                          <VisaBadge
                            category={c.category}
                            label={dict.labels[c.category]}
                            className="absolute start-2 top-2 max-w-[calc(100%-1rem)] shadow-sm"
                          />
                          <span className="absolute -bottom-6 start-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center overflow-hidden rounded-full bg-white shadow-md ring-2 ring-white rtl:translate-x-1/2">
                            {/* eslint-disable-next-line @next/next/no-img-element -- flag
                                CDN, and the app runs with the Next image optimizer
                                disabled on Workers. */}
                            <img src={flagImageUrl(c.code)} alt="" loading="lazy" className="h-full w-full object-cover" />
                          </span>
                        </div>

                        <div className="flex flex-1 flex-col items-center px-2 pb-3 pt-8 text-center">
                          <p className="w-full truncate text-sm font-bold text-navy-900">{name}</p>
                          <div className="mt-2 flex flex-wrap justify-center gap-1">
                            {c.official && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-navy-900 px-2 py-0.5 text-2xs font-bold text-white">
                                <span aria-hidden="true">🏛</span>
                                {dict.badgeOfficial}
                              </span>
                            )}
                            {c.direct && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sun-400 px-2 py-0.5 text-2xs font-bold text-navy-950">
                                <span aria-hidden="true">📄</span>
                                {dict.badgeDirect}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
