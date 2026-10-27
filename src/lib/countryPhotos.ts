import { COUNTRY_GUIDES } from "@/lib/countryGuides";
import { findCountry } from "@/lib/countries";
import { searchPexelsPhotos, type PexelsQuery } from "@/lib/pexels";
import { cityPhotoQueries, countryPhotoQueries } from "@/lib/photoSubjects";

/**
 * One photograph per country, for the destination cards.
 *
 * The search tries the country's best-known landmark first — "Petra Jordan"
 * finds Petra; "Jordan" alone finds a basketball player — then the next
 * landmark, then the country with "travel" to steer it towards places rather
 * than people. Photos come from Pexels (see pexels.ts); a country with no
 * result keeps its navy tile rather than borrowing someone else's picture.
 */
export async function fetchCountryPhotos(
  codes: string[],
  { full = false }: { full?: boolean } = {}
): Promise<Map<string, string>> {
  const wanted = new Map<string, PexelsQuery[]>();
  const legacy = new Map<string, PexelsQuery[]>();
  for (const code of codes) {
    const country = findCountry(code)?.nameEn;
    if (!country) continue;
    wanted.set(code, countryPhotoQueries(code));
    const landmarks = (COUNTRY_GUIDES[code]?.attractions ?? []).slice(0, 2);
    legacy.set(code, [
      ...landmarks.map((a) => ({ query: `${a.nameEn} ${country}`, mention: [a.nameEn, country] })),
      { query: `${country} travel`, mention: [country] },
    ]);
  }
  const found = await searchPexelsPhotos(wanted, legacy);
  const photos = new Map<string, string>();
  for (const [code, p] of found) photos.set(code, full ? p.url : p.small);
  return photos;
}

/**
 * One photograph per city, keyed "<country code>/<slug>".
 *
 * Tries "<city> <country>" first and keeps a photo only when its caption
 * names the city — a search for a smaller city on Pexels otherwise returns
 * the capital's skyline, and a card with no photo is better than a card with
 * the wrong city.
 */
export async function fetchCityPhotos(
  cities: { code: string; slug: string; nameEn: string }[]
): Promise<Map<string, string>> {
  const wanted = new Map<string, PexelsQuery[]>();
  const legacy = new Map<string, PexelsQuery[]>();
  for (const c of cities) {
    const country = findCountry(c.code)?.nameEn ?? "";
    wanted.set(`${c.code}/${c.slug}`, cityPhotoQueries(c.code, c.slug, c.nameEn));
    legacy.set(`${c.code}/${c.slug}`, [
      { query: `${c.nameEn} ${country}`.trim(), mention: [c.nameEn] },
      { query: `${c.nameEn} city`, mention: [c.nameEn] },
    ]);
  }
  const found = await searchPexelsPhotos(wanted, legacy);
  const photos = new Map<string, string>();
  for (const [key, p] of found) photos.set(key, p.small);
  return photos;
}
