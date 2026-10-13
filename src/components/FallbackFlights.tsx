"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";
import { findAirport } from "@/lib/airports";

export interface FallbackRoute {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  adults: number;
  children: number;
  infants: number;
}

interface Leg {
  depTime: string;
  depCode: string;
  arrTime: string;
  arrCode: string;
  minutes: number;
  airline: string;
  logo: string;
  flightNumber: string;
}
interface Flight {
  price: number;
  minutes: number;
  stops: number;
  layovers: { code: string; minutes: number }[];
  legs: Leg[];
  best: boolean;
}
interface Answer {
  flights: Flight[];
  url: string;
  roundTrip: boolean;
  currency: string;
}

/**
 * The second source of flights (owner, 13 Oct 2026): when the flight
 * partner's search cannot be reached, live fares from Google Flights are
 * shown instead, each opening Google Flights on the same route and dates.
 * With no live fares to be had, links to search the same trip elsewhere —
 * never a number that is not a live price.
 */
export default function FallbackFlights({
  locale,
  route,
  currency,
  directOnly,
}: {
  locale: Locale;
  route: FallbackRoute;
  currency: string;
  directOnly: boolean;
}) {
  const t = getDictionary(locale).results;
  const isAr = locale === "ar";
  const [answer, setAnswer] = useState<Answer | null | "none">(null);
  const [limit, setLimit] = useState(8);

  useEffect(() => {
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
      .then(async (r): Promise<Answer | "none"> => (r.status === 200 ? ((await r.json()) as Answer) : "none"))
      .then((a) => live && setAnswer(a))
      .catch(() => live && setAnswer("none"));
    return () => {
      live = false;
    };
  }, [route.origin, route.destination, route.departDate, route.returnDate, route.adults, route.children, route.infants, currency, locale, directOnly]);

  const money = (n: number) =>
    `${new Intl.NumberFormat(isAr ? "ar-SA-u-nu-latn" : "en-US", { maximumFractionDigits: 0 }).format(n)} ${currency === "SAR" && isAr ? "ر.س" : currency}`;
  const dur = (m: number) => `${Math.floor(m / 60)}${t.durHours} ${String(m % 60).padStart(2, "0")}${t.durMinutes}`;
  const city = (code: string) => {
    const a = findAirport(code);
    return a ? (isAr ? a.cityAr : a.cityEn) : code;
  };

  // The same trip on other sites: always offered here, so the traveller is
  // never left with nothing.
  const d = route.departDate;
  const r = route.returnDate;
  const pax = route.adults + route.children;
  const others = [
    {
      name: "Google Flights",
      href:
        answer && answer !== "none" && answer.url
          ? answer.url
          : `https://www.google.com/travel/flights?hl=${locale}&q=${encodeURIComponent(`Flights from ${route.origin} to ${route.destination} on ${d}${r ? ` returning ${r}` : ""}`)}`,
    },
    { name: "KAYAK", href: `https://www.kayak.com/flights/${route.origin}-${route.destination}/${d}${r ? `/${r}` : ""}/${pax}adults?sort=bestflight_a` },
    {
      name: "Skyscanner",
      href: `https://www.skyscanner.net/transport/flights/${route.origin.toLowerCase()}/${route.destination.toLowerCase()}/${d.slice(2).replace(/-/g, "")}/${r ? `${r.slice(2).replace(/-/g, "")}/` : ""}?adultsv2=${route.adults}`,
    },
  ];

  const flights = answer && answer !== "none" ? answer.flights : [];

  return (
    <div className="mb-5 space-y-3">
      {answer === null && (
        <p className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-navy-700 shadow-sm ring-1 ring-black/5">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-sun-400" aria-hidden="true" />
          {t.fallbackLoading}
        </p>
      )}

      {flights.length > 0 && (
        <>
          <p className="text-sm font-bold text-navy-700">
            {t.fallbackTitle}
            {answer && answer !== "none" && answer.roundTrip ? ` · ${t.fallbackRoundTrip}` : ""}
          </p>
          <ul className="space-y-2">
            {flights.slice(0, limit).map((f, i) => {
              const first = f.legs[0];
              const last = f.legs[f.legs.length - 1];
              const airlines = [...new Set(f.legs.map((l) => l.airline).filter(Boolean))];
              return (
                <li key={i} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-mist-200">
                  {first.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- airline logo from the search result
                    <img src={first.logo} alt="" className="h-9 w-9 shrink-0 rounded-full bg-white object-contain ring-1 ring-mist-200" />
                  ) : (
                    <span className="h-9 w-9 shrink-0 rounded-full bg-mist-100" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 font-extrabold text-navy-950" dir="ltr">
                      <span>{first.depTime}</span>
                      <span className="text-xs font-bold text-navy-500">{first.depCode}</span>
                      <span className="text-navy-300">→</span>
                      <span>{last.arrTime}</span>
                      <span className="text-xs font-bold text-navy-500">{last.arrCode}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-navy-500">
                      {airlines.join(" · ")} · {dur(f.minutes)} ·{" "}
                      {f.stops === 0
                        ? t.fallbackDirect
                        : `${t.fallbackStops.replace("{n}", String(f.stops))} (${f.layovers.map((l) => city(l.code)).join("، ")})`}
                    </p>
                  </div>
                  <a
                    href={answer && answer !== "none" ? answer.url || others[0].href : others[0].href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-xl bg-sun-400 px-4 py-2.5 text-sm font-extrabold text-navy-950 shadow-[var(--shadow-sun)] hover:bg-sun-300"
                  >
                    {money(f.price)}
                  </a>
                </li>
              );
            })}
          </ul>
          {flights.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + 8)}
              className="w-full rounded-full bg-white py-2.5 text-sm font-bold text-navy-800 ring-1 ring-mist-300 hover:ring-navy-300"
            >
              {t.fallbackMore}
            </button>
          )}
        </>
      )}

      {answer !== null && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-mist-200">
          <p className="text-sm font-bold text-navy-800">{flights.length > 0 ? t.fallbackOthers : t.fallbackNoLive}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {others.map((o) => (
              <a
                key={o.name}
                href={o.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-mist-50 px-4 py-2 text-sm font-bold text-navy-900 ring-1 ring-mist-200 hover:ring-navy-300"
              >
                {o.name} ↗
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
