import type { FlightOffer, HotelOffer, SearchParams } from "./types";
import { resolveIata } from "./flights";
import { aviasalesSearchUrl, travelpayoutsMarker } from "./providers/travelpayouts";
import { hotellookSearchUrl } from "./providers/hotellook";
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
 *    and Skyscanner's `/transport/flights/<from>/<to>/<yymmdd>/` are
 *    documented, stable entry points. Nothing here invents a deep link to a
 *    specific offer, because we cannot know the partner still has it — the
 *    link opens *their* search for the same trip, and the UI says so.
 *  - **The partner sets the price.** Every caller of this module has to
 *    print that alongside the button. Our number came from a different
 *    source and may be minutes or days old.
 *
 * The partner ids are public tags that travel in the query string of a URL
 * the visitor's own browser opens — they are not secrets, so they are read
 * from NEXT_PUBLIC_* and work in the browser. Without them the links still
 * work; they just earn nothing.
 */

const BOOKING_AID = process.env.NEXT_PUBLIC_BOOKING_AFFILIATE_ID || "";
const ALMOSAFER_REF = process.env.NEXT_PUBLIC_ALMOSAFER_AFFILIATE_ID || "";

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

/** Skyscanner wants YYMMDD. */
function compactDate(iso: string): string {
  return iso.replace(/-/g, "").slice(2);
}

/**
 * Flights: the airline's own site when we know the carrier and it sells
 * direct, otherwise Skyscanner.
 *
 * Sending someone to Saudia for a Saudia fare is a better handover than
 * sending them to a metasearch that will show them Saudia — one fewer step,
 * and the price they land on is the airline's own.
 */
const AIRLINE_SITES: Record<string, { name: string; url: string }> = {
  SV: { name: "Saudia", url: "https://www.saudia.com/" },
  XY: { name: "flynas", url: "https://www.flynas.com/" },
  F3: { name: "flyadeal", url: "https://www.flyadeal.com/" },
  TK: { name: "Turkish Airlines", url: "https://www.turkishairlines.com/" },
  EK: { name: "Emirates", url: "https://www.emirates.com/" },
  QR: { name: "Qatar Airways", url: "https://www.qatarairways.com/" },
};

export function flightBookingHandoff(
  params: SearchParams,
  flight?: FlightOffer
): BookingHandoff | null {
  if (params.tripType === "hotel") return null;
  if (!params.origin || !params.destination || !params.departDate) return null;

  /**
   * Aviasales first, once the affiliate marker exists.
   *
   * This used to send the traveller to the carrier's own website when we knew
   * the carrier, on the reasoning that one fewer step is a better handover.
   * That reasoning held while the site had no revenue model; it does not now.
   * A referral to saudia.com earns nothing, and a site with no income is one
   * that stops being maintained — which serves the traveller worst of all.
   *
   * The trade is small and honest: Aviasales opens the same search across
   * every carrier, including the one we just showed, and the price the
   * traveller pays is unchanged. The commission comes out of the partner's
   * margin, never out of the fare.
   */
  const marker = travelpayoutsMarker();
  if (marker) {
    return {
      partner: "Aviasales",
      url: aviasalesSearchUrl({
        origin: params.origin,
        destination: params.destination,
        departDate: params.departDate,
        returnDate: params.returnDate,
        adults: params.adults || 1,
        children: params.childrenAges?.length ?? 0,
        infants: params.infants ?? 0,
      }),
    };
  }

  const direct = flight?.airlineCode ? AIRLINE_SITES[flight.airlineCode] : undefined;
  if (direct) return { partner: direct.name, url: direct.url };

  const from = resolveIata(params.origin).toLowerCase();
  const to = resolveIata(params.destination).toLowerCase();
  const out = compactDate(params.departDate);
  const back = params.returnDate ? `/${compactDate(params.returnDate)}` : "";
  return {
    partner: "Skyscanner",
    url: `https://www.skyscanner.net/transport/flights/${from}/${to}/${out}${back}/`,
  };
}

/**
 * Hotels: Hotellook first when the marker is set, because that is the
 * handover that pays and it compares Booking, Agoda and the rest in one
 * screen. Booking.com's own search otherwise.
 *
 * `destinationName` is the city as a person would type it — free text search
 * does far better with "Istanbul" than with "IST".
 */
export function hotelBookingHandoff(
  params: SearchParams,
  destinationName: string,
  hotel?: HotelOffer
): BookingHandoff | null {
  if (params.tripType === "flight") return null;
  if (!params.departDate) return null;

  const marker = travelpayoutsMarker();
  if (marker) {
    return {
      partner: "Hotellook",
      url: hotellookSearchUrl({
        destination: destinationName || params.destination,
        checkIn: params.departDate,
        checkOut: params.returnDate || params.departDate,
        adults: params.adults || 1,
        marker,
      }),
    };
  }

  const checkin = params.departDate;
  const checkout = params.returnDate || params.departDate;
  const url = new URL("https://www.booking.com/searchresults.html");
  url.searchParams.set("ss", destinationName || params.destination);
  url.searchParams.set("checkin", checkin);
  url.searchParams.set("checkout", checkout);
  url.searchParams.set("group_adults", String(params.adults || 1));
  const children = params.childrenAges?.length ?? 0;
  if (children > 0) url.searchParams.set("group_children", String(children));
  if (params.minHotelStars) url.searchParams.set("nflt", `class=${params.minHotelStars}`);
  if (BOOKING_AID) url.searchParams.set("aid", BOOKING_AID);
  // The hotel we picked is a suggestion to search for, not a promise it is
  // still bookable at that price.
  if (hotel?.name) url.searchParams.set("ss", hotel.name);

  return { partner: "Booking.com", url: url.toString() };
}

/** A second hotel option, for travellers who prefer a regional agency. */
export function hotelBookingAlternative(
  params: SearchParams,
  destinationName: string
): BookingHandoff | null {
  if (params.tripType === "flight") return null;
  const url = new URL("https://www.almosafer.com/en/hotels/search-results");
  url.searchParams.set("city", destinationName || params.destination);
  url.searchParams.set("checkIn", params.departDate);
  url.searchParams.set("checkOut", params.returnDate || params.departDate);
  url.searchParams.set("adults", String(params.adults || 1));
  if (ALMOSAFER_REF) url.searchParams.set("ref", ALMOSAFER_REF);
  return { partner: "Almosafer", url: url.toString() };
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
 *
 * Deliberately separate from hotelBookingHandoff, which still serves the
 * older flight-and-hotel pages and sends to Hotellook first.
 */
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
  /** The traveller's language, for partners whose page can follow it. */
  locale?: "ar" | "en";
}

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
  if (BOOKING_AID) booking.searchParams.set("aid", BOOKING_AID);

  const almosafer = new URL("https://www.almosafer.com/en/hotels/search-results");
  almosafer.searchParams.set("city", q.query);
  almosafer.searchParams.set("checkIn", q.checkIn);
  almosafer.searchParams.set("checkOut", q.checkOut);
  almosafer.searchParams.set("adults", String(Math.max(1, q.adults)));
  if (ALMOSAFER_REF) almosafer.searchParams.set("ref", ALMOSAFER_REF);

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

  return [
    { partner: "Booking.com", url: booking.toString() },
    // Through our own redirect, which adds the affiliate tag: a direct
    // Expedia link would be rewritten by Stay22 (see /api/go/expedia).
    { partner: "Expedia", url: `/api/go/expedia?landing=${encodeURIComponent(expedia.toString())}` },
    { partner: "Agoda", url: agoda.toString() },
    { partner: "Hotels.com", url: hotelsCom.toString() },
    { partner: "Trip.com", url: trip.toString() },
    ...(zen ? [{ partner: "ZenHotels", url: zen }] : []),
    { partner: "Almosafer", url: almosafer.toString() },
  ];
}
