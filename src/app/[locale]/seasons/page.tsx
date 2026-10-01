import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import { pageMetadata } from "@/lib/seo";
import type { Locale } from "@/lib/types";
import CitySeasons, { type SeasonCity } from "@/components/CitySeasons";
import PageHero from "@/components/ui/PageHero";
import { sectionHero } from "@/lib/sectionHero";
import { monthName } from "@/lib/seasons";
import { COUNTRY_CITIES } from "@/lib/cities";
import { findCountry } from "@/lib/countries";
import { seasonRecords } from "@/lib/travelSeason/site";
import { fetchCityPhotos } from "@/lib/countryPhotos";

// Photos come from Pexels, same as the rest of the site.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/seasons">): Promise<Metadata> {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  return pageMetadata({
    locale: loc,
    path: "/seasons",
    title: dict.seasons.title,
    description: dict.seasons.subtitle,
  });
}

/**
 * "When to travel?" — every destination, every month, from the single
 * travel-season dataset (src/data/climate/travelSeasons.json via
 * src/lib/travelSeason/site.ts). The home page's "best in <month>" reads the
 * same records; nothing here is computed on the page.
 */
export default async function SeasonsPage({ params, searchParams }: PageProps<"/[locale]/seasons">) {
  const { locale } = await params;
  const cityParam = (await searchParams).city;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  const isAr = loc === "ar";

  const list = Object.entries(COUNTRY_CITIES).flatMap(([code, cs]) =>
    cs.filter((c) => seasonRecords(c.slug)).map((c) => ({ code, ...c }))
  );

  const [hero, photos] = await Promise.all([
    sectionHero("seasons", loc),
    fetchCityPhotos(list.map((c) => ({ code: c.code, slug: c.slug, nameEn: c.nameEn }))),
  ]);

  const cities: SeasonCity[] = list.flatMap((c) => {
    const country = findCountry(c.code);
    const recs = seasonRecords(c.slug);
    if (!country || !recs) return [];
    return [
      {
        code: c.code,
        slug: c.slug,
        name: isAr ? c.nameAr : c.nameEn,
        countryName: isAr ? country.nameAr : country.nameEn,
        keywords: `${c.nameAr} ${c.nameEn} ${country.nameAr} ${country.nameEn}`,
        continent: country.continent,
        photo: photos.get(`${c.code}/${c.slug}`),
        months: recs.map((r) => ({
          classification: r.classification,
          finalScore: r.finalScore,
          season: r.season,
          pattern: r.climatePattern,
          seasonName: isAr ? r.seasonNameAr : r.seasonNameEn,
          seasonIcon: r.seasonIcon,
          phase: r.favorablePhase,
          high: r.averageHighC,
          low: r.averageLowC,
          rainDays: r.precipitationDays,
          summary: isAr ? r.weatherSummaryAr : r.weatherSummaryEn,
          reason: isAr ? r.reasonAr : r.reasonEn,
        })),
        // Sources stay internal: the page shows ratings and weather, not
        // which data set or tourism board they came from.
      },
    ];
  });

  const month = new Date().getMonth() + 1;

  return (
    <div>
      <PageHero {...hero} eyebrow={monthName(month, loc)} title={dict.seasons.title} subtitle={dict.seasons.subtitle} />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <CitySeasons
          locale={loc}
          cities={cities}
          currentMonth={month}
          initialCity={typeof cityParam === "string" ? cityParam : undefined}
          dict={{
            ...dict.citySeasons,
            monthNames: [...dict.citySeasons.monthNames],
            kinds: { ...dict.citySeasons.kinds },
            ts: {
              ...dict.travelSeasons,
              classes: { ...dict.travelSeasons.classes },
              phases: { ...dict.travelSeasons.phases },
              patterns: { ...dict.travelSeasons.patterns },
            },
            allContinents: dict.filters.allContinents,
            continents: dict.attractions.continents,
          }}
        />
      </div>
    </div>
  );
}
