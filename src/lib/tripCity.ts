import { COUNTRY_CITIES, type CityEntry } from "@/lib/cities";
import { CITY_AIRPORTS } from "@/data/cityAirports";
import { searchEquals } from "@/lib/search";

export interface TripCity {
  countryCode: string;
  slug: string;
  nameAr: string;
  nameEn: string;
}

/** A covered city by its Arabic or English name, or an airport code. */
export function tripCityFrom(nameOrCode: string): TripCity | undefined {
  const n = nameOrCode.trim();
  if (!n) return undefined;
  for (const [countryCode, cities] of Object.entries(COUNTRY_CITIES)) {
    const hit = cities.find(
      (c: CityEntry) => CITY_AIRPORTS[c.slug]?.iata === n.toUpperCase() || searchEquals(c.nameEn, n) || searchEquals(c.nameAr, n)
    );
    if (hit) return { countryCode, slug: hit.slug, nameAr: hit.nameAr, nameEn: hit.nameEn };
  }
  return undefined;
}

