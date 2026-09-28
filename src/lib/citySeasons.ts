// When each city is in season — from its own measured weather.
//
// The country guides carry a hand-written "best months" line, and for a
// country that spans a continent's worth of climate that line is only ever
// right for some of it: Antalya in October is not Istanbul in October, and
// Salalah's monsoon summer is Muscat's furnace. So the season is decided per
// city, from two numbers a traveller actually feels, both averaged over
// twenty years of NASA's daily record for that city's coordinates (see
// src/data/cityClimate.ts for the source and how it was collected):
//
//   - the typical afternoon high (mean daily maximum, °C)
//   - the days in the month with at least 1 mm of rain
//
// A month is "in season" for a city when both are comfortable:
//
//   18 °C ≤ afternoon high ≤ 32 °C,  and  rainy days ≤ 8.
//
// The band is deliberately wider on the warm side than a European guide's
// would be — the people using this live with Gulf summers — and the rule is
// printed on the page with the numbers beside every city, so nobody has to
// take "in season" on trust.

import { CITY_CLIMATE, type CityClimate } from "@/data/cityClimate";
import { CITY_COORDS } from "@/data/cityCoords";
import { COUNTRY_CITIES } from "@/lib/cities";

export const SEASON_RULE = { minHigh: 18, maxHigh: 32, maxRainyDays: 8 } as const;

export interface CityInSeason {
  code: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  /** Mean afternoon high for the month, °C, one decimal. */
  high: number;
  /** Mean rainy days (≥ 1 mm) in the month. */
  rainyDays: number;
}

/**
 * Cities whose climate figures we know to be wrong, and so give no season.
 *
 * Dubai's NASA grid cell is mostly sea, which cools it: the data gives a
 * 35 °C August against about 41 °C measured in the city, and would call
 * April and October "in season" when they are not. Its numbers are still
 * shown, labelled; no verdict is drawn from them. (Checked against known
 * averages on 26 Sep 2026 — see src/data/cityClimate.ts.)
 */
export const UNRELIABLE_CLIMATE: ReadonlySet<string> = new Set<string>([]);
// (Dubai was here until 28 Sep 2026; it now uses the WMO 1991–2020 normals
// for Dubai International Airport — see cityClimate.ts.)

export function hasReliableClimate(slug: string): boolean {
  return Boolean(CITY_CLIMATE[slug]) && !UNRELIABLE_CLIMATE.has(slug);
}

/**
 * What kind of month it is where the city is.
 *
 * The four meteorological seasons, by hemisphere — December–February is
 * winter in the north and summer in the south — except where the year turns
 * on rain rather than temperature. That is a tropical city (|latitude| <
 * 23.44°) that either has a real rainy season (some month with 10 or more
 * rainy days: Bangkok, Mumbai, Bali, Mexico City) or barely changes
 * temperature through the year (monthly highs within 8 °C: Singapore, Malé).
 * There the month is the rainy season when it has 10 or more rainy days, and
 * the dry season otherwise.
 *
 * The second condition is what keeps dry cities just inside the tropic —
 * Jeddah at 21°N, Abha at 18°N — on the calendar their people use: Abha runs
 * from 19 °C in January to 30 °C in summer with almost no rain, so January
 * there is winter, not "dry season".
 */
export type SeasonKind = "winter" | "spring" | "summer" | "autumn" | "wet" | "dry";

export const TROPIC_LATITUDE = 23.44;
export const WET_MONTH_RAINY_DAYS = 10;

export function seasonKindFor(slug: string, month: number): SeasonKind | undefined {
  const point = CITY_COORDS[slug];
  const climate = CITY_CLIMATE[slug];
  if (!point || !climate) return undefined;
  const hasRainySeason = climate.rainyDays.some((d) => d >= WET_MONTH_RAINY_DAYS);
  const flatYear = Math.max(...climate.high) - Math.min(...climate.high) < 8;
  if (Math.abs(point.lat) < TROPIC_LATITUDE && (hasRainySeason || flatYear)) {
    return climate.rainyDays[month - 1] >= WET_MONTH_RAINY_DAYS ? "wet" : "dry";
  }
  const north: SeasonKind[] = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
  const flip: Record<string, SeasonKind> = { winter: "summer", summer: "winter", spring: "autumn", autumn: "spring" };
  const kind = north[month - 1];
  return point.lat < 0 ? flip[kind] : kind;
}

export function isInSeason(climate: CityClimate, month: number): boolean {
  const high = climate.high[month - 1];
  const wet = climate.rainyDays[month - 1];
  return (
    high >= SEASON_RULE.minHigh && high <= SEASON_RULE.maxHigh && wet <= SEASON_RULE.maxRainyDays
  );
}

/** The months (1–12) a city is in season. */
export function seasonMonthsForCity(slug: string): number[] {
  const climate = CITY_CLIMATE[slug];
  if (!climate || !hasReliableClimate(slug)) return [];
  return Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => isInSeason(climate, m));
}

/**
 * Every city in season in a month, most comfortable first — closest to a
 * 25 °C afternoon, fewest rainy days.
 */
export function citiesInSeason(month: number): CityInSeason[] {
  const out: CityInSeason[] = [];
  for (const [code, cities] of Object.entries(COUNTRY_CITIES)) {
    for (const city of cities) {
      const climate = CITY_CLIMATE[city.slug];
      if (!climate || !hasReliableClimate(city.slug) || !isInSeason(climate, month)) continue;
      out.push({
        code,
        slug: city.slug,
        nameAr: city.nameAr,
        nameEn: city.nameEn,
        high: climate.high[month - 1],
        rainyDays: climate.rainyDays[month - 1],
      });
    }
  }
  const score = (c: CityInSeason) => Math.abs(c.high - 25) + c.rainyDays * 0.5;
  return out.sort((a, b) => score(a) - score(b));
}

/**
 * A short list that is not six cities from one country: the most
 * comfortable city of each country first, then the rest.
 */
export function varietyFirst(cities: CityInSeason[], count: number): CityInSeason[] {
  const seen = new Set<string>();
  const first: CityInSeason[] = [];
  const rest: CityInSeason[] = [];
  for (const c of cities) {
    if (seen.has(c.code)) rest.push(c);
    else {
      seen.add(c.code);
      first.push(c);
    }
  }
  return [...first, ...rest].slice(0, count);
}
