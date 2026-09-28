import { NextResponse } from "next/server";
import { configuredProviders } from "@/lib/providers";
import { travelpayouts } from "@/lib/providers/travelpayouts";

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

export async function GET(req: Request) {
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

  return NextResponse.json(
    {
      edgeCache,
      pexels,
      configuredProviders: configured,
      hotelProbe: hotels,
      keys: {
        travelpayoutsToken: Boolean(process.env.TRAVELPAYOUTS_TOKEN),
        pexels: Boolean(process.env.PEXELS_API_KEY),
      },
      flightProbe: probe,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
