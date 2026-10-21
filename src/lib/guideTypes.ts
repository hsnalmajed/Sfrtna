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
  /** Arabic name written by our write-up when Wikidata has none. */
  an?: string;
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
  /** Seen from outside only (no visitors inside). */
  out?: boolean;
  /** Date of the write-up. */
  wAt?: string;
}

export interface GuideFile {
  v: 1;
  /** Where the facts came from: Wikidata ("wd") or OpenStreetMap + Wikidata. */
  src?: "wd" | "osm";
  city: string;
  factsAt: string;
  places: GuidePlace[];
}

/** The group of an OpenStreetMap feature, or null when it is not an outing. */
export function groupOf(t: Record<string, string>): Group | null {
  const tour = t.tourism;
  // A bay, a cape or a stadium is a name on a map, not a visit.
  if (t.natural === "bay" || t.natural === "cape" || t.leisure === "stadium") return null;
  if (tour === "museum" || tour === "gallery") return "museums";
  if (tour === "zoo" || tour === "aquarium" || tour === "theme_park" || t.leisure === "water_park" || t.amenity === "planetarium") return "family";
  if (tour === "viewpoint" || t.man_made === "tower" || t.man_made === "lighthouse" || t.natural === "peak") return "views";
  if (t.natural === "beach" || t.leisure === "marina") return "beach";
  if (t.leisure === "park" || t.leisure === "garden" || t.leisure === "nature_reserve" || t.natural) return "nature";
  if (t.shop === "mall" || t.shop === "department_store") return "shopping";
  if (t.amenity === "marketplace") return "markets";
  if (t.amenity === "place_of_worship" || /^(mosque|church|cathedral|temple)$/.test(t.building ?? "")) return "religion";
  if (t.amenity === "theatre" || t.amenity === "arts_centre" || t.amenity === "library") return "culture";
  if (t.historic || /^(palace|castle)$/.test(t.building ?? "") || t.place === "square" || tour === "attraction" || tour === "artwork" || t.amenity === "fountain") return "history";
  return null;
}

const DAYS_AR: Record<string, string> = { Mo: "الإثنين", Tu: "الثلاثاء", We: "الأربعاء", Th: "الخميس", Fr: "الجمعة", Sa: "السبت", Su: "الأحد", PH: "العطل الرسمية" };

/**
 * OpenStreetMap opening hours in words: "Mo-Fr 09:00-17:00; Sa off" →
 * "الإثنين–الجمعة 09:00–17:00، السبت مغلق". Unusual syntax is shown as mapped.
 */
export function readableHours(oh: string, locale: "ar" | "en"): string {
  if (oh.trim() === "24/7") return locale === "ar" ? "مفتوح على مدار الساعة" : "Open 24/7";
  // Month-by-month or holiday rules read badly in a card: left out.
  if (/[a-z]{3,}|"|\[|week|easter|sunrise|sunset|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(oh.replace(/\boff\b|\bclosed\b/g, "")) || oh.length > 90) return "";
  if (locale === "en") return oh.replace(/;\s*/g, "; ").replace(/\boff\b/g, "closed");
  return oh
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (d) => DAYS_AR[d])
    .replace(/(\S)-(\S)/g, "$1–$2")
    .replace(/\b(off|closed)\b/g, "مغلق")
    .replace(/,\s*/g, " و")
    .replace(/;\s*/g, "، ");
}

const CUISINE_AR: Record<string, string> = {
  turkish: "تركي", arab: "عربي", arabic: "عربي", lebanese: "لبناني", syrian: "سوري", indian: "هندي", pakistani: "باكستاني",
  italian: "إيطالي", pizza: "بيتزا", french: "فرنسي", japanese: "ياباني", sushi: "سوشي", chinese: "صيني", thai: "تايلندي",
  seafood: "مأكولات بحرية", kebab: "كباب", burger: "برغر", steak_house: "ستيك", regional: "محلي", local: "محلي",
  mediterranean: "متوسطي", greek: "يوناني", spanish: "إسباني", mexican: "مكسيكي", american: "أمريكي", korean: "كوري",
  vietnamese: "فيتنامي", malaysian: "ماليزي", indonesian: "إندونيسي", persian: "إيراني", moroccan: "مغربي", egyptian: "مصري",
  yemeni: "يمني", saudi: "سعودي", coffee_shop: "مقهى", cafe: "مقهى", vegetarian: "نباتي", vegan: "نباتي صرف",
  asian: "آسيوي", international: "عالمي", grill: "مشويات", barbecue: "مشويات", chicken: "دجاج", fish: "سمك", breakfast: "فطور",
};

/** "turkish;kebab" → "تركي، كباب" on the Arabic page; unknown words dropped there. */
export function readableCuisine(u: string | undefined, locale: "ar" | "en"): string {
  if (!u) return "";
  const parts = u.split(";").map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 3);
  if (locale === "en") return parts.map((x) => x.replace(/_/g, " ")).join(", ");
  return [...new Set(parts.map((x) => CUISINE_AR[x]).filter(Boolean))].join("، ");
}
