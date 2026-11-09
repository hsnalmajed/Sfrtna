import { findAirport } from "@/lib/airports";

/**
 * Suppliers directory (owner, 8 Nov 2026): trusted sites for each need,
 * linked even when they pay us nothing — the visit is the gain, and a
 * traveller sent to the right place may book another service we earn on.
 *
 * Rules every link here follows:
 *  - **Only URL shapes checked by hand** in a real browser on 8 Nov 2026
 *    (route RUH→IST, 10–17 Dec, 2 adults + 1 child): the site opened its own
 *    search with the places, the dates and the party filled in. A site whose
 *    shape could not be checked is not here (Wego, Momondo, Kiwi.com,
 *    Klook, Airbnb — the browser used for the check refused those domains).
 *  - **No prices.** The site sets the price; we show none of ours.
 *  - Google Flights' `q` is read in English only: with `hl=ar` the same
 *    query opens an empty form (checked 8 Nov), so `hl=en` always, with the
 *    traveller's currency in `curr`.
 */

export interface FlightTrip {
  origin: string;
  destination: string;
  departDate: string;
  /** Empty for one way. */
  returnDate: string;
  adults: number;
  /** Ages of the children (2–11); a count alone is used where a site has no ages. */
  childrenAges: number[];
  /** Children counted when their ages are unknown (older searches). */
  children?: number;
  infants: number;
  currency?: string;
  locale?: "ar" | "en";
}

export interface SupplierLink {
  /** Stable id, for click tracking (data-partner). */
  id: string;
  name: string;
  href: string;
}

const pax = (t: FlightTrip) => ({
  adults: Math.max(1, t.adults),
  kids: t.childrenAges.length || t.children || 0,
  ages: t.childrenAges.map((a) => Math.min(17, Math.max(2, Math.round(a)))),
  infants: Math.max(0, t.infants),
});

/** Google Flights search in plain words — optionally narrowed to one airline. */
export function googleFlightsUrl(t: FlightTrip, airline?: string): string {
  const p = pax(t);
  const party = [
    `${p.adults} adult${p.adults > 1 ? "s" : ""}`,
    p.kids ? `${p.kids} child${p.kids > 1 ? "ren" : ""}` : "",
  ]
    .filter(Boolean)
    .join(" and ");
  const q =
    `Flights from ${t.origin} to ${t.destination} on ${t.departDate}` +
    (t.returnDate ? ` returning ${t.returnDate}` : "") +
    ` for ${party}` +
    (airline ? ` on ${airline}` : "");
  const u = new URL("https://www.google.com/travel/flights");
  u.searchParams.set("hl", "en");
  if (t.currency) u.searchParams.set("curr", t.currency);
  u.searchParams.set("q", q);
  return u.toString();
}

function almosaferUrl(t: FlightTrip): string {
  const p = pax(t);
  const dates = t.returnDate ? `${t.departDate}/${t.returnDate}` : t.departDate;
  // Its own form writes the party as path parts: /2Adult/1Child.
  const party = [`${p.adults}Adult`, p.kids ? `${p.kids}Child` : ""].filter(Boolean).join("/");
  return `https://www.almosafer.com/${t.locale === "en" ? "en" : "ar"}/flights/${t.origin}-${t.destination}/${dates}/Economy/${party}`;
}

function tripComUrl(t: FlightTrip): string {
  const p = pax(t);
  const u = new URL("https://www.trip.com/flights/showfarefirst");
  u.searchParams.set("dcity", t.origin.toLowerCase());
  u.searchParams.set("acity", t.destination.toLowerCase());
  u.searchParams.set("ddate", t.departDate);
  if (t.returnDate) u.searchParams.set("rdate", t.returnDate);
  u.searchParams.set("triptype", t.returnDate ? "rt" : "ow");
  u.searchParams.set("class", "y");
  u.searchParams.set("quantity", String(p.adults));
  u.searchParams.set("childqty", String(p.kids));
  u.searchParams.set("babyqty", String(p.infants));
  u.searchParams.set("searchboxarg", "t");
  if (t.currency) u.searchParams.set("curr", t.currency);
  return u.toString();
}

function kayakUrl(t: FlightTrip): string {
  const p = pax(t);
  const kids = p.ages.length ? `/children-${p.ages.join("-")}` : "";
  return `https://www.kayak.com/flights/${t.origin}-${t.destination}/${t.departDate}${t.returnDate ? `/${t.returnDate}` : ""}/${p.adults}adults${kids}?sort=bestflight_a`;
}

function expediaFlightsUrl(t: FlightTrip): string {
  const p = pax(t);
  const us = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`;
  const parts = [
    `trip=${t.returnDate ? "roundtrip" : "oneway"}`,
    `leg1=from:${t.origin},to:${t.destination},departure:${us(t.departDate)}TANYT`,
    ...(t.returnDate ? [`leg2=from:${t.destination},to:${t.origin},departure:${us(t.returnDate)}TANYT`] : []),
    `passengers=adults:${p.adults},children:${p.ages.length}${p.ages.length ? `[${p.ages.join(";")}]` : ""},infantinlap:N`,
    "mode=search",
    "options=cabinclass:economy",
  ];
  const landing = `https://www.expedia.com/Flights-Search?${parts.join("&")}`;
  // Through our redirect, which adds the affiliate tag (see /api/go/expedia).
  return `/api/go/expedia?landing=${encodeURIComponent(landing)}`;
}

function skyscannerUrl(t: FlightTrip): string {
  const p = pax(t);
  const d = (s: string) => s.slice(2).replace(/-/g, "");
  const u = new URL(
    `https://www.skyscanner.net/transport/flights/${t.origin.toLowerCase()}/${t.destination.toLowerCase()}/${d(t.departDate)}/${t.returnDate ? `${d(t.returnDate)}/` : ""}`
  );
  u.searchParams.set("adultsv2", String(p.adults));
  if (p.ages.length) u.searchParams.set("childrenv2", p.ages.join("|"));
  u.searchParams.set("cabinclass", "economy");
  return u.toString();
}

/** Flight search sites, each opened on this very trip. */
export function flightSites(t: FlightTrip): SupplierLink[] {
  return [
    { id: "google-flights", name: "Google Flights", href: googleFlightsUrl(t) },
    { id: "almosafer", name: t.locale === "en" ? "Almosafer" : "المسافر", href: almosaferUrl(t) },
    { id: "trip-com-flights", name: "Trip.com", href: tripComUrl(t) },
    { id: "kayak", name: "KAYAK", href: kayakUrl(t) },
    { id: "expedia-flights", name: "Expedia", href: expediaFlightsUrl(t) },
    { id: "skyscanner", name: "Skyscanner", href: skyscannerUrl(t) },
  ];
}

/**
 * The main airlines of a country, by the names Google Flights reads in a
 * query ("… on flynas" narrows the results to that airline — checked 8 Nov).
 * National and largest carriers only; a country not listed adds none.
 */
const NATIONAL_AIRLINES: Record<string, string[]> = {
  "Saudi Arabia": ["Saudia", "flynas", "flyadeal"],
  "United Arab Emirates": ["Emirates", "Etihad", "flydubai", "Air Arabia"],
  Qatar: ["Qatar Airways"],
  Bahrain: ["Gulf Air"],
  Kuwait: ["Kuwait Airways", "Jazeera Airways"],
  Oman: ["Oman Air", "SalamAir"],
  Jordan: ["Royal Jordanian"],
  Egypt: ["EgyptAir"],
  Morocco: ["Royal Air Maroc"],
  Tunisia: ["Tunisair"],
  Lebanon: ["Middle East Airlines"],
  Iraq: ["Iraqi Airways"],
  Turkey: ["Turkish Airlines", "Pegasus", "AJet"],
  Azerbaijan: ["Azerbaijan Airlines"],
  Georgia: ["Georgian Airways"],
  Uzbekistan: ["Uzbekistan Airways"],
  Kazakhstan: ["Air Astana"],
  Pakistan: ["PIA"],
  India: ["Air India", "IndiGo"],
  "Sri Lanka": ["SriLankan Airlines"],
  Maldives: ["Maldivian"],
  Malaysia: ["Malaysia Airlines", "AirAsia"],
  Indonesia: ["Garuda Indonesia"],
  Thailand: ["Thai Airways"],
  Singapore: ["Singapore Airlines"],
  Vietnam: ["Vietnam Airlines"],
  Philippines: ["Philippine Airlines"],
  China: ["Air China", "China Southern", "China Eastern"],
  "Hong Kong": ["Cathay Pacific"],
  Japan: ["Japan Airlines", "ANA"],
  "South Korea": ["Korean Air", "Asiana"],
  "United Kingdom": ["British Airways", "Virgin Atlantic"],
  France: ["Air France"],
  Germany: ["Lufthansa"],
  Netherlands: ["KLM"],
  Italy: ["ITA Airways"],
  Spain: ["Iberia"],
  Portugal: ["TAP Air Portugal"],
  Switzerland: ["SWISS"],
  Austria: ["Austrian"],
  Greece: ["Aegean"],
  Poland: ["LOT"],
  Ethiopia: ["Ethiopian"],
  Kenya: ["Kenya Airways"],
  "South Africa": ["South African Airways"],
  "United States": ["United", "American", "Delta"],
  Canada: ["Air Canada"],
  Australia: ["Qantas"],
  Bangladesh: ["Biman Bangladesh"],
  Nepal: ["Nepal Airlines"],
  Belgium: ["Brussels Airlines"],
  Ireland: ["Aer Lingus"],
  Finland: ["Finnair"],
  Denmark: ["SAS"],
  Sweden: ["SAS"],
  Norway: ["SAS", "Norwegian"],
  Serbia: ["Air Serbia"],
  Algeria: ["Air Algerie"],
  Yemen: ["Yemenia"],
  Syria: ["Syrian Air"],
  Mauritius: ["Air Mauritius"],
  Seychelles: ["Air Seychelles"],
  Taiwan: ["China Airlines", "EVA Air"],
  Mexico: ["Aeromexico"],
  Brazil: ["LATAM"],
  "New Zealand": ["Air New Zealand"],
  Nigeria: ["Air Peace"],
  Tanzania: ["Air Tanzania"],
};

/**
 * Airlines whose own site opens its results from a link (round trip + one
 * way, Arabic + English, in a fresh tab — TEST_PLAN «Airlines' own booking
 * links»). Every other airline keeps Google Flights narrowed to it.
 */
const OWN_SITE: Record<string, (t: FlightTrip) => string | undefined> = {
  // Qatar Airways' own booking widget builds exactly this (checked 8 Nov:
  // RUH→IST RT 2+1, JED→IST RT ar, DMM→LHR OW 1 + infant).
  "Qatar Airways": (t) => {
    const p = pax(t);
    const u = new URL("https://www.qatarairways.com/app/booking/flight-selection");
    const q: [string, string][] = [
      ["widget", "QR"],
      ["searchType", "F"],
      ["addTaxToFare", "Y"],
      ["minPurTime", "0"],
      ["selLang", t.locale === "en" ? "en" : "ar"],
      ["tripType", t.returnDate ? "R" : "O"],
      ["fromStation", t.origin],
      ["toStation", t.destination],
      ["departing", t.departDate],
      ...(t.returnDate ? ([["returning", t.returnDate]] as [string, string][]) : []),
      ["bookingClass", "E"],
      ["adults", String(p.adults)],
      ["children", String(p.kids)],
      ["infants", String(p.infants)],
      ["ofw", "0"],
      ["teenager", "0"],
      ["flexibleDate", "off"],
      ["allowRedemption", "N"],
    ];
    for (const [k, v] of q) u.searchParams.set(k, v);
    return u.toString();
  },
  // Emirates' results page reads these names itself (its own
  // searchResultsPayloadTransformer; dates "10 Dec 26"). Checked 8 Nov in a
  // fresh tab: RUH→IST RT 2+1 ar = same 22 options and total as the site's
  // own search; DMM→LHR OW 1 + infant en.
  Emirates: (t) => {
    const p = pax(t);
    const d = (iso: string) => {
      const [y, m, day] = iso.split("-").map(Number);
      const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
      return `${String(day).padStart(2, "0")} ${mon} ${String(y).slice(2)}`;
    };
    const u = new URL("https://www.emirates.com/booking/search-results/");
    const q: [string, string][] = [
      ["pub", t.locale === "en" ? "/sa/english" : "/sa/arabic"],
      ["seldcity1", t.origin],
      ["selacity1", t.destination],
      ["selddate1", d(t.departDate)],
      ...(t.returnDate ? ([["seladate1", d(t.returnDate)]] as [string, string][]) : []),
      ["seladults", String(p.adults)],
      ["selchildren", String(p.kids)],
      ["selinfants", String(p.infants)],
      ["selcabinclass", "0"],
    ];
    for (const [k, v] of q) u.searchParams.set(k, v);
    return u.toString();
  },
  // flydubai's own search lands on this path. Checked 8 Nov in a new tab:
  // RUH→IST RT 2+1 en = same party, dates and lowest total (SAR 7,815) as
  // the site's own search; DMM→DXB OW 1 + infant ar.
  flydubai: (t) => {
    const p = pax(t);
    const d = (iso: string) => iso.replaceAll("-", "");
    const dates = t.returnDate ? `${d(t.departDate)}_${d(t.returnDate)}` : d(t.departDate);
    const u = new URL(
      `https://flights2.flydubai.com/${t.locale === "en" ? "en" : "ar"}/results/${t.returnDate ? "rt" : "ow"}/a${p.adults}c${p.kids}i${p.infants}/${t.origin}_${t.destination}/${dates}`,
    );
    const q: [string, string][] = [
      ["cabinClass", "Economy"],
      ["isOriginMetro", "false"],
      ["isDestMetro", "false"],
      ["pm", "cash"],
    ];
    for (const [k, v] of q) u.searchParams.set(k, v);
    return u.toString();
  },
  // Gulf Air: the URL its own search lands on. Checked 9 Nov in the owner's
  // normal browser: RUH→IST RT 2+1 = route, dates and 3 passengers. One-way
  // and Arabic are untested, so one-way keeps Google and the page stays en.
  "Gulf Air": (t) => {
    if (!t.returnDate) return undefined;
    const p = pax(t);
    const d = (iso: string) => iso.replaceAll("-", "");
    const u = new URL("https://flights.gulfair.com/flights");
    const q: [string, string][] = [
      ["adt", String(p.adults)],
      ["cabin_class", "A"],
      ["chd", String(p.kids)],
      ["departure_date", d(t.departDate)],
      ["destination", t.destination],
      ["flight_type", "return"],
      ["inf", String(p.infants)],
      ["locale", "en"],
      ["origin", t.origin],
      ["return_date", d(t.returnDate)],
      ["tnn", "0"],
    ];
    for (const [k, v] of q) u.searchParams.set(k, v);
    return u.toString();
  },
  // Etihad: its own OneA search link. Checked 9 Nov in the owner's private
  // window (cold): RUH→IST RT 3 guests = route, dates, guests, fares. One-way,
  // Arabic and infants are untested, so those keep Google.
  Etihad: (t) => {
    const p = pax(t);
    if (!t.returnDate || p.infants > 0) return undefined;
    const d = (iso: string) => `${iso.replaceAll("-", "")}0000`;
    const u = new URL("https://digital.etihad.com/book/search");
    const q: [string, string][] = [
      ["LANGUAGE", "EN"],
      ["CHANNEL", "DESKTOP"],
      ["B_LOCATION", t.origin],
      ["E_LOCATION", t.destination],
      ["TRIP_TYPE", "R"],
      ["CABIN", "E"],
      ["TRAVELERS", [...Array(p.adults).fill("ADT"), ...Array(p.kids).fill("CHD")].join(",")],
      ["TRIP_FLOW_TYPE", "AVAILABILITY"],
      ["SITE_EDITION", "EN-SA"],
      ["DATE_1", d(t.departDate)],
      ["DATE_2", d(t.returnDate)],
    ];
    for (const [k, v] of q) u.searchParams.set(k, v);
    return u.toString();
  },
  // Pegasus: the URL its own search lands on. Checked 9 Nov in Chrome, typed
  // by hand: RUH→SAW RT 2+1 ar, DMM→SAW OW ar (SAR) = route, dates, language.
  Pegasus: (t) => {
    const p = pax(t);
    const u = new URL("https://web.flypgs.com/booking");
    const q: [string, string][] = [
      ["language", t.locale === "en" ? "en" : "ar"],
      ["adultCount", String(p.adults)],
      ["childCount", String(p.kids)],
      ["infantCount", String(p.infants)],
      ["departurePort", pegasusPort(t.origin)],
      ["arrivalPort", pegasusPort(t.destination)],
      ["currency", t.currency || "SAR"],
      ["dateOption", "1"],
      ["departureDate", t.departDate],
      ...(t.returnDate ? ([["returnDate", t.returnDate]] as [string, string][]) : []),
    ];
    for (const [k, v] of q) u.searchParams.set(k, v);
    return u.toString();
  },
};

/** Pegasus: Istanbul means Sabiha Gökçen, it does not fly to IST. */
const pegasusPort = (code: string) => (code === "IST" ? "SAW" : code);

/** Big connecting airlines between the Gulf and the world. */
const HUB_AIRLINES = ["Emirates", "Qatar Airways", "Etihad", "Turkish Airlines"];

/**
 * Airlines for a route — those of the two countries first, then the big
 * connecting ones — each opening its own site on this trip when it has a
 * checked link (OWN_SITE), else Google Flights narrowed to that airline,
 * where its own "book with" button leads to the airline's site.
 */
export function airlineLinks(t: FlightTrip, limit = 8): SupplierLink[] {
  const from = findAirport(t.origin)?.countryEn ?? "";
  const to = findAirport(t.destination)?.countryEn ?? "";
  const names = [...(NATIONAL_AIRLINES[from] ?? []), ...(NATIONAL_AIRLINES[to] ?? []), ...HUB_AIRLINES];
  const seen = new Set<string>();
  const out: SupplierLink[] = [];
  for (const n of names) {
    if (seen.has(n) || out.length >= limit) continue;
    seen.add(n);
    out.push({ id: `airline-${n.toLowerCase().replace(/[^a-z]+/g, "-")}`, name: n, href: OWN_SITE[n]?.(t) ?? googleFlightsUrl(t, n) });
  }
  return out;
}

export interface StayTrip {
  /** "City,Country" in English, as KAYAK reads it (e.g. "Istanbul,Turkey"). */
  cityEn: string;
  countryEn?: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges: number[];
  currency?: string;
}

/**
 * Hotel search sites beyond the paying ones (hotelPartnerLinks): KAYAK opens
 * the city with dates and party; Google Hotels takes the city and dates in
 * words (it does not read the party from a query — checked 8 Nov).
 */
export function extraHotelSites(s: StayTrip): SupplierLink[] {
  const place = s.countryEn ? `${s.cityEn},${s.countryEn}` : s.cityEn;
  const ages = s.childrenAges.map((a) => Math.min(17, Math.max(0, Math.round(a))));
  const kayak = `https://www.kayak.com/hotels/${encodeURI(place)}/${s.checkIn}/${s.checkOut}/${Math.max(1, s.adults)}adults${
    ages.length ? `/${ages.length}children-${ages.join("-")}` : ""
  }?sort=rank_a`;
  const g = new URL("https://www.google.com/travel/search");
  g.searchParams.set("hl", "en");
  if (s.currency) g.searchParams.set("curr", s.currency);
  g.searchParams.set("q", `hotels in ${s.cityEn} from ${s.checkIn} to ${s.checkOut}`);
  return [
    { id: "kayak-hotels", name: "KAYAK", href: kayak },
    { id: "google-hotels", name: "Google Hotels", href: g.toString() },
  ];
}

/**
 * Car hire at the city's airport with the trip's dates (KAYAK reads the
 * airport code; a city name alone can land on another place of that name —
 * "Turkey" opened Turkey, North Carolina, checked 8 Nov).
 */
export function carHireSites(airport: string, from: string, to: string): SupplierLink[] {
  if (!/^[A-Z]{3}$/.test(airport) || !from || !to) return [];
  return [{ id: "kayak-cars", name: "KAYAK", href: `https://www.kayak.com/cars/${airport}/${from}/${to}?sort=rank_a` }];
}
