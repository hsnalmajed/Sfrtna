import { findCountry } from "@/lib/countries";
import { COUNTRY_LANDMARKS, CITY_LANDMARKS } from "@/data/countryLandmarks";
import GUIDE_LANDMARKS from "@/data/cityLandmarks.json";
import type { PexelsQuery } from "@/lib/pexels";

/**
 * What to search for each place's photo (owner, 27 Oct: "every country and
 * city must have a photo of its most famous landmark or its own nature —
 * never people, never a view from above, never a plane"). The searches run
 * in order until three fitting photos are found (scripts/pexels-photos.ts;
 * captions with people, aircraft or aerial views are refused in pexels.ts).
 *
 *   city:    its signature view → its guide's best-known landmarks →
 *            "<city> landmark" → "<city> <country>" → the country's nature
 *   country: its best-known landmarks → its landscape
 */
const guide = GUIDE_LANDMARKS as Record<string, string[]>;
const q = ([query, ...mention]: [string, ...string[]]): PexelsQuery => ({ query, mention });

export function cityPhotoQueries(code: string, slug: string, nameEn: string): PexelsQuery[] {
  const country = findCountry(code)?.nameEn ?? "";
  const city = nameEn.replace(/\s*\(.*?\)\s*/g, " ").trim();
  return [
    ...(CITY_LANDMARKS[slug] ?? []).map(q),
    ...(guide[slug] ?? []).slice(0, 2).map((name) => ({ query: `${name} ${city}`, mention: [name, city] })),
    { query: `${city} landmark`, mention: [city] },
    { query: `${city} ${country}`.trim(), mention: [city] },
    ...(country ? [{ query: `${country} landscape`, mention: [country] }] : []),
  ];
}

export function countryPhotoQueries(code: string): PexelsQuery[] {
  const country = findCountry(code)?.nameEn;
  if (!country) return [];
  return [
    ...(COUNTRY_LANDMARKS[code] ?? []).map(q),
    { query: `${country} landscape`, mention: [country] },
    { query: `${country} travel`, mention: [country] },
  ];
}
