import { strictIata } from "@/lib/flights";
import type { SearchParams } from "@/lib/types";

/**
 * The trip, written the way the flight widget reads it.
 *
 * The White Label search box takes its starting values from one query
 * parameter on the page it loads in — `?flightSearch=RUH1611IST23112` — and,
 * when that parameter is there, runs the search itself. That string is the
 * whole reason the traveller does not have to type their trip a second time:
 * they tell us where and when once, on our own form, and the live results for
 * exactly those dates are already on screen when the page opens.
 *
 * The shape is positional, with no separators:
 *
 *     RUH 16 11 IST 23 11 2
 *     │   │  │  │   │  │  └── seats
 *     │   │  │  │   └──┴───── date home, day then month
 *     │   │  │  └───────────── where to
 *     │   └──┴──────────────── date out, day then month
 *     └──────────────────────── where from
 *
 * A one-way trip simply leaves the second date out. The year is not in it at
 * all: the widget reads a day-and-month as the next time that date comes
 * round, which is what a traveller means by "16 November" anyway.
 */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "2026-11-16" → "1611", or null if the date is missing or unparseable. */
function dayMonth(iso: string | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${pad(day)}${pad(month)}`;
}

function iata(place: string | undefined): string | null {
  return strictIata(place || "");
}

/**
 * The code for this search, or null when the trip is not specific enough to
 * ask a real airline about — no destination, no date, nowhere to fly from.
 *
 * Seats are everyone who occupies one: adults and children. Infants travel on
 * a lap and are not part of this count, and the widget takes a single digit,
 * so nine is the ceiling.
 */
export function flightSearchCode(search: SearchParams): string | null {
  if (search.tripType === "hotel") return null;

  const from = iata(search.origin);
  const to = iata(search.destination);
  const out = dayMonth(search.departDate);
  if (!from || !to || !out || from === to) return null;

  const back = dayMonth(search.returnDate);
  // Who flies, as the widget reads it: adults, then children (2–11), then
  // infants on a lap — one digit each, "211" for two adults, a child and an
  // infant (checked on aviasales.com, 6 Oct 2026). Sending children as adults
  // priced a family as three grown-ups and left the baby out. The partner
  // allows nine travellers in all and no more infants than adults.
  const adults = Math.min(9, Math.max(1, search.adults || 1));
  const children = Math.min(9 - adults, search.childrenAges?.length ?? 0);
  const infants = Math.min(adults, 9 - adults - children, Math.max(0, search.infants ?? 0));
  const people = children || infants ? `${adults}${children}${infants}` : `${adults}`;

  return `${from}${out}${to}${back ?? ""}${people}`;
}

/**
 * The trip back out of a widget code — "RUH1110IST18102" → origin RUH,
 * destination IST, 11 Oct out, 18 Oct back, two seats.
 *
 * The fallback for when the results page has nothing else to go on: the
 * widget runs a new search from its own form and reloads the page with only
 * its code in the address. The code still names the route, which is all the
 * visa and currency panels need. The year is the next time that day comes
 * round, which is how the widget reads it too.
 */
export function parseFlightSearchCode(code: string | null | undefined): URLSearchParams | null {
  const m = /^([A-Z]{3})(\d{2})(\d{2})([A-Z]{3})(?:(\d{2})(\d{2}))?(\d)(\d)?(\d)?$/.exec((code || "").trim());
  if (!m) return null;
  const [, from, d1, m1, to, d2, m2, seats, kids, babies] = m;

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const nextIso = (day: string, month: string, notBefore: string) => {
    const y = today.getFullYear();
    const thisYear = `${y}-${month}-${day}`;
    return thisYear >= notBefore ? thisYear : `${y + 1}-${month}-${day}`;
  };

  const departDate = nextIso(d1, m1, todayIso);
  const returnDate = d2 && m2 ? nextIso(d2, m2, departDate) : "";
  return new URLSearchParams({
    tripType: "flight",
    origin: from,
    destination: to,
    departDate,
    returnDate,
    adults: seats,
    ...(kids && kids !== "0" ? { childrenAges: Array(Number(kids)).fill("8").join(",") } : {}),
    ...(babies && babies !== "0" ? { infants: babies } : {}),
  });
}
