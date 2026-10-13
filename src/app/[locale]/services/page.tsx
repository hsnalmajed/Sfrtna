import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import { pageMetadata } from "@/lib/seo";
import type { Locale } from "@/lib/types";
import { findCountry } from "@/lib/countries";
import { findCity } from "@/lib/cities";
import PageHero from "@/components/ui/PageHero";
import { sectionHero } from "@/lib/sectionHero";
import TripServices from "@/components/TripServices";
import ServicesFinder from "@/components/ServicesFinder";

// Travel tools → «خدمات رحلتك» (owner's section 6): pick a city or type a
// country, and every partner for each need there — tours and tickets, mobile
// data, airport transfer, car rental, luggage storage — the same panel the
// city pages and flight results show. `?code=TR&city=istanbul` opens a city.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/services">): Promise<Metadata> {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  return pageMetadata({ locale: loc, path: "/services", title: dict.services.title, description: dict.services.subtitle });
}

export default async function ServicesPage({ params, searchParams }: PageProps<"/[locale]/services">) {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  const sp = await searchParams;
  const code = typeof sp.code === "string" ? sp.code : "";
  const slug = typeof sp.city === "string" ? sp.city : "";
  const country = code ? findCountry(code) : undefined;
  const city = country && slug ? findCity(country.code, slug) : undefined;
  const hero = await sectionHero("attractions", loc);
  const cityName = city ? (loc === "ar" ? city.nameAr : city.nameEn) : "";

  return (
    <div>
      <PageHero {...hero} size="sm" align="center" title={dict.services.title} subtitle={dict.services.subtitle} />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <ServicesFinder locale={loc} initial={cityName} placeholder={dict.services.placeholder} label={dict.services.label} />
        {country && city ? (
          <div className="mt-8">
            <TripServices
              locale={loc}
              countryCode={country.code}
              citySlug={city.slug}
              cityName={cityName}
              cityNameEn={city.nameEn}
              t={dict.attractions}
            />
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-navy-600">{dict.services.hint}</p>
        )}
      </div>
    </div>
  );
}
