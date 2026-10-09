import type { FlightOffer, SearchParams } from "./types";
import { DESTINATIONS } from "./destinations";
import { AIRPORTS } from "./airports";
import { searchFlightsFromProviders } from "./providers";

// ---------------------------------------------------------------------------
// Prices come from the provider registry in ./providers, not from this file.
//
// This module used to call Duffel directly. Duffel is a *booking* API: it
// charges per order and adds a per-search fee once the search-to-book ratio
// passes 1500:1. Sfrtna never takes a booking, so that ratio is infinite by
// construction — every search a cost, every booking someone else's. A pure
// comparison site on a booking API pays to exist and earns nothing.
//
// What remains here: turning a typed place into an airport code, and the
// flight search over the providers. No sample fares — "nothing found" is an
// answer (the generator that made them was removed 10 Oct 2026).
// ---------------------------------------------------------------------------

// A small static lookup so users can type city names in Arabic or English.
// Falls through to using the raw input (uppercased) as an IATA code if unknown.
const CITY_TO_IATA: Record<string, string> = {
  "الرياض": "RUH", riyadh: "RUH",
  "جدة": "JED", jeddah: "JED", jedda: "JED",
  "الدمام": "DMM", dammam: "DMM",
  "المدينة": "MED", "المدينة المنورة": "MED", medina: "MED",
  "مكة": "JED", makkah: "JED", mecca: "JED",
  "أبها": "AHB", abha: "AHB",
  "دبي": "DXB", dubai: "DXB",
  "أبوظبي": "AUH", "ابوظبي": "AUH", "abu dhabi": "AUH",
  "الدوحة": "DOH", doha: "DOH",
  "الكويت": "KWI", kuwait: "KWI",
  "المنامة": "BAH", manama: "BAH", bahrain: "BAH",
  "مسقط": "MCT", muscat: "MCT",
  "القاهرة": "CAI", cairo: "CAI",
  "اسطنبول": "IST", "إسطنبول": "IST", istanbul: "IST",
  "لندن": "LON", london: "LON",
  "باريس": "PAR", paris: "PAR",
  "دبلن": "DUB", dublin: "DUB",
  "روما": "ROM", rome: "ROM",
  "برشلونة": "BCN", barcelona: "BCN",
  "مدريد": "MAD", madrid: "MAD",
  "كوالالمبور": "KUL", "kuala lumpur": "KUL",
  "بانكوك": "BKK", bangkok: "BKK",
  "جاكرتا": "JKT", jakarta: "JKT",
  "نيويورك": "NYC", "new york": "NYC",
};

// Merge in every discover-mode destination's ar/en names so cards built from
// DestinationSuggestion always resolve back to the right IATA code, even for
// cities (e.g. Baku, Tbilisi) not covered by the hand-written list above.
for (const d of DESTINATIONS) {
  CITY_TO_IATA[d.nameAr.toLowerCase()] = d.code;
  CITY_TO_IATA[d.nameEn.toLowerCase()] = d.code;
}

export function resolveIata(input: string): string {
  const key = input.trim().toLowerCase();
  if (CITY_TO_IATA[key]) return CITY_TO_IATA[key];
  const cleaned = input.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(cleaned)) return cleaned;
  // Fallback: first 3 letters, not accurate but keeps the demo running
  return cleaned.replace(/[^A-Z]/g, "").slice(0, 3) || "RUH";
}

/**
 * The same thing, without the guess.
 *
 * resolveIata ends by taking the first three letters of whatever it was
 * given, which is fine for seeding sample data and wrong for anything a
 * traveller will act on: "Tbilisi" becomes TBI, an airport in Papua New
 * Guinea, and the real one is TBS. Anywhere a code is about to be sent to a
 * booking site, ask this instead and show nothing when the answer is null.
 */
export function strictIata(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (CITY_TO_IATA[key]) return CITY_TO_IATA[key];
  const upper = raw.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  const airport = AIRPORTS.find(
    (a) => a.cityAr.toLowerCase() === key || a.cityEn.toLowerCase() === key
  );
  return airport?.iata ?? null;
}




export async function searchFlights(params: SearchParams): Promise<FlightOffer[]> {
  const { offers } = await searchFlightsFromProviders(params);
  // "Nothing found" is the answer: never sample fares in its place.

  return offers
    .filter((o) => !params.directFlightsOnly || o.stops === 0)
    // Baggage is only a filter when the source actually stated it. A
    // price-only offer says nothing about baggage, and dropping every such
    // fare because a box was ticked would hide the whole result set behind a
    // fact we never had.
    .filter((o) => !params.baggageIncluded || o.priceOnly || o.baggageIncluded)
    .sort((a, b) => a.price - b.price);
}
