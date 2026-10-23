import { countUse } from "@/lib/usage";
import { cachedJson } from "@/lib/edgeCache";
// Viator Partner API (v2) client — the real source for bookable tours and
// activities, their live prices, photos, ratings and booking links.
//
// We use the *affiliate* tier: the traveller always completes the booking on
// viator.com through the product's own `productUrl`, and Sfrtna never
// touches payment. That matches how the rest of this site works (we compare
// and hand off, we don't sell).
//
// Everything here degrades to `null` / `[]` rather than throwing: without a
// configured key, or if Viator is slow or returns an error, the pages fall
// back to the hand-curated country guide instead of showing a broken screen
// or inventing data.
//
// Set the key as a Cloudflare secret:  npx wrangler secret put VIATOR_API_KEY
// Get one free (instant, no approval) at https://www.viator.com/partner/

// A sandbox key (test data, for building) works only against the sandbox
// host: Cloudflare variable VIATOR_ENV=sandbox until the production key.
const BASE = () => (process.env.VIATOR_ENV === "sandbox" ? "https://api.sandbox.viator.com/partner" : "https://api.viator.com/partner");

export function viatorConfigured(): boolean {
  return Boolean(process.env.VIATOR_API_KEY);
}

/** For /api/health: the key is set, and how many destinations the (cached) list holds. */
export async function viatorProbe(): Promise<{ key: boolean; env: string; destinations: number; lastError: string }> {
  const env = process.env.VIATOR_ENV === "sandbox" ? "sandbox" : "production";
  if (!process.env.VIATOR_API_KEY) return { key: false, env, destinations: 0, lastError: "" };
  // The cached list: Viator limits how often /destinations may be asked.
  const all = await viatorDestinations();
  return { key: true, env, destinations: all.length, lastError };
}

// Viator serves content in a fixed set of languages and Arabic is not one of
// them, so product titles/descriptions always come back in English. The
// surrounding UI is still fully localised — we label the source rather than
// machine-translating names we can't verify.
const VIATOR_LANG = "en-US";

/** The last refusal or failure, for /api/viator/offers?debug=1. */
let lastError = "";

async function viatorFetch<T>(
  path: string,
  init: RequestInit & { revalidate?: number } = {}
): Promise<T | null> {
  const key = process.env.VIATOR_API_KEY;
  if (!key) return null;

  // `revalidate` is kept in the signature for callers; caching is done with
  // cachedJson (Next's fetch cache is not used on the Worker).
  const { revalidate: _unused, ...rest } = init;
  void _unused;
  try {
    const res = await fetch(`${BASE()}${path}`, {
      ...rest,
      headers: {
        "exp-api-key": key,
        Accept: "application/json;version=2.0",
        "Accept-Language": VIATOR_LANG,
        ...(rest.body ? { "Content-Type": "application/json" } : {}),
        ...(rest.headers || {}),
      },
    });
    countUse("viator");
    if (!res.ok) {
      lastError = `${path} ${res.status} ${(await res.text()).slice(0, 200)}`;
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    lastError = `${path} ${String(e).slice(0, 200)}`;
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Destinations (countries -> cities)                                  */
/* ------------------------------------------------------------------ */

export interface ViatorCity {
  id: number;
  name: string;
  countryCode: string;
}

interface RawDestination {
  destinationId?: number;
  destinationName?: string;
  name?: string;
  type?: string;
  destinationType?: string;
  countryCode?: string;
  country?: string;
  parentDestinationId?: number;
  lookupId?: string;
}

// The full taxonomy is one large, rarely-changing document, so we pull it
// once per isolate and slice it per country rather than re-requesting.
let destinationsCache: RawDestination[] | null = null;

async function fetchAllDestinations(): Promise<RawDestination[]> {
  if (destinationsCache) return destinationsCache;
  const data = await viatorFetch<{ destinations?: RawDestination[] } | RawDestination[]>(
    "/auxiliary/destinations",
    { method: "GET", revalidate: 86400 }
  );
  if (!data) return [];
  const list = Array.isArray(data) ? data : data.destinations || [];
  destinationsCache = list;
  return list;
}

// Viator labels city-like destinations in a few different ways depending on
// how granular the place is; anything that behaves like a visitable place
// (rather than a whole country or broad region) is worth listing.
const CITY_LIKE = new Set(["CITY", "TOWN", "DISTRICT", "NEIGHBORHOOD", "ISLAND", "AREA"]);

export async function fetchCitiesForCountry(countryCode: string): Promise<ViatorCity[]> {
  const all = await fetchAllDestinations();
  const wanted = countryCode.toUpperCase();

  const cities = all
    .filter((d) => (d.countryCode || "").toUpperCase() === wanted)
    .filter((d) => {
      const type = (d.type || d.destinationType || "").toUpperCase();
      // If Viator gives us a type, trust it. If it doesn't, fall back to
      // "not the country itself", which is the only distinction we need.
      if (type) return CITY_LIKE.has(type);
      const name = d.destinationName || d.name || "";
      return Boolean(name) && name !== d.country;
    })
    .map((d) => ({
      id: Number(d.destinationId),
      name: d.destinationName || d.name || "",
      countryCode: (d.countryCode || "").toUpperCase(),
    }))
    .filter((c) => Number.isFinite(c.id) && c.name.length > 0);

  // De-duplicate by id, then present alphabetically.
  const seen = new Set<number>();
  return cities
    .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function findCityById(id: number): Promise<ViatorCity | null> {
  const all = await fetchAllDestinations();
  const hit = all.find((d) => Number(d.destinationId) === id);
  if (!hit) return null;
  return {
    id,
    name: hit.destinationName || hit.name || "",
    countryCode: (hit.countryCode || "").toUpperCase(),
  };
}

/* ------------------------------------------------------------------ */
/* Products (tours & activities)                                       */
/* ------------------------------------------------------------------ */

export interface ViatorTour {
  code: string;
  title: string;
  description: string;
  photo?: string;
  priceFrom?: number;
  currency: string;
  rating?: number;
  reviewCount?: number;
  durationMinutes?: number;
  url: string;
}

interface RawProduct {
  productCode?: string;
  title?: string;
  description?: string;
  productUrl?: string;
  webURL?: string;
  images?: {
    variants?: { url?: string; width?: number; height?: number }[];
  }[];
  pricing?: {
    currency?: string;
    summary?: { fromPrice?: number; fromPriceBeforeDiscount?: number };
  };
  reviews?: { combinedAverageRating?: number; totalReviews?: number };
  duration?: {
    fixedDurationInMinutes?: number;
    variableDurationFromMinutes?: number;
    variableDurationToMinutes?: number;
  };
}

// Viator ships several sizes per photo; pick one big enough to fill a card
// without pulling the largest original on a phone.
function pickPhoto(p: RawProduct): string | undefined {
  const variants = p.images?.[0]?.variants;
  if (!variants?.length) return undefined;
  const sized = variants.filter((v) => v.url && (v.width ?? 0) >= 400);
  const chosen = sized.sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0] || variants[variants.length - 1];
  return chosen?.url;
}

function pickDuration(p: RawProduct): number | undefined {
  const d = p.duration;
  if (!d) return undefined;
  return d.fixedDurationInMinutes ?? d.variableDurationToMinutes ?? d.variableDurationFromMinutes;
}

/** One product from a search answer, or null when it cannot be booked. */
function toTour(p: RawProduct, currency: string): ViatorTour | null {
  const code = p.productCode;
  const url = p.productUrl || p.webURL;
  if (!code || !url || !p.title) return null;
  return {
    code,
    title: p.title,
    description: p.description || "",
    photo: pickPhoto(p),
    priceFrom: p.pricing?.summary?.fromPrice,
    currency: p.pricing?.currency || currency,
    rating: p.reviews?.combinedAverageRating,
    reviewCount: p.reviews?.totalReviews,
    durationMinutes: pickDuration(p),
    url,
  };
}

/* ------------------------------------------------------------------ */
/* Our cities → Viator destinations                                     */
/* ------------------------------------------------------------------ */

interface Dest {
  id: number;
  name: string;
  type: string;
  lat?: number;
  lon?: number;
}

/** Viator's destinations (v2), trimmed; cached a week at the edge. */
async function viatorDestinations(): Promise<Dest[]> {
  return (
    (await cachedJson<Dest[]>("viator-dest:v1", 7 * 86_400, async () => {
      const data = await viatorFetch<{ destinations?: { destinationId?: number; name?: string; type?: string; center?: { latitude?: number; longitude?: number } }[] }>("/destinations", { method: "GET" });
      const list = (data?.destinations ?? [])
        .filter((d) => typeof d.destinationId === "number" && d.name)
        .map((d) => ({ id: d.destinationId as number, name: d.name as string, type: (d.type ?? "").toUpperCase(), lat: d.center?.latitude, lon: d.center?.longitude }));
      return list.length ? list : null;
    })) ?? []
  );
}

const norm = (x: string) =>
  x
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function kmBetween(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** For checking the mapping: how many destinations, and a sample record. */
export async function viatorDebug(): Promise<{ count: number; sample: unknown; types: Record<string, number>; lastError: string }> {
  const all = await viatorDestinations();
  const types: Record<string, number> = {};
  for (const d of all) types[d.type] = (types[d.type] ?? 0) + 1;
  return { count: all.length, sample: all.find((d) => d.name === "Istanbul"), types, lastError };
}

/**
 * Our city's Viator destination: a city-like destination of the same name
 * within 60 km of our centre, else the nearest city-like one within 25 km.
 * Never a guess farther away — Ankara's tours on Istanbul's page would be
 * worse than none.
 */
export async function viatorDestinationFor(slug: string, nameEn: string, lat: number, lon: number): Promise<number | null> {
  const key = `viator-city:v1:${slug}`;
  const hit = await cachedJson<{ id: number | null }>(key, 7 * 86_400, async () => {
    const all = await viatorDestinations();
    if (!all.length) return null;
    const cityLike = all.filter((d) => CITY_LIKE.has(d.type) && typeof d.lat === "number" && typeof d.lon === "number");
    const near = cityLike.map((d) => ({ d, km: kmBetween(lat, lon, d.lat as number, d.lon as number) })).filter((x) => x.km < 60);
    const want = norm(nameEn);
    const named = near.filter((x) => norm(x.d.name) === want || norm(x.d.name).startsWith(`${want} `) || want.startsWith(`${norm(x.d.name)} `)).sort((a, b) => a.km - b.km)[0];
    const nearest = near.filter((x) => x.km < 25).sort((a, b) => a.km - b.km)[0];
    return { id: (named ?? nearest)?.d.id ?? null };
  });
  return hit?.id ?? null;
}

/**
 * The best-rated tours and tickets in a destination, or — with `q` — the
 * ones for one place in it ("Hagia Sophia"). Live prices from Viator, cached
 * six hours at the edge.
 */
export async function viatorOffers(destinationId: number, q: string | undefined, count: number): Promise<ViatorTour[]> {
  const currency = "USD";
  const key = `viator-offers:v2:${destinationId}:${(q ?? "").toLowerCase()}:${count}`;
  return (
    (await cachedJson<ViatorTour[]>(key, 6 * 3600, async () => {
      // A refusal (rate limit, outage) is not "no offers": not cached.
      lastError = "";
      const keep = (list: ViatorTour[]) => (list.length || !lastError ? list : null);
      if (q) {
        const data = await viatorFetch<{ products?: { results?: RawProduct[] } }>("/search/freetext", {
          method: "POST",
          body: JSON.stringify({
            searchTerm: q,
            currency,
            productFiltering: { destination: String(destinationId) },
            productSorting: { sort: "DEFAULT" },
            searchTypes: [{ searchType: "PRODUCTS", pagination: { start: 1, count } }],
          }),
        });
        const list = (data?.products?.results ?? []).map((p) => toTour(p, currency)).filter((t): t is ViatorTour => t !== null);
        return keep(list);
      }
      const data = await viatorFetch<{ products?: RawProduct[] }>("/products/search", {
        method: "POST",
        body: JSON.stringify({
          filtering: { destination: String(destinationId) },
          pagination: { start: 1, count },
          currency,
          // Viator's own ranking (bookings and reviews), not a 5.0 with few reviews.
          sorting: { sort: "DEFAULT" },
        }),
      });
      const list = (data?.products ?? []).map((p) => toTour(p, currency)).filter((t): t is ViatorTour => t !== null);
      return keep(list);
    })) ?? []
  );
}

export async function fetchToursForCity(
  destinationId: number,
  { count = 50, start = 1, currency = "USD" }: { count?: number; start?: number; currency?: string } = {}
): Promise<{ tours: ViatorTour[]; total: number }> {
  const data = await viatorFetch<{ products?: RawProduct[]; totalCount?: number }>("/products/search", {
    method: "POST",
    body: JSON.stringify({
      filtering: { destination: String(destinationId) },
      pagination: { start, count },
      currency,
      sorting: { sort: "TRAVELER_RATING", order: "DESCENDING" },
    }),
  });
  if (!data?.products) return { tours: [], total: 0 };

  const tours = data.products
    .map((p): ViatorTour | null => {
      const code = p.productCode;
      const url = p.productUrl || p.webURL;
      if (!code || !url) return null;
      return {
        code,
        title: p.title || "",
        description: p.description || "",
        photo: pickPhoto(p),
        priceFrom: p.pricing?.summary?.fromPrice,
        currency: p.pricing?.currency || currency,
        rating: p.reviews?.combinedAverageRating,
        reviewCount: p.reviews?.totalReviews,
        durationMinutes: pickDuration(p),
        url,
      };
    })
    .filter((t): t is ViatorTour => t !== null && t.title.length > 0);

  return { tours, total: data.totalCount ?? tours.length };
}
