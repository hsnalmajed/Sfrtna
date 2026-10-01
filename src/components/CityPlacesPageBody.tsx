import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import { findCountry } from "@/lib/countries";
import { findCity } from "@/lib/cities";
import { fetchCityOverviews, fetchPlacesAroundCities } from "@/lib/mapPins";
import { fetchCityHighlights } from "@/lib/guideHighlights";
import { countLabel, flightHoursFromRiyadh, monthRanges, placeCountLabel } from "@/lib/format";
import { monthName } from "@/lib/seasons";
import { bestMonths } from "@/lib/travelSeason/site";
import { CITY_COORDS } from "@/data/cityCoords";
import CountryQuickFacts, { type QuickFact } from "@/components/CountryQuickFacts";
import { BOOKING_SHORT_LABELS } from "@/lib/countryGuides";
import { fetchCitiesForCountry, fetchToursForCity } from "@/lib/viator";
import { type PlaceListItem } from "@/components/CityPlacesExplorer";
import CityPlacesView, { type CityView } from "@/components/CityPlacesView";
import TourCard from "@/components/TourCard";
import PageHero from "@/components/ui/PageHero";
import SectionHeading from "@/components/ui/SectionHeading";

/**
 * Only a relative path on this site is allowed back.
 *
 * `back` arrives in the query string, which anyone can write, so it is checked
 * rather than trusted: one leading slash and no second one rules out
 * "//evil.example" and every absolute URL.
 */
function safeBackHref(raw: string | string[] | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  if (!raw.startsWith("/") || raw.startsWith("//")) return undefined;
  return raw;
}

/**
 * A city's places — the list and the map on one page (see CityPlacesView).
 * Rendered by /attractions/<code>/<city> (list first) and by the older
 * /maps/<code>/<city> address (map first), so no link to either breaks.
 */
export default async function CityPlacesPageBody({
  loc,
  code,
  city,
  back,
  initialView,
}: {
  loc: Locale;
  code: string;
  city: string;
  back: string | string[] | undefined;
  initialView: CityView;
}) {
  const dict = getDictionary(loc);

  // Someone who arrived from their own search is mid-decision, and this page
  // is about their destination — so the way back to their results comes with
  // them, and nothing about the page itself changes for anyone else.
  const backToResults = safeBackHref(back);

  const country = findCountry(code);
  if (!country) notFound();

  const cityEntry = findCity(country.code, city);
  if (!cityEntry) notFound();

  const [places, overviews, viatorCities, highlights] = await Promise.all([
    fetchPlacesAroundCities([cityEntry], { locale: loc }),
    fetchCityOverviews([cityEntry]),
    // Empty (and instant) with no Viator key configured, so the guide below
    // stands on its own until one is added.
    fetchCitiesForCountry(country.code),
    // The country's hand-checked landmarks that actually sit in this city —
    // see guideHighlights.ts for why they now live here rather than a level up.
    fetchCityHighlights(country.code, cityEntry),
  ]);

  // A stored place and a curated landmark are the same thing when their
  // English names match, or when they stand within 150 m of each other —
  // OpenStreetMap often names a place in the local language.
  const near = (aLat: number, aLon: number, bLat: number, bLon: number) =>
    Math.abs(aLat - bLat) < 0.0015 && Math.abs(aLon - bLon) < 0.0015;
  const highlightFor = (p: { nameEn: string; lat: number; lon: number }) =>
    highlights.find(
      (h) =>
        h.landmark.nameEn.toLowerCase() === p.nameEn.toLowerCase() ||
        near(h.lat, h.lon, p.lat, p.lon)
    );

  // Viator names its destinations in English, same as our `nameEn`, so an
  // exact case-insensitive match is a safe join. Anything short of an exact
  // match is left unmatched rather than guessed — showing Ankara's tours on
  // Istanbul's page would be worse than showing none.
  const viatorCity = viatorCities.find(
    (c) => c.name.trim().toLowerCase() === cityEntry.nameEn.trim().toLowerCase()
  );
  const tours = viatorCity
    ? (await fetchToursForCity(viatorCity.id, { count: 12, currency: "USD" })).tours
    : [];

  const covered = new Set<string>();
  const items: PlaceListItem[] = places.map((p) => {
    const hit = highlightFor(p);
    if (hit) covered.add(hit.landmark.nameEn);
    return {
      key: p.id,
      // Our own hand-written name wins for a curated landmark: it is checked,
      // and it is in the reader's language.
      name: hit ? (loc === "ar" ? hit.landmark.nameAr : hit.landmark.nameEn) : p.name,
      description: p.description,
      photo: hit?.photo,
      category: p.category,
      lat: p.lat,
      lon: p.lon,
      englishOnly: hit ? false : p.englishOnly,
      bookingLabel: hit ? BOOKING_SHORT_LABELS[hit.landmark.booking][loc] : undefined,
    };
  });

  // A curated landmark the stored places don't include still belongs on its
  // city's page — Diriyah is fifteen kilometres out of Riyadh and every
  // traveller calls it Riyadh's.
  for (const h of highlights) {
    if (covered.has(h.landmark.nameEn)) continue;
    items.push({
      key: `guide-${h.landmark.nameEn}`,
      name: loc === "ar" ? h.landmark.nameAr : h.landmark.nameEn,
      photo: h.photo,
      category: "historic",
      lat: h.lat,
      lon: h.lon,
      // The names here are our own, written in both languages.
      englishOnly: false,
      bookingLabel: BOOKING_SHORT_LABELS[h.landmark.booking][loc],
    });
  }

  // The curated landmarks first, in each category. They are the ones somebody
  // checked by hand, and they are what a visitor came to this city for — they
  // should not be on page three of an alphabet of three hundred places.
  items.sort((a, b) => Number(Boolean(b.bookingLabel)) - Number(Boolean(a.bookingLabel)));

  const cityName = loc === "ar" ? cityEntry.nameAr : cityEntry.nameEn;

  // What depends on the city rather than the country: when to go there, how
  // long the flight from Riyadh is, and how much there is to see.
  const facts: QuickFact[] = [];
  const best = bestMonths(cityEntry.slug);
  if (best.length) {
    facts.push({
      icon: "🗓️",
      label: dict.attractions.factBestMonths,
      value: monthRanges(best, (m) => monthName(m, loc), loc),
      href: `/${loc}/seasons?city=${cityEntry.slug}`,
    });
  }
  const point = CITY_COORDS[cityEntry.slug];
  const hours = point ? flightHoursFromRiyadh(point) : undefined;
  if (hours) {
    facts.push({
      icon: "✈️",
      label: dict.attractions.factFlightTime,
      value: countLabel(hours, {
        one: dict.attractions.factFlightOne,
        two: dict.attractions.factFlightTwo,
        few: dict.attractions.factFlightFew,
        many: dict.attractions.factFlightMany,
      }),
    });
  }
  if (items.length) {
    facts.push({ icon: "📍", label: dict.attractions.factPlaces, value: placeCountLabel(items.length, dict.attractions) });
  }

  return (
    <div>
      <PageHero
        photo={overviews.get(cityEntry.slug)?.photoLarge}
        size="sm"
        eyebrow={loc === "ar" ? country.nameAr : country.nameEn}
        title={dict.attractions.cityPlacesTitle.replace("{city}", cityName)}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Their own results first, when that is where they came from. */}
          {backToResults && (
            <Link
              href={backToResults}
              className="inline-flex w-fit items-center gap-1.5 rounded-full bg-sun-400 px-3.5 py-2 text-sm font-bold text-navy-950 shadow-sm transition hover:bg-sun-300"
            >
              <span aria-hidden="true">{loc === "ar" ? "→" : "←"}</span>
              {dict.itinerary.backToResults}
            </Link>
          )}
          <Link
            href={`/${loc}/attractions/${country.code}`}
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/20"
          >
            <span aria-hidden="true">{loc === "ar" ? "→" : "←"}</span>
            {dict.attractions.backToCities}
          </Link>
        </div>
      </PageHero>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <CountryQuickFacts locale={loc} facts={facts} heading={dict.attractions.quickFactsHeading} />
        {tours.length > 0 && (
          <section className="mb-10">
            <SectionHeading title={dict.attractions.toursHeading} />
            <div className="flex flex-col gap-4">
              {tours.map((tour) => (
                <TourCard key={tour.code} tour={tour} locale={loc} dict={dict.attractions} />
              ))}
            </div>
            <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-gray-500">
              {dict.attractions.contentSourceNote}
            </p>
          </section>
        )}

        {items.length === 0 ? (
          <p className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-5 text-sm text-amber-800 leading-relaxed">
            {dict.attractions.noPlacesInCity}
          </p>
        ) : (
          <>
            <CityPlacesView
              locale={loc}
              initialView={initialView}
              places={items}
              countryCode={country.code}
              citySlug={cityEntry.slug}
              cityName={cityName}
              countryName={loc === "ar" ? country.nameAr : country.nameEn}
              mapTitle={dict.maps.cityMapTitle.replace("{city}", cityName)}
              fileBase={`Sfrtna-${cityEntry.nameEn}-map`}
              plannerDict={{
                attractionsHeading: dict.attractions.attractionsHeading,
                activitiesHeading: dict.attractions.activitiesHeading,
                cuisineHeading: dict.attractions.cuisineHeading,
                otherHeading: dict.attractions.otherHeading,
                placesCount: dict.attractions.placesCount,
                emptyCategory: dict.attractions.emptyCategory,
                englishOnly: dict.attractions.englishOnly,
                directions: dict.maps.directions,
                loadMore: dict.attractions.loadMore,
                searchPlaceholder: dict.attractions.placeSearchPlaceholder,
              }}
              mapDict={{
                activitiesHeading: dict.maps.legendCityActivity,
                nearbyHeading: dict.maps.nearbyHeading,
                foodHeading: dict.maps.foodHeading,
                historicHeading: dict.maps.historicHeading,
                directions: dict.maps.directions,
                englishOnly: dict.maps.englishOnly,
                viewTours: dict.attractions.backToPlaces,
                mapAttribution: dict.maps.mapAttribution,
                legendHistoric: dict.maps.legendHistoric,
                legendFood: dict.maps.legendFood,
                legendCityActivity: dict.maps.legendCityActivity,
                legendPlace: dict.maps.legendPlace,
                placeSearchPlaceholder: dict.maps.placeSearchPlaceholder,
                nearMe: dict.maps.nearMe,
                nearMeDenied: dict.maps.nearMeDenied,
                showAll: dict.maps.showAll,
                hideAll: dict.maps.hideAll,
                noMatches: dict.maps.noMatches,
                placesCount: dict.attractions.placesCount,
                placeOne: dict.attractions.placeOne,
                placeTwo: dict.attractions.placeTwo,
                placeFew: dict.attractions.placeFew,
                listHeading: dict.maps.listHeading,
              }}
              downloadsDict={{
                downloadHeading: dict.maps.downloadHeading,
                downloadHint: dict.maps.downloadHint,
                downloadGpx: dict.maps.downloadGpx,
                downloadGpxHint: dict.maps.downloadGpxHint,
                downloadKml: dict.maps.downloadKml,
                downloadKmlHint: dict.maps.downloadKmlHint,
                legendHistoric: dict.maps.legendHistoric,
                legendFood: dict.maps.legendFood,
                legendCityActivity: dict.maps.legendCityActivity,
                legendPlace: dict.maps.legendPlace,
              }}
              labels={{
                viewList: dict.attractions.viewList,
                viewMap: dict.attractions.viewMap,
                showOnMap: dict.attractions.showOnMap,
                downloadAll: dict.attractions.downloadAll,
              }}
            />

            <p className="mt-6 rounded-lg bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-gray-500">
              {dict.attractions.source}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
