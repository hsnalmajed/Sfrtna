import { NextRequest, NextResponse } from "next/server";
import { resolveIata, searchFlights } from "@/lib/flights";
import type {
  FlightOffer,
  MultiCityLegInput,
  MultiCityLegResult,
  MultiCitySearchParams,
  MultiCityTripResult,
  SearchParams,
} from "@/lib/types";

/**
 * A multi-city trip, priced flight by flight.
 *
 * Each flight is what the traveller entered — from, to, the day — and each is
 * priced as its own one-way fare. Nothing is added that they didn't ask for:
 * no return flight home (they add it as a last flight if they want one) and
 * no hotels (a separate search now, with no price source behind it here).
 *
 * The sum is a sum of separate one-way fares seen recently. A single
 * multi-city ticket can cost more or less, and the page says so.
 */

const MAX_LEGS = 5;

async function cheapestFlight(leg: MultiCityLegInput, params: MultiCitySearchParams): Promise<FlightOffer | null> {
  const searchParams: SearchParams = {
    tripType: "flight",
    origin: leg.origin,
    destination: leg.destination,
    departDate: leg.date,
    adults: params.adults,
    budgetTotal: params.budgetTotal,
    currency: params.currency,
    directFlightsOnly: params.directFlightsOnly,
    minHotelStars: 0,
    baggageIncluded: params.baggageIncluded,
    childrenAges: params.childrenAges,
    infants: params.infants,
  };
  const flights = await searchFlights(searchParams);
  return flights[0] ?? null;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const rawLegs: unknown[] = Array.isArray(body.legs) ? body.legs : [];
  const params: MultiCitySearchParams = {
    legs: rawLegs
      .map((l) => {
        const leg = (l ?? {}) as Partial<MultiCityLegInput>;
        return {
          origin: String(leg.origin ?? "").trim(),
          destination: String(leg.destination ?? "").trim(),
          date: String(leg.date ?? "").trim(),
        };
      })
      .filter((l) => l.origin && l.destination && /^\d{4}-\d{2}-\d{2}$/.test(l.date))
      .slice(0, MAX_LEGS),
    adults: Math.max(1, Number(body.adults || 1)),
    childrenAges: Array.isArray(body.childrenAges) ? body.childrenAges.map(Number).filter(Number.isFinite) : [],
    infants: Number(body.infants || 0),
    budgetTotal: Number(body.budgetTotal || 0),
    currency: body.currency || "SAR",
    directFlightsOnly: Boolean(body.directFlightsOnly),
    baggageIncluded: Boolean(body.baggageIncluded),
  };

  if (params.legs.length < 2) {
    return NextResponse.json({ error: "At least two complete flights are needed" }, { status: 400 });
  }

  // Independent flights, so priced side by side rather than one after another.
  const flights = await Promise.all(params.legs.map((leg) => cheapestFlight(leg, params)));
  const legs: MultiCityLegResult[] = params.legs.map((leg, i) => ({
    origin: leg.origin,
    originIata: resolveIata(leg.origin),
    destination: leg.destination,
    destinationIata: resolveIata(leg.destination),
    date: leg.date,
    flight: flights[i],
  }));

  const allPriced = legs.every((l) => l.flight);
  const totalPrice = legs.reduce((sum, l) => sum + (l.flight?.price ?? 0), 0);
  const withinBudget = params.budgetTotal > 0 ? totalPrice <= params.budgetTotal : true;

  const result: MultiCityTripResult = {
    legs,
    totalPrice,
    allPriced,
    currency: params.currency,
    budgetTotal: params.budgetTotal,
    withinBudget,
    remainingBudget: params.budgetTotal - totalPrice,
    isMock: legs.some((l) => l.flight?.isMock),
  };
  return NextResponse.json(result);
}
