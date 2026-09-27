// A discover destination (an IATA code and a name) as a place on the site:
// its country and city page, its weather in the month of travel and its visa
// status. The discover list and the city data grew up separately, so the
// link is made here once — by the city's own airport code first, its
// English name second — rather than kept by hand in two lists.

import { COUNTRY_CITIES } from "@/lib/cities";
import { CITY_AIRPORTS } from "@/data/cityAirports";
import { CITY_CLIMATE } from "@/data/cityClimate";
import { hasReliableClimate, isInSeason } from "@/lib/citySeasons";
import { visaStatusFor } from "@/data/visaStatus";
import type { DestinationPlace } from "@/lib/types";

function findCity(code: string, nameEn: string): { countryCode: string; slug: string; nameEn: string } | undefined {
  const byName = nameEn.trim().toLowerCase();
  let nameMatch: { countryCode: string; slug: string; nameEn: string } | undefined;
  for (const [countryCode, cities] of Object.entries(COUNTRY_CITIES)) {
    for (const c of cities) {
      if (CITY_AIRPORTS[c.slug]?.iata === code) return { countryCode, slug: c.slug, nameEn: c.nameEn };
      if (!nameMatch && c.nameEn.toLowerCase() === byName) nameMatch = { countryCode, slug: c.slug, nameEn: c.nameEn };
    }
  }
  return nameMatch;
}

/** `month` is 1–12, the month of the outbound flight. */
export function placeForDestination(code: string, nameEn: string, month: number): DestinationPlace | undefined {
  const city = findCity(code.toUpperCase(), nameEn);
  if (!city) return undefined;
  const climate = CITY_CLIMATE[city.slug];
  const reliable = hasReliableClimate(city.slug);
  const valid = month >= 1 && month <= 12;
  return {
    countryCode: city.countryCode,
    citySlug: city.slug,
    cityNameEn: city.nameEn,
    high: climate && valid ? climate.high[month - 1] : undefined,
    rainyDays: climate && valid ? climate.rainyDays[month - 1] : undefined,
    inSeason: climate && reliable && valid ? isInSeason(climate, month) : undefined,
    visa: visaStatusFor(city.countryCode)?.category,
  };
}
