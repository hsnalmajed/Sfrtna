/**
 * Budget advisor, step one: the traveller says their trip in their own words
 * («أسبوع في أوروبا مع عائلتي بعشرين ألف») and the AI turns it into the
 * fields of our search — nothing priced here. The numbers then come only
 * from our live searches (flights and hotels for those dates), never from
 * the model (owner's rule: a live price or no number).
 */

import { aiJson } from "@/lib/ai/provider";
import { searchAirports } from "@/lib/airports";
import { CONTINENTS, type Continent } from "@/lib/countries";

export interface BudgetUnderstanding {
  originIata: string | null;
  destinationIata: string | null;
  continents: Continent[];
  departDate: string | null;
  returnDate: string | null;
  nights: number | null;
  adults: number | null;
  childrenAges: number[];
  budget: number | null;
  currency: string;
  /** What the budget covers. */
  scope: "both" | "flight" | "hotel" | null;
  hotelStars: number | null;
  directOnly: boolean;
  /** What still needs asking, in the page's language (short). */
  missing: string[];
}

const S = { type: "string" } as const;
const SN = { type: ["string", "null"] } as const;
const IN = { type: ["integer", "null"] } as const;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["origin_city", "destination_city", "continents", "depart_date", "return_date", "nights", "adults", "children_ages", "budget", "currency", "scope", "hotel_stars", "direct_only", "missing"],
  properties: {
    origin_city: SN,
    destination_city: SN,
    continents: { type: "array", items: { type: "string", enum: [...CONTINENTS] } },
    depart_date: SN,
    return_date: SN,
    nights: IN,
    adults: IN,
    children_ages: { type: "array", items: { type: "integer" } },
    budget: { type: ["number", "null"] },
    currency: S,
    scope: { type: ["string", "null"], enum: ["both", "flight", "hotel", null] },
    hotel_stars: IN,
    direct_only: { type: "boolean" },
    missing: { type: "array", items: S },
  },
} as const;

/** The city's main airport (or "all airports" code) for an English city name. */
function iataFor(city: string | null): string | null {
  if (!city) return null;
  const hit = searchAirports(city, 3)[0];
  return hit ? hit.iata : null;
}

export async function understandTrip(text: string, locale: "ar" | "en", today: string): Promise<BudgetUnderstanding | { error: string }> {
  const answer = await aiJson<{
    origin_city: string | null;
    destination_city: string | null;
    continents: Continent[];
    depart_date: string | null;
    return_date: string | null;
    nights: number | null;
    adults: number | null;
    children_ages: number[];
    budget: number | null;
    currency: string;
    scope: "both" | "flight" | "hotel" | null;
    hotel_stars: number | null;
    direct_only: boolean;
    missing: string[];
  }>({
    system: `You read a traveller's trip request (Arabic or English, often Gulf dialect) and fill search fields. Today is ${today}.
- Cities in English (e.g. "Riyadh", "Istanbul"); a country alone → its capital or best-known gateway only if they clearly mean one place, else leave destination null and use continents when a region is named (Europe → europe, Asia → asia, etc.).
- Dates as YYYY-MM-DD, in the future. "a week in December" → pick no exact dates: depart_date null, nights 7, and add the dates to missing. A month name alone is not a date.
- adults/children from words like "me and my wife" (2), "family of 5 with 3 kids".
- budget: the total number they give, in their currency (default SAR; "ألف" = thousand). scope: what the budget covers if said ("للطيران" → flight, "شامل الفندق" → both); null if not said.
- hotel_stars from "فندق 5 نجوم", "فاخر" (5), "متوسط" (3–4 → 4), "اقتصادي" (3).
- missing: short questions, in ${locale === "ar" ? "Arabic" : "English"}, for what is needed and not given (departure city, dates, travellers, budget). At most 3.
Never invent what was not said.`,
    user: text.slice(0, 600),
    schemaName: "trip_fields",
    schema: SCHEMA as unknown as Record<string, unknown>,
    search: false,
    effort: "low",
    timeoutMs: 40_000,
  });
  if ("error" in answer) return answer;
  const a = answer.data;
  const iso = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today ? d : null);
  return {
    originIata: iataFor(a.origin_city),
    destinationIata: iataFor(a.destination_city),
    continents: a.continents.filter((c) => (CONTINENTS as readonly string[]).includes(c)),
    departDate: iso(a.depart_date),
    returnDate: iso(a.return_date),
    nights: a.nights && a.nights > 0 && a.nights <= 30 ? a.nights : null,
    adults: a.adults && a.adults > 0 && a.adults <= 9 ? a.adults : null,
    childrenAges: a.children_ages.filter((x) => x >= 0 && x <= 17).slice(0, 6),
    budget: a.budget && a.budget > 0 ? Math.round(a.budget) : null,
    currency: /^[A-Z]{3}$/.test(a.currency) ? a.currency : "SAR",
    scope: a.scope,
    hotelStars: a.hotel_stars && a.hotel_stars >= 2 && a.hotel_stars <= 5 ? a.hotel_stars : null,
    directOnly: a.direct_only,
    missing: a.missing.slice(0, 3).map((m) => m.slice(0, 120)),
  };
}
