// The cities "suggest a destination" chooses from — single destinations
// (/api/discover) and multi-country routes (routeSuggest.ts) alike.

import { DESTINATIONS } from "@/lib/destinations";
import { COUNTRY_CITIES } from "@/lib/cities";
import { flagEmoji, findCountry, type Continent } from "@/lib/countries";
import { CITY_AIRPORTS } from "@/data/cityAirports";
import { DESTINATION_TYPES } from "@/data/destinationTypes";
import type { DestinationCategory } from "@/lib/types";

export type Candidate = {
  code: string;
  nameAr: string;
  nameEn: string;
  emoji: string;
  categories: DestinationCategory[];
  continent?: Continent;
};

/**
 * Every city we have a guide and an airport for, as a place to suggest.
 *
 * This list used to be fourteen hand-picked cities, which is why a search
 * from Dammam could answer with two: whatever the budget, only those
 * fourteen were ever asked about. The categories come from the same trip
 * types the season ratings use (src/data/destinationTypes.ts), with the old
 * hand-picked tags kept where a city had them.
 */
export function discoverCandidates(): Candidate[] {
  const curated = new Map(DESTINATIONS.map((d) => [d.code, d]));
  const typeToCategory: Record<string, DestinationCategory[]> = {
    beach: ["beach", "family"],
    tropical: ["beach", "nature"],
    nature: ["nature"],
    mountain: ["nature", "adventure"],
    desert: ["adventure"],
    city: ["city", "culture"],
  };
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const [countryCode, cities] of Object.entries(COUNTRY_CITIES)) {
    for (const c of cities) {
      const code = CITY_AIRPORTS[c.slug]?.iata;
      if (!code || seen.has(code)) continue;
      seen.add(code);
      const cats = new Set<DestinationCategory>(curated.get(code)?.categories ?? []);
      for (const t of DESTINATION_TYPES[c.slug] ?? []) for (const k of typeToCategory[t] ?? []) cats.add(k);
      out.push({
        code,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        emoji: curated.get(code)?.emoji ?? flagEmoji(countryCode),
        categories: [...cats],
        continent: findCountry(countryCode)?.continent,
      });
    }
  }
  return out;
}

