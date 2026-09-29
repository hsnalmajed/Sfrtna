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
 * The same trip a few days either side.
 *
 * The traveller's own dates show the live price from this page's search —
 * the same figure as the tabs and the card below. Only one live search runs
 * at a time, so the other days cannot have live prices; what we have for
 * them are fares seen recently, which run a few per cent off live ones. A
 * seen price beside a live one would be two different numbers for the same
 * kind of thing, so the other days are compared with the traveller's own
 * dates *in the seen data* — "about 13% cheaper" — and tapping one runs its
 * live search. Days with no fare seen are left out.
 */
export default function NearbyDates({
  locale,
  origin,
  destination,
  depart,
  back,
  currency,
  paying,
  hrefFor,
  live,
  liveSettled,
}: {
  locale: Locale;
  origin: string;
  destination: string;
  depart: string;
  back: string;
  currency: string;
  /** Seats paid at a fare: adults and children. */
  paying: number;
  hrefFor: (depart: string, back: string) => string;
  /** The live cheapest fare for the traveller's own dates, from the search on this page. */
  live: number | null;
  liveSettled: boolean;
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

  // Worth showing with the live price for the traveller's dates, a seen
  // price for them to compare against, and at least two other days.
  const base = (days ?? []).find((d) => d.offset === 0);
  const others = (days ?? []).filter((d) => d.offset !== 0);
  if (live === null || !base || others.length < 2) return null;

  // Each day against the traveller's own, in the same seen data.
  const pct = (d: Day) => Math.round(((d.total - base.total) / base.total) * 100);
  const list = [...others, base].sort((a, b) => a.offset - b.offset);
  const best = others.reduce((a, b) => (b.total < a.total ? b : a));
  const bestPct = pct(best);
  const label = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale === "ar" ? "ar-u-ca-gregory-nu-latn" : "en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  const money = (n: number) => `${Math.round(n).toLocaleString("en-US")} ${currency}`;

  return (
    <section className="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-mist-200 sm:p-5">
      <h2 className="font-display text-lg font-extrabold text-navy-950">{t.nearbyTitle}</h2>
      <p className="mt-1 text-xs leading-relaxed text-navy-500">{t.nearbyNote}</p>
      <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {list.map((d) => {
          const isYours = d.offset === 0;
          const p = isYours ? 0 : pct(d);
          const isBest = !isYours && d === best && bestPct <= -3;
          const body = (
            <>
              {isYours && <span className="mb-1 block text-xs font-extrabold text-navy-900">{t.nearbyYours}</span>}
              <span className="flex items-center justify-center gap-1.5 text-xs">
                <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-extrabold text-sky-800">{t.nearbyOut}</span>
                <span className="font-bold text-navy-800">{label(d.depart)}</span>
              </span>
              {d.return && (
                <span className="mt-1 flex items-center justify-center gap-1.5 text-xs">
                  <span className="rounded bg-mist-100 px-1.5 py-0.5 text-[10px] font-extrabold text-navy-700">{t.nearbyBack}</span>
                  <span className="font-semibold text-navy-600">{label(d.return)}</span>
                </span>
              )}
              {isYours ? (
                <>
                  <span className="mt-1.5 block font-display text-base font-black text-navy-950">
                    <bdi dir="ltr">{money(live)}</bdi>
                  </span>
                  <span className="block text-[10px] font-bold text-emerald-700">
                    {liveSettled ? t.nearbyLive : t.nearbyLiveSoFar}
                  </span>
                </>
              ) : (
                <span
                  className={`mt-2 block text-sm font-extrabold ${
                    p <= -3 ? "text-emerald-700" : p >= 3 ? "text-navy-500" : "text-navy-700"
                  }`}
                >
                  {p <= -3
                    ? t.nearbyCheaperPct.replace("{n}", String(-p))
                    : p >= 3
                      ? t.nearbyDearerPct.replace("{n}", String(p))
                      : t.nearbySimilar}
                </span>
              )}
              <span className="mt-1 flex min-h-[18px] flex-wrap justify-center gap-1">
                {isBest && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 ring-1 ring-emerald-200">
                    {t.nearbyCheapest}
                  </span>
                )}
              </span>
            </>
          );
          const cls = `min-w-[140px] flex-1 rounded-xl px-3 py-2.5 text-center transition ${
            isYours ? "bg-navy-950/[0.04] ring-2 ring-navy-900" : "ring-1 ring-mist-200 hover:ring-navy-300 hover:shadow-sm"
          }`;
          return isYours ? (
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
