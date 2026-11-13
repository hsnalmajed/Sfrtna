"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { airlineLinks, flightSites } from "@/lib/suppliers";

export interface FallbackRoute {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  adults: number;
  children: number;
  /** The children's ages, for sites that ask for them (KAYAK, Expedia). */
  childrenAges?: number[];
  infants: number;
}

export interface FallbackLeg {
  depDate: string;
  arrDate: string;
  depTime: string;
  depCode: string;
  arrTime: string;
  arrCode: string;
  minutes: number;
  airline: string;
  logo: string;
  flightNumber: string;
}
export interface FallbackFlight {
  price: number;
  minutes: number;
  stops: number;
  layovers: { code: string; minutes: number }[];
  legs: FallbackLeg[];
  best: boolean;
}
export interface FallbackAnswer {
  flights: FallbackFlight[];
  url: string;
  roundTrip: boolean;
  currency: string;
}

/**
 * The second source of flights (owner, 13 Oct 2026): when the flight
 * partner's search cannot be reached, or has nothing for the route (Riyadh
 * since 30 Oct), live fares from Google Flights. `null` while asking,
 * "none" when there is nothing live to show. The results page draws these
 * fares with the same cards, tabs and filters as the partner's (owner,
 * 13 Nov: the plain list on the phone was not acceptable).
 */
export function useFallbackFares(
  route: FallbackRoute | undefined,
  enabled: boolean,
  currency: string,
  locale: Locale,
  directOnly: boolean
): FallbackAnswer | null | "none" {
  const [answer, setAnswer] = useState<FallbackAnswer | null | "none">(null);
  const key = route
    ? [route.origin, route.destination, route.departDate, route.returnDate, route.adults, route.children, route.infants].join("|")
    : "";
  useEffect(() => {
    if (!enabled || !route) return;
    let live = true;
    const qs = new URLSearchParams({
      origin: route.origin,
      destination: route.destination,
      departDate: route.departDate,
      returnDate: route.returnDate,
      adults: String(route.adults),
      children: String(route.children),
      infants: String(route.infants),
      currency,
      locale,
      directOnly: String(directOnly),
    });
    fetch(`/api/flight-fallback?${qs}`)
      .then(async (r): Promise<FallbackAnswer | "none"> => {
        if (r.status !== 200) return "none";
        const a = (await r.json()) as FallbackAnswer;
        return a.flights?.length ? a : "none";
      })
      .then((a) => live && setAnswer(a))
      .catch(() => live && setAnswer("none"));
    return () => {
      live = false;
    };
    // route is read through `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, currency, locale, directOnly]);
  return answer;
}

/**
 * No live fares at all: never a number that is not a live price — the same
 * trip on other sites, and the airlines of the two countries, so the
 * traveller is never left with nothing. Shown only then: with fares on the
 * page the «compare elsewhere» row is gone (owner, 13 Nov).
 */
export default function FallbackLinks({
  locale,
  route,
  currency,
}: {
  locale: Locale;
  route: FallbackRoute;
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
  const others = flightSites(trip);
  const airlines = airlineLinks(trip);

  return (
    <div className="mb-5 rounded-2xl bg-white p-4 ring-1 ring-mist-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-navy-800">{t.fallbackNoLive}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-navy-900 px-4 py-2 text-sm font-extrabold text-white"
        >
          {t.fallbackRetry}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {others.map((o) => (
          <a
            key={o.id}
            href={o.href}
            target="_blank"
            rel="noopener noreferrer"
            data-partner={o.id}
            data-placement="flight_fallback"
            className="rounded-full bg-mist-50 px-4 py-2 text-sm font-bold text-navy-900 ring-1 ring-mist-200 hover:ring-navy-300"
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
                data-placement="flight_fallback_airline"
                className="rounded-full bg-white px-4 py-2 text-sm font-bold text-navy-900 ring-1 ring-mist-300 hover:ring-sea-300"
              >
                <bdi>{o.name}</bdi> ↗
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
