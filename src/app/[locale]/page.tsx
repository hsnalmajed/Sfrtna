import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import { COUNTRY_GUIDES } from "@/lib/countryGuides";
import { COUNTRY_CITIES } from "@/lib/cities";
import { findCountry } from "@/lib/countries";
import { fetchCityPhotos } from "@/lib/countryPhotos";
import { citiesInSeason, varietyFirst } from "@/lib/citySeasons";
import { CITY_AIRPORTS } from "@/data/cityAirports";
import { heroImage as heroImageOf, heroPhotoForToday } from "@/lib/heroPhotos";
import { monthName } from "@/lib/seasons";
import HomeShowcase, { type ShowcaseCity } from "@/components/HomeShowcase";
import { planFromParams } from "@/lib/planEvents";
import Photo from "@/components/Photo";
import { brandJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function HomePage({ params, searchParams }: PageProps<"/[locale]">) {
  const { locale } = await params;
  // Arriving from "edit search" or a city's flight button opens the booking
  // tab on the right search — see planFromParams.
  const query = await searchParams;
  const initialPlan = planFromParams((k) => {
    const v = query[k];
    return Array.isArray(v) ? v[0] : v;
  });
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  const isAr = loc === "ar";

  const guideCodes = Object.keys(COUNTRY_GUIDES);
  const cityCount = guideCodes.reduce((n, code) => n + (COUNTRY_CITIES[code]?.length ?? 0), 0);

  // This month, and the cities whose own measured weather is at its best in
  // it — see citySeasons.ts for the rule and the source. Cities, not
  // countries: a season belongs to a place, and Antalya's October is not
  // Istanbul's. Ordered so the first six come from six countries.
  const month = new Date().getMonth() + 1;
  const inSeasonCities = citiesInSeason(month);
  const seasonOrder = varietyFirst(inSeasonCities, inSeasonCities.length);

  // A different corner of the world each day — see heroPhotos.ts for the
  // brief these are chosen against.
  const heroPick = heroPhotoForToday();
  const cityPhotos = await fetchCityPhotos(seasonOrder);
  const heroImage = heroImageOf(heroPick);
  const heroPhoto = heroImage.url;
  const nameOf = (code: string) => {
    const c = findCountry(code);
    return c ? (isAr ? c.nameAr : c.nameEn) : code;
  };

  const seasonCities: ShowcaseCity[] = seasonOrder.map((c) => {
    const airport = CITY_AIRPORTS[c.slug];
    return {
      code: c.code,
      slug: c.slug,
      name: isAr ? c.nameAr : c.nameEn,
      countryName: nameOf(c.code),
      photo: cityPhotos.get(`${c.code}/${c.slug}`),
      high: c.high,
      rainyDays: c.rainyDays,
      flightHref: airport
        ? `/${loc}?${new URLSearchParams({ product: "flights", mode: "known", destination: airport.iata })}#plan`
        : undefined,
      flightAirport: airport?.iata,
      flightKm: airport?.km ?? undefined,
    };
  });

  const stats = [
    { value: String(guideCodes.length), label: dict.home.statCountries },
    { value: String(cityCount), label: dict.home.statCities },
    { value: "6", label: dict.home.statContinents },
  ];

  const tools = [
    { href: `/${loc}/attractions`, icon: "🏛", title: dict.home.toolAttractions, body: dict.home.toolAttractionsBody },
    { href: `/${loc}/maps`, icon: "🗺", title: dict.home.toolMaps, body: dict.home.toolMapsBody },
    { href: `/${loc}/visa`, icon: "🛂", title: dict.home.toolVisa, body: dict.home.toolVisaBody },
    { href: `/${loc}/currency`, icon: "💱", title: dict.home.toolCurrency, body: dict.home.toolCurrencyBody },
  ];


  const steps = [
    { n: "1", title: dict.home.step1Title, body: dict.home.step1Body },
    { n: "2", title: dict.home.step2Title, body: dict.home.step2Body },
    { n: "3", title: dict.home.step3Title, body: dict.home.step3Body },
  ];

  return (
    // Dark to the footer. The light band that used to sit under the showcase
    // was the FAQ's background; with the FAQ gone it was only empty white
    // between two navy blocks. -mb-20 covers the footer's own top margin.
    <div className="-mb-20 bg-navy-990 pb-20">
      {/* The site's name and every spelling of it, for search engines. Only
          on the homepage, which is where Google reads it from — see seo.ts. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(brandJsonLd(loc)) }}
      />
      {/* ── Hero ─────────────────────────────────────────────────────────
          The photograph and the planner, together.

          The photograph is its own fixed slab, pinned to the top of the
          section, and the content flows over it. It used to be stretched to
          whatever height the section happened to be — and the section's
          height is the planner's height, which changes every time someone
          switches to "hotels only" or opens the extra options. So the picture
          silently re-cropped on every click: it looked like the background
          was zooming in and out under the form. A fixed slab cannot do that.

          The content is no longer vertically centred either. Centring inside
          a box whose height is set by that same content means a tall form
          pushes the headline up underneath the fixed header. It starts below
          the header and grows downwards, where there is room. */}
      <section className="relative isolate overflow-hidden bg-navy-990 pb-28 sm:pb-32">
        <div className="absolute inset-x-0 top-0 -z-10 h-[46rem] overflow-hidden">
          <Photo
            src={heroPhoto}
            priority
            srcSet={heroImage.srcSet}
            sizes="100vw"
            className="h-full w-full object-cover"
            fallback={
              <div className="h-full w-full bg-[radial-gradient(130%_100%_at_60%_0%,var(--navy-700),var(--navy-990))]" />
            }
          />
          <div className="scrim-soft absolute inset-0" />
          {/* A dark halo behind the headline. Bright photographs — a pale
              sky, a white town — left the white and gold words almost
              invisible; this keeps them readable on any picture of the day
              without darkening the whole photograph. */}
          <div className="absolute inset-0 bg-[radial-gradient(75%_48%_at_50%_30%,rgb(4_24_47/0.62),rgb(4_24_47/0.25)_60%,transparent)]" />
          {/* The picture ends; the page keeps going. Without this the slab
              would cut off in a hard line across the middle of the form. */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-navy-990" />
          {/* Pexels asks that the photographer be named where it fits — on
              the picture itself, which is where it stays put now that the
              section is taller than the photograph. Plain text, not a link:
              this sits in the photograph's own layer, behind the form, so a
              link here would look clickable without being reachable. The
              footer carries the link to Pexels. */}
          <p className="absolute bottom-2 end-3 text-2xs text-white/45">
            {dict.hero.photoCredit
              .replace("{place}", isAr ? heroPick.placeAr : heroPick.placeEn)
              .replace("{artist}", heroPick.photographer)}
          </p>
        </div>

        {/* Centred, because the panel is the point.
            Left-aligned, the headline ran along one edge and the search
            panel — narrower than the page — sat under it off to one side,
            so the first thing the eye met was a column of empty photograph.
            A hero whose whole reason for existing is one panel puts that
            panel in the middle of the window. */}
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center px-4 pt-28 text-center sm:px-6">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-navy-990/60 px-3.5 py-1.5 text-2xs font-bold tracking-wide text-sun-300 ring-1 ring-white/25 backdrop-blur-md">
            ✈️ {dict.hero.badge}
          </p>

          <h1 className="max-w-3xl font-display text-h1 font-black text-white drop-shadow-[0_2px_14px_rgba(4,24,47,0.85)]">
            {dict.hero.titleLine1}
            <br />
            <span className="text-sun-400">{dict.hero.titleLine2}</span>
          </h1>

          <p className="mt-3 max-w-xl text-sm font-medium text-white drop-shadow-[0_1px_8px_rgba(4,24,47,0.95)] sm:text-base">
            {dict.hero.subtitle}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {stats.map((s) => (
              <p key={s.label} className="text-sm font-semibold text-white/90 drop-shadow-[0_1px_8px_rgba(4,24,47,0.9)]">
                <span className="font-display text-xl font-black text-sun-400">{s.value}</span>{" "}
                {s.label}
              </p>
            ))}
          </div>
        </div>

      </section>

      {/* ── What the site is ────────────────────────────────────────────
          Four sections of the old page, now four tabs in one panel that
          straddles the seam below the photograph. See HomeShowcase. */}
      <section className="relative z-10 -mt-20 bg-[radial-gradient(60rem_24rem_at_50%_0%,rgb(255_255_255/0.04),transparent)] pb-6 sm:-mt-24 sm:pb-8">
        <HomeShowcase
          locale={loc}
          seasonCities={seasonCities}
          initialPlan={initialPlan}
          tools={tools}
          steps={steps}
          dict={{
            tabSeason: dict.home.tabSeason,
            tabTools: dict.home.tabTools,
            tabHow: dict.home.tabHow,
            tabPlan: dict.home.tabPlan,
            planSubtitle: dict.home.planSubtitle,
            flightsTitle: dict.productSelect.flightsTitle,
            flightsHint: dict.productSelect.flightsHint,
            hotelsTitle: dict.productSelect.hotelsTitle,
            hotelsHint: dict.productSelect.hotelsHint,
            seasonTitle: dict.home.seasonTitle.replace("{month}", monthName(month, loc)),
            seasonSubtitle: dict.home.seasonSubtitle,
            seasonCta: dict.home.seasonCta,
            seasonAllCities: dict.home.seasonAllCities.replace("{month}", monthName(month, loc)),
            seasonFewerCities: dict.home.seasonFewerCities,
            seasonCityWeather: dict.home.seasonCityWeather,
            seasonFlight: dict.home.seasonFlight,
            seasonFlightTitle: dict.home.seasonFlightTitle,
            seasonHigh: dict.home.seasonHigh,
            seasonRainNone: dict.home.seasonRainNone,
            seasonRainOne: dict.home.seasonRainOne,
            seasonRainTwo: dict.home.seasonRainTwo,
            seasonRainFew: dict.home.seasonRainFew,
            seasonRainMany: dict.home.seasonRainMany,
            seasonMethod: dict.home.seasonMethod,
            toolsSubtitle: dict.home.toolsSubtitle,
            toolCta: dict.home.toolCta,
            stepsTitle: dict.home.stepsTitle,
          }}
        />
      </section>
    </div>
  );
}
