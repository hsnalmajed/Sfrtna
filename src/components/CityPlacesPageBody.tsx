import { readGuide } from "@/lib/guide";
import { guidePlanReady } from "@/lib/guidePlan";
import { readGallery } from "@/lib/gallery";
import { readableHours, type Group } from "@/lib/guideTypes";
import type { PinCategory } from "@/lib/pinStyles";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import { findCountry } from "@/lib/countries";
import { findCity } from "@/lib/cities";
import { fetchCityOverviews, fetchPlacesAroundCities, readStoredRestaurants } from "@/lib/mapPins";
import { fetchCityHighlights } from "@/lib/guideHighlights";
import { countLabel, monthRanges, placeCountLabel } from "@/lib/format";
import { flightHoursBetween } from "@/lib/originInfo";
import { userOrigin } from "@/lib/origin";
import { CITY_AIRPORTS } from "@/data/cityAirports";
import { monthName } from "@/lib/seasons";
import { bestMonths } from "@/lib/travelSeason/site";
import { CITY_COORDS } from "@/data/cityCoords";
import CountryQuickFacts, { type QuickFact } from "@/components/CountryQuickFacts";
import { BOOKING_SHORT_LABELS } from "@/lib/countryGuides";
import { type PlaceListItem } from "@/components/CityPlacesExplorer";
import TripServices from "@/components/TripServices";
import { TICKETED_KINDS } from "@/lib/activityLinks";
import CityPlacesView, { type CityView } from "@/components/CityPlacesView";
import ViatorOffers from "@/components/ViatorOffers";
import PageHero from "@/components/ui/PageHero";
import FavButton from "@/components/member/FavButton";
import BackLink from "@/components/BackLink";

/**
 * Only a relative path on this site is allowed back.
 *
 * `back` arrives in the query string, which anyone can write, so it is checked
 * rather than trusted: one leading slash and no second one rules out
 * "//evil.example" and every absolute URL.
 */
/** Our guide's groups on the page's four tabs. */
const GUIDE_CATEGORY: Record<Group, PinCategory> = {
  history: "historic",
  religion: "historic",
  museums: "historic",
  views: "historic",
  culture: "historic",
  nature: "activity",
  beach: "activity",
  family: "activity",
  shopping: "activity",
  markets: "activity",
};

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

  const [places, overviews, highlights, guide, gallery] = await Promise.all([
    fetchPlacesAroundCities([cityEntry], { locale: loc }),
    fetchCityOverviews([cityEntry]),
    // The country's hand-checked landmarks that actually sit in this city —
    // see guideHighlights.ts for why they now live here rather than a level up.
    fetchCityHighlights(country.code, cityEntry),
    // Our own guide: the places the world knows, with a write-up of ours.
    readGuide(cityEntry.slug),
    // «استعرض صور المدينة»: a small list of photo addresses; no photo is
    // loaded until the traveller opens it.
    readGallery(cityEntry.slug),
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



  // Ticket and tour buttons go on places such things are sold for: a hand-
  // checked landmark booked online, or a well-known museum, palace, site…
  // (an obscure one would only open an empty search at the partner).
  const sellsTickets = (booking: string) => booking === "official" || booking === "guide";
  // "Basilica Cistern (Exit)" is a map's note, not part of what to search for.
  const ticketQueryFor = (nameEn: string) => `${nameEn.replace(/\s*\([^)]*\)/g, "").trim()} ${cityEntry.nameEn}`;

  const covered = new Set<string>();
  const items: PlaceListItem[] = places.map((p) => {
    const hit = highlightFor(p);
    if (hit) covered.add(hit.landmark.nameEn);
    const ticketed = hit
      ? sellsTickets(hit.landmark.booking)
      : (TICKETED_KINDS.has(p.kind ?? "") && (p.fame ?? 0) >= 8) ||
        // Hagia Sophia, St Peter's, Westminster Abbey: famous enough that
        // tickets and guided tours are sold for them.
        (p.kind === "place_of_worship" && (p.fame ?? 0) >= 40);
    return {
      key: p.id,
      // Our own hand-written name wins for a curated landmark: it is checked,
      // and it is in the reader's language.
      name: hit ? (loc === "ar" ? hit.landmark.nameAr : hit.landmark.nameEn) : p.name,
      description: p.description,
      photo: hit?.photo,
      category: p.category,
      kind: p.kind,
      fame: p.fame,
      lat: p.lat,
      lon: p.lon,
      englishOnly: hit ? false : p.englishOnly,
      bookingLabel: hit ? BOOKING_SHORT_LABELS[hit.landmark.booking][loc] : undefined,
      ticketQuery: ticketed ? ticketQueryFor(hit ? hit.landmark.nameEn : p.nameEn) : undefined,
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
      ticketQuery: sellsTickets(h.landmark.booking) ? ticketQueryFor(h.landmark.nameEn) : undefined,
    });
  }

  // Our guide (scripts/guide/): the city's best-known places, ranked, with
  // our own write-up. Joined to a listed place by its map id, or by name or
  // position; a guide place the list lacks is added.
  if (guide) {
    const nameEnOf = new Map(places.map((p) => [p.id, p.nameEn]));
    const byKey = new Map(items.map((it) => [it.key, it]));
    const sameName = (a?: string, b?: string) => Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
    guide.places.forEach((g, rank) => {
      const close = (x: PlaceListItem) =>
        x.lat !== undefined && x.lon !== undefined && Math.abs(x.lat - g.y) < 0.0012 && Math.abs(x.lon - g.x) < 0.0015;
      let it =
        byKey.get(g.i) ??
        items.find(
          (x) =>
            close(x) &&
            (sameName(x.name, g.n) || sameName(x.name, g.e) || sameName(x.name, g.a) || sameName(nameEnOf.get(x.key), g.e) || (x.fame ?? 0) >= 20)
        );
      // Two items of ours on one listed place: the better known keeps it.
      if (it?.guide) return;
      const nameAr = g.a ?? g.an;
      const nameEn = g.e ?? g.n;
      if (!it) {
        it = {
          key: g.i,
          name: loc === "ar" ? (nameAr ?? nameEn) : nameEn,
          category: GUIDE_CATEGORY[g.g],
          lat: g.y,
          lon: g.x,
          englishOnly: loc === "ar" && !nameAr,
        };
        items.push(it);
        byKey.set(it.key, it);
      } else if (it.englishOnly && loc === "ar" && nameAr) {
        it.name = nameAr;
        it.englishOnly = false;
      }
      const text = loc === "ar" ? g.d : g.de;
      if (text) it.description = text;
      if (!it.ticketQuery && (g.fee === "yes" || ((g.g === "museums" || g.g === "history" || g.g === "family") && g.sl >= 15))) {
        it.ticketQuery = ticketQueryFor(nameEn);
      }
      it.guide = {
        rank,
        heritage: g.wh,
        visitorsM: g.vis && g.vis >= 1_000_000 ? Math.round(g.vis / 100_000) / 10 : undefined,
        minutes: g.m,
        best: loc === "ar" ? g.bt : g.bte,
        dress: loc === "ar" ? g.dr : g.dre,
        tip: loc === "ar" ? g.tp : g.tpe,
        hours: g.oh ? readableHours(g.oh, loc) : undefined,
        website: g.web,
        kids: g.kids,
        free: g.fee === "no",
        outside: g.out,
      };
    });
  }

  // The curated landmarks first, in each category. They are the ones somebody
  // checked by hand, and they are what a visitor came to this city for — they
  // should not be on page three of an alphabet of three hundred places.
  items.sort((a, b) => Number(Boolean(b.bookingLabel)) - Number(Boolean(a.bookingLabel)));

  const cityName = loc === "ar" ? cityEntry.nameAr : cityEntry.nameEn;
  // The plan's meals: the city's stored restaurants, best documented first.
  const restaurants = (await readStoredRestaurants(cityEntry.slug)).slice(0, 150).map((r) => ({
    name: (loc === "ar" ? r.a : r.e) || r.n,
    cuisine: r.u ? r.u.split(";")[0].replace(/_/g, " ") : undefined,
    halal: r.h === 1,
    lat: r.y,
    lon: r.x,
  }));

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
  // From the visitor's own airport (src/lib/origin.ts), not a fixed city.
  const origin = await userOrigin();
  const hours = point && origin.iata !== CITY_AIRPORTS[cityEntry.slug]?.iata ? flightHoursBetween(origin, point) : undefined;
  if (hours) {
    facts.push({
      icon: "✈️",
      label: dict.attractions.factFlightTime.replace("{origin}", loc === "ar" ? origin.cityAr : origin.cityEn),
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
          <FavButton
            locale={loc}
            tone="glass"
            fav={{ type: "city", code: country.code, slug: cityEntry.slug, nameAr: cityEntry.nameAr, nameEn: cityEntry.nameEn }}
          />
          <BackLink
            href={`/${loc}/attractions/${country.code}`}
            label={dict.attractions.backToCities}
            backLabel={dict.back}
            arrow={loc === "ar" ? "→" : "←"}
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/20"
          />
        </div>
      </PageHero>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <CountryQuickFacts locale={loc} facts={facts} heading={dict.attractions.quickFactsHeading} />
        {items.length === 0 && (
          <TripServices
            locale={loc}
            countryCode={country.code}
            citySlug={cityEntry.slug}
            cityName={cityName}
            cityNameEn={cityEntry.nameEn}
            t={dict.attractions}
          />
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
              smartReady={guidePlanReady(guide)}
              gallery={gallery}
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
                tickets: dict.attractions.ticketsAndTours,
                loadMore: dict.attractions.loadMore,
                searchPlaceholder: dict.attractions.placeSearchPlaceholder,
                guide: dict.attractions.guide,
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
                plan: dict.attractions.tabPlan,
                activities: dict.attractions.tabActivities,
                services: dict.attractions.tabServices,
              }}
              restaurants={restaurants}
              activities={
                <div>
                  {/* Viator's tours and tickets, asked for by the browser (never in the indexed HTML). */}
                  <div className="mb-6">
                    <ViatorOffers locale={loc} city={cityEntry.slug} n={12} />
                  </div>
                  <TripServices
                    locale={loc}
                    countryCode={country.code}
                    citySlug={cityEntry.slug}
                    cityName={cityName}
                    cityNameEn={cityEntry.nameEn}
                    only={["activity"]}
                    bare
                    t={dict.attractions}
                  />
                </div>
              }
              services={
                <TripServices
                  locale={loc}
                  countryCode={country.code}
                  citySlug={cityEntry.slug}
                  cityName={cityName}
                  cityNameEn={cityEntry.nameEn}
                  except={["activity"]}
                  bare
                  t={dict.attractions}
                />
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
