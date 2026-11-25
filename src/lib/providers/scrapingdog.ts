import { headers } from "next/headers";
import { cachedJson } from "@/lib/edgeCache";
import { countUse } from "@/lib/usage";
import type { FallbackFlight, FallbackFlights } from "@/lib/providers/serpapi";

/**
 * Live flight prices from Google Flights through Scrapingdog (owner rule,
 * 24 Nov 2026: "show flights from ANY source, but nothing without its live
 * price"). Same data as our SerpApi fallback — it covers Riyadh and the
 * Saudi airlines that the flight partner does not show — paid per request
 * instead of SerpApi's free 250 a month for the whole site.
 *
 * Read from Scrapingdog's own docs on 25 Nov 2026
 * (scrapingdog.com/documentation/google-flights-api):
 *  - GET https://api.scrapingdog.com/google_flights, 5 credits a request;
 *  - api_key (Cloudflare secret SCRAPINGDOG_KEY, never in code),
 *    departure_id, arrival_id, outbound_date, return_date, type (1 round,
 *    2 one way), adults, children, infants_on_lap, currency, country,
 *    language, stops (1 = non-stop);
 *  - answer: best_flights[] (and other_flights[] when given) with
 *    flights[] segments, layovers[], total_duration, price.
 *
 * Inactive until the secret exists. Answers are cached 20 minutes (as the
 * SerpApi source) and our own site checks never spend.
 */

const BASE = "https://api.scrapingdog.com/google_flights";

function key(): string {
  return process.env.SCRAPINGDOG_KEY || "";
}

export function sdConfigured(): boolean {
  return Boolean(key());
}

async function isOwnCheck(): Promise<boolean> {
  const token = process.env.SMOKE_TOKEN;
  if (!token) return false;
  try {
    const h = await headers();
    return h.get("x-sfrtna-smoke") === token && h.get("x-sfrtna-spend") !== "1";
  } catch {
    return false;
  }
}

/** The last refusal, for the site check only (never shown to visitors). */
let lastError = "";
/** Index (in sdFlights' list) of the market/language form that answered last. */
let workingForm = -1;
let lastForm = "";
export function sdLastError(): string {
  return [lastForm && `ok=${lastForm}`, lastError].filter(Boolean).join(" ");
}

const https = (u?: string) => (u && u.startsWith("https://") ? u : "");

interface Segment {
  departure_airport?: { id?: string; time?: string };
  arrival_airport?: { id?: string; time?: string };
  duration?: number;
  airline?: string;
  airline_logo?: string;
  flight_number?: string;
}
interface Option {
  flights?: Segment[];
  layovers?: { id?: string; duration?: number }[];
  total_duration?: number;
  price?: number | string;
}

/** Google Flights opened on the same route, dates and currency. */
export function googleFlightsUrl(q: { origin: string; destination: string; departDate: string; returnDate?: string; currency: string; locale: "ar" | "en" }): string {
  const text = `Flights from ${q.origin} to ${q.destination} on ${q.departDate}${q.returnDate ? ` through ${q.returnDate}` : " one way"}`;
  const u = new URL("https://www.google.com/travel/flights");
  u.searchParams.set("q", text);
  u.searchParams.set("curr", q.currency);
  u.searchParams.set("hl", q.locale);
  u.searchParams.set("gl", "sa");
  return u.toString();
}

export async function sdFlights(q: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  currency: string;
  locale: "ar" | "en";
  directOnly: boolean;
}): Promise<FallbackFlights | null> {
  if (!key()) return null;
  const round = Boolean(q.returnDate);
  const cacheKey = `sd-flights1:${q.origin}:${q.destination}:${q.departDate}:${q.returnDate || "-"}:${q.adults}:${q.children}:${q.infants}:${q.currency}:${q.locale}:${q.directOnly ? 1 : 0}`;
  return cachedJson<FallbackFlights>(cacheKey, 20 * 60, async () => {
    // Our own checks read the cache only.
    if (await isOwnCheck()) return null;
    const base: Record<string, string> = {
      api_key: key(),
      departure_id: q.origin,
      arrival_id: q.destination,
      outbound_date: q.departDate,
      type: round ? "1" : "2",
      adults: String(q.adults),
      currency: q.currency,
    };
    if (round) base.return_date = q.returnDate as string;
    if (q.children) base.children = String(q.children);
    if (q.infants) base.infants_on_lap = String(q.infants);
    if (q.directOnly) base.stops = "1";
    // The docs list market/language examples only (us/uk/fr, en/es/fr/de):
    // the Saudi market in Arabic is asked first, then plainer forms. The one
    // that answered is kept for the next searches (and shown to the check).
    const forms = [
      { country: "sa", language: q.locale },
      { country: "sa", language: "en" },
      { country: "us", language: "en" },
    ];
    const order = workingForm >= 0 ? [forms[workingForm], ...forms.filter((_, i) => i !== workingForm)] : forms;
    let body: Record<string, unknown> | null = null;
    const errors: string[] = [];
    for (const form of order) {
      const url = new URL(BASE);
      for (const [k, v] of Object.entries({ ...base, ...form })) url.searchParams.set(k, v);
      try {
        const res = await fetch(url.toString());
        countUse("scrapingdog");
        if (!res.ok) {
          // The reason, for the site check (never the key: it is not echoed).
          const why = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 120);
          errors.push(`${form.country}/${form.language}: http ${res.status} ${why}`);
          continue;
        }
        const b = (await res.json()) as Record<string, unknown>;
        if (b.error) {
          errors.push(`${form.country}/${form.language}: ${String(b.error).slice(0, 120)}`);
          continue;
        }
        body = b;
        workingForm = forms.indexOf(form);
        lastForm = `${form.country}/${form.language}`;
        break;
      } catch (e) {
        errors.push(`${form.country}/${form.language}: ${e instanceof Error ? e.message : "fetch failed"}`);
      }
    }
    lastError = errors.join(" | ").slice(0, 400);
    if (!body) return null;
    const best = (body.best_flights as Option[] | undefined) ?? [];
    const other = (body.other_flights as Option[] | undefined) ?? [];
    const time = (s?: string) => (s ? s.slice(11, 16) : "");
    const flights: FallbackFlight[] = [...best.map((o) => [o, true] as const), ...other.map((o) => [o, false] as const)]
      .map(([o, isBest]) => [o, Number(o.price), isBest] as const)
      .filter(([o, price]) => Number.isFinite(price) && price > 0 && (o.flights?.length ?? 0) > 0)
      .map(([o, price, isBest]) => ({
        price,
        minutes: o.total_duration ?? 0,
        stops: (o.flights?.length ?? 1) - 1,
        layovers: (o.layovers ?? []).map((l) => ({ code: l.id ?? "", minutes: l.duration ?? 0 })),
        legs: (o.flights ?? []).map((s) => ({
          depDate: (s.departure_airport?.time ?? "").slice(0, 10),
          arrDate: (s.arrival_airport?.time ?? "").slice(0, 10),
          depTime: time(s.departure_airport?.time),
          depCode: s.departure_airport?.id ?? "",
          arrTime: time(s.arrival_airport?.time),
          arrCode: s.arrival_airport?.id ?? "",
          minutes: s.duration ?? 0,
          airline: s.airline ?? "",
          logo: https(s.airline_logo),
          flightNumber: s.flight_number ?? "",
        })),
        best: isBest,
      }));
    if (flights.length === 0) return null;
    return { flights, url: googleFlightsUrl(q), roundTrip: round, currency: q.currency };
  });
}
