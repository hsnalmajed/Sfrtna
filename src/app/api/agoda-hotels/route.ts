import { NextRequest, NextResponse } from "next/server";
import { parseChildrenAges } from "@/lib/searchParamsUtil";
import { normalizeSearch } from "@/lib/search";
import { agodaCityList, agodaConfigured, agodaHotelRates, agodaPhoto, type AgodaListRow } from "@/lib/providers/agoda";
import { agodaHotelLanding } from "@/lib/affiliateLinks";

export const dynamic = "force-dynamic";

/**
 * Every Agoda hotel of one of our cities, a page at a time, each with Agoda's
 * live rate for these dates (Agoda Partners, direct):
 *
 *   /api/agoda-hotels?city=riyadh&checkIn=…&checkOut=…&adults=2[&childrenAges=7]
 *   [&page=0][&q=<name, Arabic or English>][&minStars=4][&sort=popular|rating|stars][&rooms=1]
 *
 * The list is ours (Agoda's Hotel Data File, public/data/agoda/city/); the
 * rates are asked live for the page shown (30 hotels, one Agoda call). A rate
 * is per night BEFORE taxes and fees — what agoda.com itself shows (checked
 * 28 Nov 2026), and labelled so on the page.
 */
const PAGE = 30;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const city = sp.get("city") || "";
  const checkIn = sp.get("checkIn") || "";
  const checkOut = sp.get("checkOut") || "";
  const adults = Math.min(9, Math.max(1, Number(sp.get("adults")) || 2));
  const childrenAges = parseChildrenAges(sp.get("childrenAges")).slice(0, 6);
  const rooms = Math.min(8, Math.max(1, Number(sp.get("rooms")) || 1));
  const page = Math.min(2000, Math.max(0, Math.floor(Number(sp.get("page")) || 0)));
  const minStars = Math.min(5, Math.max(0, Number(sp.get("minStars")) || 0));
  const sort = sp.get("sort") || "popular";
  const q = normalizeSearch((sp.get("q") || "").slice(0, 80));
  const today = new Date().toISOString().slice(0, 10);
  const yearOut = new Date(Date.now() + 330 * 86_400_000).toISOString().slice(0, 10);
  const okDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today && d <= yearOut;
  const nights = (Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000;
  if (!/^[a-z0-9-]{2,60}$/.test(city) || !okDate(checkIn) || !okDate(checkOut) || !(nights >= 1 && nights <= 30)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const all = await agodaCityList(city);
  if (!all) return NextResponse.json({ result: null }, { headers: { "Cache-Control": "no-store" } });

  let rows: AgodaListRow[] = all;
  if (minStars) rows = rows.filter((r) => r[3] >= minStars);
  if (q) {
    const words = q.split(" ").filter(Boolean);
    rows = rows.filter((r) => {
      const hay = `${normalizeSearch(r[1])} ${normalizeSearch(r[2])}`;
      return words.every((w) => hay.includes(w));
    });
  }
  if (sort === "rating") rows = [...rows].sort((a, b) => b[4] - a[4] || b[5] - a[5]);
  else if (sort === "stars") rows = [...rows].sort((a, b) => b[3] - a[3] || b[5] - a[5]);

  const slice = rows.slice(page * PAGE, page * PAGE + PAGE);
  const rates = agodaConfigured() && slice.length
    ? await agodaHotelRates(slice.map((r) => r[0]), { checkIn, checkOut, adults, childrenAges })
    : null;
  const byId = new Map((rates ?? []).map((r) => [r.hotelId, r]));
  const hotels = slice.map((r) => {
    const rate = byId.get(r[0]);
    const landing = agodaHotelLanding(r[0], { checkIn, checkOut, adults: adults * rooms, childrenAges, rooms });
    return {
      id: r[0],
      name: r[1],
      nameAr: r[2] || null,
      stars: r[3] || null,
      rating: r[4] || null,
      reviews: r[5] || 0,
      lat: r[6],
      lng: r[7],
      photo: agodaPhoto(r[8], "400x300"),
      type: r[9],
      shard: r[10],
      // Per night before taxes and fees, as agoda.com shows it; null = no room
      // for these dates at Agoda (the hotel still opens there).
      perNight: rate ? Math.round(rate.dailyRate * 100) / 100 : null,
      crossedOut: rate?.crossedOutRate && rate.crossedOutRate > rate.dailyRate ? rate.crossedOutRate : null,
      breakfast: rate?.includeBreakfast ?? false,
      room: rate?.roomtypeName || null,
      url: `/api/go/agoda?landing=${encodeURIComponent(landing)}`,
    };
  });
  return NextResponse.json(
    {
      result: {
        total: all.length,
        matching: rows.length,
        page,
        pageSize: PAGE,
        ratesOk: rates !== null,
        currency: "SAR",
        hotels,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
