// "Istanbul, Turkey" for a city slug — what the write-up prompt names.
import { COUNTRY_CITIES } from "@/lib/cities";
import { findCountry } from "@/lib/countries";

export const CITY_NAMES_EN: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_CITIES).flatMap(([cc, list]) => list.map((c) => [c.slug, `${c.nameEn}, ${findCountry(cc)?.nameEn ?? cc}`]))
);
