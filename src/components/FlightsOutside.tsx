"use client";

import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { airlineLinks, flightSites } from "@/lib/suppliers";
import type { FallbackRoute } from "@/components/FallbackFlights";

/**
 * Flights in the iPhone app (owner's decision, 18 Nov 2026): the search
 * form stays in the app, the live results and the booking open OUTSIDE it,
 * on the partner's own site, in the Safari sheet (AppDelegate.swift opens
 * every link to another site, and our /api/go/ redirects, there).
 *
 * Why: the partner's widget is a third-party script inside our page, and
 * Apple counts that as tracking without App Tracking Transparency
 * (5.1.2(i), rejection of 18 Nov — see lib/iosClean.ts).
 *
 * No prices here: the site opened sets the price; we show none of ours.
 */
export default function FlightsOutside({
  locale,
  route,
  code,
  currency,
}: {
  locale: Locale;
  route: FallbackRoute;
  /** The trip as flightSearchCode writes it, for the partner's search. */
  code: string | null;
  currency: string;
}) {
  const t = useDictionary().results;
  const trip = {
    origin: route.origin,
    destination: route.destination,
    departDate: route.departDate,
    returnDate: route.returnDate,
    adults: route.adults,
    childrenAges: route.childrenAges ?? [],
    children: route.children,
    infants: route.infants,
    currency,
    locale,
  };
  // Aviasales has shown no flights from or to Riyadh since 30 Oct 2026
  // (INBOX row 10): no button that would open an empty search.
  const riyadh = route.origin === "RUH" || route.destination === "RUH";
  const main = code && !riyadh ? `/api/go/tp?b=aviasales&s=${encodeURIComponent(code)}` : null;
  const sites = flightSites(trip);
  const airlines = airlineLinks(trip);
  const pill =
    "rounded-full bg-mist-50 px-4 py-2 text-sm font-bold text-navy-900 ring-1 ring-mist-200 hover:ring-navy-300";

  return (
    <section data-flights-outside="" className="rounded-2xl bg-white p-4 ring-1 ring-mist-200 sm:p-5">
      <h2 className="font-display text-lg font-extrabold text-navy-900">{t.outTitle}</h2>
      <p className="mt-1 text-sm leading-relaxed text-navy-500">{t.outSub}</p>
      {main && (
        <a
          href={main}
          target="_blank"
          rel="noopener noreferrer"
          data-partner="aviasales"
          data-placement="ios_flights_outside"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sun-400 px-4 py-3 text-base font-extrabold text-navy-990 transition hover:bg-sun-300"
        >
          {t.outMain} <span aria-hidden="true">↗</span>
        </a>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {sites.map((o) => (
          <a
            key={o.id}
            href={o.href}
            target="_blank"
            rel="noopener noreferrer"
            data-partner={o.id}
            data-placement="ios_flights_outside"
            className={pill}
          >
            <bdi>{o.name}</bdi> ↗
          </a>
        ))}
      </div>
      {airlines.length > 0 && (
        <>
          <p className="mt-4 text-sm font-bold text-navy-800">{t.fallbackAirlines}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-navy-500">{t.fallbackAirlinesSub}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {airlines.map((o) => (
              <a
                key={o.id}
                href={o.href}
                target="_blank"
                rel="noopener noreferrer"
                data-partner={o.id}
                data-placement="ios_flights_outside"
                className={pill}
              >
                <bdi>{o.name}</bdi> ↗
              </a>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
