import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import { findCountry } from "@/lib/countries";
import { COUNTRY_CITIES } from "@/lib/cities";
import { fetchCityOverviews, fetchPlacesAroundCities } from "@/lib/mapPins";
import { fetchCountryPhotos } from "@/lib/countryPhotos";
import { cityCountLabel, placeCountLabel } from "@/lib/format";
import CityGallery, { type CityCard } from "@/components/CityGallery";
import VisaQuickCard from "@/components/VisaQuickCard";
import PageHero from "@/components/ui/PageHero";
import { pageMetadata, absoluteUrl, touristDestinationJsonLd } from "@/lib/seo";
import CountryQuickFacts, { type QuickFact } from "@/components/CountryQuickFacts";
import { currencyForCountry } from "@/lib/currencies";

/**
 * A title that says which country.
 *
 * Every page on the site used to share one title, so a link shared in a
 * message said nothing about what was behind it — which on a site whose
 * growth depends on someone sending a friend a destination is the whole
 * game.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/attractions/[code]">): Promise<Metadata> {
  const { locale, code } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  const country = findCountry(code);
  if (!country) return {};

  const name = loc === "ar" ? country.nameAr : country.nameEn;
  const cities = COUNTRY_CITIES[country.code] ?? [];
  return pageMetadata({
    locale: loc,
    path: `/attractions/${country.code}`,
    title: dict.attractions.metaCountryTitle.replace("{country}", name),
    description: dict.attractions.metaCountryDescription
      .replace("{country}", name)
      .replace("{cities}", String(cities.length)),
  });
}

export default async function CountryAttractionsPage({
  params,
}: PageProps<"/[locale]/attractions/[code]">) {
  const { locale, code } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);

  const country = findCountry(code);
  if (!country) notFound();

  const cities = COUNTRY_CITIES[country.code] ?? [];

  const [photos, cityOverviews] = await Promise.all([
    // Full resolution: this one photo is the full-width hero, not a card.
    fetchCountryPhotos([country.code], { full: true }),
    // A photo for every city card.
    fetchCityOverviews(cities),
  ]);

  const cityCards: CityCard[] = cities.map((c) => {
    const overview = cityOverviews.get(c.slug);
    return {
      slug: c.slug,
      name: loc === "ar" ? c.nameAr : c.nameEn,
      photo: overview?.photo,
    };
  });

  // The country's photo as the hero, or the hero's own gradient if none
  // resolved.
  const heroPhoto = photos.get(country.code);

  /**
   * The quick-facts row.
   *
   * Assembled only from data this page already has or the site already
   * holds. Anything we cannot answer is omitted — a country page with three
   * facts on it is more useful than one with five where two are guesses.
   */
  const currency = currencyForCountry(country.code);
  const quickFacts: QuickFact[] = [];

  if (currency) {
    quickFacts.push({
      icon: "💱",
      label: dict.attractions.factCurrency,
      value: `${loc === "ar" ? currency.nameAr : currency.nameEn} (${currency.code})`,
      href: `/${loc}/currency`,
    });
  }
  if (cities.length > 0) {
    quickFacts.push({
      icon: "🏙️",
      label: dict.attractions.factCities,
      value: cityCountLabel(cities.length, dict.maps),
    });
  }

  const jsonLd = touristDestinationJsonLd({
    name: loc === "ar" ? country.nameAr : country.nameEn,
    url: absoluteUrl(`/${loc}/attractions/${country.code}`),
    image: heroPhoto,
    country: loc === "ar" ? country.nameAr : country.nameEn,
  });

  return (
    <div>
      {/* Structured data carries only what we actually know — Google treats
          invented markup as a reason to distrust the rest of the page. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <PageHero
        photo={heroPhoto}
        eyebrow={dict.attractions.title}
        title={loc === "ar" ? country.nameAr : country.nameEn}
      >
        <Link href={`/${loc}/attractions`} className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/20">
          {loc === "ar" ? "→" : "←"} {dict.attractions.backToCountries}
        </Link>
      </PageHero>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
        {/* Everything about the country itself at the top — the visa first.
            When to go and how long the flight is depend on the city, so they
            are on each city's page. */}
        <CountryQuickFacts
          locale={loc}
          facts={quickFacts}
          heading={dict.attractions.quickFactsHeading}
          lead={<VisaQuickCard countryCode={country.code} locale={loc} />}
        />

        {/* The one thing this page is for. A country has no attractions of its
            own — its cities do — so choosing one is the whole job, and it
            comes before anything else on the page. */}
        {cityCards.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-bold text-brand-900 mb-1 flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-accent-500" aria-hidden="true" />
              {dict.attractions.chooseCityTitle.replace(
                "{country}",
                loc === "ar" ? country.nameAr : country.nameEn
              )}
            </h2>
            <p className="text-sm font-semibold text-brand-700 ms-3">
              🏙️ {cityCountLabel(cities.length, dict.attractions)}
            </p>
            <p className="text-sm text-gray-500 mb-4 ms-3">{dict.attractions.chooseCitySubtitle}</p>
            {/* The cards show at once; each city's place count follows when
                its places arrive, so the page never waits on them. */}
            <Suspense fallback={<CityGallery cities={cityCards} hrefBase={`/${loc}/attractions/${country.code}`} />}>
              <CityGalleryWithCounts cards={cityCards} locale={loc} hrefBase={`/${loc}/attractions/${country.code}`} />
            </Suspense>
          </section>
        )}

      </div>
    </div>
  );
}

/** How long the country page waits for a city's places before showing its card without a count. */
const COUNT_BUDGET_MS = 6000;

async function CityGalleryWithCounts({
  cards,
  locale,
  hrefBase,
}: {
  cards: CityCard[];
  locale: Locale;
  hrefBase: string;
}) {
  const dict = getDictionary(locale);
  // How many places each city's page lists — the same query that page runs
  // (cached a week), so the two numbers agree. A city whose places are not
  // back within the budget, or could not be fetched, just shows no count.
  const counts = await Promise.all(
    cards.map((c) =>
      Promise.race([
        fetchPlacesAroundCities([{ slug: c.slug, nameEn: c.name }], { locale }).then((p) => p.length),
        new Promise<number>((resolve) => setTimeout(() => resolve(0), COUNT_BUDGET_MS)),
      ]).catch(() => 0)
    )
  );
  const withCounts = cards.map((c, i) => ({
    ...c,
    subtitle: counts[i] ? `📍 ${placeCountLabel(counts[i], dict.attractions)}` : undefined,
  }));
  return <CityGallery cities={withCounts} hrefBase={hrefBase} />;
}
