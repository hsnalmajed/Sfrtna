import { NextRequest, NextResponse } from "next/server";
import { resolveIata } from "@/lib/flights";
import { dayFares } from "@/lib/providers/travelpayouts";
import { cachedJson } from "@/lib/edgeCache";

/**
 * Fares seen for the same trip a few days earlier or later.
 *
 * Each day is priced as it is sold on the partner's side: the cheapest
 * one-way fare seen for that outbound day plus the cheapest seen for the
 * return day, the stay kept the same length. Only exact days are used — a
 * day with no fare seen is left out, never filled from a neighbour. These
 * are observed fares, not live ones, and the page says so.
 *
 * Four calls at most (the outbound and return months either side of a
 * month's end), each cached for three hours.
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
  const outMonths = [...new Set(offsets.map((o) => shift(depart, o).slice(0, 7)))];
  const backMonths = back ? [...new Set(offsets.map((o) => shift(back, o).slice(0, 7)))] : [];
  const [outTables, backTables] = await Promise.all([
    Promise.all(outMonths.map((m) => monthFares(origin, destination, m, currency))),
    Promise.all(backMonths.map((m) => monthFares(destination, origin, m, currency))),
  ]);
  const outFares = Object.assign({}, ...outTables) as Record<string, DayRow>;
  const backFares = Object.assign({}, ...backTables) as Record<string, DayRow>;

  const tomorrow = shift(new Date().toISOString().slice(0, 10), 1);
  const days = offsets
    .map((offset) => {
      const d = shift(depart, offset);
      const r = back ? shift(back, offset) : "";
      if (d < tomorrow) return null;
      const out = outFares[d];
      const ret = r ? backFares[r] : undefined;
      if (!out || (r && !ret)) return null;
      const perSeat = out.price + (ret?.price ?? 0);
      const stops = [out.transfers, ret?.transfers].filter((t) => t !== undefined);
      return {
        offset,
        depart: d,
        return: r,
        perSeat,
        total: perSeat * paying,
        direct: stops.length > 0 && stops.every((t) => t === 0),
      };
    })
    .filter(Boolean);

  return NextResponse.json({ currency, days });
}
