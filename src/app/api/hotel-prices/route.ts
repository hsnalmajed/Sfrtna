import { NextRequest, NextResponse } from "next/server";
import { hotelPrices } from "@/lib/providers/serpapi";
import { parseChildrenAges } from "@/lib/searchParamsUtil";

export const dynamic = "force-dynamic";

/**
 * Each booking site's price for a hotel (or a city's hotels), from Google
 * Hotels via SerpApi:
 *
 *   /api/hotel-prices?q=Swissotel+Istanbul&checkIn=2026-11-10&checkOut=2026-11-13&adults=2[&childrenAges=7]
 *   [&token=<one hotel from a list>][&minStars=4][&maxPerNight=600]
 *
 * Dates from today to about a year ahead, at most 30 nights, so a malformed
 * request never spends a search. Every answer is cached six hours and the
 * month's allowance is paced (see serpapi.ts).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") || "").trim().slice(0, 120);
  const checkIn = sp.get("checkIn") || "";
  const checkOut = sp.get("checkOut") || "";
  const adults = Math.min(9, Math.max(1, Number(sp.get("adults")) || 2));
  const childrenAges = parseChildrenAges(sp.get("childrenAges")).slice(0, 6);
  const tokenRaw = sp.get("token") || "";
  const token = /^[A-Za-z0-9_=-]{8,300}$/.test(tokenRaw) ? tokenRaw : undefined;
  const minStars = Math.min(5, Math.max(0, Number(sp.get("minStars")) || 0));
  const maxPerNight = Math.min(100_000, Math.max(0, Number(sp.get("maxPerNight")) || 0));
  const today = new Date().toISOString().slice(0, 10);
  const yearOut = new Date(Date.now() + 330 * 86_400_000).toISOString().slice(0, 10);
  const okDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today && d <= yearOut;
  const nights = (Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000;
  if (q.length < 2 || !okDate(checkIn) || !okDate(checkOut) || !(nights >= 1 && nights <= 30)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (tokenRaw && !token) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const result = await hotelPrices({ q, checkIn, checkOut, adults, childrenAges, token, minStars, maxPerNight });
  return NextResponse.json({ result }, { headers: { "Cache-Control": "no-store" } });
}
