import { NextRequest, NextResponse } from "next/server";
import { strictIata } from "@/lib/flights";
import { liveFare } from "@/lib/providers/serpapi";

/**
 * The live fare for one trip, from Google Flights via SerpApi:
 *
 *   /api/live-fare?origin=RUH&destination=IST&departDate=2026-10-25[&returnDate=…][&adults=1&children=0]
 *
 * { fare: LiveFare } or { fare: null } when it could not be checked (no key,
 * the month's allowance paced out, or no flights). Only real airport or city
 * codes and dates from today to a year ahead are asked, so a malformed
 * request never spends a search.
 */
// Switched off 6 Oct 2026: measured against Aviasales — where travellers
// actually book — Google Flights' fare was 25% higher on the median route
// and up to 92% (Dammam–Rome), because Aviasales also sells the cheaper
// agency and self-transfer fares Google leaves out. A number that far from
// the booking price is not shown, and an open endpoint would only spend the
// month's searches. The code stays for the hotel prices, where Google's
// figure is each booking site's own.
const ENABLED = false;

export async function GET(req: NextRequest) {
  if (!ENABLED) return NextResponse.json({ error: "not available" }, { status: 404 });
  const sp = req.nextUrl.searchParams;
  const origin = strictIata(sp.get("origin") || "");
  const destination = strictIata(sp.get("destination") || "");
  const departDate = sp.get("departDate") || "";
  const returnDate = sp.get("returnDate") || "";
  const adults = Math.min(9, Math.max(1, Number(sp.get("adults")) || 1));
  const children = Math.min(8, Math.max(0, Number(sp.get("children")) || 0));
  const today = new Date().toISOString().slice(0, 10);
  const yearOut = new Date(Date.now() + 330 * 86_400_000).toISOString().slice(0, 10);
  const okDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today && d <= yearOut;
  if (!origin || !destination || origin === destination || !okDate(departDate) || (returnDate && (!okDate(returnDate) || returnDate < departDate))) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const fare = await liveFare({ origin, destination, departDate, returnDate: returnDate || undefined, adults, children });
  return NextResponse.json({ fare }, { headers: { "Cache-Control": "no-store" } });
}
