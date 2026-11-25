import { NextResponse } from "next/server";
import { googleFlights } from "@/lib/providers/serpapi";
import { sdConfigured, sdFlights, sdLastError, sdSkyscannerProbe } from "@/lib/providers/scrapingdog";

export const dynamic = "force-dynamic";

const CODE = /^[A-Z]{3}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Live flight prices when the flight partner's search cannot be reached
 * (see googleFlights in serpapi.ts). 204 when there is nothing to show —
 * no allowance left, or nothing found — and the page offers links instead.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const origin = (q.get("origin") || "").toUpperCase();
  const destination = (q.get("destination") || "").toUpperCase();
  const departDate = q.get("departDate") || "";
  const returnDate = q.get("returnDate") || "";
  if (!CODE.test(origin) || !CODE.test(destination) || origin === destination || !DAY.test(departDate) || (returnDate && !DAY.test(returnDate))) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const n = (k: string, max: number) => Math.max(0, Math.min(max, Number(q.get(k)) || 0));
  const currency = /^[A-Z]{3}$/.test(q.get("currency") || "") ? (q.get("currency") as string) : "SAR";
  const ask = {
    origin,
    destination,
    departDate,
    returnDate: returnDate || undefined,
    adults: Math.max(1, n("adults", 9)),
    children: n("children", 8),
    infants: n("infants", 4),
    currency,
    locale: (q.get("locale") === "en" ? "en" : "ar") as "ar" | "en",
    directOnly: q.get("directOnly") === "true",
  };
  // Source probe (own spending check only): Skyscanner through Scrapingdog.
  if (
    q.get("probe") === "sky" &&
    process.env.SMOKE_TOKEN &&
    request.headers.get("x-sfrtna-smoke") === process.env.SMOKE_TOKEN &&
    request.headers.get("x-sfrtna-spend") === "1"
  ) {
    return NextResponse.json(await sdSkyscannerProbe(ask), { headers: { "Cache-Control": "no-store" } });
  }
  // Paid-per-search source first (cheap, prepaid); SerpApi's small free
  // allowance stays for the destination explorer, and answers when the
  // first one is not set up, is out of credit, or finds nothing.
  const first = await sdFlights(ask);
  const result = first && first.flights.length > 0 ? first : await googleFlights(ask);
  // Which source answered: for our own site check only, never for visitors.
  // (Only the source check that spends on purpose: page checks keep the 204.)
  const own =
    Boolean(process.env.SMOKE_TOKEN) &&
    request.headers.get("x-sfrtna-smoke") === process.env.SMOKE_TOKEN &&
    request.headers.get("x-sfrtna-spend") === "1";
  const check = own ? { via: result === first ? "sd" : result ? "serp" : "none", sdOn: sdConfigured(), sdError: sdLastError() } : undefined;
  if (!result || result.flights.length === 0) {
    return own ? NextResponse.json({ check }, { status: 200 }) : new NextResponse(null, { status: 204 });
  }
  return NextResponse.json(own ? { ...result, check } : result, { headers: { "Cache-Control": "no-store" } });
}
