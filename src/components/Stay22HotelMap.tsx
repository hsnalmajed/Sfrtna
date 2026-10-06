"use client";

import { useEffect, useState } from "react";
import { convert, fetchRates } from "@/lib/rates";

/**
 * A city's hotels, from Stay22's map widget: up to 99 hotels and rentals
 * with photos, a map and a list, and each one's price for the whole stay
 * from Booking.com, Expedia, Hotels.com, Vrbo and the others Stay22 reads.
 * A booking through it pays us through our Stay22 account (`aid`).
 *
 * Chosen over building the list ourselves (6 Oct 2026): the hotel search we
 * have (Google Hotels through SerpApi) gives a city's hotels without any
 * one site's price, so every card would cost a further search — about
 * twenty per city — against a monthly allowance of 250. Stay22 prices the
 * whole list at once, filters it by the traveller's budget and stars, and
 * costs nothing.
 *
 * The budget filter: `max` is a price a NIGHT in US DOLLARS, whatever
 * `currency` and `priceper` say (measured 6 Oct 2026 — max=100 left stays
 * of at most 2,233 SAR for six nights, $99 a night). So the traveller's
 * budget for the whole stay is divided by the nights and turned into
 * dollars, and the list still shows each stay's total in their currency.
 *
 * Its labels are English: the widget has no Arabic (`ljs` lists the
 * languages it has). The page around it says what it shows, in Arabic.
 */
const AID = "sfrtna";

export function stay22MapUrl(q: {
  /** "Istanbul, Turkey" — the widget centres on it. */
  address: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  /** Children travelling (named `kids`: `children` is React's own prop). */
  kids: number;
  /** A grid of cards (photo, price, rating) or the map with prices on it. */
  view: "list" | "map";
  /** Nightly cap in US dollars, from the budget for the stay; 0 for none. */
  maxNightlyUsd: number;
  currency: string;
  minStars: number;
}): string {
  const u = new URL("https://www.stay22.com/embed/gm");
  const p = u.searchParams;
  p.set("aid", AID);
  p.set("address", q.address);
  p.set("checkin", q.checkIn);
  p.set("checkout", q.checkOut);
  p.set("adults", String(Math.max(1, q.adults)));
  if (q.kids) p.set("children", String(q.kids));
  p.set("rooms", "1");
  p.set("currency", q.currency);
  p.set("priceper", "total");
  if (q.maxNightlyUsd > 0) {
    p.set("min", "0");
    p.set("max", String(Math.max(1, Math.floor(q.maxNightlyUsd))));
  }
  if (q.minStars > 0) p.set("minstarrating", String(q.minStars));
  p.set("limit", "99");
  p.set("viewmode", q.view === "list" ? "listview" : "map");
  p.set("zoom", "12");
  p.set("ljs", "en");
  p.set("maincolor", "ffa630");
  p.set("hotelscolor", "0b2d5b");
  p.set("hotelsfontcolor", "ffffff");
  p.set("loadingbarcolor", "ffa630");
  p.set("campaign", "hotel-discover");
  return u.toString();
}

/** The riyal is pegged at 3.75 to the dollar; other currencies use today's rate. */
const USD_PER: Record<string, number> = { USD: 1, SAR: 1 / 3.75 };

export default function Stay22HotelMap({
  title,
  budget,
  currency,
  nights,
  labels,
  ...q
}: Omit<Parameters<typeof stay22MapUrl>[0], "maxNightlyUsd" | "currency" | "view"> & {
  title: string;
  labels: { list: string; map: string; choose: string };
  /** The traveller's budget for the whole stay, in `currency`; 0 for none. */
  budget: number;
  currency: string;
  nights: number;
}) {
  const cur = currency.toUpperCase();
  const known = USD_PER[cur];
  const [usdRate, setUsdRate] = useState<number | null | undefined>(known);
  // The list first: it is how most people compare hotels; the map is one
  // tap away for those who choose by where.
  const [view, setView] = useState<"list" | "map">("list");
  useEffect(() => {
    if (known !== undefined || !(budget > 0)) return;
    let live = true;
    fetchRates().then((rates) => {
      if (live) setUsdRate(rates ? convert(1, cur, "USD", rates) : null);
    });
    return () => {
      live = false;
    };
  }, [known, budget, cur]);

  const needsRate = budget > 0 && usdRate === undefined;
  if (needsRate) return <div className="h-[640px] animate-pulse rounded-2xl bg-mist-200/70 sm:h-[720px]" />;
  // No rate for an unusual currency: show the list without the cap rather
  // than with a wrong one.
  const maxNightlyUsd = budget > 0 && nights > 0 && usdRate ? (budget / nights) * usdRate : 0;
  const src = stay22MapUrl({ ...q, view, currency: usdRate === null ? "USD" : cur, maxNightlyUsd });
  const tabs: { v: "list" | "map"; label: string; icon: string }[] = [
    { v: "list", label: labels.list, icon: "☰" },
    { v: "map", label: labels.map, icon: "⌖" },
  ];

  return (
    <div>
      <div className="mb-3 inline-flex rounded-full bg-white p-1 shadow-sm ring-1 ring-black/5" role="tablist" aria-label={labels.choose}>
        {tabs.map((t) => (
          <button
            key={t.v}
            type="button"
            role="tab"
            aria-selected={view === t.v}
            onClick={() => setView(t.v)}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-extrabold transition ${
              view === t.v ? "bg-navy-900 text-white shadow-sm" : "text-navy-700 hover:bg-mist-100"
            }`}
          >
            <span aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <iframe
          key={view}
          src={src}
          title={title}
          loading="lazy"
          className="block h-[680px] w-full border-0 sm:h-[760px]"
          allow="geolocation"
        />
      </div>
    </div>
  );
}
