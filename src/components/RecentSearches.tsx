"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { findAirport } from "@/lib/airports";
import { readRecent, type RecentSearch } from "@/lib/recentSearches";

/** «عمليات بحثك الأخيرة»: the last searches from this browser, one tap each. */
export default function RecentSearches({ locale }: { locale: Locale }) {
  const t = useDictionary().recent;
  const [list, setList] = useState<RecentSearch[]>([]);
  useEffect(() => {
    // Read once in the browser (storage does not exist on the server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setList(readRecent());
  }, []);
  if (!list.length) return null;

  const place = (s?: string) => {
    if (!s) return "";
    const a = /^[A-Z]{3}$/.test(s) ? findAirport(s) : undefined;
    return a ? (locale === "ar" ? a.cityAr : a.cityEn) : s;
  };
  const day = (iso?: string) =>
    iso
      ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale === "ar" ? "ar-u-ca-gregory-nu-latn" : "en-GB", {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        })
      : "";
  const icon = { flight: "✈️", hotel: "🏨", combo: "✈️🏨", discover: "🧭" };

  return (
    <div className="mx-auto mb-4 max-w-4xl">
      <p className="mb-2 text-xs font-bold text-white/70">{t.title}</p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {list.map((r) => (
          <Link
            key={r.url}
            href={r.url}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-white/[0.08] px-3 py-2 text-start text-white ring-1 ring-white/15 transition hover:bg-white/[0.14] hover:ring-sun-400/60"
          >
            <span aria-hidden="true">{icon[r.kind]}</span>
            <span className="leading-tight">
              <span className="block whitespace-nowrap text-sm font-extrabold">
                {r.kind === "discover"
                  ? `${place(r.from)} · ${t.discover}`
                  : r.from
                    ? `${place(r.from)} ${locale === "ar" ? "←" : "→"} ${place(r.to)}`
                    : place(r.to)}
              </span>
              <span className="block whitespace-nowrap text-[11px] font-semibold text-white/65">
                {day(r.date)}
                {r.back ? ` – ${day(r.back)}` : ""}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
