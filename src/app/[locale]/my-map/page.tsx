import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import { pageMetadata } from "@/lib/seo";
import type { Locale } from "@/lib/types";
import PageHero from "@/components/ui/PageHero";
import { sectionHero } from "@/lib/sectionHero";
import VisitedMap from "@/components/visited/VisitedMap";

// «خريطتي» (owner's note G, 14 Nov 2026): the same page for everyone
// (edge-cached); the marks live in the account or this browser
// (src/lib/visitedMap.ts). Personal → not indexed.
export async function generateMetadata({ params }: PageProps<"/[locale]/my-map">): Promise<Metadata> {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  return { ...pageMetadata({ locale: loc, path: "/my-map", title: dict.visited.title, description: dict.visited.subtitle }), robots: { index: false, follow: false } };
}

export default async function MyMapPage({ params }: PageProps<"/[locale]/my-map">) {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  const hero = await sectionHero("attractions", loc);
  return (
    <div>
      <PageHero {...hero} size="sm" align="center" title={dict.visited.title} subtitle={dict.visited.subtitle} />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <VisitedMap locale={loc} />
      </div>
    </div>
  );
}
