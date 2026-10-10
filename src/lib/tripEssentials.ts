import pages from "@/data/partnerPages.json";

/**
 * What a traveller needs around the trip itself — mobile data on landing, a
 * driver at the airport, a car — at partners we earn from (Travelpayouts).
 *
 * Only pages scripts/partners/check-pages.ts found to exist are linked
 * (src/data/partnerPages.json): a link to a partner's home page instead of
 * the traveller's city, or to a 404, is a broken promise. Every link goes
 * through /api/go/tp, which looks the page up again by key — never a free URL.
 */

export type EssentialBrand = "airalo" | "kiwitaxi" | "welcomepickups" | "localrent";
export type EssentialKind = "esim" | "transfer" | "car";

interface Pages {
  countries: Record<string, { airalo?: string }>;
  cities: Record<string, { kiwitaxi?: string; welcomepickups?: string; localrent?: string }>;
}
const PAGES = pages as Pages;

export const BRAND_NAMES: Record<EssentialBrand, string> = {
  airalo: "Airalo",
  kiwitaxi: "Kiwitaxi",
  welcomepickups: "Welcome Pickups",
  localrent: "Localrent",
};

/** The checked partner page for a brand and a place, or null. */
export function essentialPage(brand: EssentialBrand, place: { country?: string; city?: string }): string | null {
  if (brand === "airalo") return (place.country && PAGES.countries[place.country]?.airalo) || null;
  return (place.city && PAGES.cities[place.city]?.[brand]) || null;
}

export interface EssentialGroup {
  kind: EssentialKind;
  links: { brand: EssentialBrand; name: string; href: string }[];
}

/** The groups that have at least one checked page for this city. */
export function essentialsFor(countryCode: string, citySlug: string): EssentialGroup[] {
  const make = (kind: EssentialKind, brands: EssentialBrand[]): EssentialGroup => ({
    kind,
    links: brands
      .filter((b) => essentialPage(b, { country: countryCode, city: citySlug }))
      .map((b) => ({
        brand: b,
        name: BRAND_NAMES[b],
        href: b === "airalo" ? `/api/go/tp?b=${b}&c=${countryCode}` : `/api/go/tp?b=${b}&p=${citySlug}`,
      })),
  });
  return [make("esim", ["airalo"]), make("transfer", ["kiwitaxi", "welcomepickups"]), make("car", ["localrent"])].filter(
    (g) => g.links.length > 0
  );
}
