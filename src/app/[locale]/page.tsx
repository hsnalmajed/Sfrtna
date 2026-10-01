import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import { COUNTRY_GUIDES } from "@/lib/countryGuides";
import { COUNTRY_CITIES } from "@/lib/cities";
import { findCountry } from "@/lib/countries";
import { fetchCityPhotos } from "@/lib/countryPhotos";
import { bestForMonth, bestMonths, seasonRecord, CLASS_DOT } from "@/lib/travelSeason/site";
import { visaStatusFor } from "@/data/visaStatus";
import { currencyForCountry } from "@/lib/currencies";
import { fetchRates, rateBetween, type Rates } from "@/lib/rates";
import { cachedJson } from "@/lib/edgeCache";
import { SEASON_FARE_ORIGIN, seasonFares } from "@/lib/seasonFares";
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

  // This month's best destinations — read from the single travel-season
  // dataset the "When to travel?" page uses (src/lib/travelSeason/site.ts):
  // EXCELLENT and VERY_GOOD cities, never low-confidence ones, GOOD only when
  // too few, ranked with one country each first. No calculation here.
  const month = new Date().getMonth() + 1;
  const inSeasonCities = bestForMonth(month);

  // A different corner of the world each day — see heroPhotos.ts for the
  // brief these are chosen against.
  const heroPick = heroPhotoForToday();
  // Rates for the city summaries' "1 riyal ≈ …" line — cached for a few
  // hours, so the homepage does not spend a subrequest on them every visit.
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(month).padStart(2, "0")}`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextKey = `${month === 12 ? now.getFullYear() + 1 : now.getFullYear()}-${String(nextMonth).padStart(2, "0")}`;
  const fareMonths = isAr
    ? `${monthName(month, loc)} و${monthName(nextMonth, loc)}`
    : `${monthName(month, loc)} and ${monthName(nextMonth, loc)}`;
  // Every season card carries a real one-way fare, so the strip shows the
  // cities the fare source has seen a price for; the rest of the month's
  // cities are on the seasons page (see seasonFares.ts for why some have none).
  const fares = await seasonFares([monthKey, nextKey]);
  const fareFor = (slug: string) => {
    const iata = CITY_AIRPORTS[slug]?.iata;
    return iata && iata !== SEASON_FARE_ORIGIN ? fares[iata] : undefined;
  };
  const priced = inSeasonCities.filter((c) => fareFor(c.slug) !== undefined);
  // If the fare source is down, the strip still shows the month's cities
  // (with their weather) rather than disappearing.
  const shown = priced.length > 0 ? priced : inSeasonCities;
  const seasonOrder = shown;
  const [cityPhotos, rates] = await Promise.all([
    fetchCityPhotos(seasonOrder),
    cachedJson<Rates>("rates-usd", 6 * 3600, fetchRates),
  ]);
  const heroImage = heroImageOf(heroPick);
  const heroPhoto = heroImage.url;
  const nameOf = (code: string) => {
    const c = findCountry(code);
    return c ? (isAr ? c.nameAr : c.nameEn) : code;
  };

  // Everything the season tab's city summary says, from data the site
  // already holds and has checked: the city's own weather record, the
  // confirmed visa statuses, the currency table and the country guide.
  // Nothing here is filled in when unknown — a missing field stays missing.
  const ts = dict.travelSeasons;
  const visaNames = {
    free: dict.visa.statusFree,
    arrival: dict.visa.statusArrival,
    eta: dict.visa.statusEta,
    required: dict.visa.statusRequired,
  };
  // The card's shorter wording; the summary keeps the full one.
  const visaShort = {
    free: dict.home.cardVisaFree,
    arrival: dict.home.cardVisaArrival,
    eta: dict.home.cardVisaEta,
    required: dict.home.cardVisaRequired,
  };
  const citySummary = (code: string, slug: string) => {
    const r = seasonRecord(slug, month);
    const best = bestMonths(slug);
    const visa = visaStatusFor(code);
    const cur = currencyForCountry(code);
    const perSar = cur && rates && cur.code !== "SAR" ? rateBetween("SAR", cur.code, rates) : null;
    return {
      seasonKind: r ? `${r.seasonIcon} ${isAr ? r.seasonNameAr : r.seasonNameEn}` : undefined,
      classLabel: r?.classification ? `${CLASS_DOT[r.classification]} ${ts.classes[r.classification]}` : undefined,
      low: r?.averageLowC ?? null,
      weatherSummary: r ? ((isAr ? r.weatherSummaryAr : r.weatherSummaryEn) ?? undefined) : undefined,
      reason: r ? ((isAr ? r.reasonAr : r.reasonEn) ?? undefined) : undefined,
      bestMonths: best.map((m) => monthName(m, loc)).join(isAr ? "، " : ", "),
      visa: visa
        ? { category: visa.category, label: visaNames[visa.category], short: visaShort[visa.category] }
        : undefined,
      currency: cur
        ? {
            code: cur.code,
            name: isAr ? cur.nameAr : cur.nameEn,
            // Said the way round a traveller thinks: "1 dollar ≈ 3.75
            // riyals" for strong currencies, "1 riyal ≈ 8.8 lira" for weak.
            rateLine: perSar
              ? perSar < 1
                ? dict.home.summaryRateInverse
                    .replace("{rate}", (1 / perSar).toLocaleString("en-US", { maximumFractionDigits: 2 }))
                    .replace("{code}", cur.code)
                : dict.home.summaryRate
                    .replace("{rate}", perSar.toLocaleString("en-US", { maximumFractionDigits: 2 }))
                    .replace("{code}", cur.code)
              : undefined,
          }
        : undefined,
      landmarks: (COUNTRY_GUIDES[code]?.attractions ?? []).slice(0, 4).map((a) => (isAr ? a.nameAr : a.nameEn)),
    };
  };

  const seasonCities: ShowcaseCity[] = seasonOrder.map((c) => {
    const airport = CITY_AIRPORTS[c.slug];
    return {
      code: c.code,
      slug: c.slug,
      name: isAr ? c.nameAr : c.nameEn,
      countryName: nameOf(c.code),
      photo: cityPhotos.get(`${c.code}/${c.slug}`),
      high: c.record.averageHighC ?? 0,
      rainyDays: c.record.precipitationDays ?? 0,
      flightHref: airport
        ? `/${loc}?${new URLSearchParams({ product: "flights", mode: "known", destination: airport.iata })}#plan`
        : undefined,
      flightAirport: airport?.iata,
      flightKm: airport?.km ?? undefined,
      ...citySummary(c.code, c.slug),
      hotelCity: c.nameEn,
      fare: fareFor(c.slug),
    };
  });

  const stats = [
    { value: "6", label: dict.home.statContinents },
    { value: String(guideCodes.length), label: dict.home.statCountries },
    { value: String(cityCount), label: dict.home.statCities },
  ];

  const tools = [
    { href: `/${loc}/attractions`, icon: "🏛", title: dict.home.toolAttractions, body: dict.home.toolAttractionsBody },
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
            seasonTapHint: dict.home.seasonTapHint,
            seasonFare: dict.home.seasonFare,
            seasonFareNote: dict.home.seasonFareNote.replace("{month}", fareMonths),
            summaryFare: dict.home.summaryFare.replace("{month}", fareMonths),

            monthName: monthName(month, loc),
            summaryWeather: dict.home.summaryWeather,
            summaryBestMonths: dict.home.summaryBestMonths,
            highLow: ts.highLow,
            summaryVisa: dict.home.summaryVisa,
            summaryVisaUnknown: dict.home.summaryVisaUnknown,
            summaryVisaMore: dict.home.summaryVisaMore,
            summaryCurrency: dict.home.summaryCurrency,
            summaryLandmarks: dict.home.summaryLandmarks,
            summaryAllPlaces: dict.home.summaryAllPlaces,
            summaryMap: dict.home.summaryMap,
            summaryBook: dict.home.summaryBook,
            summaryHotels: dict.home.summaryHotels,
            summaryAirport: dict.home.summaryAirport,
            summaryClose: dict.home.summaryClose,
            summaryBackTo: dict.home.summaryBackTo,
            cardVisaUnknown: dict.home.cardVisaUnknown,
            toolsSubtitle: dict.home.toolsSubtitle,
            toolCta: dict.home.toolCta,
            stepsTitle: dict.home.stepsTitle,
          }}
        />
      </section>
    </div>
  );
}
