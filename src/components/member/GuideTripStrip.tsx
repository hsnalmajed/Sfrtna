"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { myTripProgress, useMyTrip } from "@/lib/myTrip";
import { track } from "@/lib/analytics";

const OFF_KEY = "sfr-guide-strip-off";
/** «✕» hides it for this country for a while, not for ever. */
const OFF_DAYS = 14;

function offUntil(code: string): number {
  try {
    const all = JSON.parse(window.localStorage.getItem(OFF_KEY) || "{}") as Record<string, number>;
    return typeof all[code] === "number" ? all[code] : 0;
  } catch {
    return 0;
  }
}

function setOff(code: string) {
  try {
    const all = JSON.parse(window.localStorage.getItem(OFF_KEY) || "{}") as Record<string, number>;
    const now = Date.now();
    // Old answers are dropped so the stored list stays small.
    for (const k of Object.keys(all)) if (!(all[k] > now)) delete all[k];
    all[code] = now + OFF_DAYS * 86_400_000;
    window.localStorage.setItem(OFF_KEY, JSON.stringify(all));
  } catch {
    /* storage off: hidden for this visit only */
  }
}

/**
 * «مسافر إلى …؟» (growth doc item 5, «أول زيارة»): a small strip at the end
 * of a guide page — after the reading, never a window over it. It leads to
 * the flight search with the place filled in; the search is where the trip
 * gets its dates, and then «احفظ رحلتك» and «رحلتي» take over.
 * When «رحلتي» already holds a trip to this city (or country), the strip
 * shows how ready it is and opens «رحلتي» instead.
 */
export default function GuideTripStrip({
  locale,
  code,
  placeName,
  slug,
  airport,
}: {
  locale: Locale;
  /** The country (ISO-2). */
  code: string;
  /** The city on a city page, else the country, in the page's language. */
  placeName: string;
  /** The city's slug, on a city page. */
  slug?: string;
  /** The airport the search starts with (the city's, or the country's main one). */
  airport?: string;
}) {
  const t = useDictionary().member;
  const trip = useMyTrip();
  const [hidden, setHidden] = useState(true);
  const upper = code.toUpperCase();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount (this browser's «✕»)
    setHidden(offUntil(upper) > Date.now());
  }, [upper]);

  if (hidden) return null;

  const mine = trip && (slug ? trip.slug === slug : trip.code === upper) ? trip : null;
  const progress = mine ? myTripProgress(mine) : null;

  const close = () => {
    setOff(upper);
    setHidden(true);
    track("guide_strip", { action: "dismiss", code: upper });
  };

  let title: string;
  let body: string;
  let cta: string;
  let href: string;
  if (mine && progress) {
    title = t.stripMineTitle.replace("{place}", placeName);
    body = progress.next ? t.stripMineBody.replace("{done}", String(progress.done)).replace("{total}", String(progress.total)) : t.stripMineAllReady;
    cta = t.stripMineCta;
    href = `/${locale}/my-trip`;
  } else {
    title = t.stripTitle.replace("{place}", placeName);
    body = upper === "SA" ? t.stripBodyHome : t.stripBody;
    cta = t.stripCta;
    const q = new URLSearchParams({ mode: "known" });
    if (airport) q.set("destination", airport);
    href = `/${locale}?${q}#plan`;
  }

  return (
    <aside
      aria-label={title}
      className="relative mt-10 flex flex-col gap-3 rounded-3xl bg-navy-990 p-5 pe-12 text-white shadow-lg sm:flex-row sm:items-center sm:gap-5 sm:p-6 sm:pe-14 print:hidden"
    >
      <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-2xl">
        🧳
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-extrabold">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-white/75">{body}</p>
      </div>
      <Link
        href={href}
        onClick={() => track("guide_strip", { action: mine ? "my_trip" : "search", code: upper })}
        className="inline-flex min-h-11 w-fit shrink-0 items-center justify-center rounded-full bg-sun-400 px-5 text-sm font-extrabold text-navy-950 shadow-[var(--shadow-sun)] transition hover:bg-sun-300"
      >
        {cta}
      </Link>
      <button
        type="button"
        onClick={close}
        aria-label={t.stripClose}
        className="absolute end-3 top-3 grid h-9 w-9 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
      >
        ✕
      </button>
    </aside>
  );
}
