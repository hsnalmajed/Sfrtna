import { cachedJson } from "@/lib/edgeCache";

/**
 * Live hotel prices from Google Hotels, through SerpApi: one named hotel's
 * price at each booking site. (Google Flights fares were measured 25% above
 * Aviasales on 6 Oct 2026 and switched off; that code was removed 10 Oct.)
 * Every search spends from a monthly allowance.
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
 *     down — the caller gets null and the page shows the partner links
 *     without a number.
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
  /** The day the plan's allowance renews (YYYY-MM-DD), when SerpApi gives it. */
  renews: string | null;
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
        plan_renewal_date?: string | null;
      };
      const left = Number(a.total_searches_left ?? a.plan_searches_left);
      const perMonth = Number(a.searches_per_month);
      if (!Number.isFinite(left) || !Number.isFinite(perMonth)) return null;
      const renews = /^\d{4}-\d{2}-\d{2}/.test(a.plan_renewal_date ?? "") ? a.plan_renewal_date!.slice(0, 10) : null;
      return { left, perMonth, used: Number(a.this_month_usage) || 0, renews };
    } catch {
      return null;
    }
  });
}

/**
 * May a search be spent now? Only while what is left covers the rest of the
 * month at the plan's even daily pace — today's share included.
 */
/**
 * Searches kept back for flights: the flight fallback only runs when the
 * flight partner cannot be reached, and then it is the traveller's only
 * source of fares — it must not find the month spent on hotel pages
 * (owner, 20 Oct: "no prices" on the fallback is not acceptable).
 */
const FLIGHT_RESERVE = 40;

async function maySearch(kind: "hotel" | "flight" = "hotel"): Promise<boolean> {
  const a = await account();
  if (!a || a.left <= 0) return false;
  // Flights: anything left, no daily pace — the fallback is rare and it is
  // all the traveller has at that moment.
  if (kind === "flight") return a.left > 2;
  if (a.left <= FLIGHT_RESERVE) return false;
  // Paced to the plan's own renewal day (not the calendar month's end):
  // what is left must cover the days after today at an even daily share.
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let cycleDays: number;
  let daysAfterToday: number;
  const renews = a.renews ? Date.parse(`${a.renews}T00:00:00Z`) : NaN;
  if (Number.isFinite(renews) && renews > today) {
    daysAfterToday = Math.max(0, Math.round((renews - today) / 86_400_000) - 1);
    const r = new Date(renews);
    const start = Date.UTC(r.getUTCFullYear(), r.getUTCMonth() - 1, r.getUTCDate());
    cycleDays = Math.max(28, Math.round((renews - start) / 86_400_000));
  } else {
    cycleDays = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    daysAfterToday = cycleDays - now.getUTCDate();
  }
  const perDay = a.perMonth / cycleDays;
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

async function search(params: Record<string, string>, kind: "hotel" | "flight" = "hotel"): Promise<Record<string, unknown> | null> {
  if (!key() || !(await maySearch(kind))) return null;
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
  /** The site's own page for this hotel and these dates (via Google), https only. */
  link: string | null;
}

export interface HotelResult {
  name: string;
  /** The name for the Arabic page, when we can write it (added by the route). */
  nameAr?: string;
  /** Google's id for the hotel: asks its own prices without a name search. */
  token: string | null;
  stars: number | null;
  rating: number | null;
  reviews: number | null;
  /** Cheapest per night across the sites, taxes included. */
  perNight: number | null;
  total: number | null;
  offers: HotelOffer[];
  /** Up to eight photos: a small one for cards and the full one for galleries. */
  images: { thumb: string; full: string }[];
  address: string;
  /** Google's amenity names ("Free Wi-Fi", "Pool"…), at most ten. */
  amenities: string[];
  description: string;
  /** Google's rating of the location alone, out of 5. */
  locationRating: number | null;
  checkInTime: string;
  checkOutTime: string;
  /** Where it is: lets a partner link land on this hotel, not its area. */
  lat: number | null;
  lng: number | null;
}

export interface HotelSearch {
  /** "hotel" when the query matched one hotel; "list" for a city's hotels. */
  kind: "hotel" | "list";
  currency: string;
  hotels: HotelResult[];
  checkedAt: string;
  /** A city list's next page (Google gives about 20 hotels a page), if any. */
  nextPage?: string | null;
}

type Rate = { extracted_lowest?: number; extracted_before_taxes_fees?: number } | undefined;
interface GhPrice {
  source?: string;
  link?: string;
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
  images?: { thumbnail?: string; original_image?: string }[];
  address?: string;
  amenities?: string[];
  description?: string;
  location_rating?: number;
  check_in_time?: string;
  check_out_time?: string;
  gps_coordinates?: { latitude?: number; longitude?: number };
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
      link: httpsOnly(o.link) || null,
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
    images: (p.images ?? [])
      .map((i) => ({ thumb: httpsOnly(i.thumbnail), full: httpsOnly(i.original_image) || httpsOnly(i.thumbnail) }))
      .filter((i) => i.thumb || i.full)
      .map((i) => ({ thumb: i.thumb || i.full, full: i.full || i.thumb }))
      .slice(0, 8),
    address: (p.address || "").trim(),
    amenities: (p.amenities ?? []).filter((a) => typeof a === "string" && a.trim()).slice(0, 40),
    description: (p.description || "").trim().slice(0, 600),
    locationRating: typeof p.location_rating === "number" ? p.location_rating : null,
    checkInTime: (p.check_in_time || "").trim(),
    checkOutTime: (p.check_out_time || "").trim(),
    lat: typeof p.gps_coordinates?.latitude === "number" ? p.gps_coordinates.latitude : null,
    lng: typeof p.gps_coordinates?.longitude === "number" ? p.gps_coordinates.longitude : null,
  };
}

/** Only https image URLs reach the page: no mixed content, nothing else. */
function httpsOnly(u: string | undefined): string {
  return u && /^https:\/\//.test(u) ? u : "";
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
  /** Google's id for one hotel, from a list: asks that hotel's own prices. */
  token?: string;
  /** Lowest star class wanted (a city list only). */
  minStars?: number;
  /** Highest price a night, in `currency` (a city list only). */
  maxPerNight?: number;
  /** Google's property_types / amenities codes, rating floor (7/8/9), free cancellation (a city list only). */
  types?: number[];
  amenities?: number[];
  rating?: number;
  freeCancel?: boolean;
  /** Holiday rentals (apartments, villas, chalets) instead of hotels. */
  rentals?: boolean;
  /** A city list's page token from a previous answer's `nextPage`. */
  page?: string;
  /**
   * One named hotel is wanted: when Google answers the name with a list
   * (it often does for "Hotel X, City"), the first hotel's own page is
   * asked by its id, so every site's price for it is there — a list row
   * carries only the cheapest (owner, 20 Oct: "one site only").
   */
  one?: boolean;
}): Promise<HotelSearch | null> {
  if (q.one && !q.token && !q.page) {
    const first = await hotelPrices({ ...q, one: false });
    const top = first?.kind === "list" ? first.hotels.find((h) => h.token) : undefined;
    if (!first || !top?.token || top.offers.length > 1) return first;
    return (await hotelPrices({ ...q, one: false, token: top.token })) ?? first;
  }
  const currency = (q.currency || "SAR").toUpperCase();
  const ages = (q.childrenAges ?? []).map((a) => Math.min(17, Math.max(1, Math.round(a))));
  const stars = q.minStars && q.minStars >= 2 && q.minStars <= 5 ? q.minStars : 0;
  const maxPrice = q.maxPerNight && q.maxPerNight > 0 ? Math.round(q.maxPerNight) : 0;
  const rentals = Boolean(q.rentals);
  const types = rentals ? [] : (q.types ?? []).filter((n) => Number.isInteger(n) && n > 0 && n < 100).slice(0, 6);
  const amen = (q.amenities ?? []).filter((n) => Number.isInteger(n) && n > 0 && n < 100).slice(0, 10);
  const rating = q.rating && [7, 8, 9].includes(q.rating) ? q.rating : 0;
  const freeCancel = !rentals && Boolean(q.freeCancel);
  const cacheKey = `serp-hotels5:${q.q.toLowerCase()}:${q.token ?? ""}:${q.checkIn}:${q.checkOut}:${q.adults}:${ages.join(",")}:${currency}:${stars}:${maxPrice}:${q.page ?? ""}:${types.join(".")}:${amen.join(".")}:${rating}:${freeCancel ? 1 : 0}:${rentals ? 1 : 0}`;
  return cachedJson<HotelSearch>(cacheKey, 6 * 3600, async () => {
    const body = await search({
      engine: "google_hotels",
      q: q.q,
      check_in_date: q.checkIn,
      check_out_date: q.checkOut,
      adults: String(Math.max(1, q.adults)),
      ...(ages.length ? { children: String(ages.length), children_ages: ages.join(",") } : {}),
      ...(q.token ? { property_token: q.token } : {}),
      ...(q.page ? { next_page_token: q.page } : {}),
      ...(stars && !rentals ? { hotel_class: [2, 3, 4, 5].filter((c) => c >= stars).join(",") } : {}),
      ...(types.length ? { property_types: types.join(",") } : {}),
      ...(amen.length ? { amenities: amen.join(",") } : {}),
      ...(rating ? { rating: String(rating) } : {}),
      ...(freeCancel ? { free_cancellation: "true" } : {}),
      ...(rentals ? { vacation_rentals: "true" } : {}),
      ...(maxPrice ? { max_price: String(maxPrice) } : {}),
      currency,
      hl: "en",
      gl: "sa",
    });
    if (!body) return null;
    const props = body.properties as GhProperty[] | undefined;
    const kind: HotelSearch["kind"] = Array.isArray(props) ? "list" : "hotel";
    const hotels = kind === "list" ? (props ?? []).map(hotelOf) : [hotelOf(body as GhProperty)];
    if (!hotels.length || !hotels[0].name) return null;
    const pg = body.serpapi_pagination as { next_page_token?: string } | undefined;
    const nextPage = kind === "list" && typeof pg?.next_page_token === "string" ? pg.next_page_token : null;
    return { kind, currency, hotels, checkedAt: new Date().toISOString(), nextPage };
  });
}

// ---- Flights: the fallback when the flight partner cannot be reached ------
//
// Owner, 13 Oct 2026: "if the flight partner fails, on their side or ours,
// it is not acceptable that there is no other way to show results." The
// results page normally reads the partner's own live search in the visitor's
// browser; when that cannot load, it asks here instead. Google Flights'
// live prices, through the same paced allowance as hotels — so a fallback
// can never run the month dry for hotels either. No allowance left → no
// numbers, only links to search elsewhere (results page).

export interface FallbackLeg {
  depDate: string;
  arrDate: string;
  depTime: string;
  depCode: string;
  arrTime: string;
  arrCode: string;
  minutes: number;
  airline: string;
  logo: string;
  flightNumber: string;
}

export interface FallbackFlight {
  price: number;
  minutes: number;
  stops: number;
  layovers: { code: string; minutes: number }[];
  legs: FallbackLeg[];
  best: boolean;
}

export interface FallbackFlights {
  flights: FallbackFlight[];
  /** Google Flights, opened on the same route and dates. */
  url: string;
  roundTrip: boolean;
  currency: string;
}

interface GfSegment {
  departure_airport?: { id?: string; time?: string };
  arrival_airport?: { id?: string; time?: string };
  duration?: number;
  airline?: string;
  airline_logo?: string;
  flight_number?: string;
}
interface GfOption {
  flights?: GfSegment[];
  layovers?: { id?: string; duration?: number }[];
  total_duration?: number;
  price?: number;
}

export async function googleFlights(q: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  currency: string;
  locale: "ar" | "en";
  directOnly: boolean;
}): Promise<FallbackFlights | null> {
  const round = Boolean(q.returnDate);
  const cacheKey = `serp-flights2:${q.origin}:${q.destination}:${q.departDate}:${q.returnDate || "-"}:${q.adults}:${q.children}:${q.infants}:${q.currency}:${q.locale}:${q.directOnly ? 1 : 0}`;
  return cachedJson<FallbackFlights>(cacheKey, 20 * 60, async () => {
    const params: Record<string, string> = {
      engine: "google_flights",
      departure_id: q.origin,
      arrival_id: q.destination,
      outbound_date: q.departDate,
      type: round ? "1" : "2",
      adults: String(q.adults),
      currency: q.currency,
      hl: q.locale,
      gl: "sa",
    };
    if (round) params.return_date = q.returnDate as string;
    if (q.children) params.children = String(q.children);
    if (q.infants) params.infants_on_lap = String(q.infants);
    if (q.directOnly) params.stops = "1";
    const body = await search(params, "flight");
    if (!body) return null;
    const best = (body.best_flights as GfOption[] | undefined) ?? [];
    const other = (body.other_flights as GfOption[] | undefined) ?? [];
    const time = (s?: string) => (s ? s.slice(11, 16) : "");
    const flights: FallbackFlight[] = [...best.map((o) => [o, true] as const), ...other.map((o) => [o, false] as const)]
      .filter(([o]) => typeof o.price === "number" && (o.flights?.length ?? 0) > 0)
      .map(([o, isBest]) => ({
        price: o.price as number,
        minutes: o.total_duration ?? 0,
        stops: (o.flights?.length ?? 1) - 1,
        layovers: (o.layovers ?? []).map((l) => ({ code: l.id ?? "", minutes: l.duration ?? 0 })),
        legs: (o.flights ?? []).map((s) => ({
          depDate: (s.departure_airport?.time ?? "").slice(0, 10),
          arrDate: (s.arrival_airport?.time ?? "").slice(0, 10),
          depTime: time(s.departure_airport?.time),
          depCode: s.departure_airport?.id ?? "",
          arrTime: time(s.arrival_airport?.time),
          arrCode: s.arrival_airport?.id ?? "",
          minutes: s.duration ?? 0,
          airline: s.airline ?? "",
          logo: httpsOnly(s.airline_logo),
          flightNumber: s.flight_number ?? "",
        })),
        best: isBest,
      }));
    const meta = body.search_metadata as { google_flights_url?: string } | undefined;
    return { flights, url: httpsOnly(meta?.google_flights_url), roundTrip: round, currency: q.currency };
  });
}
