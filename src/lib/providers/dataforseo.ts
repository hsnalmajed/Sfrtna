import { headers } from "next/headers";
import { cachedJson } from "@/lib/edgeCache";
import { CITY_COORDS } from "@/data/cityCoords";
import { tripCityFrom } from "@/lib/tripCity";
import type { HotelOffer, HotelResult, HotelRoom, HotelSearch } from "@/lib/providers/serpapi";

/**
 * Hotel prices from Google Hotels through DataForSEO (owner, 24 Nov 2026:
 * "show every hotel, commission or not, but never without its price").
 *
 * Same data as our SerpApi source, paid per request instead of a 250-a-month
 * free plan: a city list is one "Hotel Searches" request (billed per block
 * of 18 hotels), one hotel's prices at every site is one "Hotel Info"
 * request. Read from DataForSEO's own docs on 24 Nov 2026:
 *  - auth: HTTP Basic, login + password (Cloudflare secrets
 *    DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD, never in code);
 *  - hotel_searches/live: location_coordinate "lat,lng" or location_code,
 *    keyword, check_in/check_out, adults, children [ages], currency, depth
 *    (≤140), stars, min_rating, max_price, free_cancellation,
 *    is_vacation_rentals; item price = per night;
 *  - hotel_info/live/advanced: hotel_identifier → prices.items[] (title,
 *    domain, price, url, official_site, free_cancellation_until, offers[]
 *    with room title, price, max_visitors, offer_images), reviews (value,
 *    votes_count, mentions, rating_distribution), overview_images,
 *    amenities, address, check-in/out times, location.
 *
 * The account is prepaid, so spending can never pass what was deposited;
 * every answer is cached six hours, and our own checks never spend.
 * A hotel with no price is dropped: nothing is shown without its price.
 */

const BASE = "https://api.dataforseo.com/v3/business_data/google";
/** Saudi Arabia in Google's location list: our travellers' market. */
const MARKET = 2682;
/** First list: three billing blocks of 18 hotels. "More" doubles it. */
const FIRST_DEPTH = 54;
const MAX_DEPTH = 140;

function auth(): string {
  const login = process.env.DATAFORSEO_LOGIN || "";
  const pass = process.env.DATAFORSEO_PASSWORD || "";
  return login && pass ? `Basic ${btoa(`${login}:${pass}`)}` : "";
}

export function dfsConfigured(): boolean {
  return Boolean(auth());
}

/** Our own site checks read the cache only (same rule as serpapi.ts). */
async function isOwnCheck(): Promise<boolean> {
  const token = process.env.SMOKE_TOKEN;
  if (!token) return false;
  try {
    const h = await headers();
    return h.get("x-sfrtna-smoke") === token && h.get("x-sfrtna-spend") !== "1";
  } catch {
    return false;
  }
}

async function post(path: string, task: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const a = auth();
  if (!a || (await isOwnCheck())) return null;
  try {
    const res = await fetch(`${BASE}/${path}`, {
      method: "POST",
      headers: { Authorization: a, "Content-Type": "application/json" },
      body: JSON.stringify([task]),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { tasks?: { status_code?: number; result?: Record<string, unknown>[] }[] };
    const t = body.tasks?.[0];
    if (!t || t.status_code !== 20000) return null;
    return t.result?.[0] ?? null;
  } catch {
    return null;
  }
}

const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : null);
const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const https = (u: unknown) => (typeof u === "string" && /^https:\/\//.test(u) ? u : "");

interface DfsOffer {
  title?: string;
  price?: number;
  url?: string;
  max_visitors?: number;
  offer_images?: string[];
  free_cancellation_until?: string | null;
}
interface DfsPriceItem {
  title?: string;
  domain?: string;
  price?: number;
  url?: string;
  official_site?: boolean;
  free_cancellation_until?: string | null;
  offers?: DfsOffer[] | null;
}
interface DfsHotel {
  hotel_identifier?: string;
  title?: string;
  stars?: number;
  address?: string;
  full_address?: string;
  about?: { description?: string };
  check_in_time?: { hour?: number; minute?: number };
  check_out_time?: { hour?: number; minute?: number };
  amenities?: { amenity_label?: string; is_available?: boolean }[];
  popular_amenities?: { amenity_label?: string; is_available?: boolean }[];
  location?: { latitude?: number; longitude?: number; overall_score?: number };
  reviews?: {
    value?: number;
    votes_count?: number;
    mentions?: { title?: string; positive_count?: number; negative_count?: number; total_count?: number }[] | null;
    rating_distribution?: Record<string, number> | null;
  };
  overview_images?: string[];
  prices?: { price?: number; items?: DfsPriceItem[] | null };
}

const clock = (t?: { hour?: number; minute?: number }) =>
  typeof t?.hour === "number" ? `${String(t.hour).padStart(2, "0")}:${String(t.minute ?? 0).padStart(2, "0")}` : "";

/** "2026-12-08 00:00:00 +00:00" → { date: "2026-12-08" } (the page words it). */
const cancelDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

function hotelOf(h: DfsHotel): HotelResult {
  const items = (h.prices?.items ?? []).filter((p) => num(p.price));
  const offers: HotelOffer[] = items
    .map((p) => {
      const perNight = num(p.price);
      return {
        source: str(p.title, 60) || str(p.domain, 60),
        perNight,
        // Google gives a price a night only; no total is worked out here.
        total: null,
        perNightBeforeTax: null,
        official: p.official_site === true,
        link: https(p.url) || null,
      };
    })
    .filter((o) => o.source && o.perNight !== null)
    .sort((a, b) => (a.perNight ?? 0) - (b.perNight ?? 0));
  const rooms: HotelRoom[] = [];
  for (const p of items) {
    for (const o of p.offers ?? []) {
      const perNight = num(o.price);
      if (!perNight || !str(o.title)) continue;
      const until = cancelDate(o.free_cancellation_until);
      rooms.push({
        name: str(o.title, 80),
        source: str(p.title, 60) || str(p.domain, 60),
        image: https(o.offer_images?.[0]),
        guests: num(o.max_visitors),
        perNight,
        total: null,
        link: https(o.url) || https(p.url) || null,
        rates: [{ total: null, perNight, guests: num(o.max_visitors), freeCancel: Boolean(until), cancelUntil: until, cancelUntilTime: null, breakfast: false }],
      });
    }
  }
  const listPrice = num(h.prices?.price);
  const perNight = offers[0]?.perNight ?? listPrice;
  const dist = h.reviews?.rating_distribution ?? null;
  const amen = [...(h.popular_amenities ?? []), ...(h.amenities ?? [])]
    .filter((a) => a.is_available !== false)
    .map((a) => str(a.amenity_label, 60))
    .filter(Boolean);
  return {
    ...(rooms.length ? { rooms: rooms.sort((a, b) => (a.perNight ?? 0) - (b.perNight ?? 0)).slice(0, 30) } : {}),
    name: str(h.title, 160),
    token: str(h.hotel_identifier, 300) || null,
    stars: num(h.stars),
    rating: typeof h.reviews?.value === "number" ? h.reviews.value : null,
    reviews: num(h.reviews?.votes_count),
    perNight,
    total: null,
    offers,
    images: (h.overview_images ?? []).map(https).filter(Boolean).slice(0, 8).map((u) => ({ thumb: u, full: u })),
    address: str(h.full_address || h.address, 200),
    amenities: [...new Set(amen)].slice(0, 40),
    description: str(h.about?.description, 600),
    locationRating: typeof h.location?.overall_score === "number" ? h.location.overall_score : null,
    checkInTime: clock(h.check_in_time),
    checkOutTime: clock(h.check_out_time),
    lat: typeof h.location?.latitude === "number" ? h.location.latitude : null,
    lng: typeof h.location?.longitude === "number" ? h.location.longitude : null,
    ratingsHist: dist
      ? [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: Math.max(0, Math.round(Number(dist[String(s)]) || 0)) })).filter((r) => r.count > 0)
      : undefined,
    topics: (h.reviews?.mentions ?? [])
      .map((m) => ({ name: str(m.title, 40), total: num(m.total_count) ?? 0, positive: num(m.positive_count) ?? 0, negative: num(m.negative_count) ?? 0 }))
      .filter((m) => m.name && m.total > 0)
      .slice(0, 12),
  };
}

/** Our city for a query like "Istanbul" or "hotels in Istanbul": its centre. */
function cityPoint(q: string): string | null {
  const name = q.replace(/^hotels?\s+in\s+/i, "").replace(/^فنادق\s+/, "").split(/[,،]/)[0].trim();
  const c = tripCityFrom(name);
  const p = c ? CITY_COORDS[c.slug] : undefined;
  return p ? `${p.lat},${p.lon}` : null;
}

export async function dfsHotelPrices(q: {
  q: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges?: number[];
  currency?: string;
  token?: string;
  minStars?: number;
  maxPerNight?: number;
  rating?: number;
  freeCancel?: boolean;
  rentals?: boolean;
  page?: string;
  one?: boolean;
}): Promise<HotelSearch | null> {
  const currency = (q.currency || "SAR").toUpperCase();
  const ages = (q.childrenAges ?? []).map((a) => Math.min(17, Math.max(0, Math.round(a)))).slice(0, 5);
  const adults = Math.max(1, Math.min(6 - ages.length, q.adults));
  const party = { check_in: q.checkIn, check_out: q.checkOut, adults, ...(ages.length ? { children: ages } : {}), currency, language_code: "en" };

  // One hotel: every site's price for it.
  if (q.token) {
    const key = `dfs-hotel1:${q.token}:${q.checkIn}:${q.checkOut}:${adults}:${ages.join(",")}:${currency}`;
    return cachedJson<HotelSearch>(key, 6 * 3600, async () => {
      const r = await post("hotel_info/live/advanced", { hotel_identifier: q.token, location_code: MARKET, ...party });
      if (!r) return null;
      const h = hotelOf(r as DfsHotel);
      if (!h.name || h.perNight === null) return null;
      return { kind: "hotel", currency, hotels: [h], checkedAt: new Date().toISOString(), nextPage: null };
    });
  }

  // A city's list, or a named hotel's search (then its own page, when asked).
  // "More" token: d<depth>s<hotels already shown>.
  const pm = q.page ? /^d(\d{2,3})s(\d{1,3})$/.exec(q.page) : null;
  const depth = pm ? Math.min(MAX_DEPTH, Math.max(FIRST_DEPTH, Number(pm[1]))) : FIRST_DEPTH;
  const shown = pm ? Math.min(depth, Number(pm[2])) : 0;
  const point = cityPoint(q.q);
  const stars = q.minStars && q.minStars >= 2 && q.minStars <= 5 ? [2, 3, 4, 5].filter((s) => s >= (q.minStars as number)) : [];
  const minRating = q.rating === 9 ? 4.5 : q.rating === 8 ? 4 : q.rating === 7 ? 3.5 : 0;
  const maxPrice = q.maxPerNight && q.maxPerNight > 0 ? Math.round(q.maxPerNight) : 0;
  const key = `dfs-hotels1:${q.q.toLowerCase()}:${q.checkIn}:${q.checkOut}:${adults}:${ages.join(",")}:${currency}:${depth}:${stars.join("")}:${minRating}:${maxPrice}:${q.freeCancel ? 1 : 0}:${q.rentals ? 1 : 0}`;
  const list = await cachedJson<HotelSearch>(key, 6 * 3600, async () => {
    const r = await post("hotel_searches/live", {
      ...(point ? { location_coordinate: point } : { location_code: MARKET, keyword: q.q, search_this_area: false }),
      ...party,
      depth,
      ...(stars.length ? { stars } : {}),
      ...(minRating ? { min_rating: minRating } : {}),
      ...(maxPrice ? { max_price: maxPrice } : {}),
      ...(q.freeCancel ? { free_cancellation: true } : {}),
      ...(q.rentals ? { is_vacation_rentals: true } : {}),
    });
    if (!r) return null;
    const items = (r.items as DfsHotel[] | undefined) ?? [];
    const hotels = items.map((h) => hotelOf(h)).filter((h) => h.name && h.perNight !== null);
    if (!hotels.length) return null;
    const more = items.length >= depth && depth < MAX_DEPTH ? `d${Math.min(MAX_DEPTH, depth * 2)}s${depth}` : null;
    return { kind: "list", currency, hotels, checkedAt: new Date().toISOString(), nextPage: more };
  });
  if (!list) return null;
  // "More" asks a deeper list: the page shows only the hotels it has not shown.
  const page = shown ? { ...list, hotels: list.hotels.slice(shown) } : list;
  if (q.one && !point) {
    const top = page.hotels.find((h) => h.token);
    if (top?.token) return (await dfsHotelPrices({ ...q, one: false, page: undefined, token: top.token })) ?? page;
  }
  return page;
}
