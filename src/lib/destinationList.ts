// The destination list the attractions, maps and seasons pages all draw from.
//
// Three pages show the same set of countries with the same filters over them.
// Building that list in one place is what keeps them agreeing: a country that
// gains a city, a photo or a season appears identically in all three without
// anyone remembering to update the other two.

import { COUNTRY_GUIDES } from "@/lib/countryGuides";
import { COUNTRY_CITIES } from "@/lib/cities";
import { findCountry } from "@/lib/countries";
import { fetchCountryPhotos } from "@/lib/countryPhotos";
import { bestMonthsFor } from "@/lib/seasons";
import type { Locale } from "@/lib/types";
import type { DestinationCountry } from "@/components/CountryCardGrid";
import type { CityOption } from "@/components/DestinationFilters";

export interface DestinationList {
  countries: DestinationCountry[];
  /** Every city across every country, for the "jump to a city" picker. */
  cities: CityOption[];
}

/**
 * @param onlyWithCities Restrict to countries that have city pages — the maps
 *   section needs this, since a country there opens onto a list of city maps
 *   and one with no cities would open onto nothing.
 */
export async function fetchDestinationList(
  locale: Locale,
  { onlyWithCities = false }: { onlyWithCities?: boolean } = {}
): Promise<DestinationList> {
  // Every country the site has a guide OR city pages for. Listing only the
  // guided ones hid 32 countries whose cities, maps and places were already
  // live (Russia, Ireland, the Nordics, Central Asia…): the list said 41
  // while the site covered 73.
  const codes = [...new Set([...Object.keys(COUNTRY_GUIDES), ...Object.keys(COUNTRY_CITIES)])].filter(
    (code) => (COUNTRY_CITIES[code]?.length ?? 0) > 0 || (!onlyWithCities && COUNTRY_GUIDES[code])
  );

  const photos = await fetchCountryPhotos(codes);

  const countries: DestinationCountry[] = codes
    .map((code): DestinationCountry | null => {
      const country = findCountry(code);
      if (!country) return null;
      const cities = COUNTRY_CITIES[code] ?? [];
      return {
        code,
        nameAr: country.nameAr,
        nameEn: country.nameEn,
        continent: country.continent,
        photo: photos.get(code),
        months: bestMonthsFor(code),
        // Both languages go in, so the search matches whichever the visitor
        // types regardless of the interface language they're reading in.
        cityNames: cities.flatMap((c) => [c.nameAr, c.nameEn]),
      };
    })
    .filter((c): c is DestinationCountry => c !== null);

  const cities: CityOption[] = codes.flatMap((code) => {
    const country = findCountry(code);
    if (!country) return [];
    return (COUNTRY_CITIES[code] ?? []).map((city) => ({
      countryCode: code,
      slug: city.slug,
      name: locale === "ar" ? city.nameAr : city.nameEn,
      countryName: locale === "ar" ? country.nameAr : country.nameEn,
    }));
  });

  return { countries, cities };
}
