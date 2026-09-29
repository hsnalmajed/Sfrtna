import { NextRequest, NextResponse } from "next/server";
import { resolveIata } from "@/lib/flights";
import { dayFares, weekMatrix, type MatrixFare } from "@/lib/providers/travelpayouts";
import { cachedJson } from "@/lib/edgeCache";

/**
 * Fares seen for the same trip a few days earlier or later.
 *
 * A return trip is priced from round-trip fares actually quoted for those
 * exact two days (the partner's week matrix), with when each was seen — not
 * from two one-ways added up, which ran several per cent off the live
 * price. A one-way trip uses the cheapest one-way seen that day. A day with
 * no fare seen is left out, never filled from a neighbour. These are
 * observed fares, not live ones; the page shows the live price for the
 * traveller's own dates beside them and says which is which.
 */

type DayRow = { price: number; transfers: number | null };

async function monthFares(origin: string, destination: string, month: string, currency: string) {
  return (
    (await cachedJson<Record<string, DayRow>>(
      `dayfares:${origin}:${destination}:${month}:${currency}`,
      3 * 3600,
      async () => {
        const map = await dayFares(origin, destination, month, currency);
        if (map.size === 0) return null;
        const out: Record<string, DayRow> = {};
        for (const [day, f] of map) out[day] = { price: f.price, transfers: f.transfers };
        return out;
      }
    )) ?? {}
  );
}

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const RANGE = 3;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const origin = resolveIata(sp.get("origin") || "");
  const destination = resolveIata(sp.get("destination") || "");
  const depart = sp.get("depart") || "";
  const back = sp.get("return") || "";
  const currency = (sp.get("currency") || "SAR").toUpperCase();
  const paying = Math.min(Math.max(1, Number(sp.get("paying") || 1)), 9);
  if (!origin || !destination || !/^\d{4}-\d{2}-\d{2}$/.test(depart) || (back && !/^\d{4}-\d{2}-\d{2}$/.test(back))) {
    return NextResponse.json({ days: [] });
  }

  const offsets = Array.from({ length: RANGE * 2 + 1 }, (_, i) => i - RANGE);
  const tomorrow = shift(new Date().toISOString().slice(0, 10), 1);

  if (back) {
    const rows =
      (await cachedJson<MatrixFare[]>(`weekmatrix:${origin}:${destination}:${depart}:${back}:${currency}`, 3600, async () => {
        const r = await weekMatrix(origin, destination, depart, back, currency);
        return r.length ? r : null;
      })) ?? [];
    const days = offsets
      .map((offset) => {
        const d = shift(depart, offset);
        const r = shift(back, offset);
        if (d < tomorrow) return null;
        // Several quotes can exist for one pair of days; the lowest is the fare.
        const quotes = rows.filter((x) => x.depart === d && x.return === r);
        if (!quotes.length) return null;
        const best = quotes.reduce((a, b) => (b.price < a.price ? b : a));
        return {
          offset,
          depart: d,
          return: r,
          perSeat: best.price,
          total: best.price * paying,
          direct: best.changes === 0,
          foundAt: best.foundAt,
        };
      })
      .filter(Boolean);
    return NextResponse.json({ currency, days, ...(sp.get("debug") ? { rows } : {}) });
  }

  const outMonths = [...new Set(offsets.map((o) => shift(depart, o).slice(0, 7)))];
  const outFares = Object.assign(
    {},
    ...(await Promise.all(outMonths.map((m) => monthFares(origin, destination, m, currency))))
  ) as Record<string, DayRow>;
  const days = offsets
    .map((offset) => {
      const d = shift(depart, offset);
      if (d < tomorrow) return null;
      const out = outFares[d];
      if (!out) return null;
      return {
        offset,
        depart: d,
        return: "",
        perSeat: out.price,
        total: out.price * paying,
        direct: out.transfers === 0,
        foundAt: null,
      };
    })
    .filter(Boolean);
  return NextResponse.json({ currency, days });
}
