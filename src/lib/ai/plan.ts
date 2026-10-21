/**
 * «خطتي الذكية» — a day-by-day trip plan built from what the traveller tells
 * us (owner, 21 Oct 2026: "an AI that understands the traveller and builds an
 * organised, varied, accurate plan — hours, how to get there, what to wear,
 * the best dish, halal or not, booking — and more than I asked").
 *
 * What keeps it honest:
 *   - every place in the plan is one of OUR stored places or restaurants for
 *     the city (OpenStreetMap, with coordinates), passed in by id — the model
 *     orders and explains them, it does not invent places; any id it returns
 *     that we did not give is dropped;
 *   - facts that change (opening hours, booking, prices, dishes) come from
 *     web search, and the pages used are shown under the plan; what it could
 *     not confirm it must say so («غير مؤكد») instead of guessing;
 *   - weather is our own climate normals for the dates, not a forecast;
 *   - distances between stops are computed here from the coordinates.
 */

import { aiJson, type AiSource } from "@/lib/ai/provider";
import { readStoredPlaces, readStoredRestaurants, type StoredPlace, type StoredRestaurant } from "@/lib/mapPins";
import { seasonRecord } from "@/lib/travelSeason/site";
import { findCity } from "@/lib/cities";
import { findCountry } from "@/lib/countries";

// ── What the traveller tells us ─────────────────────────────────────────────

export const COMPANY = ["solo", "couple", "family_kids", "family_adults", "friends", "seniors"] as const;
export const INTERESTS = [
  "landmarks", "museums", "nature", "shopping", "adventure", "beaches",
  "local_life", "kids_fun", "photography", "food", "nightlife_calm", "wellness",
] as const;
export const PACE = ["relaxed", "balanced", "packed"] as const;
export const START = ["early", "normal", "late"] as const;
export const FOOD = ["local", "international", "fine", "quick"] as const;
export const MOVE = ["walk_transit", "taxi", "car"] as const;
export const SPEND = ["budget", "mid", "luxury"] as const;

export interface PlanAnswers {
  company: (typeof COMPANY)[number];
  kidsAges?: number[];
  interests: (typeof INTERESTS)[number][];
  pace: (typeof PACE)[number];
  start: (typeof START)[number];
  lateNights: boolean;
  halalOnly: boolean;
  food: (typeof FOOD)[number][];
  vegetarian: boolean;
  move: (typeof MOVE)[number];
  spend: (typeof SPEND)[number];
  firstVisit: boolean;
  /** Anything else, in their words (short). */
  note: string;
}

export interface PlanRequest {
  code: string;
  slug: string;
  from: string;
  to: string;
  locale: "ar" | "en";
  answers: PlanAnswers;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const pickEnum = <T extends readonly string[]>(list: T, v: unknown): T[number] | null =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T[number]) : null;
const pickMany = <T extends readonly string[]>(list: T, v: unknown, max: number): T[number][] =>
  Array.isArray(v) ? ([...new Set(v.filter((x) => (list as readonly string[]).includes(x as string)))].slice(0, max) as T[number][]) : [];

/** The request as we accept it, or null. */
export function cleanPlanRequest(b: unknown): PlanRequest | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, unknown>;
  const a = (o.answers ?? {}) as Record<string, unknown>;
  const code = typeof o.code === "string" && /^[A-Z]{2}$/.test(o.code) ? o.code : null;
  const slug = typeof o.slug === "string" && /^[a-z0-9-]{2,60}$/.test(o.slug) ? o.slug : null;
  const from = typeof o.from === "string" && ISO.test(o.from) ? o.from : null;
  const to = typeof o.to === "string" && ISO.test(o.to) ? o.to : null;
  if (!code || !slug || !from || !to || to < from) return null;
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  if (days < 1 || days > 14) return null;
  const company = pickEnum(COMPANY, a.company);
  const pace = pickEnum(PACE, a.pace);
  const start = pickEnum(START, a.start);
  const move = pickEnum(MOVE, a.move);
  const spend = pickEnum(SPEND, a.spend);
  if (!company || !pace || !start || !move || !spend) return null;
  return {
    code,
    slug,
    from,
    to,
    locale: o.locale === "en" ? "en" : "ar",
    answers: {
      company,
      kidsAges: Array.isArray(a.kidsAges) ? a.kidsAges.filter((x) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 17).slice(0, 6) as number[] : undefined,
      interests: pickMany(INTERESTS, a.interests, 6),
      pace,
      start,
      lateNights: a.lateNights === true,
      halalOnly: a.halalOnly !== false,
      food: pickMany(FOOD, a.food, 4),
      vegetarian: a.vegetarian === true,
      move,
      spend,
      firstVisit: a.firstVisit !== false,
      note: typeof a.note === "string" ? a.note.replace(/[<>]/g, "").trim().slice(0, 200) : "",
    },
  };
}

// ── What comes back ────────────────────────────────────────────────────────

export interface PlanItem {
  time: string;
  kind: "place" | "meal" | "break";
  ref: string;
  name: string;
  durationMin: number;
  why: string;
  tip: string;
  hours: string;
  booking: string;
  dress: string;
  dish: string;
  halal: string;
  gettingThere: string;
  /** Added here: position, and the straight distance from the stop before. */
  lat?: number;
  lon?: number;
  fromPrevKm?: number;
  ticketQuery?: string;
}

export interface PlanDay {
  date: string;
  title: string;
  area: string;
  weather: string;
  wear: string;
  items: PlanItem[];
}

export interface SmartPlan {
  summary: string;
  days: PlanDay[];
  essentials: {
    packing: string[];
    etiquette: string[];
    transport: string[];
    money: string[];
    phrases: string[];
    safety: string[];
    emergency: string;
  };
  sources: AiSource[];
  city: { code: string; slug: string; name: string };
  from: string;
  to: string;
  generatedAt: string;
}

const str = { type: "string" } as const;
const strList = { type: "array", items: str } as const;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "days", "essentials"],
  properties: {
    summary: str,
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "title", "area", "weather", "wear", "items"],
        properties: {
          date: str,
          title: str,
          area: str,
          weather: str,
          wear: str,
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["time", "kind", "ref", "name", "duration_min", "why", "tip", "hours", "booking", "dress", "dish", "halal", "getting_there"],
              properties: {
                time: str,
                kind: { type: "string", enum: ["place", "meal", "break"] },
                ref: str,
                name: str,
                duration_min: { type: "integer" },
                why: str,
                tip: str,
                hours: str,
                booking: str,
                dress: str,
                dish: str,
                halal: str,
                getting_there: str,
              },
            },
          },
        },
      },
    },
    essentials: {
      type: "object",
      additionalProperties: false,
      required: ["packing", "etiquette", "transport", "money", "phrases", "safety", "emergency"],
      properties: { packing: strList, etiquette: strList, transport: strList, money: strList, phrases: strList, safety: strList, emergency: str },
    },
  },
} as const;

// ── Building the request ───────────────────────────────────────────────────

/** Our places for the city, varied: the best known of each kind in turn. */
function candidatePlaces(all: StoredPlace[], max: number): StoredPlace[] {
  const byKind = new Map<string, StoredPlace[]>();
  for (const p of [...all].sort((a, b) => b.f - a.f)) byKind.set(p.k, [...(byKind.get(p.k) ?? []), p]);
  // The first stretch keeps the famous ones whatever their kind…
  const out = [...all].sort((a, b) => b.f - a.f).slice(0, Math.round(max / 2));
  const seen = new Set(out.map((p) => p.i));
  // …then round-robin across kinds, so a city of churches still offers parks,
  // markets, viewpoints and museums.
  const lists = [...byKind.values()];
  for (let round = 0; out.length < max && lists.some((l) => l.length > round); round++) {
    for (const l of lists) {
      const p = l[round];
      if (p && !seen.has(p.i)) {
        out.push(p);
        seen.add(p.i);
        if (out.length >= max) break;
      }
    }
  }
  return out;
}

const LABEL_EN: Record<string, string> = {
  solo: "travelling alone", couple: "a couple", family_kids: "a family with children", family_adults: "a family of adults",
  friends: "a group of friends", seniors: "older travellers who prefer an easy pace",
  relaxed: "relaxed (2–3 stops a day, long breaks)", balanced: "balanced (3–4 stops a day)", packed: "packed (5+ stops a day)",
  early: "starts early (around 8:00)", normal: "starts around 10:00", late: "starts late (around noon)",
  walk_transit: "walking and public transport", taxi: "taxi / ride-hailing", car: "a rented car (needs parking info)",
  budget: "budget-conscious", mid: "mid-range", luxury: "luxury",
  local: "local dishes", international: "international cuisine", fine: "fine dining", quick: "quick and casual",
};

export async function buildPlan(req: PlanRequest): Promise<SmartPlan | { error: string }> {
  const city = findCity(req.code, req.slug);
  const country = findCountry(req.code);
  if (!city || !country) return { error: "unknown_city" };
  const [places, restaurants] = await Promise.all([readStoredPlaces(req.slug), readStoredRestaurants(req.slug)]);
  if (!places?.length) return { error: "no_places" };

  const pool = candidatePlaces(places, 70);
  // Restaurants tagged halal first when it matters, then the best documented.
  const eat: StoredRestaurant[] = [...restaurants]
    .sort((a, b) => (b.h ?? 0) - (a.h ?? 0) || b.f - a.f)
    .slice(0, 40);
  const byId = new Map<string, { lat: number; lon: number; en: string; kind: string; meal: boolean }>();
  pool.forEach((p, i) => byId.set(`p${i}`, { lat: p.y, lon: p.x, en: p.e ?? p.n, kind: p.k, meal: false }));
  eat.forEach((r, i) => byId.set(`r${i}`, { lat: r.y, lon: r.x, en: r.e ?? r.n, kind: "restaurant", meal: true }));

  const nights = Math.round((Date.parse(req.to) - Date.parse(req.from)) / 86_400_000);
  const dayCount = nights + 1;
  const months = [...new Set([Number(req.from.slice(5, 7)), Number(req.to.slice(5, 7))])];
  const climate = months
    .map((m) => {
      const r = seasonRecord(req.slug, m);
      return r ? `month ${m}: highs ${Math.round(r.averageHighC ?? 0)}°C, lows ${Math.round(r.averageLowC ?? 0)}°C, about ${Math.round(r.precipitationDays ?? 0)} rainy days; ${r.seasonNameEn}${r.highlightEn ? `; highlight: ${r.highlightEn}` : ""}` : null;
    })
    .filter(Boolean)
    .join("\n");

  const a = req.answers;
  const lang = req.locale === "ar" ? "Arabic (Modern Standard, clear and friendly; place names in Arabic when they have a well-known Arabic name, else as written locally)" : "English";
  const traveller = [
    `Who: ${LABEL_EN[a.company]}${a.kidsAges?.length ? ` (children aged ${a.kidsAges.join(", ")})` : ""}.`,
    `Enjoys: ${a.interests.length ? a.interests.join(", ") : "a bit of everything"}.`,
    `Pace: ${LABEL_EN[a.pace]}. Day ${LABEL_EN[a.start]}${a.lateNights ? ", likes evenings out" : ", back by about 21:00"}.`,
    `Food: ${a.halalOnly ? "HALAL ONLY" : "no halal requirement"}${a.vegetarian ? ", vegetarian" : ""}; likes ${a.food.length ? a.food.map((f) => LABEL_EN[f]).join(", ") : "anything good"}.`,
    `Getting around: ${LABEL_EN[a.move]}. Spending: ${LABEL_EN[a.spend]}. ${a.firstVisit ? "First visit to this city." : "Has been before — skip the most obvious first-timer sights unless outstanding."}`,
    a.note ? `In their words: "${a.note}"` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const placeLines = pool.map((p, i) => `p${i} | ${p.e ?? p.n}${p.a ? ` / ${p.a}` : ""} | ${p.k} | ${p.y.toFixed(4)},${p.x.toFixed(4)}`).join("\n");
  const foodLines = eat.map((r, i) => `r${i} | ${r.e ?? r.n} | ${r.u ?? "?"}${r.h ? " | tagged halal" : ""} | ${r.y.toFixed(4)},${r.x.toFixed(4)}`).join("\n");

  const system = `You are Sfrtna's trip planner — a meticulous local expert who plans for travellers from Saudi Arabia and the Gulf.
Write everything in ${lang}.
Rules (strict):
1. Use ONLY places from the PLACES and RESTAURANTS lists, by their id in "ref" (p… or r…). Never invent a place. A "break" item (rest at the hotel, a café pause) has ref "".
2. Each day: varied — never two items of the same purpose on one day (no two parks, two museums or two malls the same day); group stops that are near each other (use the coordinates) and order them to avoid crossing the city back and forth; put sights at their best time (opening, sunset, before crowds).
3. Respect the pace: relaxed 2–3 places, balanced 3–4, packed 5–6, plus meals. First and last day lighter (arrival/departure). Respect start time and evenings.
4. Meals: lunch and dinner every full day from RESTAURANTS near that day's stops. ${a.halalOnly ? "Halal only: prefer restaurants tagged halal; for others say what web search confirms (halal certified / halal options / not halal) — never claim halal without a source; if unknown write that it is not confirmed." : "Mention halal status when known."}
5. Use web search to confirm, for the main sights and every restaurant: opening hours on the travel dates (note weekly closing days and holidays), whether booking/tickets are needed and how (official site or our partners), the signature dish, dress code (e.g. modest dress and covered shoulders for mosques and churches, no shorts), and for a traveller with a car the nearest parking. Search at most about 12 times; prioritise what matters most. If something could not be confirmed, write "غير مؤكد"/"not confirmed" — never guess hours or prices. Do not state prices.
6. "getting_there": how to reach this stop from the previous one with their transport (walk/metro line/taxi) and a realistic duration; the first stop of a day from the city centre.
7. "weather" for each day comes from the CLIMATE lines (averages, not a forecast) — say so briefly; "wear" = what to wear that day for the weather AND the day's places/activities.
8. "tip": one insider tip (best photo spot, quiet entrance, what to skip, kids' needs). "why": one line on why it fits THIS traveller.
9. essentials: packing list for the season and activities; local etiquette (incl. for Muslim travellers: prayer, modesty, alcohol in restaurants); transport tips (cards/apps/airport transfer); money (currency, cards, tipping); 5–8 useful local phrases with meaning; safety; emergency numbers (only if confirmed).
10. Times as 24h "HH:MM". Dates as YYYY-MM-DD, one day per date from ${req.from} to ${req.to} (${dayCount} days).
Keep every text short and concrete.`;

  const user = `CITY: ${city.nameEn}, ${country.nameEn}. Dates ${req.from} to ${req.to} (${dayCount} days).
CLIMATE (our long-term averages):
${climate || "not available"}

TRAVELLER:
${traveller}

PLACES (id | name | kind | lat,lon):
${placeLines}

RESTAURANTS (id | name | cuisine | lat,lon):
${foodLines || "none stored — use break items for meals and say to choose a nearby restaurant"}`;

  const answer = await aiJson<{
    summary: string;
    days: (Omit<PlanDay, "items"> & { items: (Omit<PlanItem, "durationMin" | "gettingThere"> & { duration_min: number; getting_there: string })[] })[];
    essentials: SmartPlan["essentials"];
  }>({
    system,
    user,
    schemaName: "trip_plan",
    schema: SCHEMA as unknown as Record<string, unknown>,
    search: { country: req.code, city: city.nameEn },
    effort: "medium",
  });
  if ("error" in answer) return answer;

  // Keep only what we can stand behind: our own places, their positions, and
  // the straight distance between consecutive stops.
  const days: PlanDay[] = answer.data.days.slice(0, dayCount).map((d) => {
    let prev: { lat: number; lon: number } | null = null;
    const items: PlanItem[] = [];
    for (const it of d.items) {
      const known = it.ref ? byId.get(it.ref) : undefined;
      if (it.kind !== "break" && !known) continue;
      const item: PlanItem = {
        time: /^\d{2}:\d{2}$/.test(it.time) ? it.time : "",
        kind: it.kind,
        ref: known ? it.ref : "",
        name: it.name.slice(0, 120),
        durationMin: Math.max(0, Math.min(600, Math.round(it.duration_min || 0))),
        why: it.why.slice(0, 300),
        tip: it.tip.slice(0, 300),
        hours: it.hours.slice(0, 200),
        booking: it.booking.slice(0, 300),
        dress: it.dress.slice(0, 200),
        dish: it.dish.slice(0, 200),
        halal: it.halal.slice(0, 200),
        gettingThere: it.getting_there.slice(0, 300),
      };
      if (known) {
        item.lat = known.lat;
        item.lon = known.lon;
        if (prev) item.fromPrevKm = Math.round(km(prev, known) * 10) / 10;
        prev = known;
        if (!known.meal) item.ticketQuery = `${known.en} ${city.nameEn}`;
      }
      items.push(item);
    }
    return { date: d.date, title: d.title, area: d.area, weather: d.weather, wear: d.wear, items };
  });

  return {
    summary: answer.data.summary,
    days,
    essentials: answer.data.essentials,
    sources: answer.sources,
    city: { code: req.code, slug: req.slug, name: req.locale === "ar" ? city.nameAr : city.nameEn },
    from: req.from,
    to: req.to,
    generatedAt: new Date().toISOString(),
  };
}

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const t = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(t(b.lat - a.lat) / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(t(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
