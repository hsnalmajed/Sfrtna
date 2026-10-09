import { cachedJson } from "@/lib/edgeCache";
import { normalizeSearch } from "@/lib/search";
import { takeHere } from "@/lib/providers/hereQuota";
import { localHotels, type GuessedCity } from "@/lib/providers/localHotels";
import { CITY_COORDS } from "@/data/cityCoords";

/**
 * Hotel names as the traveller types: our own stored hotels first
 * (localHotels.ts), then HERE (capped daily), then OpenStreetMap's live
 * search — see hotelSuggestions(). Keys are Cloudflare runtime secrets and
 * never leave the server.
 */

export interface HotelSuggestion {
  /** The hotel's name: "Swissôtel The Bosphorus, Istanbul". */
  name: string;
  /** Where it is: "Beşiktaş/İstanbul, Türkiye". */
  area: string;
  /** Its Arabic name, when known — shown to Arabic readers under the name. */
  nameAr?: string;
}

function hereKey(): string {
  return process.env.HERE_API_KEY || "";
}

interface HereItem {
  title?: string;
  resultType?: string;
  address?: { city?: string; countryName?: string };
  categories?: { id?: string }[];
}

/**
 * Where to search from: the visitor's own location (Cloudflare knows it
 * roughly), else Riyadh. HERE needs a point to rank by; a hotel named with
 * its city («هيلتون إسطنبول») is still found far away.
 */
async function searchPoint(): Promise<string> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const cf = getCloudflareContext().cf as { latitude?: string; longitude?: string } | undefined;
    const lat = Number(cf?.latitude);
    const lon = Number(cf?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon) && cf?.latitude && cf?.longitude) {
      // Rounded to a whole degree: enough to rank by, and it keeps the cache shared.
      return `${Math.round(lat)},${Math.round(lon)}`;
    }
  } catch {
    // Not on Cloudflare.
  }
  return "25,47";
}

/** The visitor's country code (Cloudflare's), else Saudi Arabia. */
async function visitorCountry(): Promise<string> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const cf = getCloudflareContext().cf as { country?: string } | undefined;
    if (cf?.country && /^[A-Z]{2}$/.test(cf.country)) return cf.country;
  } catch {
    // Not on Cloudflare.
  }
  return "SA";
}

/**
 * HERE reads "Hilton Istanbul" as an address (a street called Hilton), so it
 * is asked for the hotel words with "hotel" added, around the city the
 * traveller named (or the visitor's own area): "Marriott hotel" at Jeddah.
 */
async function hereHotels(words: string, city: GuessedCity | null): Promise<HotelSuggestion[] | null> {
  const c = city ? CITY_COORDS[city.slug] : undefined;
  const at = c ? `${c.lat.toFixed(3)},${c.lon.toFixed(3)}` : await searchPoint();
  const q = `${words} hotel`;
  return cachedJson<HotelSuggestion[]>(`here-hotels:v2:${at}:${q.toLowerCase()}`, 7 * 86_400, async () => {
    // Only a search the edge has not cached costs a transaction; past the
    // day's cap it is not made (null, not cached) and OpenStreetMap answers.
    if (!(await takeHere())) return null;
    try {
      const u = new URL("https://discover.search.hereapi.com/v1/discover");
      u.searchParams.set("q", q);
      u.searchParams.set("at", at);
      u.searchParams.set("limit", "20");
      // English names: booking sites and Google Hotels search by the Latin name.
      u.searchParams.set("lang", "en");
      u.searchParams.set("apiKey", hereKey());
      const res = await fetch(u.toString(), { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      const body = (await res.json()) as { items?: HereItem[] };
      const out: HotelSuggestion[] = [];
      for (const it of body.items ?? []) {
        // 500-… is HERE's accommodation family (hotels, motels, guest houses).
        const lodging = (it.categories ?? []).some((c) => (c.id ?? "").startsWith("500-"));
        if (it.resultType !== "place" || !lodging) continue;
        const name = (it.title || "").trim();
        const area = [it.address?.city, it.address?.countryName].filter(Boolean).join(", ");
        if (name && !out.some((o) => o.name === name && o.area === area)) out.push({ name, area });
      }
      return out;
    } catch {
      return null;
    }
  });
}

/**
 * Hotel names for what was typed, in three layers, so a traveller always
 * finds a list and nothing can run out on them:
 *
 *  1. Our own stored hotels (localHotels.ts) — every hotel around our
 *     cities, with an Arabic dictionary of chains and words. No outside call,
 *     no allowance. Most searches end here.
 *  2. When that finds few: HERE (free 5,000 a month, capped daily in
 *     hereQuota.ts) for hotels our list does not know. Past the cap it is
 *     simply skipped.
 *  3. When still nothing: OpenStreetMap's live search, every Arabic spelling.
 *
 * The city the traveller named (if any) comes back too, so an empty list can
 * offer that city's hotels instead of a dead end.
 */
export async function hotelSuggestions(
  input: string
): Promise<{ items: HotelSuggestion[]; city: GuessedCity | null }> {
  const q = input.trim().replace(/\s+/g, " ").slice(0, 60);
  const local = await localHotels(q, await visitorCountry());
  const items: HotelSuggestion[] = local.items.map((h) => ({ name: h.name, area: h.area, nameAr: h.nameAr }));
  const city = local.city;
  if (items.length >= 5) return { items, city };

  // A city was named («فندق ماريوت جدة»): an outside answer elsewhere (a
  // Marriott in Kuwait) is wrong, not helpful — it is left out, and an empty
  // list offers that city's hotels instead.
  const cityWords = city ? [city.nameEn, city.nameAr, city.slug.replace(/-/g, " ")].map(normalizeSearch) : [];
  const inCity = (h: HotelSuggestion) => !city || cityWords.some((w) => normalizeSearch(h.area).includes(w));
  const add = (list: HotelSuggestion[] | null) => {
    for (const h of (list ?? []).filter(inCity)) {
      const n = normalizeSearch(h.name);
      if (!items.some((o) => normalizeSearch(o.name) === n)) items.push(h);
    }
  };

  const outside = hereKey() && (local.rest || !city) ? await hereHotels(local.rest || q, city) : null;
  if (outside?.length) add(ranked(outside, q));
  if (items.length) return { items: items.slice(0, 8), city };

  // OpenStreetMap matches the letters exactly, so every spelling a traveller
  // might mean is asked (each answer cached a week) and the lists merged —
  // the site-wide rule: أ إ آ = ا, ة = ه, ى = ي.
  const lists = await Promise.all(arabicSpellings(q).map((v) => osmHotels(v)));
  for (const list of lists) add(list);
  return { items: ranked(items, q).slice(0, 8), city };
}

/**
 * The spellings worth asking an outside service for: as typed; with أ إ آ
 * written as ا; with a word-final ة / ه swapped; and with a word-initial ا
 * given its hamza (أ / إ). At most five, each cached a week. Latin text is
 * asked as is.
 */
export function arabicSpellings(q: string): string[] {
  if (!/[\u0600-\u06FF]/.test(q)) return [q];
  const plainAlef = q.replace(/[أإآ]/g, "ا");
  const swapped = plainAlef.replace(/[ةه](?=\s|$)/g, (c) => (c === "ة" ? "ه" : "ة"));
  // And the other way round: a traveller who types «ابها» means «أبها», and
  // OpenStreetMap only knows the hamza spelling. A word-initial ا (not the
  // article ال) is tried with أ and with إ.
  const initial = /(^|\s)ا(?!ل)/g;
  const withHamza = plainAlef.replace(initial, "$1أ");
  const withHamzaBelow = plainAlef.replace(initial, "$1إ");
  // Sorted, so «مكة فندق» and «مكه فندق» ask the same spellings in the same
  // order and get the same merged list back.
  return [...new Set([q, plainAlef, swapped, withHamza, withHamzaBelow])].sort();
}

/** Names that contain what was typed (in any spelling) first; the rest after, in their order. */
function ranked(items: HotelSuggestion[], q: string): HotelSuggestion[] {
  const nq = normalizeSearch(q);
  const hit = (h: HotelSuggestion) => normalizeSearch(h.name).includes(nq);
  return [...items.filter(hit), ...items.filter((h) => !hit(h))];
}

interface PhotonFeature {
  properties?: { name?: string; city?: string; county?: string; state?: string; country?: string };
}

async function osmHotels(q: string): Promise<HotelSuggestion[] | null> {
  return cachedJson<HotelSuggestion[]>(`osm-hotels:${q.toLowerCase()}`, 7 * 86_400, async () => {
    try {
      const u = new URL("https://photon.komoot.io/api/");
      u.searchParams.set("q", q);
      u.searchParams.set("limit", "8");
      u.searchParams.set("lang", "en");
      u.searchParams.set("osm_tag", "tourism:hotel");
      // A traveller is typing: a slow spelling is dropped after 3 s (and not
      // cached), the ones that answered are shown.
      const res = await fetch(u.toString(), {
        headers: { "User-Agent": "sfrtna.com hotel search" },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { features?: PhotonFeature[] };
      const out: HotelSuggestion[] = [];
      for (const f of body.features ?? []) {
        const p = f.properties ?? {};
        const name = (p.name || "").trim();
        const area = [p.city || p.county || p.state, p.country].filter(Boolean).join(", ");
        if (name && !out.some((o) => o.name === name && o.area === area)) out.push({ name, area });
      }
      return out;
    } catch {
      return null;
    }
  });
}
