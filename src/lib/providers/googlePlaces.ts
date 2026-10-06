import { cachedJson } from "@/lib/edgeCache";

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
  if (google && google.length) return google;
  return (await osmHotels(q)) ?? [];
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
      const res = await fetch(u.toString(), { headers: { "User-Agent": "sfrtna.com hotel search" } });
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
