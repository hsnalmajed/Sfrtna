// "My budget, two or three countries": whole routes that start and end at
// home, priced flight by flight.
//
// A route is home → A → B (→ C) → home. The trip's days are split evenly
// between the stops, which fixes the day of every flight, and every flight is
// priced as the cheapest one-way fare seen that month (labelled as such when
// it was seen for a different day). Only routes whose flights the budget
// covers are offered first; if none fit, the cheapest few are shown as over.
//
// Pricing all orderings of all candidate cities pair by pair would cost
// hundreds of requests. Instead one request per city answers "cheapest from
// here to everywhere" (see oneWayFaresFrom), so a whole search costs one call
// per candidate city and month — comfortably inside a Worker's budget.

import { DESTINATIONS, type Destination } from "@/lib/destinations";
import { placeForDestination } from "@/lib/destinationPlace";
import { oneWayFaresFrom, type OneWayFare } from "@/lib/providers/travelpayouts";
import type { DestinationCategory, RouteLeg, RouteStop, RouteSuggestion } from "@/lib/types";

export interface RouteQuery {
  origin: string; // IATA
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  stops: 2 | 3;
  budgetTotal: number;
  currency: string;
  /** Adults and children: the seats that are paid for. */
  paying: number;
  directOnly: boolean;
  category?: DestinationCategory;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** Split `total` nights over `n` stops, the extra nights going to the first. */
function splitNights(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => base + (i < total % n ? 1 : 0));
}

function permutations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  items.forEach((item, i) => {
    const rest = items.slice(0, i).concat(items.slice(i + 1));
    for (const tail of permutations(rest, k - 1)) out.push([item, ...tail]);
  });
  return out;
}

/** Sample fares for local development only, where there is no API token. */
function devFares(origin: string, month: string): Map<string, OneWayFare> {
  const out = new Map<string, OneWayFare>();
  for (const code of [...DESTINATIONS.map((d) => d.code), "RUH", "JED", "DMM"]) {
    let h = 0;
    for (const ch of origin + code + month) h = (h * 31 + ch.charCodeAt(0)) % 997;
    out.set(code, {
      destination: code,
      price: 250 + (h % 900),
      airline: "Sample Air",
      airlineCode: "XX",
      departureAt: `${month}-10T08:00:00Z`,
      transfers: h % 3 === 0 ? 0 : 1,
    });
  }
  return out;
}

export async function suggestRoutes(q: RouteQuery): Promise<RouteSuggestion[]> {
  const totalNights = Math.max(q.stops, daysBetween(q.startDate, q.endDate));
  const nights = splitNights(totalNights, q.stops);
  // The day of each flight: out, between each stop, home.
  const legDates = [q.startDate];
  for (const n of nights) legDates.push(addDays(legDates[legDates.length - 1], n));

  const candidates = DESTINATIONS.filter(
    (d) => d.code !== q.origin && (!q.category || d.categories.includes(q.category))
  );
  if (candidates.length < q.stops) return [];

  // Fares needed: from home in the first flight's month, and from every
  // candidate in the months of the later flights.
  const month = (iso: string) => iso.slice(0, 7);
  const laterMonths = [...new Set(legDates.slice(1).map(month))];
  const useDev = process.env.NODE_ENV === "development";
  const load = async (from: string, m: string) => {
    const fares = await oneWayFaresFrom(from, m, q.currency);
    return fares.size === 0 && useDev ? devFares(from, m) : fares;
  };
  const requests: { key: string; from: string; m: string }[] = [
    { key: `${q.origin}|${month(legDates[0])}`, from: q.origin, m: month(legDates[0]) },
  ];
  for (const c of candidates) for (const m of laterMonths) requests.push({ key: `${c.code}|${m}`, from: c.code, m });
  const table = new Map<string, Map<string, OneWayFare>>();
  const loaded = await Promise.all(requests.map((r) => load(r.from, r.m)));
  requests.forEach((r, i) => table.set(r.key, loaded[i]));

  const fare = (from: string, to: string, date: string): OneWayFare | undefined =>
    table.get(`${from}|${month(date)}`)?.get(to);

  const routes: RouteSuggestion[] = [];
  for (const perm of permutations<Destination>(candidates, q.stops)) {
    const path = [q.origin, ...perm.map((d) => d.code), q.origin];
    const legs: RouteLeg[] = [];
    let ok = true;
    for (let i = 0; i < path.length - 1; i++) {
      const f = fare(path[i], path[i + 1], legDates[i]);
      if (!f || (q.directOnly && f.transfers !== 0)) {
        ok = false;
        break;
      }
      legs.push({
        from: path[i],
        to: path[i + 1],
        date: legDates[i],
        price: f.price * q.paying,
        pricePerSeat: f.price,
        airline: f.airline,
        transfers: f.transfers,
        approximate: f.departureAt.slice(0, 10) !== legDates[i],
      });
    }
    if (!ok) continue;
    const totalPrice = legs.reduce((s, l) => s + l.price, 0);
    const stops: RouteStop[] = perm.map((d, i) => ({
      code: d.code,
      nameAr: d.nameAr,
      nameEn: d.nameEn,
      emoji: d.emoji,
      nights: nights[i],
      arrive: legDates[i],
      place: placeForDestination(d.code, d.nameEn, Number(legDates[i].slice(5, 7))),
    }));
    routes.push({
      stops,
      legs,
      totalPrice,
      currency: q.currency.toUpperCase(),
      withinBudget: totalPrice <= q.budgetTotal,
      remainingBudget: q.budgetTotal - totalPrice,
    });
  }

  // One ordering per set of countries — the cheapest — so the list is
  // different trips, not the same trip backwards.
  const bestPerSet = new Map<string, RouteSuggestion>();
  for (const r of routes) {
    const key = r.stops.map((s) => s.code).sort().join("-");
    const prev = bestPerSet.get(key);
    if (!prev || r.totalPrice < prev.totalPrice) bestPerSet.set(key, r);
  }
  const unique = [...bestPerSet.values()];
  const inSeason = (r: RouteSuggestion) => r.stops.filter((s) => s.place?.inSeason).length;
  const within = unique
    .filter((r) => r.withinBudget)
    .sort((a, b) => inSeason(b) - inSeason(a) || a.totalPrice - b.totalPrice);
  // The page filters by season and visa and keeps what is over budget behind
  // a button, so it gets enough of both to do that with.
  const over = unique.filter((r) => !r.withinBudget).sort((a, b) => a.totalPrice - b.totalPrice);
  return [...within.slice(0, 24), ...over.slice(0, 8)];
}
