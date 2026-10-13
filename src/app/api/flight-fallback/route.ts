import { NextResponse } from "next/server";
import { googleFlights } from "@/lib/providers/serpapi";

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
  const result = await googleFlights({
    origin,
    destination,
    departDate,
    returnDate: returnDate || undefined,
    adults: Math.max(1, n("adults", 9)),
    children: n("children", 8),
    infants: n("infants", 4),
    currency,
    locale: q.get("locale") === "en" ? "en" : "ar",
    directOnly: q.get("directOnly") === "true",
  });
  if (!result || result.flights.length === 0) return new NextResponse(null, { status: 204 });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
