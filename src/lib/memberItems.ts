/**
 * What a member keeps in their account (owner, 21 Oct 2026: "features that
 * make a difference, only accurate ones"). Shared by the browser and the
 * /api/me routes; the server keeps only what `cleanItem` lets through.
 *
 *   profile  home airport, travellers, currency and preferences — every
 *            search form starts from them
 *   fav      a city or a hotel kept for later
 *   search   a search, to reopen on any device (site or app)
 *   trip     a flight the traveller went to book, with the steps left to
 *            get ready (hotel, trip services, plan, visa) ticked by them
 */

export type ItemKind = "profile" | "fav" | "search" | "trip";

export interface Profile {
  origin?: string;
  adults?: number;
  childrenAges?: number[];
  infants?: number;
  currency?: string;
  directOnly?: boolean;
  baggage?: boolean;
  breakfast?: boolean;
  minStars?: number;
}

export interface FavCity {
  type: "city";
  code: string;
  slug: string;
  nameAr: string;
  nameEn: string;
}
export interface FavHotel {
  type: "hotel";
  name: string;
  area: string;
  label?: string;
  city?: string;
}
export type Fav = FavCity | FavHotel;

export interface SavedSearch {
  url: string;
  kind: "flight" | "hotel" | "combo" | "discover";
  from?: string;
  to?: string;
  date?: string;
  back?: string;
}

export const TRIP_STEPS = ["hotel", "services", "plan", "visa"] as const;
export type TripStep = (typeof TRIP_STEPS)[number];

export interface Trip {
  origin: string;
  destination: string;
  /** The destination city, when known: its pages and its hotels. */
  code?: string;
  slug?: string;
  cityAr?: string;
  cityEn?: string;
  depart: string;
  back?: string;
  adults: number;
  childrenAges: number[];
  infants: number;
  /** The traveller says they booked it (we cannot see the booking). */
  booked: boolean;
  done: TripStep[];
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const IATA = /^[A-Z]{3}$/;
const str = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : undefined);
const int = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : undefined);
const ages = (v: unknown) =>
  Array.isArray(v) && v.length <= 8 && v.every((a) => int(a, 0, 17) !== undefined) ? (v as number[]) : undefined;

/** The item as it may be stored, or null when anything is off. */
export function cleanItem(kind: unknown, key: unknown, data: unknown): { kind: ItemKind; key: string; data: unknown } | null {
  if (typeof key !== "string" || key.length < 1 || key.length > 200 || !data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (kind === "profile") {
    if (key !== "me") return null;
    const p: Profile = {};
    const origin = str(o.origin, 3);
    if (origin && IATA.test(origin)) p.origin = origin;
    if (int(o.adults, 1, 9) !== undefined) p.adults = o.adults as number;
    if (ages(o.childrenAges)) p.childrenAges = o.childrenAges as number[];
    if (int(o.infants, 0, 4) !== undefined) p.infants = o.infants as number;
    const cur = str(o.currency, 3);
    if (cur && /^[A-Z]{3}$/.test(cur)) p.currency = cur;
    for (const b of ["directOnly", "baggage", "breakfast"] as const) if (typeof o[b] === "boolean") p[b] = o[b] as boolean;
    if (int(o.minStars, 0, 5) !== undefined) p.minStars = o.minStars as number;
    return { kind, key, data: p };
  }
  if (kind === "fav") {
    if (o.type === "city") {
      const code = str(o.code, 2);
      const slug = str(o.slug, 60);
      const nameAr = str(o.nameAr, 80);
      const nameEn = str(o.nameEn, 80);
      if (!code || !/^[A-Z]{2}$/.test(code) || !slug || !/^[a-z0-9-]+$/.test(slug) || !nameAr || !nameEn) return null;
      if (key !== `city:${code}/${slug}`) return null;
      return { kind, key, data: { type: "city", code, slug, nameAr, nameEn } satisfies FavCity };
    }
    if (o.type === "hotel") {
      const name = str(o.name, 120);
      const area = typeof o.area === "string" && o.area.length <= 120 ? o.area : "";
      if (!name || key !== `hotel:${name}|${area}`.slice(0, 200)) return null;
      return { kind, key, data: { type: "hotel", name, area, label: str(o.label, 120), city: str(o.city, 80) } satisfies FavHotel };
    }
    return null;
  }
  if (kind === "search") {
    const url = str(o.url, 1500);
    if (!url || !/^\/(ar|en)\/(results|hotel-results|discover-results)\?/.test(url)) return null;
    const k = o.kind;
    if (k !== "flight" && k !== "hotel" && k !== "combo" && k !== "discover") return null;
    const date = str(o.date, 10);
    const back = str(o.back, 10);
    return {
      kind,
      key,
      data: {
        url,
        kind: k,
        from: str(o.from, 80),
        to: str(o.to, 120),
        date: date && ISO.test(date) ? date : undefined,
        back: back && ISO.test(back) ? back : undefined,
      } satisfies SavedSearch,
    };
  }
  if (kind === "trip") {
    const origin = str(o.origin, 3);
    const destination = str(o.destination, 3);
    const depart = str(o.depart, 10);
    const back = str(o.back, 10);
    if (!origin || !IATA.test(origin) || !destination || !IATA.test(destination) || !depart || !ISO.test(depart)) return null;
    if (back && !ISO.test(back)) return null;
    const code = str(o.code, 2);
    const slug = str(o.slug, 60);
    const t: Trip = {
      origin,
      destination,
      depart,
      back,
      code: code && /^[A-Z]{2}$/.test(code) ? code : undefined,
      slug: slug && /^[a-z0-9-]+$/.test(slug) ? slug : undefined,
      cityAr: str(o.cityAr, 80),
      cityEn: str(o.cityEn, 80),
      adults: int(o.adults, 1, 9) ?? 1,
      childrenAges: ages(o.childrenAges) ?? [],
      infants: int(o.infants, 0, 4) ?? 0,
      booked: o.booked === true,
      done: Array.isArray(o.done) ? (o.done.filter((x) => (TRIP_STEPS as readonly string[]).includes(x as string)) as TripStep[]) : [],
    };
    if (key !== tripKey(t)) return null;
    return { kind, key, data: t };
  }
  return null;
}

/** One trip per route and dates. */
export function tripKey(t: Pick<Trip, "origin" | "destination" | "depart" | "back">): string {
  return `${t.origin}-${t.destination}-${t.depart}-${t.back || "ow"}`;
}

/** One search per kind, places and dates (as the browser list does). */
export function searchKey(s: SavedSearch): string {
  return [s.kind, s.from || "", s.to || "", s.date || "", s.back || ""].join("|").slice(0, 200);
}

export function favCityKey(code: string, slug: string): string {
  return `city:${code}/${slug}`;
}
export function favHotelKey(name: string, area: string): string {
  return `hotel:${name}|${area}`.slice(0, 200);
}
