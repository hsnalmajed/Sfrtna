import { NextRequest, NextResponse } from "next/server";
import { hotelPrices } from "@/lib/providers/serpapi";
import { dfsConfigured, dfsHotelPrices, dfsLastError } from "@/lib/providers/dataforseo";
import { parseChildrenAges } from "@/lib/searchParamsUtil";
import { arabicNameFor } from "@/lib/providers/localHotels";
import { agodaConfigured, agodaHotelRates, agodaIdsFor, agodaLastError } from "@/lib/providers/agoda";

export const dynamic = "force-dynamic";

/**
 * Each booking site's price for a hotel (or a city's hotels), from Google
 * Hotels via SerpApi:
 *
 *   /api/hotel-prices?q=Swissotel+Istanbul&checkIn=2026-11-10&checkOut=2026-11-13&adults=2[&childrenAges=7]
 *   [&token=<one hotel from a list>][&minStars=4][&maxPerNight=600][&page=<nextPage of a list>]
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
  const pageRaw = sp.get("page") || "";
  const page = /^[A-Za-z0-9_=+/-]{2,300}$/.test(pageRaw) ? pageRaw : undefined;
  if (pageRaw && !page) return NextResponse.json({ error: "bad request" }, { status: 400 });
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
  const one = sp.get("one") === "1";
  const list = (name: string) =>
    (sp.get(name) || "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0 && n < 100)
      .slice(0, 10);
  const smoke = process.env.SMOKE_TOKEN;
  const probe = Boolean(sp.get("probe") === "1" && smoke && req.headers.get("x-sfrtna-smoke") === smoke);
  const types = list("types");
  const amenities = list("amen");
  const rating = Number(sp.get("rating")) || 0;
  const freeCancel = sp.get("fc") === "1";
  const rentals = sp.get("vr") === "1";
  // DataForSEO first when its account is set (24 Nov 2026): the same Google
  // Hotels data, paid per search, so the list no longer shuts for the month.
  // Its tokens (hotel ids, "more" pages) only work there; SerpApi's only on
  // SerpApi. Filters only Google's own codes can express (property types,
  // amenities) and the site check's probe stay on SerpApi.
  const serpToken = Boolean(token && /^Ch[A-Za-z0-9_-]+$/.test(token) === false) || Boolean(page && !/^d\d{2,3}s\d{1,3}$/.test(page));
  const mktRaw = sp.get("mkt");
  const mkt = smoke && req.headers.get("x-sfrtna-smoke") === smoke && (mktRaw === "kw" || mktRaw === "both") ? mktRaw : undefined;
  const useDfs = dfsConfigured() && !probe && !types.length && !amenities.length && !serpToken;
  const dfs = useDfs
    ? await dfsHotelPrices({ q, checkIn, checkOut, adults, childrenAges, token, minStars, maxPerNight, page, one, rating, freeCancel, rentals, mkt })
    : null;
  const result =
    dfs ??
    (page && /^d\d{2,3}s\d{1,3}$/.test(page)
      ? null
      : await hotelPrices({ q, checkIn, checkOut, adults, childrenAges, token, minStars, maxPerNight, page, one, probe, types, amenities, rating, freeCancel, rentals }));
  // The Arabic page shows Arabic names where every word is known (chains,
  // cities, «فندق»…); the hotel's own name stays for the booking sites.
  if (result && sp.get("lang") === "ar") {
    for (const h of result.hotels) h.nameAr = arabicNameFor(h.name) ?? undefined;
  }
  // Agoda direct: each shown hotel's Agoda id (our index of Agoda's hotel
  // file), so its Agoda button lands on the hotel itself with our cid.
  const smokeOk = Boolean(smoke && req.headers.get("x-sfrtna-smoke") === smoke);
  let agoda: Record<string, unknown> | undefined;
  if (result?.hotels.length) {
    const ids = await agodaIdsFor(result.hotels);
    result.hotels.forEach((h, i) => (h.agodaId = ids[i]?.hotelId ?? null));
    // Site check only, for now: Agoda's live rate beside Google's Agoda price
    // for the same hotels, to learn how they compare (Agoda's dailyRate is
    // before taxes) before any Agoda number is shown to travellers.
    if (smokeOk && sp.get("agoda") === "1") {
      const matched = result.hotels.filter((h) => h.agodaId);
      const rates = agodaConfigured()
        ? await agodaHotelRates(matched.map((h) => h.agodaId as number), { checkIn, checkOut, adults, childrenAges })
        : null;
      agoda = {
        on: agodaConfigured(),
        matched: `${matched.length}/${result.hotels.length}`,
        rates: rates?.length ?? null,
        error: agodaLastError(),
        sample: matched.slice(0, 12).map((h) => {
          const r = rates?.find((x) => x.hotelId === h.agodaId);
          const g = h.offers.find((o) => /^agoda$/i.test(o.source));
          return { name: h.name, id: h.agodaId, agodaName: r?.hotelName, dailyRate: r?.dailyRate, crossed: r?.crossedOutRate, cur: r?.currency, room: r?.roomtypeName, googleAgodaNight: g?.perNight, googleAgodaBeforeTax: g?.perNightBeforeTax };
        }),
      };
    }
  }
  // Site check only: which source answered, and DataForSEO's refusal if any.
  const check = smokeOk ? { via: dfs ? "dfs" : result ? "serp" : "none", dfsOn: dfsConfigured(), dfsError: dfsLastError(), agoda } : undefined;
  return NextResponse.json({ result, ...(check ? { check } : {}) }, { headers: { "Cache-Control": "no-store" } });
}
