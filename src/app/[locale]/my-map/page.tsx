import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import { pageMetadata } from "@/lib/seo";
import type { Locale } from "@/lib/types";
import MyMap from "@/components/visited/MyMap";

// «خريطتي» (owner's spec, 18 Nov 2026): one page for everyone (edge-cached);
// the account decides what shows (src/components/visited/MyMap.tsx).
// Personal → not indexed.
export async function generateMetadata({ params }: PageProps<"/[locale]/my-map">): Promise<Metadata> {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  return { ...pageMetadata({ locale: loc, path: "/my-map", title: dict.visited.title, description: dict.visited.subtitle }), robots: { index: false, follow: false } };
}

export default async function MyMapPage({ params }: PageProps<"/[locale]/my-map">) {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  return (
    <div className="min-h-[80vh] bg-[radial-gradient(70rem_30rem_at_80%_-10%,rgb(248_184_64/0.10),transparent),linear-gradient(#04182f,#061a33)] hero-pad pb-16 pt-24 sm:pt-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <MyMap locale={loc} />
      </div>
    </div>
  );
}
