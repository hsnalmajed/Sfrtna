// Booking-style filters on a hotel list we already hold (owner, 28 Oct:
// "mirror Booking's filters"). Everything here reads the Google Hotels
// answer the page has — no extra search — so changing a filter is instant
// and costs nothing from the paid allowance.
import type { HotelResult } from "@/lib/providers/serpapi";

/** Facilities a traveller filters by, matched on Google's amenity names. */
export type Facility =
  | "breakfast"
  | "pool"
  | "parking"
  | "wifi"
  | "spa"
  | "gym"
  | "restaurant"
  | "kids"
  | "airport"
  | "kitchen"
  | "beach"
  | "ac"
  | "access"
  | "pets"
  | "allin";
export const FACILITIES: Facility[] = ["breakfast", "pool", "parking", "wifi", "spa", "gym", "restaurant", "kids", "airport", "kitchen", "beach", "ac", "access", "pets", "allin"];

const FACILITY_RE: Record<Facility, RegExp> = {
  // "Breakfast ($)" is paid: only "Free breakfast" counts.
  breakfast: /^free breakfast/i,
  pool: /pool/i,
  parking: /parking/i,
  wifi: /wi-?fi/i,
  spa: /\bspa\b|hot tub|sauna/i,
  gym: /fitness|gym/i,
  restaurant: /restaurant/i,
  kids: /child|kid/i,
  airport: /airport shuttle/i,
  kitchen: /kitchen/i,
  beach: /beach/i,
  ac: /air.?condition/i,
  access: /accessib|wheelchair/i,
  pets: /pet-?friendly|pets allowed/i,
  allin: /all-?inclusive/i,
};

export function hasFacility(h: HotelResult, f: Facility): boolean {
  return h.amenities.some((a) => FACILITY_RE[f].test(a));
}

/**
 * Chains a traveller in the Gulf searches for by name. Matched on the hotel's
 * name; the order puts a hotel under its most specific brand ("Hampton by
 * Hilton" before "Hilton").
 */
const BRANDS: [string, RegExp][] = [
  ["Hampton by Hilton", /hampton/i],
  ["DoubleTree by Hilton", /double ?tree/i],
  ["Conrad", /\bconrad\b/i],
  ["Waldorf Astoria", /waldorf/i],
  ["Hilton", /hilton/i],
  ["Ritz-Carlton", /ritz/i],
  ["JW Marriott", /\bjw marriott/i],
  ["Courtyard", /courtyard/i],
  ["Sheraton", /sheraton/i],
  ["Westin", /westin/i],
  ["Le Méridien", /m[eé]ridien/i],
  ["W Hotels", /^w [a-z]/i],
  ["Four Points", /four points/i],
  ["Renaissance", /renaissance/i],
  ["St. Regis", /st\.? regis/i],
  ["Marriott", /marriott/i],
  ["Holiday Inn", /holiday inn/i],
  ["Crowne Plaza", /crowne plaza/i],
  ["InterContinental", /intercontinental/i],
  ["Kimpton", /kimpton/i],
  ["voco", /\bvoco\b/i],
  ["Novotel", /novotel/i],
  ["ibis", /\bibis\b/i],
  ["Mercure", /mercure/i],
  ["Pullman", /pullman/i],
  ["Sofitel", /sofitel/i],
  ["Fairmont", /fairmont/i],
  ["Raffles", /raffles/i],
  ["Swissôtel", /swiss[oô]tel/i],
  ["Mövenpick", /m[oö]venpick/i],
  ["Radisson", /radisson/i],
  ["Park Inn", /park inn/i],
  ["Hyatt", /hyatt/i],
  ["Rotana", /rotana/i],
  ["Jumeirah", /jumeirah/i],
  ["Kempinski", /kempinski/i],
  ["Four Seasons", /four seasons/i],
  ["Shangri-La", /shangri/i],
  ["Mandarin Oriental", /mandarin oriental/i],
  ["Millennium", /millennium/i],
  ["Wyndham", /wyndham|ramada|days inn|tryp/i],
  ["Best Western", /best western/i],
  ["Accor MGallery", /mgallery/i],
  ["Anantara", /anantara/i],
  ["Address", /^address /i],
  ["Rixos", /rixos/i],
  ["Titanic", /titanic/i],
  ["Dedeman", /dedeman/i],
];

export function brandOf(name: string): string | null {
  for (const [b, re] of BRANDS) if (re.test(name)) return b;
  return null;
}

export interface Facets {
  /** Price a night: the upper bound of each band (Infinity for the last). */
  price: number[];
  rating: number[]; // floors on Google's 5-point scale
  stars: number[];
  facilities: Facility[];
  near: number; // km, 0 = any
  brands: string[];
  eco: boolean;
}
export const NO_FACETS: Facets = { price: [], rating: [], stars: [], facilities: [], near: 0, brands: [], eco: false };
export const RATING_FLOORS_5 = [4.5, 4, 3.5];
export const NEAR_BANDS = [1, 3, 5];

/** Four price bands cut at round amounts from the list's own prices. */
export function priceBands(perNight: number[]): number[] {
  const p = perNight.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (p.length < 6) return [];
  const step = p[p.length - 1] > 2000 ? 100 : 50;
  const cut = (q: number) => Math.max(step, Math.round(p[Math.floor(p.length * q)] / step) * step);
  const cuts = [...new Set([cut(0.25), cut(0.5), cut(0.75)])].sort((a, b) => a - b);
  return [...cuts, Infinity];
}

export interface FacetInput {
  hotel: HotelResult;
  perNight: number; // Infinity when unknown
  km: number; // Infinity when unknown
}

/** One facet's test; the list is narrowed by every facet but the one being counted. */
export function passes(x: FacetInput, f: Facets, bands: number[], skip?: keyof Facets): boolean {
  const h = x.hotel;
  if (skip !== "price" && f.price.length) {
    const ok = f.price.some((top) => {
      const i = bands.indexOf(top);
      const low = i > 0 ? bands[i - 1] : 0;
      return x.perNight > low && x.perNight <= top;
    });
    if (!ok) return false;
  }
  if (skip !== "rating" && f.rating.length && !((h.rating ?? 0) >= Math.min(...f.rating))) return false;
  if (skip !== "stars" && f.stars.length && !f.stars.includes(h.stars ?? 0)) return false;
  if (skip !== "facilities" && f.facilities.some((fa) => !hasFacility(h, fa))) return false;
  if (skip !== "near" && f.near && !(x.km <= f.near)) return false;
  if (skip !== "brands" && f.brands.length && !f.brands.includes(brandOf(h.name) ?? "")) return false;
  if (skip !== "eco" && f.eco && !h.eco) return false;
  return true;
}

export function activeCount(f: Facets): number {
  return f.price.length + f.rating.length + f.stars.length + f.facilities.length + (f.near ? 1 : 0) + f.brands.length + (f.eco ? 1 : 0);
}

/** Google's words for how to reach a nearby place. */
export const TRANSPORT_AR: Record<string, string> = {
  walking: "مشياً",
  taxi: "بالسيارة",
  "public transport": "بالمواصلات العامة",
  transit: "بالمواصلات العامة",
  driving: "بالسيارة",
};

/** Google's review topics on the Arabic page. Unknown ones stay in English. */
export const TOPIC_AR: Record<string, string> = {
  property: "الفندق",
  service: "الخدمة",
  location: "الموقع",
  room: "الغرفة",
  rooms: "الغرف",
  bathroom: "الحمّام",
  breakfast: "الإفطار",
  dining: "الطعام",
  food: "الطعام",
  restaurant: "المطعم",
  cleanliness: "النظافة",
  "wi-fi": "الواي فاي",
  wifi: "الواي فاي",
  internet: "الإنترنت",
  pool: "المسبح",
  spa: "السبا",
  fitness: "النادي الرياضي",
  gym: "النادي الرياضي",
  parking: "المواقف",
  "nature and outdoor activities": "الطبيعة والأنشطة الخارجية",
  nature: "الطبيعة",
  "nature and outdoor": "الطبيعة والأنشطة الخارجية",
  "family-friendliness": "ملاءمة العائلات",
  kids: "الأطفال",
  "kid-friendliness": "ملاءمة الأطفال",
  "airport access": "الوصول من المطار",
  airport: "المطار",
  "public transit": "المواصلات العامة",
  transit: "المواصلات العامة",
  nightlife: "السهر",
  "sleep quality": "جودة النوم",
  sleep: "النوم",
  value: "القيمة مقابل السعر",
  "value for money": "القيمة مقابل السعر",
  atmosphere: "الأجواء",
  view: "الإطلالة",
  views: "الإطلالة",
  bar: "البار",
  beach: "الشاطئ",
  "accessibility": "سهولة الوصول",
  "safety": "الأمان",
  "noise": "الهدوء",
  "staff": "الموظفون",
  "comfort": "الراحة",
  "elevator": "المصعد",
};

export function topicLabel(name: string, locale: "ar" | "en"): string {
  if (locale !== "ar") return name;
  return TOPIC_AR[name.toLowerCase()] ?? name;
}

/** "5 min" → "5 د", "1 hr 10 min" → "1 س 10 د" on the Arabic page. */
export function durationLabel(d: string, locale: "ar" | "en"): string {
  if (locale !== "ar") return d;
  return d
    .replace(/\bhrs?\b/gi, "س")
    .replace(/\bmins?\b/gi, "د");
}

/** "5 min walking to Taksim Square", the quickest way first. */
export function nearbyText(n: NonNullable<HotelResult["nearby"]>[number], line: string, locale: "ar" | "en"): string {
  const how = n.how[0];
  const word = locale === "ar" ? TRANSPORT_AR[how.type.toLowerCase()] ?? "" : how.type.toLowerCase();
  return line.replace("{dur}", durationLabel(how.duration, locale)).replace("{how}", word).replace("{place}", n.name).replace(/\s+/g, " ").trim();
}

