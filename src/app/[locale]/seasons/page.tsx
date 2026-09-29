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
import { CITY_CLIMATE, CLIMATE_FROM_WMO } from "@/data/cityClimate";
import { citySeason, seasonKindFor } from "@/lib/citySeasons";
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
 * "When should I travel?" — city by city.
 *
 * Each city's best months come from its tourism board or a named guide, with
 * the page they were read from (src/data/citySeasonSources.ts), checked
 * against its 2021–2025 weather (src/lib/citySeasons.ts). What kind of month
 * it is — winter, rainy season — is worked out from the weather.
 */
export default async function SeasonsPage({ params }: PageProps<"/[locale]/seasons">) {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  const d = dict.citySeasons;
  const isAr = loc === "ar";

  const list = Object.entries(COUNTRY_CITIES).flatMap(([code, cs]) =>
    cs.filter((c) => CITY_CLIMATE[c.slug]).map((c) => ({ code, ...c }))
  );

  const [hero, photos] = await Promise.all([
    sectionHero("seasons", loc),
    fetchCityPhotos(list.map((c) => ({ code: c.code, slug: c.slug, nameEn: c.nameEn }))),
  ]);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const cities: SeasonCity[] = list.flatMap((c) => {
    const country = findCountry(c.code);
    const climate = CITY_CLIMATE[c.slug];
    if (!country || !climate) return [];
    const season = citySeason(c.slug);
    return [
      {
        code: c.code,
        slug: c.slug,
        name: isAr ? c.nameAr : c.nameEn,
        countryName: isAr ? country.nameAr : country.nameEn,
        // Both spellings are searchable, so typing "Paris" finds باريس.
        keywords: `${c.nameAr} ${c.nameEn} ${country.nameAr} ${country.nameEn}`,
        continent: country.continent,
        photo: photos.get(`${c.code}/${c.slug}`),
        high: climate.high,
        rainyDays: climate.rainyDays,
        kind: months.map((m) => seasonKindFor(c.slug, m) ?? "spring"),
        inSeason: months.map((m) => Boolean(season?.months.includes(m))),
        season: season
          ? {
              source: isAr ? season.source.nameAr : season.source.nameEn,
              official: season.source.official,
              url: season.url,
              broad: season.broad,
              dropped: season.dropped,
            }
          : undefined,
        weatherFromWmo: CLIMATE_FROM_WMO.has(c.slug),
      },
    ];
  });

  const month = new Date().getMonth() + 1;
  const unsourced = cities.filter((c) => !c.season).length;

  return (
    <div>
      <PageHero {...hero} eyebrow={monthName(month, loc)} title={dict.seasons.title} subtitle={dict.seasons.subtitle} />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <CitySeasons
          locale={loc}
          cities={cities}
          currentMonth={month}
          unsourcedCount={unsourced}
          dict={{
            ...d,
            monthNames: [...d.monthNames],
            kinds: { ...d.kinds },
            allContinents: dict.filters.allContinents,
            continents: dict.attractions.continents,
          }}
        />
      </div>
    </div>
  );
}
