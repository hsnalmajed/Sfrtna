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

/** { IATA: price per person, in SAR } for departures in `month` (YYYY-MM). */
export async function seasonFares(month: string): Promise<Record<string, number>> {
  const table = await cachedJson<Record<string, number>>(
    `season-fares:${SEASON_FARE_ORIGIN}:${month}`,
    6 * 3600,
    async () => {
      const fares = await oneWayFaresFrom(SEASON_FARE_ORIGIN, month, "SAR", true);
      if (fares.size === 0) return null; // don't cache an empty answer
      const out: Record<string, number> = {};
      for (const [code, f] of fares) out[code] = f.price;
      return out;
    }
  );
  return table ?? {};
}
