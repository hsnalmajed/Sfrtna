import { NextRequest, NextResponse } from "next/server";
import { resolveIata, searchFlights, searchHotels } from "@/lib/flights";
import { suggestRoutes } from "@/lib/routeSuggest";
import { DESTINATIONS } from "@/lib/destinations";
import { placeForDestination } from "@/lib/destinationPlace";
import { tripFaresFrom, type TripFare } from "@/lib/providers/travelpayouts";
import { COUNTRY_CITIES } from "@/lib/cities";
import { flagEmoji } from "@/lib/countries";
import { CITY_AIRPORTS } from "@/data/cityAirports";
import { DESTINATION_TYPES } from "@/data/destinationTypes";
import type {
  DestinationCategory,
  FlightOffer,
  DestinationSuggestion,
  DiscoverParams,
  SearchParams,
  TripType,
} from "@/lib/types";

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type Candidate = { code: string; nameAr: string; nameEn: string; emoji: string; categories: DestinationCategory[] };

/**
 * Every city we have a guide and an airport for, as a place to suggest.
 *
 * This list used to be fourteen hand-picked cities, which is why a search
 * from Dammam could answer with two: whatever the budget, only those
 * fourteen were ever asked about. The categories come from the same trip
 * types the season ratings use (src/data/destinationTypes.ts), with the old
 * hand-picked tags kept where a city had them.
 */
function candidates(): Candidate[] {
  const curated = new Map(DESTINATIONS.map((d) => [d.code, d]));
  const typeToCategory: Record<string, DestinationCategory[]> = {
    beach: ["beach", "family"],
    tropical: ["beach", "nature"],
    nature: ["nature"],
    mountain: ["nature", "adventure"],
    desert: ["adventure"],
    city: ["city", "culture"],
  };
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const [countryCode, cities] of Object.entries(COUNTRY_CITIES)) {
    for (const c of cities) {
      const code = CITY_AIRPORTS[c.slug]?.iata;
      if (!code || seen.has(code)) continue;
      seen.add(code);
      const cats = new Set<DestinationCategory>(curated.get(code)?.categories ?? []);
      for (const t of DESTINATION_TYPES[c.slug] ?? []) for (const k of typeToCategory[t] ?? []) cats.add(k);
      out.push({
        code,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        emoji: curated.get(code)?.emoji ?? flagEmoji(countryCode),
        categories: [...cats],
      });
    }
  }
  return out;
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
  const fare = fares?.get(destination.code);
  if (fares && params.directFlightsOnly && fare && fare.transfers !== 0) return "no-fare";
  const [flights, hotels] = await Promise.all([
    wantsFlight
      ? fares
        ? Promise.resolve(fare ? [flightFromFare(params, destination, fare)] : [])
        : searchFlights(searchParams)
      : Promise.resolve([]),
    wantsHotel ? searchHotels(searchParams, nights) : Promise.resolve([]),
  ]);

  const flight = flights[0];
  const hotel = hotels[0];
  if (wantsFlight && !flight) return "no-fare";
  if (wantsHotel && !hotel) return null;

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
    preferenceCategory: body.preferenceCategory || undefined,
  };

  if (!params.origin || !params.departDate || !params.budgetTotal) {
    return NextResponse.json({ error: "Missing required params" }, { status: 400 });
  }

  const pool = candidates().filter(
    (d) =>
      d.code !== resolveIata(params.origin) &&
      (!params.preferenceCategory || d.categories.includes(params.preferenceCategory))
  );

  if (!params.multiDestination) {
    const returnDate = params.oneWayOnly ? undefined : params.returnDate || addDays(params.departDate, params.nights);
    const fares =
      params.tripType !== "hotel" && process.env.TRAVELPAYOUTS_TOKEN
        ? await tripFaresFrom(resolveIata(params.origin), params.departDate, returnDate, params.currency)
        : null;
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

    // Cities at their best in the month of travel that no fare was seen for
    // on these dates: no price, and no claim about the budget — a way to the
    // live search instead. Best months first.
    const month = Number(params.departDate.slice(5, 7));
    const rank = { EXCELLENT: 0, VERY_GOOD: 1 } as Record<string, number>;
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
      }))
      .filter((s) => s.place?.inSeason)
      .sort((a, b) => (rank[a.place?.classification ?? ""] ?? 9) - (rank[b.place?.classification ?? ""] ?? 9))
      .slice(0, 24);

    return NextResponse.json({ mode: "single", suggestions, unpriced });
  }

  // Several countries on one budget: whole routes from home and back, every
  // flight priced — see routeSuggest.ts.
  const endDate =
    typeof body.returnDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.returnDate)
      ? body.returnDate
      : addDays(params.departDate, params.nights);
  const routes = await suggestRoutes({
    origin: resolveIata(params.origin),
    startDate: params.departDate,
    endDate,
    stops: Number(body.stops) === 3 ? 3 : 2,
    budgetTotal: params.budgetTotal,
    currency: params.currency,
    paying: params.adults + (params.childrenAges?.length ?? 0),
    directOnly: params.directFlightsOnly,
    category: params.preferenceCategory,
  });
  return NextResponse.json({ mode: "routes", routes });
}

