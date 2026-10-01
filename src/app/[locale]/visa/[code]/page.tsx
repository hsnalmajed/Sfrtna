import VisaBadge from "@/components/VisaBadge";
import { VISA_CHECKED_AT, visaStatusFor } from "@/data/visaStatus";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import { findCountry } from "@/lib/countries";
import { flagImageUrl } from "@/lib/visaProviders";
import { fetchCountryPhotos } from "@/lib/countryPhotos";
import VisaWarning from "@/components/VisaWarning";
import VisaOfficialLinks from "@/components/VisaOfficialLinks";
import PageHero from "@/components/ui/PageHero";
import BackLink from "@/components/BackLink";

export const dynamic = "force-dynamic";

// One country, and where to go to find out about entering it.
//
// We state no visa status here — see visaProviders.ts for why. The page is
// the warning, then the official links (IATA, the Saudi foreign ministry, the
// country's own portal where we have a verified one), then a typical
// checklist in the two cases where we know which one applies.
export default async function VisaCountryPage({ params }: PageProps<"/[locale]/visa/[code]">) {
  const { locale, code } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);

  const country = findCountry(code);
  if (!country) notFound();

  // Full resolution: this one photo is a full-width hero, not a card.
  const photos = await fetchCountryPhotos([country.code], { full: true });
  const countryName = loc === "ar" ? country.nameAr : country.nameEn;
  const status = visaStatusFor(country.code);

  return (
    <div>
      <PageHero
        photo={photos.get(country.code)}
        size="sm"
        eyebrow={dict.visa.title}
        title={dict.visa.headingForCountry.replace("{country}", countryName)}
      >
        <div className="flex flex-wrap items-center gap-3">
          <BackLink
            href={`/${loc}/visa`}
            label={dict.visa.backToVisa}
            backLabel={dict.back}
            arrow={loc === "ar" ? "→" : "←"}
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/20"
          />
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-md ring-2 ring-white/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={flagImageUrl(country.code)} alt="" className="h-full w-full object-cover" />
          </span>
        </div>
      </PageHero>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <VisaWarning
          dict={{
            warningTitle: dict.visa.warningTitle,
            warningBody: dict.visa.warningBody,
            checkIata: dict.visa.checkIata,
            checkMofa: dict.visa.checkMofa,
          }}
          scope={dict.visa.onlySaudi}
          showLinks={false}
        />

        {/* The status, when we confirmed it from the country's official
            source — with that source and the day it was read, so the claim
            can be checked rather than trusted. */}
        {status && (
          <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="mb-3 text-sm font-extrabold text-navy-900">
              {dict.visa.statusHeading.replace("{country}", countryName)}
            </p>
            <VisaBadge
              category={status.category}
              label={
                {
                  free: dict.visa.statusFree,
                  arrival: dict.visa.statusArrival,
                  eta: dict.visa.statusEta,
                  required: dict.visa.statusRequired,
                }[status.category]
              }
              className="text-sm"
            />
            {status.until && (
              <p className="mt-3 text-sm font-semibold text-navy-800">
                {dict.visa.statusUntil.replace("{date}", status.until)}
              </p>
            )}
            <p className="mt-3 text-xs leading-relaxed text-navy-500">
              <a
                href={status.source}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-sea-600 underline-offset-2 hover:underline"
              >
                {dict.visa.statusSource} ↗
              </a>
              {" · "}
              {dict.visa.statusChecked.replace("{date}", VISA_CHECKED_AT)}
            </p>
          </section>
        )}

        <div className="mt-6">
          <VisaOfficialLinks countryCode={country.code} locale={loc} />
        </div>
      </div>
    </div>
  );
}
