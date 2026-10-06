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
