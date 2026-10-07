import { cachedJson } from "@/lib/edgeCache";
import { normalizeSearch } from "@/lib/search";

/**
 * Hotel names as the traveller types, from Google Places Autocomplete (New).
 *
 * Only the autocomplete call is used — no Place Details — so each keystroke
 * the traveller pauses on is one Autocomplete request, inside Google's free
 * monthly allowance (5,000 in 2026). The project's own daily quota in Google
 * Cloud caps it so a busy day cannot run into billing, and every answer is
 * cached at the edge for a week, so the same few letters cost once.
 *
 * Names come back in English whatever the traveller typed: «سما» finds
 * "Samaa Inn". Booking sites and Google Hotels search by the Latin name, so
 * that is the name worth carrying to the results page.
 *
 * The key is a Cloudflare runtime secret (GOOGLE_PLACES_KEY) and never
 * leaves the server. Without it, OpenStreetMap answers alone.
 */

export interface HotelSuggestion {
  /** The hotel's name: "Swissôtel The Bosphorus, Istanbul". */
  name: string;
  /** Where it is: "Beşiktaş/İstanbul, Türkiye". */
  area: string;
}

function key(): string {
  return process.env.GOOGLE_PLACES_KEY || "";
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

async function hereHotels(q: string): Promise<HotelSuggestion[] | null> {
  const at = await searchPoint();
  return cachedJson<HotelSuggestion[]>(`here-hotels:${at}:${q.toLowerCase()}`, 7 * 86_400, async () => {
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

export function placesConfigured(): boolean {
  return Boolean(key());
}

interface Prediction {
  placePrediction?: {
    structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
    text?: { text?: string };
  };
}

/**
 * Hotel names for what was typed: Google first, and OpenStreetMap (through
 * Photon, free and keyless) when Google has no key, has hit the day's quota,
 * or found nothing. OSM knows fewer hotels, but a shorter list beats an
 * empty one — the traveller must pick from it, so there must be one.
 */
export async function hotelSuggestions(input: string): Promise<HotelSuggestion[]> {
  const q = input.trim().replace(/\s+/g, " ").slice(0, 60);
  const google = key() ? await googleHotels(q) : null;
  if (google && google.length) return ranked(google, q);

  // HERE: Google Cloud is sold in Saudi Arabia only through CNTXT, which
  // takes companies with a commercial registration — so for now the hotel
  // names come from HERE (free 5,000 a month), when its key is set.
  const here = hereKey() ? await hereHotels(q) : null;
  if (here && here.length) return ranked(here, q).slice(0, 8);

  // OpenStreetMap matches the letters exactly, so «فندق سماء» and «فندق سما»
  // or «اسطنبول» and «إسطنبول» find different hotels. Every spelling a
  // traveller might mean is asked (each answer cached a week), and the lists
  // are merged — the site-wide rule: أ إ آ = ا, ة = ه, ى = ي.
  const lists = await Promise.all(arabicSpellings(q).map((v) => osmHotels(v)));
  const merged: HotelSuggestion[] = [];
  for (const list of lists) {
    for (const h of list ?? []) {
      if (!merged.some((o) => o.name === h.name && o.area === h.area)) merged.push(h);
    }
  }
  return ranked(merged, q).slice(0, 8);
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

async function googleHotels(q: string): Promise<HotelSuggestion[] | null> {
  return cachedJson<HotelSuggestion[]>(`places-hotels:${q.toLowerCase()}`, 7 * 86_400, async () => {
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key(),
          "X-Goog-FieldMask":
            "suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text",
        },
        body: JSON.stringify({ input: q, includedPrimaryTypes: ["lodging"], languageCode: "en" }),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { suggestions?: Prediction[] };
      const out: HotelSuggestion[] = [];
      for (const s of body.suggestions ?? []) {
        const p = s.placePrediction;
        const name = (p?.structuredFormat?.mainText?.text || p?.text?.text || "").trim();
        const area = (p?.structuredFormat?.secondaryText?.text || "").trim();
        if (name && !out.some((o) => o.name === name && o.area === area)) out.push({ name, area });
      }
      return out;
    } catch {
      return null;
    }
  });
}
