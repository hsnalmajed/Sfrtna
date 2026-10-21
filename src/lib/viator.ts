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

// Viator serves content in a fixed set of languages and Arabic is not one of
// them, so product titles/descriptions always come back in English. The
// surrounding UI is still fully localised — we label the source rather than
// machine-translating names we can't verify.
const VIATOR_LANG = "en-US";

async function viatorFetch<T>(
  path: string,
  init: RequestInit & { revalidate?: number } = {}
): Promise<T | null> {
  const key = process.env.VIATOR_API_KEY;
  if (!key) return null;

  const { revalidate = 3600, ...rest } = init;
  try {
    const res = await fetch(`${BASE()}${path}`, {
      ...rest,
      headers: {
        "exp-api-key": key,
        Accept: "application/json;version=2.0",
        "Accept-Language": VIATOR_LANG,
        "Content-Type": "application/json",
        ...(rest.headers || {}),
      },
      // Tours and prices change slowly enough that an hour of caching is
      // safe, and it keeps us well inside the Worker's subrequest budget.
      next: { revalidate },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
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
