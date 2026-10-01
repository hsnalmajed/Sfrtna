import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import { pageMetadata } from "@/lib/seo";
import type { Locale } from "@/lib/types";
import { findCountry } from "@/lib/countries";
import { findCity } from "@/lib/cities";
import CityPlacesPageBody from "@/components/CityPlacesPageBody";

export const dynamic = "force-dynamic";

// A city's tourist map is now the map view of the city's places page — the
// same places, list and map together. This address keeps working (links,
// bookmarks, the "Tourist maps" tool) and opens that page on the map. Its
// canonical address is the places page, so search engines see one page.
export async function generateMetadata({ params }: PageProps<"/[locale]/maps/[code]/[city]">): Promise<Metadata> {
  const { locale, code, city } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  const country = findCountry(code);
  const entry = country ? findCity(country.code, city) : undefined;
  if (!country || !entry) return {};
  const name = loc === "ar" ? entry.nameAr : entry.nameEn;
  return pageMetadata({
    locale: loc,
    path: `/attractions/${country.code}/${entry.slug}`,
    title: dict.maps.cityMapTitle.replace("{city}", name),
    description: dict.attractions.metaCityDescription.replace("{city}", name),
  });
}

export default async function CityMapPage({ params, searchParams }: PageProps<"/[locale]/maps/[code]/[city]">) {
  const { locale, code, city } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const sp = await searchParams;
  return <CityPlacesPageBody loc={loc} code={code} city={city} back={sp.back} initialView={sp.view === "list" ? "list" : "map"} />;
}
