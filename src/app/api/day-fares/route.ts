import { NextRequest, NextResponse } from "next/server";
import { routeDayFares } from "@/lib/providers/travelpayouts";
import { strictIata } from "@/lib/flights";
import { cachedJson } from "@/lib/edgeCache";

/**
 * The cheapest one-way fare seen for each day of a month on one route —
 * what the date picker writes under each day.
 *
 *   /api/day-fares?origin=DMM&destination=Rome&month=2026-10&currency=SAR
 *
 * Fares the partner has seen in the last days, per person; a day with none
 * seen is simply absent. Cached at the edge for six hours per route and month.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const origin = strictIata(sp.get("origin") || "") ?? "";
  const destination = strictIata(sp.get("destination") || "") ?? "";
  const month = sp.get("month") || "";
  const currency = (sp.get("currency") || "SAR").toUpperCase();
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination) || origin === destination || !/^\d{4}-\d{2}$/.test(month) || !/^[A-Z]{3}$/.test(currency)) {
    return NextResponse.json({ fares: {} }, { status: 400 });
  }
  const cached = await cachedJson<{ fares: Record<string, number>; sources: Record<string, number> }>(
    `day-fares2:${origin}:${destination}:${month}:${currency}`,
    3 * 3600,
    async () => {
      const { fares, sources } = await routeDayFares(origin, destination, month, currency);
      if (fares.size === 0) return null;
      const out: Record<string, number> = {};
      for (const [day, f] of fares) out[day] = f.price;
      return { fares: out, sources };
    }
  );
  return NextResponse.json(
    { origin, destination, currency, fares: cached?.fares ?? {}, sources: cached?.sources ?? {} },
    { headers: { "Cache-Control": "public, max-age=1800" } }
  );
}
