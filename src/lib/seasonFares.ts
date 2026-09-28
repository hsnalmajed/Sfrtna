// The cheapest round-trip fare seen this month from Riyadh to each city, per
// person — the number the season cards show in place of the rain.
//
// One request answers it for every destination at once (Aviasales'
// prices_for_dates with only an origin; see oneWayFaresFrom), cached at the
// edge for six hours so the homepage does not spend a request per visit.
//
// These are fares *seen* in the last days for departures in this month, not
// a live quote — the card and the summary say so, and name the month and the
// departure city. A city with no fare seen gets no number: nothing here is
// estimated.

import { oneWayFaresFrom } from "@/lib/providers/travelpayouts";
import { cachedJson } from "@/lib/edgeCache";

export const SEASON_FARE_ORIGIN = "RUH";

async function faresFor(month: string, roundTrip: boolean): Promise<Record<string, number>> {
  const table = await cachedJson<Record<string, number>>(
    `season-fares:${SEASON_FARE_ORIGIN}:${month}:${roundTrip ? "rt" : "ow"}`,
    6 * 3600,
    async () => {
      const fares = await oneWayFaresFrom(SEASON_FARE_ORIGIN, month, "SAR", roundTrip);
      if (fares.size === 0) return null; // don't cache an empty answer
      const out: Record<string, number> = {};
      for (const [code, f] of fares) out[code] = f.price;
      return out;
    }
  );
  return table ?? {};
}

export interface SeasonFare {
  price: number;
  /** false: only a one-way fare was seen, and the page says "one way". */
  roundTrip: boolean;
}

function lowest(tables: Record<string, number>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of tables) for (const [code, price] of Object.entries(t)) {
    if (!(code in out) || price < out[code]) out[code] = price;
  }
  return out;
}

/**
 * The lowest fare seen per person, in SAR, departing in any of `months`
 * (YYYY-MM) — two months, so that late in a month a city still has a fare.
 *
 * A round trip when the source has seen one. The source holds round-trip
 * fares from Riyadh to fewer places than one-way ones (checked 28 Sep 2026:
 * 139 destinations against 220 for October — none at all for Athens or
 * Beirut), so where only a one-way fare was seen, that is given, marked as
 * one-way. Never a doubled one-way passed off as a return.
 */
export async function seasonFares(months: string[]): Promise<Record<string, SeasonFare>> {
  const [rt, ow] = await Promise.all([
    Promise.all(months.map((m) => faresFor(m, true))),
    Promise.all(months.map((m) => faresFor(m, false))),
  ]);
  const round = lowest(rt);
  const oneWay = lowest(ow);
  const out: Record<string, SeasonFare> = {};
  for (const [code, price] of Object.entries(oneWay)) out[code] = { price, roundTrip: false };
  for (const [code, price] of Object.entries(round)) out[code] = { price, roundTrip: true };
  return out;
}
