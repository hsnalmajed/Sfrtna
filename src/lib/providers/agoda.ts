import { cachedJson } from "@/lib/edgeCache";
import { normalizeSearch } from "@/lib/search";

/**
 * Agoda, direct (Agoda Partners, CID 1976542): its Affiliate Lite API
 * (Long Tail Search, v2 PDF of 28 Nov 2026) and our index of its hotel ids.
 *
 *   Search: POST http://affiliateapi7643.agoda.com/affiliateservice/lt_v1
 *   Authorization "<siteId>:<apiKey>" (key = Runtime secret AGODA_API_KEY),
 *   body {criteria: {hotelId: [...] | cityId, checkInDate, checkOutDate,
 *   additional: {currency, language, occupancy, ...}}}. Answer: results[]
 *   with dailyRate (per night, BEFORE taxes — Agoda's "sell exclusive"),
 *   crossedOutRate, landingURL (the hotel on agoda.com for these dates)…
 *
 *   Ids: public/data/agoda/tiles/<lat>_<lng>.json, built from Agoda's Hotel
 *   Data File by scripts/agoda/build-index.py — every Agoda hotel in the
 *   1-degree squares around our cities as [hotelId, cityId, lat, lng, name,
 *   stars]. Served to our own server only, through ASSETS.
 */

const SITE_ID = "1976542";
const ENDPOINT = "http://affiliateapi7643.agoda.com/affiliateservice/lt_v1";

let lastError = "";
export const agodaLastError = () => lastError;
export const agodaConfigured = () => Boolean(process.env.AGODA_API_KEY || process.env.AGODA_API_KEY_2 || process.env.AGODA_API_KEY_3);
/** The Partners page lists two keys for our one site: we keep them all (_2, _3 = the two lines of the page) and use the one Agoda accepts. */
const keys = () => [process.env.AGODA_API_KEY, process.env.AGODA_API_KEY_2, process.env.AGODA_API_KEY_3].map((k) => (k || "").trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
/** Site check only: per key, its length and Agoda's answer (never the key). */
const tried: string[] = [];
export const agodaKeyReport = () => ({ set: [process.env.AGODA_API_KEY, process.env.AGODA_API_KEY_2, process.env.AGODA_API_KEY_3].map((k) => (k ? k.trim().length : 0)), tried: tried.slice(-6) });
let goodKey = 0;
export const agodaKeyInUse = () => (keys().length ? goodKey + 1 : 0);

type Tile = [number, number, number, number, string, number][];
type AssetsBinding = { fetch: (input: Request | string) => Promise<Response> };

async function readTile(key: string): Promise<Tile> {
  if (!/^-?\d{1,3}_-?\d{1,3}$/.test(key)) return [];
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    let assets: AssetsBinding | undefined;
    try {
      assets = (getCloudflareContext().env as unknown as { ASSETS?: AssetsBinding }).ASSETS;
    } catch {
      assets = undefined;
    }
    if (!assets) {
      if (process.env.NODE_ENV === "production") return [];
      const { readFile } = await import("node:fs/promises");
      const text = await readFile(`${process.cwd()}/public/data/agoda/tiles/${key}.json`, "utf8").catch(() => null);
      return text ? (JSON.parse(text) as Tile) : [];
    }
    const res = await assets.fetch(new Request(`https://assets.local/data/agoda/tiles/${key}.json`));
    return res.ok ? ((await res.json()) as Tile) : [];
  } catch {
    return [];
  }
}

/** Words that say "a place to stay", not which one. */
const GENERIC = new Set(
  "hotel hotels suites suite resort spa apartments apartment residence residences inn the and by of at a al el".split(" ")
);
const words = (s: string) =>
  new Set(
    normalizeSearch(s)
      .split(/[^a-z0-9؀-ۿ]+/)
      .filter((w) => w.length > 1 && !GENERIC.has(w))
  );

function km(a: number, b: number, c: number, d: number) {
  const p = Math.PI / 180;
  const x = (d - b) * p * Math.cos(((a + c) * p) / 2);
  return 6371 * Math.hypot(x, (c - a) * p);
}

export interface AgodaMatch {
  hotelId: number;
  cityId: number;
}

/**
 * The Agoda id of each hotel we already show, by place and name: within
 * 300 m and at least half of the shorter name's words shared, or within
 * 60 m and one word shared. No match → no id (never a guess at a neighbour).
 */
export async function agodaIdsFor(hotels: { name: string; lat: number | null; lng: number | null }[]) {
  const keys = new Set<string>();
  for (const h of hotels) if (h.lat != null && h.lng != null) keys.add(`${Math.floor(h.lat)}_${Math.floor(h.lng)}`);
  const tiles = new Map<string, Tile>();
  await Promise.all([...keys].slice(0, 6).map(async (k) => tiles.set(k, await readTile(k))));
  return hotels.map((h): AgodaMatch | null => {
    if (h.lat == null || h.lng == null) return null;
    const tile = tiles.get(`${Math.floor(h.lat)}_${Math.floor(h.lng)}`);
    if (!tile?.length) return null;
    const mine = words(h.name);
    let best: AgodaMatch | null = null;
    let bestScore = 0;
    for (const [id, city, la, lo, name] of tile) {
      if (Math.abs(la - h.lat) > 0.003 || Math.abs(lo - h.lng) > 0.004) continue;
      const d = km(h.lat, h.lng, la, lo);
      if (d > 0.3) continue;
      const theirs = words(name);
      let shared = 0;
      for (const w of mine) if (theirs.has(w)) shared++;
      const need = Math.min(mine.size, theirs.size);
      const ok = (need > 0 && shared / need >= 0.5) || (d <= 0.06 && shared >= 1);
      if (!ok) continue;
      const score = shared / Math.max(1, need) - d;
      if (score > bestScore) {
        bestScore = score;
        best = { hotelId: id, cityId: city };
      }
    }
    return best;
  });
}

export interface AgodaRate {
  hotelId: number;
  hotelName: string;
  /** Per night, before taxes (Agoda's dailyRate). */
  dailyRate: number;
  crossedOutRate: number | null;
  currency: string;
  landingURL: string;
  includeBreakfast: boolean;
  freeWifi: boolean;
  starRating: number | null;
  reviewScore: number | null;
  reviewCount: number | null;
  imageURL: string;
  roomtypeName: string;
}

export interface AgodaQuery {
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges: number[];
  currency?: string;
  language?: string;
}

async function search(criteria: Record<string, unknown>, q: AgodaQuery): Promise<AgodaRate[] | null> {
  const all = keys();
  if (!all.length) return null;
  const body = {
    criteria: {
      ...criteria,
      checkInDate: q.checkIn,
      checkOutDate: q.checkOut,
      additional: {
        ...((criteria.additional as object) || {}),
        currency: q.currency || "SAR",
        language: q.language || "en-us",
        discountOnly: false,
        occupancy: {
          numberOfAdult: Math.max(1, q.adults),
          numberOfChildren: q.childrenAges.length,
          ...(q.childrenAges.length ? { childrenAges: q.childrenAges } : {}),
        },
      },
    },
  };
  try {
    let res: Response | null = null;
    let text = "";
    // The key that worked last first; on 401 (key refused) the other one.
    for (const i of [goodKey, ...all.keys()].filter((v, j, a) => v < all.length && a.indexOf(v) === j)) {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Encoding": "gzip,deflate",
          Authorization: `${SITE_ID}:${all[i]}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      text = await res.text();
      tried.push(`#${i + 1}:${res.status}`);
      if (res.status !== 401) {
        goodKey = i;
        break;
      }
    }
    if (!res || !res.ok) {
      lastError = `http ${res?.status}: ${text.slice(0, 160)}`;
      return null;
    }
    const json = JSON.parse(text) as { results?: Record<string, unknown>[]; error?: { id?: number; message?: string } };
    if (json.error) {
      // 911 = "No search result": an honest empty answer, not a failure.
      if (json.error.id === 911) return [];
      lastError = `error ${json.error.id}: ${json.error.message}`;
      return null;
    }
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return (json.results || [])
      .map((r) => ({
        hotelId: Number(r.hotelId),
        hotelName: String(r.hotelName || ""),
        dailyRate: num(r.dailyRate) ?? 0,
        crossedOutRate: num(r.crossedOutRate),
        currency: String(r.currency || ""),
        landingURL: String(r.landingURL || ""),
        includeBreakfast: r.includeBreakfast === true,
        freeWifi: r.freeWifi === true,
        starRating: num(r.starRating),
        reviewScore: num(r.reviewScore),
        reviewCount: num(r.reviewCount),
        imageURL: String(r.imageURL || "").replace(/^http:/, "https:"),
        roomtypeName: String(r.roomtypeName || ""),
      }))
      .filter((r) => r.hotelId > 0 && r.dailyRate > 0 && /^https:\/\/www\.agoda\.com\//.test(r.landingURL));
  } catch (e) {
    lastError = `fetch: ${String(e).slice(0, 160)}`;
    return null;
  }
}

const cacheKey = (kind: string, ids: string, q: AgodaQuery) =>
  `agoda:${kind}:${ids}:${q.checkIn}:${q.checkOut}:${q.adults}:${q.childrenAges.join(".")}:${q.currency || "SAR"}`;

/** Live rates for these Agoda hotels (30 min cache). */
export async function agodaHotelRates(ids: number[], q: AgodaQuery): Promise<AgodaRate[] | null> {
  const list = [...new Set(ids)].slice(0, 30);
  if (!list.length || !agodaConfigured()) return null;
  return cachedJson(cacheKey("h", list.join(","), q), 1800, () => search({ hotelId: list }, q));
}

/** A city's hotels at Agoda (at most 30, Agoda's limit), 30 min cache. */
export async function agodaCityRates(cityId: number, q: AgodaQuery, sortBy = "Recommended"): Promise<AgodaRate[] | null> {
  if (!(cityId > 0) || !agodaConfigured()) return null;
  return cachedJson(cacheKey(`c${sortBy}`, String(cityId), q), 1800, () =>
    search({ cityId, additional: { sortBy, maxResult: 30 } }, q)
  );
}
