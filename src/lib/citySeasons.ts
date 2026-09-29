// When each city is in season.
//
// The months come from someone who knows the place — the city's or
// country's tourism board where it names months, otherwise a travel guide —
// with the page they were read from (src/data/citySeasonSources.ts). They
// used to come from a comfort rule applied to NASA's weather numbers
// (18–32 °C, 8 rainy days or fewer), which knew nothing about what a city is
// for: it put London "out of season" all year and Salalah's monsoon, the
// reason people go, off the calendar.
//
// The weather still checks the source. A month the source names is dropped
// when the city's recent weather (2021–2025, src/data/cityClimate.ts)
// contradicts it outright — an average afternoon of 36 °C or more, or under
// 10 °C — because no one's best month is either. Every drop is shown on the
// page beside the source's own months, so nothing is hidden.
//
// What kind of month it is (winter, rainy season…) is still worked out from
// the weather and the city's latitude: see seasonKindFor.

import { CITY_CLIMATE } from "@/data/cityClimate";
import { CITY_COORDS } from "@/data/cityCoords";
import { CITY_SEASON_SOURCES, SEASON_SOURCES, type CitySeasonSource, type SeasonSource } from "@/data/citySeasonSources";
import { COUNTRY_CITIES } from "@/lib/cities";

/** A sourced month outside these afternoon highs (°C) is not kept. */
export const WEATHER_LIMITS = { minHigh: 10, maxHigh: 36 } as const;

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
 * Cities whose climate figures we know to be wrong. Empty since Dubai moved
 * to the WMO normals (28 Sep 2026 — see cityClimate.ts); kept so a future
 * bad cell has somewhere to go.
 */
export const UNRELIABLE_CLIMATE: ReadonlySet<string> = new Set<string>([]);

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
 * Jeddah at 21°N — on the calendar their people use: Jeddah runs from 29 °C
 * in January to 42 °C in June with almost no rain, so January there is
 * winter, not "dry season". (Abha, at 18°N, was kept on that calendar too
 * until the 2021–2025 figures: its August now averages 12 rainy days, so it
 * reads as a rainy-season city — 12 in August, 2 in September.)
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

export interface CitySeason {
  /** Months in season, 1–12, January first. */
  months: number[];
  /** Months the source names that the weather rules out, January first. */
  dropped: { month: number; high: number }[];
  /** The source's own months, January first. */
  sourceMonths: number[];
  source: SeasonSource;
  url: string;
  broad: boolean;
}

const byCalendar = (a: number, b: number) => a - b;

/** The city's season with its source, or undefined when it has none. */
export function citySeason(slug: string): CitySeason | undefined {
  const entry: CitySeasonSource | undefined = CITY_SEASON_SOURCES[slug];
  if (!entry) return undefined;
  const climate = hasReliableClimate(slug) ? CITY_CLIMATE[slug] : undefined;
  const sourceMonths = [...entry.months].sort(byCalendar);
  const dropped: CitySeason["dropped"] = [];
  const months: number[] = [];
  for (const m of sourceMonths) {
    const high = climate?.high[m - 1];
    if (high !== undefined && (high < WEATHER_LIMITS.minHigh || high >= WEATHER_LIMITS.maxHigh)) {
      dropped.push({ month: m, high });
    } else {
      months.push(m);
    }
  }
  return { months, dropped, sourceMonths, source: SEASON_SOURCES[entry.source], url: entry.url, broad: Boolean(entry.broad) };
}

/** The months (1–12, January first) a city is in season; empty when unsourced. */
export function seasonMonthsForCity(slug: string): number[] {
  return citySeason(slug)?.months ?? [];
}

/** Whether the city has a sourced season at all. */
export function hasSeasonSource(slug: string): boolean {
  return Boolean(CITY_SEASON_SOURCES[slug]);
}

/** In season in `month` (1–12); undefined when the city has no sourced season. */
export function isCityInSeason(slug: string, month: number): boolean | undefined {
  const season = citySeason(slug);
  return season ? season.months.includes(month) : undefined;
}

/**
 * Every city in season in a month, most comfortable first — closest to a
 * 25 °C afternoon, fewest rainy days. Only cities with a climate record are
 * listed, since the cards show the month's weather.
 */
export function citiesInSeason(month: number): CityInSeason[] {
  const out: CityInSeason[] = [];
  for (const [code, cities] of Object.entries(COUNTRY_CITIES)) {
    for (const city of cities) {
      const climate = CITY_CLIMATE[city.slug];
      if (!climate || !isCityInSeason(city.slug, month)) continue;
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
