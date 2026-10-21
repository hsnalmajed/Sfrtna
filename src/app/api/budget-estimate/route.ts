import { NextResponse } from "next/server";
import { estimateBudget, STYLES, type EstimateRequest, type Style } from "@/lib/ai/budgetEstimate";
import { CONTINENTS, type Continent } from "@/lib/countries";

export const dynamic = "force-dynamic";

const IATA = /^[A-Z]{3}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** «كم أحتاج؟»: live flight + hotel for the trip, daily spending from sources. */
export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim().toUpperCase() : "");
  const origin = str(b.origin);
  const destination = str(b.destination);
  const from = typeof b.from === "string" ? b.from : "";
  const to = typeof b.to === "string" ? b.to : "";
  const today = new Date().toISOString().slice(0, 10);
  const adults = Number(b.adults);
  const ages = Array.isArray(b.childrenAges) ? b.childrenAges.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 17).slice(0, 6) : [];
  const infants = Math.min(4, Math.max(0, Math.round(Number(b.infants) || 0)));
  const currency = /^[A-Z]{3}$/.test(str(b.currency)) ? str(b.currency) : "SAR";
  const style: Style = STYLES.includes(b.style as Style) ? (b.style as Style) : "mid";
  const continents = Array.isArray(b.continents) ? (b.continents.filter((c) => (CONTINENTS as string[]).includes(c as string)) as Continent[]) : [];
  const nights = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
  if (
    (origin && !IATA.test(origin)) ||
    (destination && !IATA.test(destination)) ||
    (!origin && !destination) ||
    !DAY.test(from) ||
    !DAY.test(to) ||
    from < today ||
    !(nights >= 1 && nights <= 30) ||
    !(Number.isInteger(adults) && adults >= 1 && adults <= 9)
  ) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }
  const req: EstimateRequest = {
    origin,
    destination,
    continents,
    from,
    to,
    adults,
    childrenAges: ages,
    infants,
    currency,
    style,
    directOnly: b.directOnly === true,
    locale: b.locale === "en" ? "en" : "ar",
  };
  const result = await estimateBudget(req);
  if (!result) return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
}
