import { NextResponse } from "next/server";
import { configuredProviders } from "@/lib/providers";
import { travelpayouts } from "@/lib/providers/travelpayouts";
import { hereUsage, takeHere } from "@/lib/providers/hereQuota";
import { localHotels } from "@/lib/providers/localHotels";

/**
 * Is the site actually wired up?
 *
 * Says which price sources hold credentials and whether a real search comes
 * back with anything — and never prints a credential, only whether one is
 * present. Without this, a page showing sample prices gives no way to tell a
 * missing key from a source that answered with nothing.
 */
/**
 * `?fares=YYYY-MM`: how many destinations each fare endpoint answers for from
 * Riyadh that month, and whether a few popular ones are there — to tell a
 * route the source has no data for from one our query misses. Counts and
 * cities only; no credential is ever printed.
 */
async function fareCoverage(month: string) {
  const token = process.env.TRAVELPAYOUTS_TOKEN || "";
  const get = async (url: string) => {
    try {
      const r = await fetch(url, { headers: { "X-Access-Token": token }, cache: "no-store" });
      return r.ok ? await r.json() : { status: r.status };
    } catch (e) {
      return { error: String(e).slice(0, 80) };
    }
  };
  const base = "https://api.travelpayouts.com";
  const v3 = (unique: boolean, oneWay: boolean) =>
    `${base}/aviasales/v3/prices_for_dates?origin=RUH&departure_at=${month}&one_way=${oneWay}&unique=${unique}&sorting=price&limit=1000&currency=sar`;
  const dests = (j: { data?: { destination?: string }[] }) => new Set((j.data ?? []).map((r) => r.destination));
  const [a, b, c] = await Promise.all([get(v3(true, false)), get(v3(false, false)), get(v3(true, true))]);
  const probe = ["ATH", "BEY", "LIS", "OPO", "SFO", "TNG", "SLL"];
  const cheap = await Promise.all(
    probe.map((d) => get(`${base}/v1/prices/cheap?origin=RUH&destination=${d}&depart_date=${month}&currency=sar`))
  );
  const da = dests(a), db = dests(b), dc = dests(c);
  return {
    v3UniqueRound: da.size,
    v3AllRound: db.size,
    v3UniqueOneWay: dc.size,
    probe: probe.map((d, i) => ({
      d,
      inUnique: da.has(d),
      inAll: db.has(d),
      inOneWay: dc.has(d),
      v1cheap: Object.keys((cheap[i] as { data?: Record<string, unknown> }).data ?? {}).length > 0,
    })),
  };
}

/**
 * `?seasoncov=1`: for every city in season this month, whether each fare
 * source has a price from Riyadh — to choose the source that covers them all.
 */
async function seasonCoverage(offset: number) {
  const { bestForMonth } = await import("@/lib/travelSeason/site");
  const { CITY_AIRPORTS } = await import("@/data/cityAirports");
  const token = process.env.TRAVELPAYOUTS_TOKEN || "";
  const now = new Date();
  const m = now.getMonth() + 1;
  const months = [0, 1, 2].map((k) => {
    const d = new Date(Date.UTC(now.getFullYear(), m - 1 + k, 1));
    return d.toISOString().slice(0, 7);
  });
  const get = async (url: string) => {
    try {
      const r = await fetch(url, { headers: { "X-Access-Token": token }, cache: "no-store" });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };
  const base = "https://api.travelpayouts.com";
  const codes = bestForMonth(m)
    .map((c) => CITY_AIRPORTS[c.slug]?.iata)
    .filter((x): x is string => Boolean(x));
  const seen = (rows: { destination?: string; destination_airport?: string }[] | undefined) =>
    new Set((rows ?? []).flatMap((r) => [r.destination, r.destination_airport]));
  const ow = await Promise.all(
    months.map((mm) => get(`${base}/aviasales/v3/prices_for_dates?origin=RUH&departure_at=${mm}&one_way=true&unique=true&sorting=price&limit=1000&currency=sar`))
  );
  const owSets = ow.map((j) => seen(j?.data));
  const missing = codes.filter((c) => !owSets.some((s) => s.has(c)));
  // Per-destination endpoints for a slice of the missing ones.
  const slice = missing.slice(offset, offset + 12);
  const grouped = await Promise.all(
    slice.map((d) =>
      get(`${base}/aviasales/v3/grouped_prices?origin=RUH&destination=${d}&group_by=departure_at&currency=sar`)
    )
  );
  const latest = await Promise.all(
    slice.map((d) => get(`${base}/v2/prices/latest?origin=RUH&destination=${d}&period_type=year&one_way=true&limit=5&currency=sar`))
  );
  return {
    months,
    total: codes.length,
    oneWayByMonth: owSets.map((s) => codes.filter((c) => s.has(c)).length),
    oneWayAnyMonth: codes.length - missing.length,
    missing,
    perDestination: slice.map((d, i) => ({
      d,
      grouped: Object.keys(grouped[i]?.data ?? {}).length,
      latest: (latest[i]?.data ?? []).length,
    })),
  };
}

/** `?exact=YYYY-MM-DD,YYYY-MM-DD`: exact-date fare coverage for the suggest list. */
async function exactCoverage(dep: string, ret: string) {
  const { DESTINATIONS } = await import("@/lib/destinations");
  const token = process.env.TRAVELPAYOUTS_TOKEN || "";
  const base = "https://api.travelpayouts.com";
  const get = async (url: string) => {
    try {
      const r = await fetch(url, { headers: { "X-Access-Token": token }, cache: "no-store" });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };
  return Promise.all(
    DESTINATIONS.map(async (d) => {
      const [v3, v1] = await Promise.all([
        get(`${base}/aviasales/v3/prices_for_dates?origin=RUH&destination=${d.code}&departure_at=${dep}&return_at=${ret}&sorting=price&limit=5&currency=sar`),
        get(`${base}/v1/prices/cheap?origin=RUH&destination=${d.code}&depart_date=${dep}&return_date=${ret}&currency=sar`),
      ]);
      const v1rows = Object.values((v1?.data ?? {}) as Record<string, Record<string, { price?: number }>>).flatMap((b) => Object.values(b));
      return {
        d: d.code,
        v3: (v3?.data ?? []).map((r: { price: number }) => r.price).slice(0, 3),
        v1: v1rows.map((r) => r.price).slice(0, 3),
      };
    })
  );
}

/** `?days=DEST`: per-day fares for October from Riyadh, three ways of asking. */
async function dayFares(dest: string) {
  const token = process.env.TRAVELPAYOUTS_TOKEN || "";
  const base = "https://api.travelpayouts.com/aviasales/v3/grouped_prices";
  const get = async (q: string) => {
    try {
      const r = await fetch(`${base}?origin=RUH&destination=${dest}&group_by=departure_at&currency=sar&${q}`, {
        headers: { "X-Access-Token": token },
        cache: "no-store",
      });
      const j = r.ok ? await r.json() : null;
      const data = (j?.data ?? {}) as Record<string, { price: number; return_at?: string }>;
      return Object.entries(data).map(([day, v]) => `${day}:${v.price}${v.return_at ? "→" + v.return_at.slice(5, 10) : ""}`);
    } catch {
      return ["error"];
    }
  };
  const [rt, rt7, ow] = await Promise.all([
    get("departure_at=2026-10"),
    get("departure_at=2026-10&trip_duration=7"),
    get("departure_at=2026-10&one_way=true"),
  ]);
  return { dest, rt, rt7, ow };
}

export async function GET(req: Request) {
  const days = new URL(req.url).searchParams.get("days");
  if (days && /^[A-Z]{3}$/.test(days)) return NextResponse.json(await dayFares(days));
  const ex = new URL(req.url).searchParams.get("exact");
  if (ex && /^\d{4}-\d{2}-\d{2},\d{4}-\d{2}-\d{2}$/.test(ex)) {
    const [dep, ret] = ex.split(",");
    return NextResponse.json(await exactCoverage(dep, ret));
  }
  const sc = new URL(req.url).searchParams.get("seasoncov");
  if (sc !== null) return NextResponse.json(await seasonCoverage(Number(sc) || 0));
  const faresMonth = new URL(req.url).searchParams.get("fares");
  if (faresMonth && /^\d{4}-\d{2}$/.test(faresMonth)) {
    return NextResponse.json(await fareCoverage(faresMonth));
  }
  const configured = configuredProviders().map((p) => p.name);

  let probe: { ok: boolean; offers: number; error?: string } = { ok: false, offers: 0 };
  try {
    const offers = await travelpayouts.searchFlights!({
      tripType: "flight",
      origin: "RUH",
      destination: "IST",
      departDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      adults: 1,
      budgetTotal: 0,
      currency: "SAR",
      directFlightsOnly: false,
      minHotelStars: 0,
      baggageIncluded: false,
      childrenAges: [],
      infants: 0,
    });
    probe = { ok: true, offers: offers.length };
  } catch (err) {
    probe = { ok: false, offers: 0, error: String(err).slice(0, 200) };
  }

  // The hotel side, asked the same way the provider asks it, so a blank
  // hotel list can be told apart from a refused request.
  let hotels: { status: number | string; sample: string } = { status: "skipped", sample: "" };
  try {
    const u = new URL("https://engine.hotellook.com/api/v2/cache.json");
    u.searchParams.set("location", "Istanbul");
    u.searchParams.set("checkIn", new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
    u.searchParams.set("checkOut", new Date(Date.now() + 35 * 86_400_000).toISOString().slice(0, 10));
    u.searchParams.set("currency", "sar");
    u.searchParams.set("limit", "3");
    u.searchParams.set("token", process.env.TRAVELPAYOUTS_TOKEN || "");
    const res = await fetch(u.toString(), { cache: "no-store" });
    hotels = { status: res.status, sample: (await res.text()).slice(0, 160) };
  } catch (err) {
    hotels = { status: "error", sample: String(err).slice(0, 160) };
  }

  // The edge cache the photos depend on (edgeCache.ts): is it there, and
  // does a write come back on the next read?
  const edgeCache: { present: boolean; roundTrip: string } = { present: false, roundTrip: "skipped" };
  try {
    const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
    edgeCache.present = Boolean(cache);
    if (cache) {
      const req = new Request("https://sfrtna.com/__edge-cache/health-probe");
      const stamp = String(Date.now());
      await cache.put(req, new Response(stamp, { headers: { "Cache-Control": "public, max-age=300" } }));
      const back = await cache.match(req);
      edgeCache.roundTrip = back ? ((await back.text()) === stamp ? "ok" : "stale") : "miss";
    }
  } catch (err) {
    edgeCache.roundTrip = `error: ${String(err).slice(0, 120)}`;
  }

  // Pexels' own answer to one search, and how much of the hourly allowance
  // is left — never the key.
  let pexels: { status: number | string; remaining: string | null; reset: string | null } = {
    status: "skipped",
    remaining: null,
    reset: null,
  };
  if (process.env.PEXELS_API_KEY) {
    try {
      const res = await fetch("https://api.pexels.com/v1/search?query=Istanbul&per_page=1", {
        headers: { Authorization: process.env.PEXELS_API_KEY },
        cache: "no-store",
      });
      pexels = {
        status: res.status,
        remaining: res.headers.get("x-ratelimit-remaining"),
        reset: res.headers.get("x-ratelimit-reset"),
      };
    } catch (err) {
      pexels = { status: `error: ${String(err).slice(0, 120)}`, remaining: null, reset: null };
    }
  }

  // Google Places (hotel names): one autocomplete call, and Google's own
  // reason when it refuses — billing off, API not enabled, key restricted.
  // Never the key.
  let googlePlaces: { status: number | string; reason: string | null } = { status: "no key", reason: null };
  if (process.env.GOOGLE_PLACES_KEY) {
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GOOGLE_PLACES_KEY,
          "X-Goog-FieldMask": "suggestions.placePrediction.text",
        },
        body: JSON.stringify({ input: "Hilton Istanbul", includedPrimaryTypes: ["lodging"] }),
        cache: "no-store",
      });
      let reason: string | null = null;
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { status?: string; message?: string } } | null;
        reason = `${body?.error?.status ?? ""} ${body?.error?.message ?? ""}`.trim().slice(0, 220) || null;
      }
      googlePlaces = { status: res.status, reason };
    } catch (err) {
      googlePlaces = { status: `error: ${String(err).slice(0, 120)}`, reason: null };
    }
  }

  // HERE (hotel names while Google is unavailable in KSA): one search, taken
  // from the same daily cap as the visitors' searches.
  let here: {
    status: number | string;
    lodging: number | null;
    usage?: Awaited<ReturnType<typeof hereUsage>>;
  } = { status: "no key", lodging: null };
  if (process.env.HERE_API_KEY && !(await takeHere())) {
    here = { status: "daily cap reached — OpenStreetMap answers until tomorrow (UTC)", lodging: null };
  } else if (process.env.HERE_API_KEY) {
    try {
      const u = new URL("https://discover.search.hereapi.com/v1/discover");
      u.searchParams.set("q", "Hilton Istanbul");
      u.searchParams.set("at", "41,29");
      u.searchParams.set("limit", "10");
      u.searchParams.set("apiKey", process.env.HERE_API_KEY);
      const res = await fetch(u.toString(), { cache: "no-store" });
      const body = res.ok
        ? ((await res.json()) as { items?: { categories?: { id?: string }[] }[] })
        : null;
      here = {
        status: res.status,
        lodging: body ? (body.items ?? []).filter((i) => (i.categories ?? []).some((c) => (c.id ?? "").startsWith("500-"))).length : null,
      };
    } catch (err) {
      here = { status: `error: ${String(err).slice(0, 120)}`, lodging: null };
    }
  }
  here.usage = await hereUsage();

  // Our own stored hotel names (no outside call): hits for two test searches.
  const storedHotels = {
    hiltonIstanbul: (await localHotels("هيلتون إسطنبول")).items.length,
    jeddah: (await localHotels("فندق جدة")).items.length,
  };

  return NextResponse.json(
    {
      edgeCache,
      pexels,
      googlePlaces,
      here,
      storedHotels,
      configuredProviders: configured,
      hotelProbe: hotels,
      keys: {
        travelpayoutsToken: Boolean(process.env.TRAVELPAYOUTS_TOKEN),
        pexels: Boolean(process.env.PEXELS_API_KEY),
        googlePlaces: Boolean(process.env.GOOGLE_PLACES_KEY),
        here: Boolean(process.env.HERE_API_KEY),
        serpapi: Boolean(process.env.SERPAPI_KEY),
      },
      flightProbe: probe,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
