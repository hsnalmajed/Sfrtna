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
import Icon from "@/components/ui/Icon";
import Link from "next/link";

const POPULAR: [string, string][] = [
  ["TR", "istanbul"],
  ["AE", "dubai"],
  ["GB", "london"],
  ["FR", "paris"],
  ["EG", "cairo"],
  ["MY", "kuala-lumpur"],
  ["AZ", "baku"],
  ["GE", "tbilisi"],
];

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
      <div className="mx-auto max-w-4xl px-4 pb-10 sm:px-6">
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
          <>
            {/* Before a city is chosen: what the page offers, then the
                cities travellers look for most — one tap opens them. */}
            <h2 className="mt-8 text-center font-display text-lg font-extrabold text-navy-900">{dict.services.whatTitle}</h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(
                [
                  ["compass", dict.services.itemActivities, dict.services.itemActivitiesSub],
                  ["globe", dict.services.itemEsim, dict.services.itemEsimSub],
                  ["takeoff", dict.services.itemTransfer, dict.services.itemTransferSub],
                  ["route", dict.services.itemCar, dict.services.itemCarSub],
                  ["luggage", dict.services.itemLuggage, dict.services.itemLuggageSub],
                ] as const
              ).map(([icon, title, sub], i) => (
                <li
                  key={title}
                  className={`flex flex-col items-center rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-black/5 ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`}
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-navy-900 text-sun-400" aria-hidden="true">
                    <Icon name={icon} className="h-5 w-5" />
                  </span>
                  <span className="mt-2.5 text-sm font-extrabold text-navy-900">{title}</span>
                  <span className="mt-0.5 text-xs leading-snug text-navy-500">{sub}</span>
                </li>
              ))}
            </ul>
            <h2 className="mt-8 text-center text-sm font-extrabold text-navy-700">{dict.services.popularTitle}</h2>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {POPULAR.map(([code, slug]) => {
                const c = findCity(code, slug);
                if (!c) return null;
                return (
                  <Link
                    key={slug}
                    href={`/${loc}/services?code=${code}&city=${slug}`}
                    className="rounded-full bg-white px-4 py-2 text-sm font-bold text-navy-800 shadow-sm ring-1 ring-mist-200 transition hover:ring-sun-400"
                  >
                    {loc === "ar" ? c.nameAr : c.nameEn}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
