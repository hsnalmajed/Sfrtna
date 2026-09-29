"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";

interface Day {
  offset: number;
  depart: string;
  return: string;
  total: number;
  direct: boolean;
}

/**
 * The same trip a few days either side, priced from fares seen recently.
 *
 * For a site built on a budget this is often the answer: the dates asked
 * for cost too much, and two days later do not. Only days with a fare seen
 * for both ways are shown — none is filled in — and each opens the full
 * results for those dates, so the header, the pick and the budget all move
 * with it. Nothing shows while there is nothing to compare.
 */
export default function NearbyDates({
  locale,
  origin,
  destination,
  depart,
  back,
  currency,
  paying,
  budget,
  hrefFor,
}: {
  locale: Locale;
  origin: string;
  destination: string;
  depart: string;
  back: string;
  currency: string;
  /** Seats paid at a fare: adults and children. */
  paying: number;
  budget: number;
  hrefFor: (depart: string, back: string) => string;
}) {
  const t = getDictionary(locale).results;
  const [days, setDays] = useState<Day[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({ origin, destination, depart, return: back, currency, paying: String(paying) });
    fetch(`/api/nearby-dates?${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((d: { days: Day[] }) => {
        if (!cancelled) setDays(d.days ?? []);
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      });
    return () => {
      cancelled = true;
    };
  }, [origin, destination, depart, back, currency, paying]);

  // Worth showing only when there is another day to compare with.
  if (!days || days.filter((d) => d.offset !== 0).length < 2) return null;

  const cheapest = Math.min(...days.map((d) => d.total));
  // "Within budget" only says something when the dates asked for are not.
  const yoursDay = days.find((d) => d.offset === 0);
  const markFits = budget > 0 && (!yoursDay || yoursDay.total > budget);
  const label = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale === "ar" ? "ar-u-ca-gregory-nu-latn" : "en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  const money = (n: number) => `${Math.round(n).toLocaleString("en-US")} ${currency}`;

  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-mist-200 sm:p-5">
      <h2 className="font-display text-lg font-extrabold text-navy-950">{t.nearbyTitle}</h2>
      <p className="mt-1 text-xs text-navy-500">{t.nearbyNote}</p>
      <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((d) => {
          const yours = d.offset === 0;
          const fits = markFits && d.total <= budget;
          const isCheapest = d.total === cheapest;
          const body = (
            <>
              <span className="block text-xs font-bold text-navy-500">{yours ? t.nearbyYours : label(d.depart)}</span>
              {d.return && <span className="block text-[11px] text-navy-400">← {label(d.return)}</span>}
              <span className="mt-1.5 block font-display text-base font-black text-navy-950">
                <bdi dir="ltr">{money(d.total)}</bdi>
              </span>
              <span className="mt-1 flex min-h-[18px] flex-wrap justify-center gap-1">
                {isCheapest && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 ring-1 ring-emerald-200">
                    {t.nearbyCheapest}
                  </span>
                )}
                {fits && !isCheapest && (
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800 ring-1 ring-sky-200">
                    {t.nearbyFits}
                  </span>
                )}
              </span>
            </>
          );
          const cls = `min-w-[118px] flex-1 rounded-xl px-3 py-2.5 text-center transition ${
            yours ? "bg-navy-950/[0.04] ring-2 ring-navy-900" : "ring-1 ring-mist-200 hover:ring-navy-300 hover:shadow-sm"
          }`;
          return yours ? (
            <div key={d.depart} className={cls} aria-current="true">
              {body}
            </div>
          ) : (
            <a key={d.depart} href={hrefFor(d.depart, d.return)} className={cls}>
              {body}
            </a>
          );
        })}
      </div>
    </section>
  );
}
