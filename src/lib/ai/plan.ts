/**
 * «خطتي الذكية» — a day-by-day trip plan built from what the traveller tells
 * us (owner, 21 Oct 2026: "an AI that understands the traveller and builds an
 * organised, varied, accurate plan — hours, how to get there, what to wear,
 * the best dish, halal or not, booking — and more than I asked").
 *
 * What keeps it good and honest (owner, 21 Oct: "our own place list gave me
 * a 2-star place with 6 reviews — is that the best this country has?"):
 *   - the model chooses the BEST places for this traveller — the city's
 *     highly rated, well-reviewed sights and restaurants — and must verify
 *     each one by web search (rating and review count as the source shows
 *     them, hours, booking); our own stored list is passed only as a hint;
 *   - every stop is then placed on the map here: by our stored place of the
 *     same name, else OpenStreetMap search near the city centre; a stop we
 *     cannot place keeps a "search on the map" link instead of a pin;
 *   - what it could not confirm it must say so («غير مؤكد») — never guessed;
 *     it states no prices; the pages it used are listed under the plan;
 *   - weather is our own climate normals for the dates, not a forecast;
 *   - distances between stops are computed here from the positions.
 */

import { aiJson, type AiSource } from "@/lib/ai/provider";
import { readStoredPlaces, readStoredRestaurants, type StoredPlace, type StoredRestaurant } from "@/lib/mapPins";
import { seasonRecord } from "@/lib/travelSeason/site";
import { findCity } from "@/lib/cities";
import { findCountry } from "@/lib/countries";
import { CITY_COORDS } from "@/data/cityCoords";

// ── What the traveller tells us ─────────────────────────────────────────────

export const COMPANY = ["solo", "couple", "family_kids", "family_adults", "friends", "seniors"] as const;
export const INTERESTS = [
  "famous", "history", "islamic", "museums", "art", "oldtown",
  "nature", "mountains", "beaches", "relax", "kids", "malls",
  "souqs", "food", "modern", "photo", "night", "churches",
] as const;
/** When the traveller arrives on the first day and leaves on the last. */
export const DAY_PART = ["morning", "noon", "evening"] as const;
/** Needs that change the plan (strollers, wheelchairs, crowds…). */
export const NEEDS = ["stroller", "wheelchair", "less_walking", "avoid_crowds", "free_first", "prayer"] as const;
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
  arrive?: (typeof DAY_PART)[number];
  leave?: (typeof DAY_PART)[number];
  needs?: (typeof NEEDS)[number][];
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
      interests: pickMany(INTERESTS, a.interests, 8),
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
      arrive: pickEnum(DAY_PART, a.arrive) ?? "morning",
      leave: pickEnum(DAY_PART, a.leave) ?? "evening",
      needs: pickMany(NEEDS, a.needs, NEEDS.length),
    },
  };
}

// ── What comes back ────────────────────────────────────────────────────────

export interface PlanItem {
  time: string;
  kind: "place" | "meal" | "break";
  name: string;
  /** Name as written locally, area, rating as the source shows it. */
  localName: string;
  area: string;
  rating: string;
  website: string;
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
  /** The stop as a Google Maps search (name and city). */
  mapQuery?: string;
  /** Which of the traveller's interests chose it (an INTERESTS key). */
  forYou?: string;
}

export interface PlanDay {
  date: string;
  title: string;
  area: string;
  weather: string;
  wear: string;
  items: PlanItem[];
  /** The day's prayer times in the city's own time ("05:12 · 11:58 …"). */
  prayers?: { fajr: string; dhuhr: string; asr: string; maghrib: string; isha: string };
  /** What shaped this day (heat, arrival, a closed day…), short notes. */
  notes?: string[];
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
              required: ["time", "kind", "name", "local_name", "area", "rating", "website", "lat", "lon", "duration_min", "why", "tip", "hours", "booking", "dress", "dish", "halal", "getting_there"],
              properties: {
                time: str,
                kind: { type: "string", enum: ["place", "meal", "break"] },
                name: str,
                local_name: str,
                area: str,
                rating: str,
                website: str,
                lat: { type: ["number", "null"] },
                lon: { type: ["number", "null"] },
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
  const center = CITY_COORDS[req.slug];
  // Our stored names are only a memory aid and a source of map positions.
  const pool = candidatePlaces(places ?? [], 40);
  const eat: StoredRestaurant[] = [...restaurants].sort((x, y) => (y.h ?? 0) - (x.h ?? 0) || y.f - x.f).slice(0, 25);

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

  const hintLines = pool.map((p) => `${p.e ?? p.n} (${p.k})`).join("; ");
  const foodHints = eat.map((r) => `${r.e ?? r.n}${r.u ? ` (${r.u})` : ""}${r.h ? " [tagged halal]" : ""}`).join("; ");

  const system = `You are Sfrtna's trip planner — the best local expert a traveller from Saudi Arabia or the Gulf could ask, planning for THIS traveller.
Write everything in ${lang}.
Choosing places (most important):
1. Pick the city's genuinely best places for this traveller: iconic sights, top-rated attractions and experiences, and well-loved restaurants — places with high ratings and many reviews on Google Maps or Tripadvisor (as a rule ≥ 4.3/5 with hundreds of reviews for sights, ≥ 4.3 with 300+ for restaurants), plus a few outstanding lesser-known gems. Never fill a day with obscure, poorly rated or barely reviewed places.
2. Verify every place by web search: it exists and is open on the travel dates; read its rating and number of reviews from the source and write them in "rating" as found, e.g. "4.7 (52,000 reviews, Google)"; "website" = its official site, else "". Give its coordinates in lat/lon only if you found them, else null. "local_name" = the name as signed locally (Latin or local script); "area" = its neighbourhood.
3. Use the HINTS only as a memory aid; you are not limited to them.
Building each day:
4. Varied: never two items of the same purpose on one day (no two parks, two museums, two malls, two religious sites the same day); mix a highlight, an experience and a calmer stop. Group stops that are near each other and order them to avoid crossing the city; each at its best time (opening, sunset, before crowds, cooler hours in heat).
5. Pace: relaxed 2–3 places, balanced 3–4, packed 5–6, plus meals. First and last day lighter. Respect start time and evenings.
6. Meals: lunch and dinner every full day (a breakfast spot when it is part of the experience), near that day's stops. ${a.halalOnly ? "HALAL: choose restaurants confirmed halal (certified, Muslim-owned or clearly stated by the restaurant/source); write in \"halal\" exactly what the source says; if not confirmed, say so and prefer a confirmed alternative." : "Mention halal status when known."}${a.vegetarian ? " Vegetarian options required." : ""} "dish" = the dish the place is known for.
7. For each stop: "hours" on the travel dates (note weekly closing days and holidays); "booking": whether tickets/reservation are needed or strongly advised, and how (official site, timed tickets, how far ahead); "dress": what to wear there (modest dress for mosques/churches/temples, comfortable shoes for long walks, swimwear rules, etc.); "getting_there": from the previous stop with their transport (walk / metro line / taxi) and realistic minutes${a.move === "car" ? ", plus the nearest parking" : ""}; "tip": one insider tip (best photo spot, quieter entrance, what to skip, kids' needs); "why": why it fits THIS traveller.
8. "weather" from the CLIMATE lines (long-term averages, not a forecast) — say so briefly; "wear" = what to wear that day for the weather and the day's places.
9. essentials: packing for the season and activities; customs and etiquette (incl. for Muslim travellers: prayer places, modesty, alcohol in restaurants); transport (cards, apps, airport transfer); money (currency, cards, tipping); 5–8 local phrases with meaning; safety; emergency numbers (only if confirmed).
10. Search as much as needed to be right (about 15–25 searches). If something could not be confirmed write "غير مؤكد"/"not confirmed" — never guess. Do not state prices.
11. Times as 24h "HH:MM". One day per date from ${req.from} to ${req.to} (${dayCount} days), dates as YYYY-MM-DD. Keep each text short and concrete.`;

  const user = `CITY: ${city.nameEn}, ${country.nameEn}. Dates ${req.from} to ${req.to} (${dayCount} days).
CLIMATE (our long-term averages):
${climate || "not available"}

TRAVELLER:
${traveller}

HINTS — some known places (not a limit): ${hintLines || "none"}
HINTS — some restaurants: ${foodHints || "none"}`;

  const answer = await aiJson<{
    summary: string;
    days: (Omit<PlanDay, "items"> & {
      items: {
        time: string; kind: PlanItem["kind"]; name: string; local_name: string; area: string; rating: string; website: string;
        lat: number | null; lon: number | null; duration_min: number; why: string; tip: string; hours: string; booking: string;
        dress: string; dish: string; halal: string; getting_there: string;
      }[];
    })[];
    essentials: SmartPlan["essentials"];
  }>({
    system,
    user,
    schemaName: "trip_plan",
    schema: SCHEMA as unknown as Record<string, unknown>,
    search: { country: req.code, city: city.nameEn },
    effort: "medium",
    timeoutMs: 240_000,
  });
  if ("error" in answer) return answer;

  // Each stop on the map: our stored place of the same name, else an
  // OpenStreetMap search near the city centre, else the model's own position
  // when it lies in the city; failing all, a map-search link.
  const stored = [...(places ?? []), ...restaurants];
  const norm = (x: string) => x.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const near = (lat: number, lon: number, maxKm: number) => !center || km(center, { lat, lon }) <= maxKm;
  let lookups = 0;
  async function place(it: { name: string; local_name: string; lat: number | null; lon: number | null }): Promise<{ lat: number; lon: number } | null> {
    const names = [it.local_name, it.name].filter(Boolean).map(norm);
    const hit = stored.find((p) => names.includes(norm(p.e ?? p.n)) || names.includes(norm(p.n)));
    if (hit) return { lat: hit.y, lon: hit.x };
    if (lookups < 24 && center) {
      lookups++;
      const found = await photon(`${it.local_name || it.name} ${city!.nameEn}`, center);
      if (found && near(found.lat, found.lon, 60)) return found;
    }
    if (typeof it.lat === "number" && typeof it.lon === "number" && near(it.lat, it.lon, 60)) return { lat: it.lat, lon: it.lon };
    return null;
  }

  const days: PlanDay[] = [];
  for (const d of answer.data.days.slice(0, dayCount)) {
    let prev: { lat: number; lon: number } | null = null;
    const items: PlanItem[] = [];
    const pos = await Promise.all(d.items.map((it) => (it.kind === "break" ? Promise.resolve(null) : place(it))));
    d.items.forEach((it, k) => {
      const item: PlanItem = {
        time: /^\d{2}:\d{2}$/.test(it.time) ? it.time : "",
        kind: it.kind,
        name: it.name.slice(0, 120),
        localName: it.local_name.slice(0, 120),
        area: it.area.slice(0, 80),
        rating: it.rating.slice(0, 80),
        website: /^https:\/\//.test(it.website) ? it.website.slice(0, 300) : "",
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
      const p = pos[k];
      if (p) {
        item.lat = p.lat;
        item.lon = p.lon;
        if (prev) item.fromPrevKm = Math.round(km(prev, p) * 10) / 10;
        prev = p;
      }
      if (it.kind !== "break") item.mapQuery = `${it.local_name || it.name}, ${city.nameEn}`;
      if (it.kind === "place") item.ticketQuery = `${it.local_name || it.name} ${city.nameEn}`;
      items.push(item);
    });
    days.push({ date: d.date, title: d.title, area: d.area, weather: d.weather, wear: d.wear, items });
  }

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

/** One OpenStreetMap search (Photon) for a named place near the city, cached a month. */
async function photon(q: string, at: { lat: number; lon: number }): Promise<{ lat: number; lon: number } | null> {
  // Not cached on its own: each cache read/write is a subrequest too, and a
  // Worker request has 50. The whole plan is cached instead.
  {
    try {
      const u = new URL("https://photon.komoot.io/api/");
      u.searchParams.set("q", q);
      u.searchParams.set("limit", "1");
      u.searchParams.set("lat", String(at.lat));
      u.searchParams.set("lon", String(at.lon));
      const res = await fetch(u.toString(), { headers: { "User-Agent": "sfrtna.com trip planner" }, signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      const j = (await res.json()) as { features?: { geometry?: { coordinates?: [number, number] } }[] };
      const c = j.features?.[0]?.geometry?.coordinates;
      return c ? { lat: c[1], lon: c[0] } : null;
    } catch {
      return null;
    }
  }
}

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const t = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(t(b.lat - a.lat) / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(t(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
