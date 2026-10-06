import { cachedJson } from "@/lib/edgeCache";

/**
 * Live prices from Google Flights and Google Hotels, through SerpApi.
 *
 * The fares the site had (Travelpayouts' cache) are other people's searches
 * from days ago: checked on 6 Oct 2026 against live searches, a quarter were
 * off by 20–40%. SerpApi runs the search now. It is used where a number has
 * to be right — "within your budget", a hotel's price at each site — and
 * nowhere else, because every search spends from a monthly allowance.
 *
 * Three rules keep that allowance from ever running out on a visitor:
 *
 *  1. Every answer is cached at the edge (a few hours), so a route asked by
 *     a hundred visitors costs one search.
 *  2. Before searching, the account's own count is read (SerpApi's account
 *     endpoint, which is free) and a search is only made while usage is on
 *     pace for the month: what is left must cover the days still to come.
 *     A busy day cannot spend next week's searches.
 *  3. When a search is not made — no key, allowance paced out, or SerpApi
 *     down — the caller gets null and shows what it showed before: the live
 *     flight search still works, only the verified number is missing.
 *
 * The key is a Cloudflare secret (SERPAPI_KEY) and never leaves the server.
 */

const BASE = "https://serpapi.com";

function key(): string {
  return process.env.SERPAPI_KEY || "";
}

interface Account {
  /** Searches left this month on the plan (plus any extra credits). */
  left: number;
  /** The plan's monthly searches. */
  perMonth: number;
  used: number;
}

/** The account's usage, read at most every two minutes. Free: not a search. */
async function account(): Promise<Account | null> {
  if (!key()) return null;
  return cachedJson<Account>("serpapi-account", 120, async () => {
    try {
      const res = await fetch(`${BASE}/account.json?api_key=${encodeURIComponent(key())}`);
      if (!res.ok) return null;
      const a = (await res.json()) as {
        total_searches_left?: number;
        plan_searches_left?: number;
        searches_per_month?: number;
        this_month_usage?: number;
      };
      const left = Number(a.total_searches_left ?? a.plan_searches_left);
      const perMonth = Number(a.searches_per_month);
      if (!Number.isFinite(left) || !Number.isFinite(perMonth)) return null;
      return { left, perMonth, used: Number(a.this_month_usage) || 0 };
    } catch {
      return null;
    }
  });
}

/**
 * May a search be spent now? Only while what is left covers the rest of the
 * month at the plan's even daily pace — today's share included.
 */
async function maySearch(): Promise<boolean> {
  const a = await account();
  if (!a || a.left <= 0) return false;
  const now = new Date();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const daysAfterToday = daysInMonth - now.getUTCDate();
  const perDay = a.perMonth / daysInMonth;
  return a.left > Math.floor(daysAfterToday * perDay);
}

/** Whether a key is set at all — for the status check. */
export function serpConfigured(): boolean {
  return Boolean(key());
}

/** Usage, for the site's own status check: never the key. */
export async function serpUsage(): Promise<(Account & { mayUse: boolean }) | null> {
  const a = await account();
  if (!a) return null;
  return { ...a, mayUse: await maySearch() };
}

async function search(params: Record<string, string>): Promise<Record<string, unknown> | null> {
  if (!key() || !(await maySearch())) return null;
  const url = new URL(`${BASE}/search.json`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("api_key", key());
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const body = (await res.json()) as Record<string, unknown>;
    if (body.error) return null;
    return body;
  } catch {
    return null;
  }
}

export interface LiveFare {
  /** Total for all travellers, in `currency`; both ways for a return trip. */
  price: number;
  currency: string;
  airline: string;
  stops: number;
  /** Minutes, the outbound journey. */
  durationMinutes: number;
  /** ISO time the price was fetched. */
  checkedAt: string;
}

interface GfFlight {
  airline?: string;
}
interface GfOption {
  flights?: GfFlight[];
  layovers?: unknown[];
  total_duration?: number;
  price?: number;
}

/**
 * The cheapest fare Google Flights shows now for one route and date (and
 * return date), for `adults` + `children` in economy, cached six hours.
 * Null when it could not be checked.
 */
export async function liveFare(q: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults: number;
  children?: number;
  currency?: string;
}): Promise<LiveFare | null> {
  const currency = (q.currency || "SAR").toUpperCase();
  const cacheKey = `serp-fare:${q.origin}:${q.destination}:${q.departDate}:${q.returnDate ?? ""}:${q.adults}:${q.children ?? 0}:${currency}`;
  return cachedJson<LiveFare>(cacheKey, 6 * 3600, async () => {
    const body = await search({
      engine: "google_flights",
      departure_id: q.origin,
      arrival_id: q.destination,
      outbound_date: q.departDate,
      ...(q.returnDate ? { return_date: q.returnDate, type: "1" } : { type: "2" }),
      adults: String(Math.max(1, q.adults)),
      ...(q.children ? { children: String(q.children) } : {}),
      currency,
      hl: "en",
      gl: "sa",
    });
    if (!body) return null;
    const options = [
      ...((body.best_flights as GfOption[] | undefined) ?? []),
      ...((body.other_flights as GfOption[] | undefined) ?? []),
    ].filter((o) => typeof o.price === "number" && o.price > 0);
    if (!options.length) return null;
    const best = options.reduce((a, b) => ((b.price as number) < (a.price as number) ? b : a));
    const airlines = [...new Set((best.flights ?? []).map((f) => f.airline).filter(Boolean))];
    return {
      price: Math.round(best.price as number),
      currency,
      airline: airlines.join(" / ") || "—",
      stops: best.layovers?.length ?? Math.max(0, (best.flights?.length ?? 1) - 1),
      durationMinutes: best.total_duration ?? 0,
      checkedAt: new Date().toISOString(),
    };
  });
}

/* ───────────────────────────── Google Hotels ───────────────────────────── */

/** One booking site's price for a hotel, as Google Hotels lists it. */
export interface HotelOffer {
  /** The booking site: "Booking.com", "Expedia.com", the hotel's own site… */
  source: string;
  /** Per night, taxes and fees included, in the search currency. */
  perNight: number | null;
  /** The whole stay, taxes and fees included, when Google gives it. */
  total: number | null;
  /** Per night before taxes and fees, when Google gives it. */
  perNightBeforeTax: number | null;
  official: boolean;
}

export interface HotelResult {
  name: string;
  /** Google's id for the hotel: asks its own prices without a name search. */
  token: string | null;
  stars: number | null;
  rating: number | null;
  reviews: number | null;
  /** Cheapest per night across the sites, taxes included. */
  perNight: number | null;
  total: number | null;
  offers: HotelOffer[];
}

export interface HotelSearch {
  /** "hotel" when the query matched one hotel; "list" for a city's hotels. */
  kind: "hotel" | "list";
  currency: string;
  hotels: HotelResult[];
  checkedAt: string;
}

type Rate = { extracted_lowest?: number; extracted_before_taxes_fees?: number } | undefined;
interface GhPrice {
  source?: string;
  official?: boolean;
  rate_per_night?: Rate;
  total_rate?: Rate;
}
interface GhProperty {
  name?: string;
  property_token?: string;
  extracted_hotel_class?: number;
  overall_rating?: number;
  reviews?: number;
  rate_per_night?: Rate;
  total_rate?: Rate;
  prices?: GhPrice[];
  featured_prices?: GhPrice[];
}

const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : null);

function offersOf(p: GhProperty): HotelOffer[] {
  const seen = new Set<string>();
  const out: HotelOffer[] = [];
  for (const o of [...(p.featured_prices ?? []), ...(p.prices ?? [])]) {
    const source = (o.source || "").trim();
    if (!source || seen.has(source)) continue;
    seen.add(source);
    out.push({
      source,
      perNight: num(o.rate_per_night?.extracted_lowest),
      total: num(o.total_rate?.extracted_lowest),
      perNightBeforeTax: num(o.rate_per_night?.extracted_before_taxes_fees),
      official: Boolean(o.official),
    });
  }
  return out;
}

function hotelOf(p: GhProperty): HotelResult {
  return {
    name: p.name || "",
    token: p.property_token || null,
    stars: num(p.extracted_hotel_class),
    rating: typeof p.overall_rating === "number" ? p.overall_rating : null,
    reviews: num(p.reviews),
    perNight: num(p.rate_per_night?.extracted_lowest),
    total: num(p.total_rate?.extracted_lowest),
    offers: offersOf(p),
  };
}

/**
 * Hotels and each booking site's price from Google Hotels, cached six hours.
 * `q` is a hotel's name with its city, or a city ("hotels in Istanbul").
 */
export async function hotelPrices(q: {
  q: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges?: number[];
  currency?: string;
}): Promise<HotelSearch | null> {
  const currency = (q.currency || "SAR").toUpperCase();
  const ages = (q.childrenAges ?? []).map((a) => Math.min(17, Math.max(1, Math.round(a))));
  const cacheKey = `serp-hotels:${q.q.toLowerCase()}:${q.checkIn}:${q.checkOut}:${q.adults}:${ages.join(",")}:${currency}`;
  return cachedJson<HotelSearch>(cacheKey, 6 * 3600, async () => {
    const body = await search({
      engine: "google_hotels",
      q: q.q,
      check_in_date: q.checkIn,
      check_out_date: q.checkOut,
      adults: String(Math.max(1, q.adults)),
      ...(ages.length ? { children: String(ages.length), children_ages: ages.join(",") } : {}),
      currency,
      hl: "en",
      gl: "sa",
    });
    if (!body) return null;
    const props = body.properties as GhProperty[] | undefined;
    const kind: HotelSearch["kind"] = Array.isArray(props) ? "list" : "hotel";
    const hotels = kind === "list" ? (props ?? []).map(hotelOf) : [hotelOf(body as GhProperty)];
    if (!hotels.length || !hotels[0].name) return null;
    return { kind, currency, hotels, checkedAt: new Date().toISOString() };
  });
}
