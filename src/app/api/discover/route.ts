import { NextRequest, NextResponse } from "next/server";
import { resolveIata, searchFlights, searchHotels } from "@/lib/flights";
import { suggestRoutes } from "@/lib/routeSuggest";
import { DESTINATIONS } from "@/lib/destinations";
import { placeForDestination } from "@/lib/destinationPlace";
import { dayFares, type DayFare } from "@/lib/providers/travelpayouts";
import type {
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

/** The fare on `date`, or the nearest seen within two days either side. */
function nearest(map: Map<string, DayFare>, date: string): { fare: DayFare; off: number } | null {
  for (let off = 0; off <= 2; off++) {
    for (const sign of off === 0 ? [0] : [-1, 1]) {
      const day = addDays(date, sign * off);
      const fare = map.get(day);
      if (fare) return { fare, off };
    }
  }
  return null;
}

/**
 * The trip's flight, priced from its own days: the cheapest fare seen on the
 * day out, plus the cheapest seen on the day back. Checked against the live
 * search (see dayFares) this lands within a few riyals, where the month's
 * lowest fare — the old method — was off by hundreds either way.
 */
async function datedFlight(
  params: DiscoverParams,
  destination: (typeof DESTINATIONS)[number],
  returnDate: string | undefined
): Promise<FlightOffer | null> {
  const origin = resolveIata(params.origin);
  const [outMap, backMap] = await Promise.all([
    dayFares(origin, destination.code, params.departDate.slice(0, 7), params.currency),
    returnDate ? dayFares(destination.code, origin, returnDate.slice(0, 7), params.currency) : Promise.resolve(null),
  ]);
  const out = nearest(outMap, params.departDate);
  const back = returnDate && backMap ? nearest(backMap, returnDate) : null;
  if (!out || (returnDate && !back)) return null;
  if (params.directFlightsOnly && (out.fare.transfers !== 0 || (back && back.fare.transfers !== 0))) return null;
  const perSeat = out.fare.price + (back?.fare.price ?? 0);
  const paying = Math.max(1, params.adults + (params.childrenAges?.length ?? 0));
  const transfers = [out.fare.transfers, back?.fare.transfers].filter((t) => t !== undefined);
  const known = transfers.every((t) => t !== null);
  return {
    id: `day-${destination.code}-${params.departDate}-${returnDate ?? ""}`,
    airline: back && back.fare.airline !== out.fare.airline ? `${out.fare.airline} / ${back.fare.airline}` : out.fare.airline,
    airlineCode: "",
    origin,
    destination: destination.code,
    departTime: params.departDate,
    arriveTime: params.departDate,
    durationMinutes: 0,
    stops: known ? Math.max(...(transfers as number[])) : 0,
    stopsKnown: known,
    price: perSeat * paying,
    pricePerPerson: perSeat,
    currency: params.currency.toUpperCase(),
    isMock: false,
    bookingHint: "Aviasales",
    layoverCity: null,
    layoverDurationMinutes: null,
    baggageIncluded: false,
    priceOnly: true,
    nearDays: Math.max(out.off, back?.off ?? 0),
  };
}

async function suggestForDestination(
  params: DiscoverParams,
  destination: (typeof DESTINATIONS)[number],
  nights: number
): Promise<DestinationSuggestion | null> {
  const searchParams: SearchParams = {
    tripType: params.tripType,
    origin: params.origin,
    destination: destination.code,
    departDate: params.departDate,
    // A one-way discover search prices only the outbound flight — the
    // hotel stay length still comes from `nights` (entered directly by the
    // user when there's no return date to derive it from).
    returnDate: params.oneWayOnly ? undefined : addDays(params.departDate, nights),
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

  // With a live fare source, flights are priced from the trip's own days;
  // without one (local development) the sample search stands in.
  const dated = Boolean(process.env.TRAVELPAYOUTS_TOKEN);
  const [flights, hotels] = await Promise.all([
    wantsFlight
      ? dated
        ? datedFlight(params, destination, searchParams.returnDate).then((f) => (f ? [f] : []))
        : searchFlights(searchParams)
      : Promise.resolve([]),
    wantsHotel ? searchHotels(searchParams, nights) : Promise.resolve([]),
  ]);

  const flight = flights[0];
  const hotel = hotels[0];
  if (wantsFlight && !flight) return null;
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

  const candidates = DESTINATIONS.filter(
    (d) =>
      d.code !== params.origin.toUpperCase() &&
      (!params.preferenceCategory || d.categories.includes(params.preferenceCategory))
  );

  if (!params.multiDestination) {
    const results = (
      await Promise.all(candidates.map((d) => suggestForDestination(params, d, params.nights)))
    ).filter((r): r is DestinationSuggestion => r !== null);

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

    return NextResponse.json({ mode: "single", suggestions });
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
