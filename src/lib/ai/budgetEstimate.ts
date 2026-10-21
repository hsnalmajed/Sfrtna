/**
 * «كم أحتاج؟» — the budget advisor for a traveller who does not know their
 * budget yet (owner, 21 Oct 2026: "help him set his budget because he does
 * not know it at all").
 *
 * Every part says where its number comes from:
 *   - flights: live, for these dates and this party (Google Travel Explore,
 *     else Google Flights) — the cheapest fare found now;
 *   - hotel: live, the city's list for these nights at the chosen level —
 *     the cheapest well-rated stay and the typical one;
 *   - daily spending (food, local transport, entry tickets) and one-offs:
 *     an estimate the AI reads from published sources (web search, links
 *     shown), never presented as a price — a range, labelled as such.
 * The total is a range plus a recommended budget (the high end and a 10 %
 * reserve), which the traveller can then search with.
 */

import { aiJson, aiConfigured, type AiSource } from "@/lib/ai/provider";
import { takeAi } from "@/lib/ai/quota";
import { cachedJson } from "@/lib/edgeCache";
import { findAirport } from "@/lib/airports";
import { CITY_OF_AIRPORT } from "@/lib/providers/travelpayouts";
import { exploreFares, googleFlights, hotelPrices, type HotelResult } from "@/lib/providers/serpapi";
import { discoverCandidates } from "@/lib/discoverPool";
import type { Continent } from "@/lib/countries";

export type Style = "budget" | "mid" | "luxury";
export const STYLES: Style[] = ["budget", "mid", "luxury"];
const STARS: Record<Style, number> = { budget: 3, mid: 4, luxury: 5 };

export interface EstimateRequest {
  origin: string;
  destination: string;
  continents: Continent[];
  from: string;
  to: string;
  adults: number;
  childrenAges: number[];
  infants: number;
  currency: string;
  style: Style;
  directOnly: boolean;
  locale: "ar" | "en";
}

export interface Range {
  low: number;
  high: number;
}

export interface DailyCosts {
  food: Range;
  transport: Range;
  activities: Range;
  /** One-off costs per traveller (eSIM, airport transfer, a city pass…). */
  extras: { label: string; low: number; high: number }[];
  /** What the food range means, e.g. "three meals in mid-range restaurants". */
  basis: string;
  tips: string[];
  sources: AiSource[];
}

export interface BudgetEstimate {
  kind: "estimate";
  city: { code: string; nameAr: string; nameEn: string };
  nights: number;
  travellers: number;
  currency: string;
  style: Style;
  flight: { price: number; stops: number | null; airline: string } | null;
  hotel: {
    low: number;
    typical: number;
    rooms: number;
    stars: number;
    examples: { name: string; stars: number | null; rating: number | null; total: number }[];
  } | null;
  daily: DailyCosts | null;
  total: Range & { recommended: number };
  /** Parts with no number right now (no live price, AI off). */
  missing: ("flight" | "hotel" | "daily")[];
}

export interface DestinationOption {
  code: string;
  nameAr: string;
  nameEn: string;
  emoji: string;
  price: number;
  stops: number | null;
}

export interface EstimateList {
  kind: "list";
  options: DestinationOption[];
  currency: string;
}

const nightsOf = (a: string, b: string) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000));
const sameCity = (a: string, b: string) => a === b || (CITY_OF_AIRPORT[a] ?? a) === (CITY_OF_AIRPORT[b] ?? b);

/** Cheapest live fare to `dest` for these dates and this party (whole party). */
async function flightTo(r: EstimateRequest, dest: string): Promise<BudgetEstimate["flight"]> {
  if (!r.origin) return null;
  const explore = await exploreFares({
    origin: r.origin,
    departDate: r.from,
    returnDate: r.to,
    adults: r.adults,
    children: r.childrenAges.length,
    infants: r.infants,
    currency: r.currency,
    directOnly: r.directOnly,
  });
  const hit = (explore ?? []).filter((f) => sameCity(f.airport, dest)).sort((a, b) => a.price - b.price)[0];
  if (hit) return { price: hit.price, stops: hit.stops, airline: hit.airline };
  const gf = await googleFlights({
    origin: r.origin,
    destination: dest,
    departDate: r.from,
    returnDate: r.to,
    adults: r.adults,
    children: r.childrenAges.length,
    infants: r.infants,
    currency: r.currency,
    locale: r.locale,
    directOnly: r.directOnly,
    pace: "explore",
  });
  const best = (gf?.flights ?? []).slice().sort((a, b) => a.price - b.price)[0];
  return best ? { price: Math.round(best.price), stops: best.stops, airline: best.legs[0]?.airline ?? "" } : null;
}

/** The city's hotels for these nights at the chosen level, live. */
async function hotelsIn(r: EstimateRequest, cityEn: string): Promise<BudgetEstimate["hotel"]> {
  const stars = STARS[r.style];
  // A room for every two adults; children stay with them.
  const rooms = Math.max(1, Math.ceil(r.adults / 2));
  const perRoomAdults = Math.ceil(r.adults / rooms);
  const res = await hotelPrices({
    q: `hotels in ${cityEn}`,
    checkIn: r.from,
    checkOut: r.to,
    adults: perRoomAdults,
    childrenAges: rooms === 1 ? r.childrenAges : [],
    currency: r.currency,
    minStars: stars,
  });
  if (!res || res.kind !== "list") return null;
  const nights = nightsOf(r.from, r.to);
  // The whole stay; Google gives a total for most, a nightly rate for the rest.
  const stay = (h: HotelResult) => h.total ?? (h.perNight ? h.perNight * nights : 0);
  const priced = (res.hotels as HotelResult[])
    .map((h) => ({ ...h, total: stay(h) }))
    .filter((h) => h.total > 0 && (h.stars == null || h.stars === stars || (stars === 3 && h.stars <= 3)));
  // Well-rated only (Google's guest rating out of 5): what a traveller would book.
  const good = priced.filter((h) => (h.rating ?? 0) >= 4 && (h.reviews ?? 0) >= 50);
  const pool = (good.length >= 3 ? good : priced).slice().sort((a, b) => a.total - b.total);
  if (!pool.length) return null;
  const totals = pool.map((h) => h.total);
  const typical = totals[Math.floor((totals.length - 1) / 2)];
  const examples = pool
    .slice(0, Math.max(3, Math.ceil(pool.length / 2)))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 3)
    .map((h) => ({ name: h.name, stars: h.stars, rating: h.rating, total: Math.round(h.total * rooms) }));
  return { low: Math.round(totals[0] * rooms), typical: Math.round(typical * rooms), rooms, stars, examples };
}

const RANGE = {
  type: "object",
  additionalProperties: false,
  required: ["low", "high"],
  properties: { low: { type: "number" }, high: { type: "number" } },
} as const;

const DAILY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["food", "transport", "activities", "extras", "basis", "tips"],
  properties: {
    food: RANGE,
    transport: RANGE,
    activities: RANGE,
    extras: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "low", "high"],
        properties: { label: { type: "string" }, low: { type: "number" }, high: { type: "number" } },
      },
    },
    basis: { type: "string" },
    tips: { type: "array", items: { type: "string" } },
  },
} as const;

/** Per traveller per day, from published sources; cached two weeks per city and level. */
async function dailyCosts(r: EstimateRequest, cityEn: string, countryEn: string): Promise<DailyCosts | null> {
  if (!aiConfigured()) return null;
  const key = `ai-daily1:${cityEn.toLowerCase()}:${r.style}:${r.currency}:${r.locale}`;
  return cachedJson<DailyCosts>(key, 14 * 86_400, async () => {
    if (!(await takeAi("budget"))) return null;
    const lang = r.locale === "ar" ? "Arabic" : "English";
    const level = { budget: "budget (casual local restaurants, public transport)", mid: "mid-range (good sit-down restaurants, taxis or ride-hailing sometimes)", luxury: "luxury (fine restaurants, private car or taxis)" }[r.style];
    const answer = await aiJson<Omit<DailyCosts, "sources">>({
      system: `You estimate a tourist's daily spending in a city from current published sources, for a Saudi traveller. Search the web (cost-of-living sites, official transport fares, official attraction ticket prices, recent travel guides from 2025–2026). Rules:
- All amounts in ${r.currency}, per traveller (one adult), converted at today's rate.
- food: a day's three meals at the ${level} level (halal-friendly options). transport: a day's local transport at that level (not the airport). activities: an average day's entry tickets / tours at that level.
- low and high give an honest range; high ≥ low; no zeros unless truly free.
- extras: one-off costs per traveller that most visitors pay — airport transfer one way each direction (both together), a tourist SIM/eSIM, a city card or museum pass only if commonly bought. At most 4. Never include flights, hotels or visa fees.
- basis: one short line saying what the food range assumes, in ${lang}.
- tips: up to 5 concrete money-saving tips for this city, in ${lang}, each one sentence (a real pass name, free days, cheaper transport…).
- labels in ${lang}. Never invent: if you cannot find a figure, give the range the sources support.`,
      user: `City: ${cityEn}, ${countryEn}. Level: ${r.style}.`,
      schemaName: "daily_costs",
      schema: DAILY_SCHEMA as unknown as Record<string, unknown>,
      search: { city: cityEn },
      effort: "low",
      timeoutMs: 90_000,
    });
    if ("error" in answer) return null;
    const a = answer.data;
    const fix = (x: Range): Range => {
      const low = Math.max(0, Math.round(x.low));
      return { low, high: Math.max(low, Math.round(x.high)) };
    };
    return {
      food: fix(a.food),
      transport: fix(a.transport),
      activities: fix(a.activities),
      extras: a.extras.slice(0, 4).map((e) => ({ label: e.label.slice(0, 80), ...fix(e) })),
      basis: a.basis.slice(0, 160),
      tips: a.tips.slice(0, 5).map((t) => t.slice(0, 200)),
      sources: answer.sources.slice(0, 8),
    };
  });
}

/** Round up to a tidy number (500 under 20k, 1,000 above). */
function tidy(n: number): number {
  const step = n >= 20_000 ? 1000 : 500;
  return Math.ceil(n / step) * step;
}

export async function estimateBudget(r: EstimateRequest): Promise<BudgetEstimate | EstimateList | null> {
  const nights = nightsOf(r.from, r.to);
  const travellers = r.adults + r.childrenAges.length;

  // No destination yet: the cheapest places for these dates, to choose one.
  if (!r.destination) {
    if (!r.origin) return null;
    const fares = await exploreFares({
      origin: r.origin,
      departDate: r.from,
      returnDate: r.to,
      adults: r.adults,
      children: r.childrenAges.length,
      infants: r.infants,
      currency: r.currency,
      directOnly: r.directOnly,
    });
    if (!fares) return null;
    const best = new Map<string, DestinationOption>();
    for (const c of discoverCandidates()) {
      if (r.continents.length && (!c.continent || !r.continents.includes(c.continent))) continue;
      const f = fares.filter((x) => sameCity(x.airport, c.code)).sort((a, b) => a.price - b.price)[0];
      if (!f) continue;
      const prev = best.get(c.code);
      if (!prev || f.price < prev.price) best.set(c.code, { code: c.code, nameAr: c.nameAr, nameEn: c.nameEn, emoji: c.emoji, price: f.price, stops: f.stops });
    }
    const options = [...best.values()].sort((a, b) => a.price - b.price).slice(0, 18);
    return { kind: "list", options, currency: r.currency };
  }

  const ap = findAirport(r.destination);
  if (!ap) return null;
  const [flight, hotel, daily] = await Promise.all([flightTo(r, r.destination), hotelsIn(r, ap.cityEn), dailyCosts(r, ap.cityEn, ap.countryEn)]);

  const days = nights;
  const perDay = (k: "low" | "high") => (daily ? daily.food[k] + daily.transport[k] + daily.activities[k] : 0);
  const extras = (k: "low" | "high") => (daily ? daily.extras.reduce((s, e) => s + e[k], 0) : 0);
  const low = (flight?.price ?? 0) + (hotel?.low ?? 0) + (perDay("low") * days + extras("low")) * travellers;
  const high = (flight?.price ?? 0) + (hotel?.typical ?? 0) + (perDay("high") * days + extras("high")) * travellers;
  const missing: BudgetEstimate["missing"] = [];
  if (!flight && r.origin) missing.push("flight");
  if (!hotel) missing.push("hotel");
  if (!daily) missing.push("daily");
  return {
    kind: "estimate",
    city: { code: r.destination, nameAr: ap.cityAr, nameEn: ap.cityEn },
    nights,
    travellers,
    currency: r.currency,
    style: r.style,
    flight,
    hotel,
    daily,
    total: { low: Math.round(low), high: Math.round(high), recommended: tidy(high * 1.1) },
    missing,
  };
}
