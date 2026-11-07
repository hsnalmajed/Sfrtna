import { countUse } from "@/lib/usage";
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
/** Searches left this month (site check only). */
export async function searchesLeft(): Promise<number | null> {
  return (await account())?.left ?? null;
}

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

async function maySearch(kind: "hotel" | "flight" | "explore" | "probe" = "hotel"): Promise<boolean> {
  const a = await account();
  if (!a || a.left <= 0) return false;
  // A site-check probe (by hand, two searches): outside the daily pace,
  // never into the flight reserve.
  if (kind === "probe") return a.left > FLIGHT_RESERVE;
  // "Suggest a destination": one search prices every place for the
  // traveller's own dates (cached per origin, dates and travellers), so it
  // may run whenever the flight reserve stays untouched.
  if (kind === "explore") return a.left > FLIGHT_RESERVE;
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
  // Slack (7 Nov): a busy first day (tests, a few visitors) used to shut
  // hotels for two days. Early days may run up to 25% ahead; the reserve
  // shrinks to nothing by the renewal day, so the month is never overspent.
  return a.left > Math.floor(daysAfterToday * perDay * 0.75);
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

async function search(params: Record<string, string>, kind: "hotel" | "flight" | "explore" | "probe" = "hotel"): Promise<Record<string, unknown> | null> {
  if (!key() || !(await maySearch(kind))) return null;
  const url = new URL(`${BASE}/search.json`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("api_key", key());
  try {
    const res = await fetch(url.toString());
    countUse("serpapi");
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
  /** The site's small logo, as Google shows it (https), or "". */
  logo?: string;
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
  /** Places near the hotel and how long it takes to reach them (Google's own). */
  nearby?: { name: string; how: { type: string; duration: string }[] }[];
  /** How many guests gave 5, 4, 3, 2, 1 stars. */
  ratingsHist?: { stars: number; count: number }[];
  /** What reviews talk about: each topic with its positive/negative mentions. */
  topics?: { name: string; total: number; positive: number; negative: number }[];
  /** Amenities Google says the hotel does NOT have. */
  excluded?: string[];
  /** Eco-certified, as Google marks it. */
  eco?: boolean;
  /** Holiday rentals: "Entire villa", "Sleeps 6", "3 bedrooms"… */
  essential?: string[];
  /**
   * Room types, when Google's answer for the one hotel carries them (a
   * site's offer split by room). Read defensively: absent → none shown.
   */
  rooms?: HotelRoom[];
  /** Google's amenities by group (Internet, Food & drink…), the hotel's page. */
  amenityGroups?: AmenityGroup[];
  /** What this hotel usually costs a night (Google's own range). */
  typical?: { low: number; high: number } | null;
  /** «26% less than usual» → 26. */
  dealPct?: number | null;
}

export interface HotelRoom {
  name: string;
  source: string;
  image: string;
  guests: number | null;
  perNight: number | null;
  total: number | null;
  link: string | null;
  logo?: string;
  /** The room's options at that site (cancellation, breakfast…), cheapest first. */
  rates?: RoomRate[];
}

export interface RoomRate {
  total: number | null;
  perNight: number | null;
  guests: number | null;
  freeCancel: boolean;
  /** "Dec 5" / "6:00 PM", as Google gives them (English). */
  cancelUntil: string | null;
  cancelUntilTime: string | null;
  breakfast: boolean;
}

export interface AmenityGroup {
  title: string;
  items: { name: string; label: string | null; available: boolean }[];
}

export interface HotelSearch {
  /** "hotel" when the query matched one hotel; "list" for a city's hotels. */
  kind: "hotel" | "list";
  currency: string;
  hotels: HotelResult[];
  checkedAt: string;
  /** A city list's next page (Google gives about 20 hotels a page), if any. */
  nextPage?: string | null;
  /** How many hotels Google holds for this city search (all pages), if it says. */
  total?: number | null;
  /** Site check only (x-sfrtna-smoke): where the answer mentions rooms — field names, no values. */
  shape?: string[];
}

type Rate = { extracted_lowest?: number; extracted_before_taxes_fees?: number } | undefined;
interface GhRate {
  num_guests?: number;
  free_cancellation?: boolean;
  free_cancellation_until_date?: string;
  free_cancellation_until_time?: string;
  breakfast_included?: boolean;
  rate_per_night?: Rate;
  total_rate?: Rate;
}
interface GhRoom {
  rates?: GhRate[];
  name?: string;
  link?: string;
  num_guests?: number;
  images?: (string | { thumbnail?: string; original_image?: string })[];
  rate_per_night?: Rate;
  total_rate?: Rate;
}
interface GhPrice {
  rooms?: GhRoom[];
  logo?: string;
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
  nearby_places?: { name?: string; transportations?: { type?: string; duration?: string }[] }[];
  ratings?: { stars?: number; count?: number }[];
  reviews_breakdown?: { name?: string; total_mentioned?: number; positive?: number; negative?: number }[];
  excluded_amenities?: string[];
  eco_certified?: boolean;
  essential_info?: string[];
  amenities_detailed?: { groups?: { title?: string; list?: { title?: string; label?: string; available?: boolean }[] }[] };
  typical_price_range?: { extracted_lowest?: number; extracted_highest?: number };
  deal?: string;
}

const str = (v: unknown, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");

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
      logo: httpsOnly(o.logo),
    });
  }
  return out;
}

function roomsOf(p: GhProperty): HotelRoom[] {
  const out: HotelRoom[] = [];
  const seen = new Set<string>();
  for (const o of [...(p.featured_prices ?? []), ...(p.prices ?? [])]) {
    for (const r of Array.isArray(o.rooms) ? o.rooms : []) {
      const name = str(r?.name, 90);
      if (!name) continue;
      const key = `${(o.source || "").trim()}|${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const im = (r.images ?? [])[0];
      out.push({
        name,
        source: (o.source || "").trim(),
        image: typeof im === "string" ? httpsOnly(im) : httpsOnly(im?.original_image) || httpsOnly(im?.thumbnail),
        guests: num(r.num_guests),
        perNight: num(r.rate_per_night?.extracted_lowest),
        total: num(r.total_rate?.extracted_lowest),
        link: httpsOnly(r.link) || httpsOnly(o.link) || null,
        logo: httpsOnly(o.logo),
        rates: (Array.isArray(r.rates) ? r.rates : [])
          .map((x) => ({
            total: num(x?.total_rate?.extracted_lowest),
            perNight: num(x?.rate_per_night?.extracted_lowest),
            guests: num(x?.num_guests),
            freeCancel: x?.free_cancellation === true,
            cancelUntil: str(x?.free_cancellation_until_date, 20) || null,
            cancelUntilTime: str(x?.free_cancellation_until_time, 12) || null,
            breakfast: x?.breakfast_included === true,
          }))
          .filter((x) => x.total || x.perNight)
          .sort((a, b) => (a.total ?? 0) - (b.total ?? 0))
          .slice(0, 6),
      });
    }
  }
  return out.slice(0, 40);
}

/** Paths of every field whose name mentions rooms (names only), for the site check. */
function roomPaths(v: unknown, path = "", out: string[] = [], depth = 0): string[] {
  if (depth > 6 || out.length > 40 || !v || typeof v !== "object") return out;
  if (Array.isArray(v)) {
    if (v.length) roomPaths(v[0], `${path}[0]`, out, depth + 1);
    return out;
  }
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    const here = path ? `${path}.${k}` : k;
    if (/room|bed|guest/i.test(k)) out.push(`${here}:${Array.isArray(x) ? `array(${x.length})` : typeof x}`);
    roomPaths(x, here, out, depth + 1);
  }
  return out;
}

function groupsOf(p: GhProperty): AmenityGroup[] {
  return (p.amenities_detailed?.groups ?? [])
    .map((g) => ({
      title: str(g?.title, 40),
      items: (g?.list ?? [])
        .map((x) => ({ name: str(x?.title, 60), label: str(x?.label, 30) || null, available: x?.available !== false }))
        .filter((x) => x.name)
        .slice(0, 40),
    }))
    .filter((g) => g.title && g.items.length)
    .slice(0, 20);
}

function hotelOf(p: GhProperty): HotelResult {
  const rooms = roomsOf(p);
  const amenityGroups = groupsOf(p);
  const low = num(p.typical_price_range?.extracted_lowest);
  const high = num(p.typical_price_range?.extracted_highest);
  const deal = /(\d{1,2})\s*%\s*less/i.exec(p.deal ?? "");
  return {
    ...(rooms.length ? { rooms } : {}),
    ...(amenityGroups.length ? { amenityGroups } : {}),
    ...(low && high ? { typical: { low, high } } : {}),
    ...(deal ? { dealPct: Number(deal[1]) } : {}),
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
    nearby: (p.nearby_places ?? [])
      .map((n) => ({
        name: str(n.name),
        how: (n.transportations ?? []).map((x) => ({ type: str(x.type, 30), duration: str(x.duration, 20) })).filter((x) => x.type && x.duration).slice(0, 3),
      }))
      .filter((n) => n.name && n.how.length)
      .slice(0, 8),
    ratingsHist: (p.ratings ?? [])
      .filter((r) => typeof r.stars === "number" && typeof r.count === "number" && r.stars >= 1 && r.stars <= 5)
      .map((r) => ({ stars: r.stars as number, count: Math.max(0, Math.round(r.count as number)) })),
    topics: (p.reviews_breakdown ?? [])
      .map((r) => ({ name: str(r.name, 40), total: num(r.total_mentioned) ?? 0, positive: num(r.positive) ?? 0, negative: num(r.negative) ?? 0 }))
      .filter((r) => r.name && r.total > 0)
      .slice(0, 12),
    excluded: (p.excluded_amenities ?? []).map((a) => str(a, 60)).filter(Boolean).slice(0, 20),
    eco: p.eco_certified === true || undefined,
    essential: (p.essential_info ?? []).map((a) => str(a, 60)).filter(Boolean).slice(0, 8),
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
  /** Site check: answer afresh and say where rooms are (field names only). */
  probe?: boolean;
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
  return cachedJson<HotelSearch>(q.probe ? `probe:${cacheKey}` : cacheKey, q.probe ? 60 : 6 * 3600, async () => {
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
    }, q.probe ? "probe" : "hotel");
    if (!body) return null;
    const props = body.properties as GhProperty[] | undefined;
    const kind: HotelSearch["kind"] = Array.isArray(props) ? "list" : "hotel";
    const hotels = kind === "list" ? (props ?? []).map(hotelOf) : [hotelOf(body as GhProperty)];
    if (!hotels.length || !hotels[0].name) return null;
    const pg = body.serpapi_pagination as { next_page_token?: string } | undefined;
    const nextPage = kind === "list" && typeof pg?.next_page_token === "string" ? pg.next_page_token : null;
    const sample = (label: string, v: unknown, n = 900) => `sample ${label}: ${JSON.stringify(v ?? null, (k, x) => (k === "images" || k === "link" || k === "logo" || k === "thumbnail" ? undefined : x)).slice(0, n)}`;
    const fp = (body.featured_prices as { rooms?: unknown[] }[] | undefined)?.[0];
    const shape = q.probe
      ? [
          `top:${Object.keys(body).join(",")}`,
          `featured_prices[0]:${Object.keys(fp ?? {}).join(",")}`,
          ...roomPaths(body),
          sample("rooms[0]", fp?.rooms?.[0], 1400),
          sample("rooms[1]", fp?.rooms?.[1], 700),
          sample("amenities_detailed", body.amenities_detailed, 1600),
          sample("typical_price_range", body.typical_price_range, 300),
          sample("deal", [body.deal, body.deal_description], 300),
          sample("reviews_breakdown", body.reviews_breakdown, 400),
          sample("health_and_safety", body.health_and_safety, 300),
        ]
      : undefined;
    // Google's count for the whole search (every page): «3,040 فندقاً».
    const si = body.search_information as { total_results?: unknown } | undefined;
    const totalRaw = typeof si?.total_results === "number" ? si.total_results : Number(String(si?.total_results ?? "").replace(/[^0-9]/g, ""));
    const total = kind === "list" && Number.isFinite(totalRaw) && totalRaw > hotels.length ? Math.round(totalRaw) : null;
    return { kind, currency, hotels, checkedAt: new Date().toISOString(), nextPage, ...(total ? { total } : {}), ...(shape ? { shape } : {}) };
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
  /**
   * "explore" for asks that are not the traveller's only source of fares
   * (budget advisor): they leave the flight reserve untouched.
   */
  pace?: "flight" | "explore";
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
    const body = await search(params, q.pace ?? "flight");
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

export interface ExploreFare {
  /** Airport the fare lands at (IATA). */
  airport: string;
  /** Whole trip for every paying traveller, in the asked currency. */
  price: number;
  stops: number | null;
  airline: string;
}

/**
 * Every place Google Flights prices from `origin` for the traveller's own
 * dates and party, in one search (Google Travel Explore) — what lets
 * "suggest a destination" show a price on places the flight partner has no
 * fare for. Cached six hours per origin, dates and travellers.
 */
export async function exploreFares(q: {
  origin: string;
  departDate: string;
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  currency: string;
  directOnly: boolean;
},
/** Site check only: what the search answered before filtering (filled on a cache miss). */
debug?: { rows?: number; kept?: number; dates?: string[] }): Promise<ExploreFare[] | null> {
  const round = Boolean(q.returnDate);
  const key = `serp-explore2:${q.origin}:${q.departDate}:${q.returnDate || "-"}:${q.adults}:${q.children}:${q.infants}:${q.currency}:${q.directOnly ? 1 : 0}`;
  return cachedJson<ExploreFare[]>(key, 6 * 3600, async () => {
    const params: Record<string, string> = {
      engine: "google_travel_explore",
      departure_id: q.origin,
      outbound_date: q.departDate,
      type: round ? "1" : "2",
      travel_mode: "1",
      adults: String(q.adults),
      currency: q.currency,
      hl: "en",
      gl: "sa",
    };
    if (round) params.return_date = q.returnDate as string;
    if (q.children) params.children = String(q.children);
    if (q.infants) params.infants_on_lap = String(q.infants);
    if (q.directOnly) params.stops = "1";
    const body = await search(params, "explore");
    if (!body) return null;
    type Row = {
      flight_price?: number;
      number_of_stops?: number;
      airline?: string;
      start_date?: string;
      end_date?: string;
      destination_airport?: { code?: string };
    };
    const rows = (body.destinations as Row[] | undefined) ?? [];
    if (debug) {
      debug.rows = rows.length;
      debug.dates = [...new Set(rows.map((r) => `${r.start_date ?? "-"}/${r.end_date ?? "-"}`))].slice(0, 5);
    }
    return rows
      .filter(
        (r) =>
          typeof r.flight_price === "number" &&
          r.flight_price > 0 &&
          r.destination_airport?.code &&
          // Only fares for the traveller's own days.
          (!r.start_date || r.start_date === q.departDate) &&
          (!round || !r.end_date || r.end_date === q.returnDate)
      )
      .map((r) => ({
        airport: (r.destination_airport?.code ?? "").toUpperCase(),
        price: Math.round(r.flight_price as number),
        stops: typeof r.number_of_stops === "number" ? r.number_of_stops : null,
        airline: r.airline ?? "",
      }));
  });
}
