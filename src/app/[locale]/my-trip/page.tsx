import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import { pageMetadata } from "@/lib/seo";
import type { Locale } from "@/lib/types";
import PageHero from "@/components/ui/PageHero";
import { sectionHero } from "@/lib/sectionHero";
import MyTripView from "@/components/member/MyTripView";

// «رحلتي»: the same page for everyone (edge-cached); the trip itself lives
// in the visitor's browser (src/lib/myTrip.ts). Personal → not indexed.
export async function generateMetadata({ params }: PageProps<"/[locale]/my-trip">): Promise<Metadata> {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  return { ...pageMetadata({ locale: loc, path: "/my-trip", title: dict.myTrip.title, description: dict.myTrip.subtitle }), robots: { index: false, follow: false } };
}

export default async function MyTripPage({ params }: PageProps<"/[locale]/my-trip">) {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  const hero = await sectionHero("attractions", loc);
  return (
    <div>
      <PageHero {...hero} size="sm" align="center" title={dict.myTrip.title} subtitle={dict.myTrip.subtitle} />
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <MyTripView locale={loc} />
      </div>
    </div>
  );
}
