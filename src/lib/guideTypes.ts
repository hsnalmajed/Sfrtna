// Our own place guide (scripts/guide/): the places in a city worth a
// traveller's time, with facts from OpenStreetMap and Wikidata and a short
// write-up of our own. Stored in public/data/guide/<slug>.json.

/** What kind of outing a place is — matched to the traveller's interests. */
export const GROUPS = ["history", "religion", "museums", "nature", "beach", "views", "family", "shopping", "markets", "culture"] as const;
export type Group = (typeof GROUPS)[number];

export interface GuidePlace {
  /** OpenStreetMap id ("way/123") and Wikidata id. */
  i: string;
  q: string;
  /** Local, English and Arabic names. */
  n: string;
  e?: string;
  a?: string;
  g: Group;
  y: number;
  x: number;
  /** Languages with an encyclopaedia article on it (fame). */
  sl: number;
  /** A World Heritage site. */
  wh?: boolean;
  /** Visitors a year (latest figure). */
  vis?: number;
  web?: string;
  /** OpenStreetMap opening_hours, as mapped. */
  oh?: string;
  fee?: "yes" | "no";
  wc?: boolean;
  // Write-up (scripts/guide/write.ts), Arabic then English.
  d?: string;
  de?: string;
  /** Typical visit, minutes. */
  m?: number;
  /** Best time to go. */
  bt?: string;
  bte?: string;
  /** What to wear, when it matters. */
  dr?: string;
  dre?: string;
  /** One practical tip. */
  tp?: string;
  tpe?: string;
  /** Good with children. */
  kids?: boolean;
  /** Date of the write-up. */
  wAt?: string;
}

export interface GuideFile {
  v: 1;
  city: string;
  factsAt: string;
  places: GuidePlace[];
}

/** The group of an OpenStreetMap feature, or null when it is not an outing. */
export function groupOf(t: Record<string, string>): Group | null {
  const tour = t.tourism;
  if (tour === "museum" || tour === "gallery") return "museums";
  if (tour === "zoo" || tour === "aquarium" || tour === "theme_park" || t.leisure === "water_park" || t.amenity === "planetarium") return "family";
  if (tour === "viewpoint" || t.man_made === "tower" || t.man_made === "lighthouse" || t.natural === "peak") return "views";
  if (t.natural === "beach" || t.natural === "bay" || t.natural === "cape" || t.leisure === "marina") return "beach";
  if (t.leisure === "park" || t.leisure === "garden" || t.leisure === "nature_reserve" || t.natural) return "nature";
  if (t.shop === "mall" || t.shop === "department_store") return "shopping";
  if (t.amenity === "marketplace") return "markets";
  if (t.amenity === "place_of_worship" || /^(mosque|church|cathedral|temple)$/.test(t.building ?? "")) return "religion";
  if (t.amenity === "theatre" || t.amenity === "arts_centre" || t.amenity === "library" || t.leisure === "stadium") return "culture";
  if (t.historic || /^(palace|castle)$/.test(t.building ?? "") || t.place === "square" || tour === "attraction" || tour === "artwork" || t.amenity === "fountain") return "history";
  return null;
}
