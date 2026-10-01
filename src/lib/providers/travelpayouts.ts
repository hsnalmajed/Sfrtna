import type { FlightOffer, SearchParams } from "@/lib/types";
import type { PriceProvider } from "./types";
import { resolveIata } from "@/lib/flights";
import { searchHotellook } from "./hotellook";

/**
 * Travelpayouts — the first real price source.
 *
 * Why this one, and why not the booking APIs it replaced:
 *
 * Duffel, Amadeus, Hotelbeds and the rest are *booking* APIs. They earn when
 * a reservation completes through them, and they price accordingly — Duffel
 * charges per order and adds a per-search fee once the search-to-book ratio
 * passes 1500:1. Sfrtna never takes a booking, so that ratio is infinite by
 * construction: every search is a cost and no booking is ever ours. A pure
 * comparison site on a booking API pays to exist and earns nothing.
 *
 * Travelpayouts is the other kind: it pays *for the referral*. The same
 * account that serves the prices pays a commission when a visitor clicks
 * through and books at the other end, which is exactly this site's business
 * model, and it is self-service — no contract, no minimum, no sales call.
 *
 * ── The honest limitation ────────────────────────────────────────────────
 * The free Data API returns prices **observed over the past few days**, not a
 * live quote. Travelpayouts gates its live search behind 50,000 monthly
 * active users, and we do not have them yet.
 *
 * That is a real constraint and it is handled by telling the truth rather
 * than by dressing a cached number up as a live one. Every offer from here
 * carries `observedAt` and `priceOnly`, and the interface is required to say
 * when the price was seen. Cached prices are still worth showing — "the
 * cheapest fare seen on Riyadh→Istanbul this month" is a real, useful,
 * checkable answer — but they are not a booking, and the page must not
 * pretend otherwise.
 *
 * `priceOnly` also covers a second gap: this endpoint gives a price, a
 * carrier, a flight number and a departure time, and says nothing about
 * arrival, duration, stops or baggage. Those fields are therefore absent
 * rather than estimated. A plausible-looking timeline computed from a
 * great-circle distance would be a fabrication, and this site does not put
 * invented numbers in front of travellers.
 *
 * Credentials:
 *   TRAVELPAYOUTS_TOKEN   — the API token. Secret. A Cloudflare secret,
 *                           read on the server at run time.
 *   TRAVELPAYOUTS_MARKER  — the affiliate id. Public. A constant below, for
 *                           the reason given there.
 *
 * Docs: https://travelpayouts-data-api.readthedocs.io/
 */

const BASE = "https://api.travelpayouts.com";

/** Carrier names we can print. Anything else shows its IATA code. */
const AIRLINE_NAMES: Record<string, string> = {
  SV: "Saudia",
  XY: "flynas",
  F3: "flyadeal",
  TK: "Turkish Airlines",
  EK: "Emirates",
  QR: "Qatar Airways",
  EY: "Etihad Airways",
  GF: "Gulf Air",
  WY: "Oman Air",
  KU: "Kuwait Airways",
  MS: "EgyptAir",
  RJ: "Royal Jordanian",
  G9: "Air Arabia",
  FZ: "flydubai",
  J9: "Jazeera Airways",
  AF: "Air France",
  LH: "Lufthansa",
  BA: "British Airways",
  KL: "KLM",
  QF: "Qantas",
  SQ: "Singapore Airlines",
  MH: "Malaysia Airlines",
  GA: "Garuda Indonesia",
  TG: "Thai Airways",
  JL: "Japan Airlines",
  NH: "ANA",
  AZ: "ITA Airways",
  IB: "Iberia",
  PC: "Pegasus Airlines",
};

/** One entry of the `data[DEST]` map the v1 price endpoints return. */
interface TpPrice {
  price?: number;
  airline?: string;
  flight_number?: number | string;
  departure_at?: string;
  return_at?: string;
  expires_at?: string;
}

interface TpResponse {
  success?: boolean;
  data?: Record<string, Record<string, TpPrice>>;
  currency?: string;
}

function token(): string {
  return process.env.TRAVELPAYOUTS_TOKEN || "";
}

/**
 * The affiliate marker — the number that makes an outgoing link pay.
 *
 * It lives in the code, not in a Cloudflare secret, and that is deliberate.
 * The flight handoff is built in the browser, and a Next.js NEXT_PUBLIC_*
 * value is baked into the browser bundle at *build* time; a secret added
 * with `wrangler secret put` only exists at run time on the server, so the
 * browser would never see it and every link would go out unpaid, silently.
 *
 * Nothing is lost by committing it: the marker is not a secret. It is printed
 * in the query string of every link the site sends a visitor to. The API
 * token is the secret, and that one stays in Cloudflare.
 */
const TRAVELPAYOUTS_MARKER = "778874";

export function travelpayoutsMarker(): string {
  return process.env.NEXT_PUBLIC_TRAVELPAYOUTS_MARKER || TRAVELPAYOUTS_MARKER;
}

/**
 * Aviasales wants the whole search encoded in the path: origin, day+month,
 * destination, day+month, then cabin letter (empty for economy) and the
 * passenger counts. PAR1607NYC2007c321 is Paris→New York, 16 July to 20
 * July, business, three adults, two children, one infant.
 *
 * Documented at
 * https://support.travelpayouts.com/hc/en-us/articles/5711895629714-Aviasales-affiliate-links
 */
export function aviasalesSearchUrl(params: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults: number;
  children?: number;
  infants?: number;
}): string {
  const ddmm = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${String(d.getDate()).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const out = ddmm(params.departDate);
  if (!out) return "https://www.aviasales.com/";
  const back = params.returnDate ? ddmm(params.returnDate) : "";

  const adults = Math.min(9, Math.max(1, params.adults || 1));
  const children = Math.min(9, params.children ?? 0);
  const infants = Math.min(9, params.infants ?? 0);
  // Position matters: an infant digit is only read if a child digit precedes
  // it, so once there are infants the zero has to be written out.
  const party =
    infants > 0 ? `${adults}${children}${infants}` : children > 0 ? `${adults}${children}` : `${adults}`;

  const path = `${resolveIata(params.origin)}${out}${resolveIata(params.destination)}${back}${party}`;
  const url = new URL(`https://www.aviasales.com/search/${path}`);
  const marker = travelpayoutsMarker();
  if (marker) url.searchParams.set("marker", marker);
  return url.toString();
}

async function get(path: string, query: Record<string, string>): Promise<TpResponse | null> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v) url.searchParams.set(k, v);
  }
  try {
    const res = await fetch(url.toString(), {
      headers: { "X-Access-Token": token(), Accept: "application/json" },
      // Their data changes daily at most, and the Worker's subrequest budget
      // is the recurring production constraint on this site — an hour of
      // edge caching costs nothing in freshness and saves a call per visitor.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as TpResponse;
  } catch {
    return null;
  }
}

/**
 * The response is `{ data: { DEST: { "0": {...}, "1": {...} } } }`, keyed by
 * destination then by an index that is a string. Anything that isn't a number
 * with a price is dropped rather than coerced.
 */
function toOffers(
  body: TpResponse | null,
  params: SearchParams,
  opts: { direct: boolean; currency: string }
): FlightOffer[] {
  if (!body?.success || !body.data) return [];

  const origin = resolveIata(params.origin);
  const destination = resolveIata(params.destination);
  const bucket = body.data[destination] ?? Object.values(body.data)[0];
  if (!bucket || typeof bucket !== "object") return [];

  // The endpoint quotes one seat. The site's prices are for the whole party —
  // that is what a budget means to a family of four — so the fare is
  // multiplied by the paying passengers here, and the card says the
  // multiplication happened. Infants are left out: they are not sold a seat,
  // and the fee for one is the airline's to state, not ours to guess.
  const paying = Math.max(1, (params.adults || 1) + (params.childrenAges?.length ?? 0));

  const offers: FlightOffer[] = [];
  for (const [key, row] of Object.entries(bucket)) {
    const price = Number(row?.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    const code = (row.airline || "").toUpperCase();

    offers.push({
      id: `tp-${destination}-${key}-${code}-${row.flight_number ?? ""}`,
      airline: AIRLINE_NAMES[code] || code || "—",
      airlineCode: code,
      origin,
      destination,
      departTime: row.departure_at || params.departDate,
      // Not given by this endpoint. Left equal to departure so nothing
      // downstream has to handle an empty string, and suppressed in the UI
      // by `priceOnly` rather than being shown as a real arrival.
      arriveTime: row.departure_at || params.departDate,
      durationMinutes: 0,
      stops: opts.direct ? 0 : 0,
      price: Math.round(price * paying),
      pricePerPerson: Math.round(price),
      currency: opts.currency.toUpperCase(),
      isMock: false,
      bookingHint: "Aviasales",
      layoverCity: null,
      layoverDurationMinutes: null,
      baggageIncluded: false,
      priceOnly: true,
      observedAt: row.expires_at || undefined,
      stopsKnown: opts.direct,
    });
  }

  return offers.sort((a, b) => a.price - b.price);
}

export const travelpayouts: PriceProvider = {
  name: "Travelpayouts",

  isConfigured() {
    return Boolean(token());
  },

  async searchFlights(params: SearchParams): Promise<FlightOffer[]> {
    const origin = resolveIata(params.origin);
    const destination = resolveIata(params.destination);
    if (!origin || !destination || !params.departDate) return [];

    const currency = (params.currency || "SAR").toLowerCase();
    const query: Record<string, string> = {
      origin,
      destination,
      depart_date: params.departDate,
      currency,
    };
    if (params.returnDate) query.return_date = params.returnDate;

    // "Direct only" is a different endpoint rather than a filter, which is
    // the only way this source can state a stop count at all.
    const path = params.directFlightsOnly ? "/v1/prices/direct" : "/v1/prices/cheap";
    const exact = toOffers(await get(path, query), params, {
      direct: Boolean(params.directFlightsOnly),
      currency,
    });
    if (exact.length > 0) return exact;

    // Nothing was observed on those exact days — common on a quiet route, and
    // the reason a search used to fall back to sample fares. The same
    // endpoint answers by month, which is what a traveller deciding whether a
    // trip is affordable actually wants: "somewhere around 1,400 riyals that
    // month". It is a different question from the one asked, so the offers
    // say so and the card prints it.
    const month = (iso: string) => iso.slice(0, 7);
    const monthly: Record<string, string> = {
      origin,
      destination,
      depart_date: month(params.departDate),
      currency,
    };
    if (params.returnDate) monthly.return_date = month(params.returnDate);
    const near = toOffers(await get(path, monthly), params, {
      direct: Boolean(params.directFlightsOnly),
      currency,
    });
    return near.map((o) => ({ ...o, datesApproximate: true }));
  },

  async searchHotels(params, nights) {
    return searchHotellook(params, nights);
  },
};

/** One cheapest one-way fare seen from a city, per seat. */
export interface OneWayFare {
  destination: string;
  price: number;
  airline: string;
  airlineCode: string;
  departureAt: string;
  /** Stops, as the source states them. */
  transfers: number | null;
}

interface TpV3Row {
  origin?: string;
  destination?: string;
  destination_airport?: string;
  price?: number;
  airline?: string;
  departure_at?: string;
  transfers?: number;
}

/**
 * The cheapest one-way fare seen from `origin` to *every* destination, in
 * one request — Aviasales' prices_for_dates with only an origin and
 * `unique=true` answers one row per destination.
 *
 * This is what makes "take my budget to two or three countries" affordable
 * to price: one call per city on the route instead of one per pair of
 * cities, which on a Cloudflare Worker's 50-subrequest budget is the
 * difference between possible and not.
 *
 * `when` is a day (YYYY-MM-DD) or a month (YYYY-MM). Prices are observed
 * fares, the same as the rest of this source, and are labelled so.
 */
export async function oneWayFaresFrom(
  origin: string,
  when: string,
  currency: string,
  /** Round-trip fares instead (the price then covers both ways). */
  roundTrip = false
): Promise<Map<string, OneWayFare>> {
  const out = new Map<string, OneWayFare>();
  if (!token() || !origin || !when) return out;
  const url = new URL(`${BASE}/aviasales/v3/prices_for_dates`);
  url.searchParams.set("origin", origin);
  url.searchParams.set("departure_at", when);
  url.searchParams.set("one_way", roundTrip ? "false" : "true");
  url.searchParams.set("unique", "true");
  url.searchParams.set("sorting", "price");
  url.searchParams.set("limit", "1000");
  url.searchParams.set("currency", currency.toLowerCase());
  try {
    const res = await fetch(url.toString(), {
      headers: { "X-Access-Token": token(), Accept: "application/json" },
    });
    if (!res.ok) return out;
    const body = (await res.json()) as { success?: boolean; data?: TpV3Row[] };
    for (const row of body.data ?? []) {
      const dest = (row.destination || "").toUpperCase();
      const price = Number(row.price);
      if (!dest || !Number.isFinite(price) || price <= 0) continue;
      const code = (row.airline || "").toUpperCase();
      const fare: OneWayFare = {
        destination: dest,
        price: Math.round(price),
        airline: AIRLINE_NAMES[code] || code || "—",
        airlineCode: code,
        departureAt: row.departure_at || "",
        transfers: typeof row.transfers === "number" ? row.transfers : null,
      };
      // Indexed by the city code and the airport code both: our lists use
      // either (Baku is BAK the city, GYD the airport).
      for (const key of [dest, (row.destination_airport || "").toUpperCase()]) {
        if (!key) continue;
        const prev = out.get(key);
        if (!prev || price < prev.price) out.set(key, fare);
      }
    }
  } catch {
    // An empty map: the caller reports "no fare seen", it does not guess.
  }
  return out;
}

/** The cheapest one-way fare seen for each departure day of a month. */
export interface DayFare {
  price: number;
  airline: string;
  transfers: number | null;
}

/**
 * Per-day one-way fares, origin → destination, for the month of `month`
 * (YYYY-MM): { "YYYY-MM-DD": fare per seat }.
 *
 * This is what prices a trip for *its* dates: the fare on the day out plus
 * the fare on the day back. Checked on 28 Sep 2026 against the live search —
 * Riyadh–Baku, 25 Oct to 1 Nov: 660 out + the return day ≈ 1,300 a person;
 * the live search's cheapest was 1,299. The month's single lowest fare, which
 * this replaces, had said 788.
 */
export async function dayFares(
  origin: string,
  destination: string,
  month: string,
  currency: string
): Promise<Map<string, DayFare>> {
  const out = new Map<string, DayFare>();
  if (!token() || !origin || !destination || !month) return out;
  const url = new URL(`${BASE}/aviasales/v3/grouped_prices`);
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("departure_at", month);
  url.searchParams.set("group_by", "departure_at");
  url.searchParams.set("currency", currency.toLowerCase());
  try {
    const res = await fetch(url.toString(), {
      headers: { "X-Access-Token": token(), Accept: "application/json" },
    });
    if (!res.ok) return out;
    const body = (await res.json()) as {
      data?: Record<string, { price?: number; airline?: string; transfers?: number }>;
    };
    for (const [day, row] of Object.entries(body.data ?? {})) {
      const price = Number(row?.price);
      if (!Number.isFinite(price) || price <= 0) continue;
      const code = (row.airline || "").toUpperCase();
      out.set(day.slice(0, 10), {
        price: Math.round(price),
        airline: AIRLINE_NAMES[code] || code || "—",
        transfers: typeof row.transfers === "number" ? row.transfers : null,
      });
    }
  } catch {
    // Empty: the caller says "no fare seen" rather than guess.
  }
  return out;
}


/** Airport → its city's code, where the city has several airports (FCO → ROM). */
const CITY_OF_AIRPORT: Record<string, string> = {
  CDG: "PAR", ORY: "PAR", LHR: "LON", LGW: "LON", STN: "LON", JFK: "NYC", EWR: "NYC", MXP: "MIL", LIN: "MIL",
  FCO: "ROM", CIA: "ROM", HND: "TYO", NRT: "TYO", SVO: "MOW", DME: "MOW", VKO: "MOW", IAD: "WAS", DCA: "WAS",
  ORD: "CHI", ARN: "STO", OTP: "BUH", ICN: "SEL", GMP: "SEL", PEK: "BJS", PKX: "BJS", PVG: "SHA", KIX: "OSA",
  CGK: "JKT", YYZ: "YTO", GRU: "SAO", GIG: "RIO", EZE: "BUE", KEF: "REK", IST: "IST", SAW: "IST", DXB: "DXB", DWC: "DXB",
};

/**
 * The cheapest one-way fare seen for every day of a month on a route, from
 * every place the partner's data keeps it: fares grouped by day, and the full
 * list of fares for the month — each asked for the airport and for its city
 * (Rome is FCO and ROM). The lowest per day wins. Days nobody has searched
 * recently have no fare, and stay without one: nothing is estimated.
 *
 * `sources` says how many days each query contributed — for checking coverage.
 */
export async function routeDayFares(
  origin: string,
  destination: string,
  month: string,
  currency: string
): Promise<{ fares: Map<string, DayFare>; sources: Record<string, number> }> {
  const fares = new Map<string, DayFare>();
  const sources: Record<string, number> = {};
  if (!token() || !origin || !destination || !month) return { fares, sources };
  const froms = [...new Set([origin, CITY_OF_AIRPORT[origin] ?? origin])];
  const tos = [...new Set([destination, CITY_OF_AIRPORT[destination] ?? destination])];

  const take = (label: string, day: string, price: number, airline: string, transfers: number | null) => {
    if (!day.startsWith(month) || !Number.isFinite(price) || price <= 0) return;
    sources[label] = (sources[label] ?? 0) + 1;
    const prev = fares.get(day);
    if (!prev || price < prev.price) fares.set(day, { price: Math.round(price), airline, transfers });
  };

  const jobs: Promise<void>[] = [];
  for (const from of froms) {
    for (const to of tos) {
      // 1. One row per day.
      jobs.push(
        dayFares(from, to, month, currency).then((m) => {
          for (const [day, f] of m) take(`grouped ${from}-${to}`, day, f.price, f.airline, f.transfers);
        })
      );
      // 2. Every fare seen for the month, one way.
      jobs.push(
        (async () => {
          const url = new URL(`${BASE}/aviasales/v3/prices_for_dates`);
          url.searchParams.set("origin", from);
          url.searchParams.set("destination", to);
          url.searchParams.set("departure_at", month);
          url.searchParams.set("one_way", "true");
          url.searchParams.set("unique", "false");
          url.searchParams.set("sorting", "price");
          url.searchParams.set("limit", "1000");
          url.searchParams.set("currency", currency.toLowerCase());
          try {
            const res = await fetch(url.toString(), { headers: { "X-Access-Token": token(), Accept: "application/json" } });
            if (!res.ok) return;
            const body = (await res.json()) as { data?: TpV3Row[] };
            for (const row of body.data ?? []) {
              const code = (row.airline || "").toUpperCase();
              take(
                `dates ${from}-${to}`,
                (row.departure_at || "").slice(0, 10),
                Number(row.price),
                AIRLINE_NAMES[code] || code || "—",
                typeof row.transfers === "number" ? row.transfers : null
              );
            }
          } catch {
            // That source adds nothing this time.
          }
        })()
      );
    }
  }
  await Promise.all(jobs);
  return { fares, sources };
}
