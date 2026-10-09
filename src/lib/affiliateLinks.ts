import { zenhotelsCityUrl } from "./zenhotels";

/**
 * Where a traveller actually goes to pay.
 *
 * Sfrtna never takes a booking or a payment — it compares, and then hands
 * over. That handover is the entire business model, and for a while it did
 * not exist: the button said "view details & book", the details page had no
 * booking control on it, and this module sat in the tree with nothing
 * importing it. A metasearch site with no way out to a partner is a
 * catalogue.
 *
 * Two rules the links below follow:
 *
 *  - **Only real, public URL shapes.** Booking.com's `searchresults.html`
 *    and Expedia's `Hotel-Search` are documented, stable entry points. Nothing here invents a deep link to a
 *    specific offer, because we cannot know the partner still has it — the
 *    link opens *their* search for the same trip, and the UI says so.
 *  - **The partner sets the price.** Every caller of this module has to
 *    print that alongside the button. Our number came from a different
 *    source and may be minutes or days old.
 *
 * The partner ids are public tags that travel in the query string of a URL
 * the visitor's own browser opens — they are not secrets. Only partners that
 * pay us are linked (10 Oct 2026: Almosafer, Skyscanner, airline sites and
 * Hotellook removed — no account with them, or closed).
 */

/**
 * Expedia Group affiliate (Travel Creator Program, paid through Partnerize).
 * `camref` is our account's public tracking tag and `creativeref` the link
 * type the Link builder issued with it — both ride in the visible URL, so
 * they are not secrets. Expedia's own wrapper takes any expedia.com page as
 * `landingPage`, which lets every search on the site build its own link.
 */
const EXPEDIA_CAMREF = "1011l6tt7K";
const EXPEDIA_CREATIVEREF = "1100l68075";

export function expediaAffiliateUrl(landingPage: string): string {
  const u = new URL("https://expedia.com/affiliate");
  u.searchParams.set("siteid", "1");
  u.searchParams.set("landingPage", landingPage);
  u.searchParams.set("camref", EXPEDIA_CAMREF);
  u.searchParams.set("creativeref", EXPEDIA_CREATIVEREF);
  return u.toString();
}

export interface BookingHandoff {
  /** The partner's own name, shown to the traveller before they leave. */
  partner: string;
  url: string;
}

/**
 * One named hotel at a booking site, through Stay22's Allez links.
 *
 * A plain search link by the hotel's name is no good here: Stay22's
 * LinkSwap rewrites it into a search around the hotel's address, so Booking
 * opened 665 hotels near it (reported 6 Oct 2026), and Expedia's own name
 * filter found no match for "Swissôtel". Allez, given the name and the
 * map position, resolves the hotel itself (checked the same day): Booking
 * opens its search on that hotel (dest_type=hotel, listed first), Agoda
 * and Expedia open with it selected. It pays through our Stay22 account.
 */
export type AllezProvider = "booking" | "expedia" | "agoda" | "hotelscom";
const STAY22_AID = "sfrtna";

export function hotelAllezUrl(
  provider: AllezProvider,
  h: {
    name: string;
    /** Where it is, as text — used when the coordinates are not known. */
    area?: string;
    lat?: number | null;
    lng?: number | null;
    checkIn: string;
    checkOut: string;
    adults: number;
    childrenAges: number[];
    locale?: "ar" | "en";
  }
): string {
  const u = new URL(`https://www.stay22.com/allez/${provider}`);
  const p = u.searchParams;
  p.set("aid", STAY22_AID);
  p.set("hotelname", h.name);
  if (typeof h.lat === "number" && typeof h.lng === "number") {
    p.set("lat", h.lat.toFixed(5));
    p.set("lng", h.lng.toFixed(5));
  }
  if (h.area) p.set("address", h.area);
  p.set("checkin", h.checkIn);
  p.set("checkout", h.checkOut);
  p.set("adults", String(Math.max(1, h.adults)));
  if (h.childrenAges.length) {
    p.set("children", String(h.childrenAges.length));
    p.set("childrenAges", h.childrenAges.map((a) => Math.min(17, Math.max(0, Math.round(a)))).join(","));
  }
  p.set("currency", "SAR");
  p.set("lang", h.locale ?? "ar");
  p.set("campaign", "hotel_page");
  return u.toString();
}

export interface HotelSearchQuery {
  /** A hotel's name, or a city — Booking's free-text search takes either. */
  query: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges: number[];
  minStars?: number;
  breakfast?: boolean;
  stay?: "room" | "apartment";
  /** True when `query` names one hotel rather than a city. */
  isHotel?: boolean;
  /** For a named hotel: where it is, so partner links land on it. */
  area?: string;
  lat?: number | null;
  lng?: number | null;
  /** The traveller's language, for partners whose page can follow it. */
  locale?: "ar" | "en";
}

/**
 * The hotel planner's own search, carried to partners.
 *
 * The hotel page (/hotel-results) has no prices of its own: Hotellook, the
 * source it was meant to have, closed in October 2025, and nothing replaces
 * it yet. So its whole job is the handover, and the handover should carry
 * everything the traveller told us — not just the city and the dates.
 *
 * Booking.com's search takes the stars, breakfast and stay type as filters
 * in `nflt` (class, mealplan=1, ht_id 204 hotels / 201 apartments), and the
 * children with their ages. The budget is not sent: Booking reads a price
 * filter as a nightly band in its own currency list, and a wrong band would
 * silently hide hotels the traveller can afford.
 */
export function hotelPartnerLinks(q: HotelSearchQuery): BookingHandoff[] {
  const booking = new URL("https://www.booking.com/searchresults.html");
  booking.searchParams.set("ss", q.query);
  booking.searchParams.set("checkin", q.checkIn);
  booking.searchParams.set("checkout", q.checkOut);
  booking.searchParams.set("group_adults", String(Math.max(1, q.adults)));
  booking.searchParams.set("no_rooms", "1");
  booking.searchParams.set("group_children", String(q.childrenAges.length));
  for (const age of q.childrenAges) booking.searchParams.append("age", String(age));

  const filters: string[] = [];
  if (q.minStars && q.minStars > 0) {
    for (let s = q.minStars; s <= 5; s++) filters.push(`class=${s}`);
  }
  if (q.breakfast) filters.push("mealplan=1");
  if (q.stay === "room") filters.push("ht_id=204");
  if (q.stay === "apartment") filters.push("ht_id=201");
  if (filters.length) booking.searchParams.set("nflt", filters.join(";"));

  // Expedia's hotel search: rooms=1 and children as "1_<age>" per child,
  // the shape its own search form writes.
  const expedia = new URL("https://www.expedia.com/Hotel-Search");
  expedia.searchParams.set("destination", q.query);
  expedia.searchParams.set("startDate", q.checkIn);
  expedia.searchParams.set("endDate", q.checkOut);
  expedia.searchParams.set("adults", String(Math.max(1, q.adults)));
  expedia.searchParams.set("rooms", "1");
  // A hotel's name alone lands on its city's full list; the name filter
  // narrows that list to the hotel itself (checked on expedia.com).
  if (q.isHotel) expedia.searchParams.set("hotelName", q.query);
  if (q.childrenAges.length) {
    expedia.searchParams.set("children", q.childrenAges.map((a) => `1_${a}`).join(","));
  }

  // ZenHotels (RateHawk) only links cities it has a confirmed page for; a
  // hotel's name alone cannot be turned into its URL.
  const zen = q.isHotel
    ? null
    : zenhotelsCityUrl({
        city: q.query,
        checkIn: q.checkIn,
        checkOut: q.checkOut,
        adults: q.adults,
        childrenAges: q.childrenAges,
        locale: q.locale ?? "ar",
      });

  // Agoda, Hotels.com and Trip.com: plain searches that Stay22's LinkSwap
  // turns into paid links on the page (checked on sfrtna.com, 6 Oct 2026).
  const agoda = new URL("https://www.agoda.com/search");
  agoda.searchParams.set("textToSearch", q.query);
  agoda.searchParams.set("checkIn", q.checkIn);
  agoda.searchParams.set("checkOut", q.checkOut);
  agoda.searchParams.set("rooms", "1");
  agoda.searchParams.set("adults", String(Math.max(1, q.adults)));
  if (q.childrenAges.length) {
    agoda.searchParams.set("children", String(q.childrenAges.length));
    agoda.searchParams.set("childAges", q.childrenAges.join(","));
  }
  const hotelsCom = new URL("https://www.hotels.com/Hotel-Search");
  hotelsCom.searchParams.set("destination", q.query);
  hotelsCom.searchParams.set("startDate", q.checkIn);
  hotelsCom.searchParams.set("endDate", q.checkOut);
  hotelsCom.searchParams.set("adults", String(Math.max(1, q.adults)));
  if (q.childrenAges.length) {
    hotelsCom.searchParams.set("children", q.childrenAges.map((a) => `1_${a}`).join(","));
  }
  const trip = new URL("https://www.trip.com/hotels/list");
  trip.searchParams.set("keyword", q.query);
  trip.searchParams.set("checkin", q.checkIn);
  trip.searchParams.set("checkout", q.checkOut);
  trip.searchParams.set("adult", String(Math.max(1, q.adults)));
  if (q.childrenAges.length) {
    trip.searchParams.set("children", String(q.childrenAges.length));
    trip.searchParams.set("ages", q.childrenAges.join(","));
  }

  // A named hotel: every site through Allez, which lands on the hotel
  // itself (see hotelAllezUrl). Trip.com has no Allez link and its search
  // would be rewritten into an area search, so it is left out here.
  if (q.isHotel) {
    const h = {
      name: q.query,
      area: q.area,
      lat: q.lat,
      lng: q.lng,
      checkIn: q.checkIn,
      checkOut: q.checkOut,
      adults: q.adults,
      childrenAges: q.childrenAges,
      locale: q.locale,
    };
    return [
      { partner: "Booking.com", url: hotelAllezUrl("booking", h) },
      { partner: "Expedia", url: hotelAllezUrl("expedia", h) },
      { partner: "Agoda", url: hotelAllezUrl("agoda", h) },
      { partner: "Hotels.com", url: hotelAllezUrl("hotelscom", h) },
    ];
  }

  return [
    { partner: "Booking.com", url: booking.toString() },
    // Through our own redirect, which adds the affiliate tag: a direct
    // Expedia link would be rewritten by Stay22 (see /api/go/expedia).
    { partner: "Expedia", url: `/api/go/expedia?landing=${encodeURIComponent(expedia.toString())}` },
    { partner: "Agoda", url: agoda.toString() },
    { partner: "Hotels.com", url: hotelsCom.toString() },
    { partner: "Trip.com", url: trip.toString() },
    ...(zen ? [{ partner: "ZenHotels", url: zen }] : []),
  ];
}
