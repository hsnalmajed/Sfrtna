import type { Locale } from "@/lib/types";
import { sectionHero } from "@/lib/sectionHero";
import ItineraryStart from "@/components/ItineraryStart";
import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/itinerary">): Promise<Metadata> {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  return pageMetadata({ locale: loc, path: "/itinerary", title: dict.itinerary.title, description: dict.itinerary.subtitle });
}

// The hero is a fixed Pexels photograph, so the route is
// rendered per request rather than frozen into the build.
export const dynamic = "force-dynamic";

/**
 * The plan page's shell: a city and dates, then the one plan engine on
 * that city's page (see ItineraryStart).
 *
 * Everything on this page is a form, so the page itself used to be a client
 * component — which left it as the one section of the site with no hero at
 * all, because a client component cannot await a photograph. Splitting it in
 * two fixes that: the route looks up the picture on the server, the planner
 * carries on being interactive underneath.
 */
export default async function ItineraryPage({ params }: PageProps<"/[locale]/itinerary">) {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const hero = await sectionHero("itinerary", loc);

  return <ItineraryStart hero={hero} />;
}
