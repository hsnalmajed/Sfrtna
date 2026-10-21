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
import { tripFaresFrom } from "@/lib/providers/travelpayouts";
import { readCityCosts } from "@/lib/costs";
import type { CityCosts, Pair } from "@/lib/costsTypes";
import { fetchRates, rateBetween, type Rates } from "@/lib/rates";
import { CITY_AIRPORTS } from "@/data/cityAirports";
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
  /** live: a price found now for these dates and this party; else a fare seen recently (estimate). */
  flight: { price: number; stops: number | null; airline: string; live: boolean } | null;
  hotel: {
    low: number;
    typical: number;
    rooms: number;
    stars: number;
    examples: { name: string; stars: number | null; rating: number | null; total: number }[];
    /** live: the city's hotels for these nights now; else our stored typical range (estimate). */
    live: boolean;
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
  /** A price found now; else a fare seen recently (estimate). */
  live: boolean;
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
  if (hit) return { price: hit.price, stops: hit.stops, airline: hit.airline, live: true };
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
  if (best) return { price: Math.round(best.price), stops: best.stops, airline: best.legs[0]?.airline ?? "", live: true };
  // No live price to be had now: the fare seen recently for these days
  // (within two days of them), per seat, times the party — an estimate.
  const seen = await tripFaresFrom(r.origin, r.from, r.to, r.currency);
  const f = seen.get(dest) ?? seen.get(CITY_OF_AIRPORT[dest] ?? "") ?? [...seen.entries()].find(([k]) => sameCity(k, dest))?.[1];
  if (!f) return null;
  const seats = r.adults + r.childrenAges.length + r.infants * 0.1;
  return { price: Math.round(f.price * seats), stops: f.transfers, airline: f.airline, live: false };
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
  return { low: Math.round(totals[0] * rooms), typical: Math.round(typical * rooms), rooms, stars, examples, live: true };
}

const usdRates = () => cachedJson<Rates>("rates:usd:v1", 3600, fetchRates);

/** A stored range in US dollars, in the traveller's currency. */
function inCurrency(p: Pair, rate: number): Range {
  return { low: Math.round(p[0] * rate), high: Math.round(p[1] * rate) };
}

/** The city slug an airport serves (our cities' gateway airports). */
function slugOfAirport(iata: string): string | undefined {
  const city = CITY_OF_AIRPORT[iata] ?? iata;
  return Object.entries(CITY_AIRPORTS).find(([, a]) => a.iata === iata || a.iata === city || CITY_OF_AIRPORT[a.iata] === city)?.[0];
}

const LEVEL_INDEX: Record<Style, 0 | 1 | 2> = { budget: 0, mid: 1, luxury: 2 };
const BASIS = {
  ar: { budget: "مطاعم شعبية ومواصلات عامة وأماكن مجانية أو رخيصة", mid: "مطاعم جيدة وتاكسي أحياناً وأشهر الأماكن المدفوعة", luxury: "مطاعم راقية وسيارة خاصة وجولات مميزة" },
  en: { budget: "local eateries, public transport, free or cheap sights", mid: "good restaurants, taxis sometimes, the main paid sights", luxury: "fine dining, a private car, premium tours" },
};
const EXTRA = {
  ar: { transfer: "تاكسي المطار ذهاباً وعودة", sim: "شريحة أو eSIM للإنترنت" },
  en: { transfer: "Airport taxi both ways", sim: "SIM or eSIM with data" },
};

/** Daily spending and hotels from our stored city costs (estimates), in the traveller's currency. */
async function storedCosts(r: EstimateRequest, travellers: number): Promise<{ daily: DailyCosts; hotel: (stars: number, nights: number, rooms: number) => { low: number; typical: number } } | null> {
  const slug = slugOfAirport(r.destination);
  const c: CityCosts | null = slug ? await readCityCosts(slug) : null;
  if (!c) return null;
  const rates = await usdRates();
  const rate = rates ? rateBetween("USD", r.currency, rates) : r.currency === "USD" ? 1 : null;
  if (!rate) return null;
  const L = LEVEL_INDEX[r.style];
  const share = Math.max(1, travellers);
  const daily: DailyCosts = {
    food: inCurrency(c.food[L], rate),
    transport: inCurrency(c.transport[L], rate),
    activities: inCurrency(c.activities[L], rate),
    extras: [
      // A taxi carries the whole party: its cost shared per traveller.
      { label: EXTRA[r.locale].transfer, ...inCurrency([(c.transfer[0] * 2) / share, (c.transfer[1] * 2) / share], rate) },
      { label: EXTRA[r.locale].sim, ...inCurrency(c.sim, rate) },
    ],
    basis: BASIS[r.locale][r.style],
    tips: r.locale === "ar" ? c.tipsAr : c.tipsEn,
    sources: [],
  };
  const hotel = (stars: number, nights: number, rooms: number) => {
    const h = c.hotel[Math.min(2, Math.max(0, stars - 3))];
    return { low: Math.round(h[0] * rate * nights * rooms), typical: Math.round(((h[0] + h[1]) / 2) * rate * nights * rooms) };
  };
  return { daily, hotel };
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
    // No live list now: the fares seen recently for these days (estimates).
    if (!fares) {
      const seen = await tripFaresFrom(r.origin, r.from, r.to, r.currency);
      if (!seen.size) return null;
      const seats = r.adults + r.childrenAges.length + r.infants * 0.1;
      const options: DestinationOption[] = [];
      for (const c of discoverCandidates()) {
        if (r.continents.length && (!c.continent || !r.continents.includes(c.continent))) continue;
        const f = seen.get(c.code) ?? seen.get(CITY_OF_AIRPORT[c.code] ?? "");
        if (f && !options.some((o) => o.code === c.code)) options.push({ code: c.code, nameAr: c.nameAr, nameEn: c.nameEn, emoji: c.emoji, price: Math.round(f.price * seats), stops: f.transfers, live: false });
      }
      return { kind: "list", options: options.sort((a, b) => a.price - b.price).slice(0, 18), currency: r.currency };
    }
    const best = new Map<string, DestinationOption>();
    for (const c of discoverCandidates()) {
      if (r.continents.length && (!c.continent || !r.continents.includes(c.continent))) continue;
      const f = fares.filter((x) => sameCity(x.airport, c.code)).sort((a, b) => a.price - b.price)[0];
      if (!f) continue;
      const prev = best.get(c.code);
      if (!prev || f.price < prev.price) best.set(c.code, { code: c.code, nameAr: c.nameAr, nameEn: c.nameEn, emoji: c.emoji, price: f.price, stops: f.stops, live: true });
    }
    const options = [...best.values()].sort((a, b) => a.price - b.price).slice(0, 18);
    return { kind: "list", options, currency: r.currency };
  }

  const ap = findAirport(r.destination);
  if (!ap) return null;
  const [flight, liveHotel, aiDaily, stored] = await Promise.all([
    flightTo(r, r.destination),
    hotelsIn(r, ap.cityEn),
    dailyCosts(r, ap.cityEn, ap.countryEn),
    storedCosts(r, travellers),
  ]);
  const daily = aiDaily ?? stored?.daily ?? null;
  // No live hotel prices now: our stored typical range for the level (estimate).
  const rooms = Math.max(1, Math.ceil(r.adults / 2));
  const hotel: BudgetEstimate["hotel"] =
    liveHotel ?? (stored ? { ...stored.hotel(STARS[r.style], nights, rooms), rooms, stars: STARS[r.style], examples: [], live: false } : null);

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
