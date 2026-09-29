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
  foundAt: string | null;
}

/**
 * The same trip a few days either side.
 *
 * The traveller's own dates show the live price from this page's search —
 * the same figure as the tabs and the card below, never a different one.
 * The other days show the last fare seen for them (a real round-trip quote
 * for those two exact days, with how long ago it was seen), since only one
 * live search runs at a time; tapping a day runs its live search. Days with
 * no fare seen are left out.
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
  live,
  liveSettled,
  hasChildren,
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
  /** The live cheapest fare for the traveller's own dates, from the search on this page. */
  live: number | null;
  liveSettled: boolean;
  /** Children usually fly for less: a seen adult fare × heads is then an upper figure. */
  hasChildren: boolean;
}) {
  const t = getDictionary(locale).results;
  const [days, setDays] = useState<Day[] | null>(null);
  // When the fares came back: "seen N hours ago" is counted from then.
  const [now, setNow] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({ origin, destination, depart, return: back, currency, paying: String(paying) });
    fetch(`/api/nearby-dates?${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((d: { days: Day[] }) => {
        if (cancelled) return;
        setNow(Date.now());
        setDays(d.days ?? []);
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      });
    return () => {
      cancelled = true;
    };
  }, [origin, destination, depart, back, currency, paying]);

  // Worth showing only with the live price for the traveller's dates to
  // compare against, and at least two other days seen.
  const others = (days ?? []).filter((d) => d.offset !== 0);
  if (live === null || others.length < 2) return null;

  const yours: Day = { offset: 0, depart, return: back, total: live, direct: false, foundAt: null };
  const list = [...others, yours].sort((a, b) => a.offset - b.offset);
  const cheapest = Math.min(...list.map((d) => d.total));
  // "Within budget" only says something when the dates asked for are not.
  const markFits = budget > 0 && live > budget;
  const seenAgo = (iso: string | null) => {
    if (!iso) return "";
    const ms = now - new Date(iso).getTime();
    if (!now || !Number.isFinite(ms)) return "";
    const hours = Math.max(1, Math.round(ms / 3600000));
    return hours < 24
      ? t.nearbySeenHours.replace("{n}", String(hours))
      : t.nearbySeenDays.replace("{n}", String(Math.round(hours / 24)));
  };
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
          const fits = markFits && d.total <= budget;
          const isCheapest = d.total === cheapest;
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
              <span className="mt-1.5 block font-display text-base font-black text-navy-950">
                <bdi dir="ltr">
                  {!isYours && hasChildren ? "≈ " : ""}
                  {money(d.total)}
                </bdi>
              </span>
              <span className={`block text-[10px] font-semibold ${isYours ? "text-emerald-700" : "text-navy-400"}`}>
                {isYours ? (liveSettled ? t.nearbyLive : t.nearbyLiveSoFar) : seenAgo(d.foundAt)}
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
