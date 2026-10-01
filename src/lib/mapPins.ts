// The places this site shows around a city: map pins on the tourist maps, and
// the same places as a browsable list in the attractions guide.
//
// Source: OpenStreetMap — the map data under Apple Maps, Meta and most
// navigation apps — read live from an Overpass mirror, one city at a time,
// and cached at the edge for a week. A city's museums do not move, so a
// week-old answer is as good as a fresh one, and the traveller waits for the
// query once rather than on every visit. The data is © OpenStreetMap
// contributors under the ODbL, and every page that shows it says so.
//
// Nothing here touches the browser, so server components can use it freely.
// (MapCanvas loads Leaflet at module scope, and Leaflet reaches for `window`
// on import, so the pin *type* has to live outside it.)

import { CITY_COORDS } from "@/data/cityCoords";
import { cachedJson, readJson, writeJson } from "@/lib/edgeCache";
import { findCountry } from "@/lib/countries";
import { searchPexelsPhotos, type PexelsQuery } from "@/lib/pexels";
import type { PinCategory } from "@/lib/pinStyles";
import type { Locale } from "@/lib/types";

export interface Place {
  /** OpenStreetMap id, e.g. "way/123". */
  id: string;
  /** In the reader's language when OpenStreetMap has it, else the local name. */
  name: string;
  nameEn: string;
  nameAr?: string;
  /** What it is — "museum", "castle" — as a short label in the reader's language. */
  description?: string;
  lat: number;
  lon: number;
  category: PinCategory;
  /** The OpenStreetMap value it was found by ("museum", "mall") — for telling shopping from other activities. */
  kind?: string;
  /**
   * How widely known it is, from OpenStreetMap itself: the number of
   * languages it is named in, plus a Wikipedia article. Hagia Sophia is named
   * in over a hundred languages; a corner shrine in one or two.
   */
  fame?: number;
  photo?: string;
  /** The reader wanted Arabic and OpenStreetMap has no Arabic name for it. */
  englishOnly: boolean;
}

/** Anything with a city slug — CityEntry fits. */
export interface PinCentre {
  slug: string;
  nameEn: string;
}

const KIND_LABELS: Record<string, { ar: string; en: string }> = {
  attraction: { ar: "معلم سياحي", en: "Attraction" },
  museum: { ar: "متحف", en: "Museum" },
  gallery: { ar: "معرض فني", en: "Gallery" },
  viewpoint: { ar: "إطلالة", en: "Viewpoint" },
  zoo: { ar: "حديقة حيوان", en: "Zoo" },
  aquarium: { ar: "أحواض مائية", en: "Aquarium" },
  theme_park: { ar: "مدينة ملاهٍ", en: "Theme park" },
  water_park: { ar: "حديقة مائية", en: "Water park" },
  monument: { ar: "نُصب", en: "Monument" },
  memorial: { ar: "نُصب تذكاري", en: "Memorial" },
  castle: { ar: "قلعة", en: "Castle" },
  fort: { ar: "حصن", en: "Fort" },
  citadel: { ar: "قلعة", en: "Citadel" },
  palace: { ar: "قصر", en: "Palace" },
  archaeological_site: { ar: "موقع أثري", en: "Archaeological site" },
  ruins: { ar: "أطلال", en: "Ruins" },
  city_gate: { ar: "بوابة تاريخية", en: "City gate" },
  tomb: { ar: "ضريح", en: "Tomb" },
  place_of_worship: { ar: "دار عبادة", en: "Place of worship" },
  mosque: { ar: "مسجد", en: "Mosque" },
  church: { ar: "كنيسة", en: "Church" },
  beach: { ar: "شاطئ", en: "Beach" },
  mall: { ar: "مركز تسوق", en: "Shopping mall" },
  marketplace: { ar: "سوق", en: "Market" },
  park: { ar: "حديقة", en: "Park" },
  garden: { ar: "حديقة", en: "Garden" },
};

export function kindLabel(kind: string, locale: Locale): string | undefined {
  return KIND_LABELS[kind]?.[locale];
}

/**
 * The Overpass mirrors, in the order they are asked.
 *
 * The main server is shared by every OpenStreetMap tool in the world and is
 * regularly too busy to answer; the others are the same data. A city page
 * that shows no pins because somebody else was running a big query is worse
 * than one that waited an extra second on a mirror.
 */
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

/** What counts as a place worth a pin, and which bucket it falls in. */
const WANTED: { tag: string; values: string[]; category: PinCategory }[] = [
  {
    tag: "tourism",
    values: ["attraction", "museum", "gallery", "viewpoint", "zoo", "aquarium", "theme_park"],
    category: "historic",
  },
  {
    tag: "historic",
    values: [
      "monument",
      "memorial",
      "castle",
      "fort",
      "citadel",
      "palace",
      "archaeological_site",
      "ruins",
      "city_gate",
      "tomb",
    ],
    category: "historic",
  },
  { tag: "leisure", values: ["park", "garden", "water_park"], category: "activity" },
  { tag: "natural", values: ["beach"], category: "activity" },
  { tag: "shop", values: ["mall"], category: "activity" },
  { tag: "amenity", values: ["marketplace"], category: "activity" },
];

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function query(lat: number, lon: number, radius: number): string {
  const clauses = WANTED.map(
    (w) => `nwr(around:${radius},${lat},${lon})["${w.tag}"~"^(${w.values.join("|")})$"]["name"];`
  ).join("\n");
  // No limit on the number returned: a city shows every place it has.
  return `[out:json][timeout:60];(\n${clauses}\n);out center;`;
}

function categoryOf(tags: Record<string, string>): { category: PinCategory; kind: string } {
  for (const w of WANTED) {
    const v = tags[w.tag];
    if (v && w.values.includes(v)) {
      // A mosque or a church is tagged place_of_worship with a religion; the
      // kind label is what the traveller reads, so keep the specific one.
      if (v === "attraction" && tags.religion) return { category: "historic", kind: "place_of_worship" };
      return { category: w.category, kind: v };
    }
  }
  return { category: "place", kind: "attraction" };
}

/**
 * Every mapped place around one point, from OpenStreetMap.
 *
 * Returns an empty list rather than throwing when no mirror answers: a map
 * with no pins is a disappointment, a page that fails to render is a bug.
 */
async function fetchAround(lat: number, lon: number, radius: number): Promise<OverpassElement[]> {
  // Cached at Cloudflare's edge for a week (see edgeCache.ts): `revalidate`
  // below never persisted on this deployment, and an Overpass POST per city
  // per page view is slow for the visitor and unkind to a volunteer-run
  // service. A failure on every mirror is not cached.
  const found = await cachedJson<OverpassElement[]>(`overpass:all:${lat},${lon},${radius}`, 604800, async () => {
    const body = `data=${encodeURIComponent(query(lat, lon, radius))}`;
    for (const url of OVERPASS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          body,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          next: { revalidate: 604800 },
        });
        if (!res.ok) continue;
        const json = (await res.json()) as { elements?: OverpassElement[] };
        const elements = json.elements ?? [];
        if (elements.length) return elements;
      } catch {
        // Try the next mirror.
      }
    }
    return null;
  });
  return found ?? [];
}

function toPlace(el: OverpassElement, locale: Locale): Place | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  const name = tags.name;
  if (lat === undefined || lon === undefined || !name) return null;

  const nameAr = tags["name:ar"];
  const nameEn = tags["name:en"];
  const wantAr = locale === "ar";
  const shown = wantAr ? (nameAr ?? name) : (nameEn ?? name);
  const hasArabic = Boolean(nameAr) || /[\u0600-\u06FF]/.test(name);
  const { category, kind } = categoryOf(tags);

  return {
    id: `${el.type}/${el.id}`,
    name: shown,
    nameEn: nameEn ?? name,
    nameAr,
    description: kindLabel(kind, locale),
    kind,
    fame:
      Object.keys(tags).filter((k) => k.startsWith("name:")).length +
      (tags.wikipedia ? 10 : 0) +
      (tags.wikidata ? 5 : 0),
    lat,
    lon,
    category,
    englishOnly: wantAr && !hasArabic,
  };
}

/**
 * Every mapped place around the given cities, de-duplicated. `withPhotos`
 * is accepted for older callers and ignored: OpenStreetMap carries no
 * photographs, and a Pexels search per pin would spend the month's allowance
 * on one page.
 */
function countKey(slug: string, radius: number): string {
  return `placecount:${slug}:${radius}`;
}

/**
 * How many places a city's page lists, for its card on the country page.
 *
 * Read from the small count the city's page leaves behind. When there is
 * none yet, the places are fetched — but the card waits at most `budgetMs`
 * and shows no number rather than holding the page.
 */
export async function cityPlaceCount(
  city: PinCentre,
  { locale, budgetMs = 4000, radius = 15000 }: { locale: Locale; budgetMs?: number; radius?: number }
): Promise<number> {
  const stored = await readJson<number>(countKey(city.slug, radius));
  if (typeof stored === "number") return stored;
  return Promise.race([
    fetchPlacesAroundCities([city], { locale, radius }).then((p) => p.length),
    new Promise<number>((resolve) => setTimeout(() => resolve(0), budgetMs)),
  ]).catch(() => 0);
}

export async function fetchPlacesAroundCities(
  centres: PinCentre[],
  {
    locale,
    perCity = Infinity,
    radius = 15000,
  }: { locale: Locale; perCity?: number; radius?: number; withPhotos?: boolean }
): Promise<Place[]> {
  // Each city is one query to a shared, volunteer-run service. Asking for a
  // whole country at once is how a page ends up waiting a minute, so the few
  // callers that want several cities get the first handful of them.
  const wanted = centres.slice(0, 8);
  const results = await Promise.all(
    wanted.map(async (c) => {
      const point = CITY_COORDS[c.slug];
      if (!point) return [] as Place[];
      const elements = await fetchAround(point.lat, point.lon, radius);
      const places: Place[] = [];
      for (const el of elements) {
        const place = toPlace(el, locale);
        if (place) places.push(place);
        if (places.length >= perCity) break;
      }
      // Remember the city's full count on its own (a few bytes), so the
      // country page can show it without loading every city's places.
      if (perCity === Infinity && places.length > 0) {
        await writeJson(countKey(c.slug, radius), places.length, 604800);
      }
      return places;
    })
  );

  const seen = new Set<string>();
  const out: Place[] = [];
  for (const list of results) {
    for (const place of list) {
      if (seen.has(place.id)) continue;
      seen.add(place.id);
      out.push(place);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Map pins
// ---------------------------------------------------------------------------

/** What a pin on the map carries — built on the server, rendered by MapCanvas. */
export interface MapPin {
  key: string;
  name: string;
  lat: number;
  lon: number;
  photo?: string;
  /** Short label for what the place is. */
  extract?: string;
  category: PinCategory;
  englishOnly?: boolean;
}

export function placeToPin(place: Place): MapPin {
  return {
    key: place.id,
    name: place.name,
    lat: place.lat,
    lon: place.lon,
    photo: place.photo,
    extract: place.description,
    category: place.category,
    englishOnly: place.englishOnly,
  };
}

/** The legend: only the categories this set of pins actually has, in a fixed order. */
export function buildLegend(
  pins: { category: PinCategory }[],
  labels: { historic: string; food: string; activity: string; place: string }
): { category: PinCategory; label: string; count: number }[] {
  const order: PinCategory[] = ["historic", "food", "activity", "place"];
  return order
    .map((category) => ({
      category,
      label: labels[category],
      count: pins.filter((p) => p.category === category).length,
    }))
    .filter((l) => l.count > 0);
}

/**
 * A photo and a place count per city, for the city cards on a country page,
 * keyed by slug. Photos are Pexels results whose caption names the city.
 */
export async function fetchCityOverviews(
  centres: PinCentre[]
): Promise<Map<string, { photo?: string; photoLarge?: string; count: number }>> {
  const result = new Map<string, { photo?: string; photoLarge?: string; count: number }>();
  const wanted = new Map<string, PexelsQuery[]>();
  for (const c of centres) {
    const code = CITY_COORDS[c.slug]?.code;
    const country = code ? findCountry(code)?.nameEn : undefined;
    wanted.set(c.slug, [
      { query: country ? `${c.nameEn} ${country}` : c.nameEn, mention: [c.nameEn] },
    ]);
  }
  const photos = await searchPexelsPhotos(wanted);
  for (const c of centres) {
    // No count: knowing how many places a city has would mean one Overpass
    // query per card, and a country page has a dozen cards. The card shows
    // the photograph and the name, and the city page does the counting.
    result.set(c.slug, {
      photo: photos.get(c.slug)?.small,
      photoLarge: photos.get(c.slug)?.url,
      count: 0,
    });
  }
  return result;
}
