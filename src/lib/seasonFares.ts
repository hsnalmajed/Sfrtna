// The cheapest fare seen this month from the visitor's airport to each city, per
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

async function faresFor(origin: string, month: string, roundTrip: boolean): Promise<Record<string, number>> {
  const table = await cachedJson<Record<string, number>>(
    `season-fares2:${origin}:${month}:${roundTrip ? "rt" : "ow"}`,
    6 * 3600,
    async () => {
      const fares = await oneWayFaresFrom(origin, month, "SAR", roundTrip);
      if (fares.size === 0) return null; // don't cache an empty answer
      const out: Record<string, number> = {};
      // A fare for a day already gone cannot be bought: only departures from
      // tomorrow on count.
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      for (const [code, f] of fares) {
        if (f.departureAt && f.departureAt.slice(0, 10) < tomorrow) continue;
        out[code] = f.price;
      }
      return out;
    }
  );
  return table ?? {};
}

/**
 * The lowest one-way fare per person from `origin` (the visitor's airport), in SAR, seen for departures
 * in any of `months` (YYYY-MM) — two months, so that late in a month a city
 * still has a fare.
 *
 * One way, not return: it is the number a traveller can read the same way on
 * every card, and the source holds one-way fares for many more routes than
 * return ones. A city the source has no fare for is simply absent — checked
 * on 28 Sep 2026, per-destination endpoints add almost nothing (Beirut and
 * Aqaba only), so nothing is gained by guessing the rest.
 */
export async function seasonFares(origin: string, months: string[]): Promise<Record<string, number>> {
  const tables = await Promise.all(months.map((m) => faresFor(origin, m, false)));
  const out: Record<string, number> = {};
  for (const t of tables) for (const [code, price] of Object.entries(t)) {
    if (!(code in out) || price < out[code]) out[code] = price;
  }
  return out;
}
