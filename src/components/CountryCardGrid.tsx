"use client";

import Link from "next/link";
import type { Locale } from "@/lib/types";
import type { Continent } from "@/lib/countries";
import { flagEmoji } from "@/lib/countries";
import Photo from "@/components/Photo";
import { CONTINENT_ORDER } from "@/components/DestinationFilters";
import { searchMatches, searchEquals } from "@/lib/search";

export interface DestinationCountry {
  code: string;
  nameAr: string;
  nameEn: string;
  continent: Continent;
  photo?: string;
  /** Line under the name — a city count, a season, whatever the page needs. */
  subtitle?: string;
  /** Months this country's guide recommends, for the month filter. */
  months: number[];
  /** City names, so a search for "Antalya" finds Turkey. */
  cityNames: string[];
}

/**
 * Destination cards laid out continent by continent.
 *
 * A flat grid of forty countries is a wall — Turkey next to Peru next to
 * Norway, in whatever order the data happened to be in. Grouping by continent
 * matches how people actually narrow a holiday down, and it means the heading
 * above a card already tells you half of what you wanted to know.
 */
export default function CountryCardGrid({
  locale,
  countries,
  hrefBase,
  continentLabels,
}: {
  locale: Locale;
  countries: DestinationCountry[];
  /** Each card links to `${hrefBase}/${code}`. */
  hrefBase: string;
  continentLabels: Record<Continent, string>;
}) {
  return (
    <div className="space-y-10 sm:space-y-12">
      {CONTINENT_ORDER.map((continent) => {
        const inContinent = countries.filter((c) => c.continent === continent);
        if (inContinent.length === 0) return null;

        // South America has one country here. Oceania has one. North America
        // has two. Given a full-width heading and a five-column grid, each
        // printed a banner across the page with a single card stranded under
        // one end of it and four empty columns beside it — which does not
        // read as "a small continent", it reads as a page that failed to
        // load. So a section of three or fewer turns on its side: the
        // heading takes the first column and the cards sit beside it, and
        // the row is full because it was always meant to be that size.
        const compact = inContinent.length <= 3;

        const heading = (
          <h3 className={`flex items-center gap-3 ${compact ? "mb-4 lg:mb-0 lg:w-44 lg:shrink-0" : "mb-4"}`}>
            <span className="font-display text-h3 font-extrabold text-navy-900">
              {continentLabels[continent]}
            </span>
            <span className="rounded-full bg-navy-50 px-2.5 py-0.5 text-2xs font-bold text-navy-500">
              {inContinent.length}
            </span>
            {/* The rule is what gives the page its horizontal structure —
                without it the continents read as unrelated grids. In a
                compact section it would only underline empty space, so it
                stops at the large breakpoint where the layout turns. */}
            <span
              className={`h-px flex-1 bg-gradient-to-l from-transparent to-mist-300 rtl:bg-gradient-to-r ${
                compact ? "lg:hidden" : ""
              }`}
              aria-hidden="true"
            />
          </h3>
        );

        return (
          <section
            key={continent}
            className={compact ? "lg:flex lg:items-center lg:gap-7" : undefined}
          >
            {heading}

            {/* Compact sections stop being a grid at the large breakpoint and
                become a line: the cards keep the exact width they have in
                every other section and simply run out, the way a line of
                type runs out. Sharing the row's width between one or two
                cards would have made Brazil twice the size of Turkey for no
                reason other than that Brazil is alone. */}
            <div
              className={`grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 ${
                compact ? "lg:flex lg:flex-wrap" : "lg:grid-cols-5"
              }`}
            >
              {inContinent.map((c) => (
                <Link
                  key={c.code}
                  href={`${hrefBase}/${c.code}`}
                  // Landscape, not portrait. Forty-one portrait tiles five
                  // across ran the page past four thousand pixels, which is
                  // not a directory, it is a scroll. The same forty-one in
                  // 3:2 fit in little over half that, and a country photo is
                  // a landscape photograph anyway — the portrait crop was
                  // throwing away the horizon to gain height nobody wanted.
                  className={`card-hover group relative isolate block aspect-[3/2] overflow-hidden rounded-2xl ring-1 ring-navy-950/5 app:flex app:aspect-auto app:flex-col app:bg-white app:shadow-[0_1px_2px_rgb(11_45_91/0.06),0_8px_20px_-14px_rgb(11_45_91/0.35)] app:active:scale-[0.98] ${
                    compact ? "lg:w-[13.25rem]" : ""
                  }`}
                >
                  {/* In the app: the picture on top of a white card, the name
                      under it. */}
                  <div className="absolute inset-0 -z-10 overflow-hidden app:relative app:inset-auto app:z-0 app:h-24">
                    <Photo
                      placeholder
                      src={c.photo}
                      className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
                      fallback={
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-navy-700 to-navy-990 text-4xl app:from-sea-50 app:to-mist-100 app:text-5xl">
                          {flagEmoji(c.code)}
                        </div>
                      }
                    />
                    <div className="scrim-soft absolute inset-0 app:hidden" />
                  </div>
                  {/* A sunset hairline that draws itself on hover — the same
                      mark as the section rules, at card scale. */}
                  <span
                    className="absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-sun-300 to-sun-600 transition-transform duration-300 group-hover:scale-x-100 rtl:origin-right"
                    aria-hidden="true"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 app:static">
                    <p className="truncate font-display text-sm font-extrabold text-white drop-shadow-sm sm:text-base app:text-base app:text-navy-900 app:drop-shadow-none">
                      {locale === "ar" ? c.nameAr : c.nameEn}
                    </p>
                    {c.subtitle && (
                      <p className="mt-0.5 truncate text-2xs font-semibold text-sun-300 app:text-xs app:text-[#5d6b80]">
                        {c.subtitle}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Shared matching rules, so every page's search behaves the same way. */
export function matchesFilters(
  country: DestinationCountry,
  { query, continent, month }: { query: string; continent: Continent | "all"; month: number | "all" }
): boolean {
  if (continent !== "all" && country.continent !== continent) return false;
  if (month !== "all" && !country.months.includes(month)) return false;

  const q = query.trim();
  if (!q) return true;

  // City names are searchable too: someone who knows they want Sharm El
  // Sheikh shouldn't have to remember it's in Egypt.
  return (
    searchMatches([country.nameAr, country.nameEn, ...country.cityNames], q) ||
    searchEquals(country.code, q)
  );
}
