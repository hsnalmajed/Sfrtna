import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import { pageMetadata } from "@/lib/seo";
import type { Locale } from "@/lib/types";
import {findCountry} from "@/lib/countries";
import { findCity } from "@/lib/cities";
import CityPlacesPageBody from "@/components/CityPlacesPageBody";

// Viator tours are looked up per request.
export const dynamic = "force-dynamic";

// A city's places: what each one is and how to get in (the list), and where
// they are (the map), on one page — see CityPlacesPageBody / CityPlacesView.
// `?view=map` opens it on the map.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/attractions/[code]/[city]">): Promise<Metadata> {
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
    title: dict.attractions.metaCityTitle.replace("{city}", name),
    description: dict.attractions.metaCityDescription.replace("{city}", name),
  });
}

export default async function CityPlacesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/attractions/[code]/[city]">) {
  const { locale, code, city } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const sp = await searchParams;
  return (
    <CityPlacesPageBody loc={loc} code={code} city={city} back={sp.back} initialView={sp.view === "map" ? "map" : "list"} />
  );
}
