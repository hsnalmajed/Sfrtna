import { NextRequest, NextResponse } from "next/server";
import { resolveIata, searchFlights } from "@/lib/flights";
import { suggestRoutes, type RouteStats } from "@/lib/routeSuggest";
import { placeForDestination } from "@/lib/destinationPlace";
import { tripFaresFrom, CITY_OF_AIRPORT, type TripFare } from "@/lib/providers/travelpayouts";
import { exploreFares } from "@/lib/providers/serpapi";
import { CONTINENTS, type Continent } from "@/lib/countries";
import { discoverCandidates, type Candidate } from "@/lib/discoverPool";
import { SEASON_KINDS, type SeasonKind } from "@/lib/travelSeason/kinds";
import type {
  DestinationCategory,
  FlightOffer,
  HotelOffer,
  DestinationSuggestion,
  DiscoverParams,
  SearchParams,
  TripType,
} from "@/lib/types";

const CATEGORIES: DestinationCategory[] = ["beach", "nature", "adventure", "city", "culture", "family"];

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A trip fare (see tripFaresFrom) as the flight on a suggestion card. */
function flightFromFare(params: DiscoverParams, destination: Candidate, fare: TripFare): FlightOffer {
  const origin = resolveIata(params.origin);
  const paying = Math.max(1, params.adults + (params.childrenAges?.length ?? 0));
  return {
    id: `trip-${destination.code}-${params.departDate}`,
    airline: fare.airline,
    airlineCode: "",
    origin,
    destination: destination.code,
    departTime: params.departDate,
    arriveTime: params.departDate,
    durationMinutes: 0,
    stops: fare.transfers ?? 0,
    stopsKnown: fare.transfers !== null,
    price: fare.price * paying,
    pricePerPerson: fare.price,
    currency: params.currency.toUpperCase(),
    isMock: false,
    bookingHint: "Aviasales",
    layoverCity: null,
    layoverDurationMinutes: null,
    baggageIncluded: false,
    priceOnly: true,
    nearDays: fare.off,
  };
}

async function suggestForDestination(
  params: DiscoverParams,
  destination: Candidate,
  nights: number,
  fares: Map<string, TripFare> | null
): Promise<DestinationSuggestion | "no-fare" | null> {
  const searchParams: SearchParams = {
    tripType: params.tripType,
    origin: params.origin,
    destination: destination.code,
    departDate: params.departDate,
    // A one-way discover search prices only the outbound flight — the
    // hotel stay length still comes from `nights` (entered directly by the
    // user when there's no return date to derive it from).
    returnDate: params.oneWayOnly ? undefined : params.returnDate || addDays(params.departDate, nights),
    adults: params.adults,
    budgetTotal: params.budgetTotal,
    currency: params.currency,
    directFlightsOnly: params.directFlightsOnly,
    minHotelStars: params.minHotelStars,
    baggageIncluded: params.baggageIncluded,
    breakfastIncluded: params.breakfastIncluded,
    childrenAges: params.childrenAges,
    infants: params.infants,
    roomType: params.roomType,
  };

  // Only the sides the user actually asked to budget for are searched —
  // "hotels only" shouldn't require a matching flight to exist, and vice versa.
  const wantsFlight = params.tripType !== "hotel";
  const wantsHotel = params.tripType !== "flight";

  // With a live fare source, flights are priced from the fares seen for the
  // trip's own dates (one request for every city, see tripFaresFrom);
  // without one (local development) the sample search stands in.
  const fare = fares?.get(destination.code) ?? fares?.get(CITY_OF_AIRPORT[destination.code] ?? "");
  if (fares && params.directFlightsOnly && fare && fare.transfers !== 0) return "no-fare";
  const [flights, hotels] = await Promise.all([
    wantsFlight
      ? fares
        ? Promise.resolve(fare ? [flightFromFare(params, destination, fare)] : [])
        : searchFlights(searchParams)
      : Promise.resolve([]),
    // No source prices hotels for a whole list of cities (Hotellook, which
    // did, closed in Oct 2025); hotels are priced per city on the hotel search.
    Promise.resolve([] as HotelOffer[]),
  ]);

  const flight = flights[0];
  const hotel = hotels[0];
  if (wantsFlight && !flight) return "no-fare";
  // No live hotel price source answers for the whole list of cities (hotels
  // are priced live, per city, on the hotel search). So a missing hotel
  // must not drop the city: "flight + hotel" is chosen on the flight and
  // the hotel is checked on the city's own search, and "hotel only" lists
  // the cities in season without a price — never "no results" for every
  // destination because one side has no list price.
  if (wantsHotel && !hotel && !wantsFlight) return "no-fare";

  const totalPrice = (flight?.price ?? 0) + (hotel?.totalPrice ?? 0);
  return {
    place: placeForDestination(destination.code, destination.nameEn, Number(params.departDate.slice(5, 7))),
    destinationCode: destination.code,
    destinationNameAr: destination.nameAr,
    destinationNameEn: destination.nameEn,
    emoji: destination.emoji,
    flight,
    hotel,
    nights,
    totalPrice,
    currency: params.currency,
    withinBudget: totalPrice <= params.budgetTotal,
    remainingBudget: params.budgetTotal - totalPrice,
    continent: destination.continent,
    categories: destination.categories,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const params: DiscoverParams = {
    origin: body.origin || "",
    tripType: (body.tripType as TripType) || "both",
    budgetTotal: Number(body.budgetTotal || 0),
    currency: body.currency || "SAR",
    departDate: body.departDate || "",
    returnDate: body.returnDate || "",
    nights: Math.min(Math.max(1, Number(body.nights || 5)), 21),
    adults: Math.max(1, Number(body.adults || 1)),
    directFlightsOnly: Boolean(body.directFlightsOnly),
    minHotelStars: Number(body.minHotelStars || 0),
    multiDestination: Boolean(body.multiDestination),
    oneWayOnly: Boolean(body.oneWayOnly),
    baggageIncluded: Boolean(body.baggageIncluded),
    breakfastIncluded: Boolean(body.breakfastIncluded),
    childrenAges: Array.isArray(body.childrenAges) ? body.childrenAges.map(Number).filter(Number.isFinite) : [],
    infants: Number(body.infants || 0),
    roomType: body.roomType || undefined,
    // Any number of kinds of place (owner, 20 Oct); old links sent one.
    preferenceCategories: (Array.isArray(body.preferenceCategories)
      ? body.preferenceCategories
      : String(body.preferenceCategory || "").split(",")
    ).filter((c: unknown): c is DestinationCategory => CATEGORIES.includes(c as DestinationCategory)),
    continents: Array.isArray(body.continents)
      ? body.continents.filter((c: unknown): c is Continent => CONTINENTS.includes(c as Continent))
      : [],
    seasonKinds: (Array.isArray(body.seasonKinds) ? body.seasonKinds : String(body.seasonKinds || "").split(",")).filter(
      (k: unknown): k is SeasonKind => (SEASON_KINDS as readonly string[]).includes(k as string)
    ),
  };

  if (!params.origin || !params.departDate || !params.budgetTotal) {
    return NextResponse.json({ error: "Missing required params" }, { status: 400 });
  }

  const pool = discoverCandidates().filter(
    (d) =>
      d.code !== resolveIata(params.origin) &&
      (!params.preferenceCategories?.length || d.categories.some((c) => params.preferenceCategories!.includes(c))) &&
      (!params.continents?.length || (d.continent !== undefined && params.continents.includes(d.continent))) &&
      (!params.seasonKinds?.length ||
        (placeForDestination(d.code, d.nameEn, Number(params.departDate.slice(5, 7)))?.seasonKinds ?? []).some((k) => params.seasonKinds!.includes(k)))
  );

  if (!params.multiDestination) {
    const returnDate = params.oneWayOnly ? undefined : params.returnDate || addDays(params.departDate, params.nights);
    const home = resolveIata(params.origin);
    const paying = Math.max(1, params.adults + (params.childrenAges?.length ?? 0));
    const wantsFlight = params.tripType !== "hotel";
    const [partnerFares, googleFares] = await Promise.all([
      wantsFlight && process.env.TRAVELPAYOUTS_TOKEN
        ? tripFaresFrom(home, params.departDate, returnDate, params.currency)
        : Promise.resolve(null),
      // Every place priced for these exact dates and this party — so places
      // the partner's data has no fare for still get a price (owner, 20 Oct:
      // every destination within the budget, the traveller filters).
      wantsFlight
        ? exploreFares({
            origin: home,
            departDate: params.departDate,
            returnDate,
            adults: params.adults,
            children: params.childrenAges?.length ?? 0,
            infants: params.infants ?? 0,
            currency: params.currency.toUpperCase(),
            directOnly: params.directFlightsOnly,
          })
        : Promise.resolve(null),
    ]);
    let fares: Map<string, TripFare> | null = partnerFares;
    if (googleFares?.length) {
      fares = new Map(partnerFares ?? []);
      for (const g of googleFares) {
        // Google's price covers the whole party; a TripFare is per traveller.
        const fare: TripFare = { price: Math.round(g.price / paying), airline: g.airline || "—", transfers: g.stops, off: 0 };
        for (const k of [g.airport, CITY_OF_AIRPORT[g.airport]]) {
          if (!k) continue;
          const prev = fares.get(k);
          // The partner's fare stays when it is for these days and no dearer
          // (its link earns); otherwise the exact-day price.
          if (!prev || prev.off > 0 || prev.price > fare.price) fares.set(k, fare);
        }
      }
    }
    const answers = await Promise.all(pool.map((d) => suggestForDestination(params, d, params.nights, fares)));
    const results = answers.filter((r): r is DestinationSuggestion => r !== null && r !== "no-fare");

    // What suits the traveller first: places that fit the budget *and* are
    // in season in the month they travel, then the rest that fit, cheapest
    // first; then the ones over budget, by how far over.
    const byPrice = (a: DestinationSuggestion, b: DestinationSuggestion) => a.totalPrice - b.totalPrice;
    const within = results.filter((r) => r.withinBudget);
    const suggestions = [
      ...within.filter((r) => r.place?.inSeason).sort(byPrice),
      ...within.filter((r) => !r.place?.inSeason).sort(byPrice),
      ...results.filter((r) => !r.withinBudget).sort(byPrice),
    ];

    // Every other place in the pool, whatever its season: no fare was seen
    // for these dates, so no price and no claim about the budget — the card
    // opens the live search. The traveller filters (season, visa, continent,
    // kind); we do not filter for them (owner, 20 Oct). Best seasons first.
    const month = Number(params.departDate.slice(5, 7));
    const rank = { EXCELLENT: 0, VERY_GOOD: 1, GOOD: 2, ACCEPTABLE: 3, NOT_RECOMMENDED: 4 } as Record<string, number>;
    const unpriced: DestinationSuggestion[] = pool
      .filter((d, i) => answers[i] === "no-fare")
      .map((d) => ({
        place: placeForDestination(d.code, d.nameEn, month),
        destinationCode: d.code,
        destinationNameAr: d.nameAr,
        destinationNameEn: d.nameEn,
        emoji: d.emoji,
        nights: params.nights,
        totalPrice: 0,
        currency: params.currency,
        withinBudget: false,
        remainingBudget: params.budgetTotal,
        continent: d.continent,
        categories: d.categories,
      }))
      .sort((a, b) => (rank[a.place?.classification ?? ""] ?? 9) - (rank[b.place?.classification ?? ""] ?? 9));

    return NextResponse.json({ mode: "single", suggestions, unpriced });
  }

  // Several countries on one budget: whole routes from home and back, every
  // flight priced — see routeSuggest.ts.
  const endDate =
    typeof body.returnDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.returnDate)
      ? body.returnDate
      : addDays(params.departDate, params.nights);
  const token = process.env.SMOKE_TOKEN;
  const stats: RouteStats | undefined =
    token && req.headers.get("x-sfrtna-smoke") === token ? { pool: 0, candidates: 0, tables: 0, emptyTables: 0, priced: 0 } : undefined;
  const routes = await suggestRoutes({
    origin: resolveIata(params.origin),
    startDate: params.departDate,
    endDate,
    stops: Number(body.stops) === 3 ? 3 : 2,
    budgetTotal: params.budgetTotal,
    currency: params.currency,
    paying: params.adults + (params.childrenAges?.length ?? 0),
    directOnly: params.directFlightsOnly,
    categories: params.preferenceCategories,
    continents: params.continents,
    seasonKinds: params.seasonKinds,
  }, stats);
  return NextResponse.json({ mode: "routes", routes, ...(stats ? { stats } : {}) });
}

