// The hotel search's preferences, as booking sites themselves sort places
// to stay (owner, 20 Oct: "room or apartment" was our own idea, the sites
// don't classify that way — make it match reality so the search is exact).
//
// Each choice maps to a filter Google Hotels itself applies (SerpApi
// google_hotels: property_types, amenities, rating, free_cancellation,
// vacation_rentals — codes checked on serpapi.com 20 Oct 2026), so what the
// traveller picks narrows the live list instead of being guessed after it.

/** The kind of place: Google's own property types, or holiday rentals. */
export type PlaceKind = "" | "aparthotel" | "resort" | "boutique" | "beach" | "rental";
export const PLACE_KINDS: PlaceKind[] = ["", "aparthotel", "resort", "boutique", "beach", "rental"];
/** Google Hotels property_types for each kind ("rental" is a separate search). */
export const PLACE_TYPE_CODE: Partial<Record<PlaceKind, number>> = { aparthotel: 21, resort: 17, boutique: 13, beach: 12 };

/** Facilities a traveller asks for by name — Google's amenity codes. */
export type Amenity = "parking" | "wifi" | "pool" | "kids" | "gym" | "beach" | "allin" | "access" | "spa" | "restaurant";
export const AMENITIES: Amenity[] = ["parking", "wifi", "pool", "kids", "restaurant", "gym", "spa", "beach", "allin", "access"];
export const AMENITY_CODE: Record<Amenity, number> = {
  parking: 1, // Free parking
  wifi: 35, // Free Wi-Fi
  pool: 6,
  kids: 12, // Child-friendly
  gym: 7,
  beach: 11,
  allin: 52, // All-inclusive available
  access: 53, // Wheelchair accessible
  spa: 10,
  restaurant: 8,
};
/** Free breakfast. */
export const BREAKFAST_CODE = 9;

/** Guest rating floor: Google's codes 7 = 3.5+, 8 = 4+, 9 = 4.5+. */
export type RatingFloor = 0 | 7 | 8 | 9;
export const RATING_FLOORS: RatingFloor[] = [0, 7, 8, 9];
export const RATING_LABEL: Record<Exclude<RatingFloor, 0>, string> = { 7: "3.5+", 8: "4+", 9: "4.5+" };

/** Furthest from the city centre, in km (0 = anywhere); applied to the list on our side. */
export type NearKm = 0 | 1 | 3 | 5 | 10;
export const NEAR_KMS: NearKm[] = [0, 1, 3, 5, 10];

export interface HotelPrefs {
  place: PlaceKind;
  amenities: Amenity[];
  rating: RatingFloor;
  freeCancel: boolean;
  near: NearKm;
}

/** Read from a results/search address; old links (`stay=apartment`) still work. */
export function readHotelPrefs(sp: URLSearchParams): HotelPrefs {
  const placeRaw = sp.get("place") || (sp.get("stay") === "apartment" ? "aparthotel" : "");
  const place = (PLACE_KINDS as string[]).includes(placeRaw) ? (placeRaw as PlaceKind) : "";
  const amenities = (sp.get("amen") || "")
    .split(",")
    .filter((a): a is Amenity => (AMENITIES as string[]).includes(a));
  const r = Number(sp.get("rating"));
  const rating = (RATING_FLOORS as number[]).includes(r) ? (r as RatingFloor) : 0;
  const n = Number(sp.get("near"));
  const near = (NEAR_KMS as number[]).includes(n) ? (n as NearKm) : 0;
  return { place, amenities, rating, freeCancel: sp.get("fc") === "1", near };
}

export function writeHotelPrefs(p: HotelPrefs, out: URLSearchParams) {
  if (p.place) out.set("place", p.place);
  if (p.amenities.length) out.set("amen", p.amenities.join(","));
  if (p.rating) out.set("rating", String(p.rating));
  if (p.freeCancel) out.set("fc", "1");
  if (p.near) out.set("near", String(p.near));
}

export const NO_HOTEL_PREFS: HotelPrefs = { place: "", amenities: [], rating: 0, freeCancel: false, near: 0 };
