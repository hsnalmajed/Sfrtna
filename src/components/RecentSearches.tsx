"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { findAirport } from "@/lib/airports";
import { readRecent, type RecentSearch } from "@/lib/recentSearches";
import { useMember } from "@/lib/useMember";

/**
 * «عمليات بحثك الأخيرة»: the last searches, one tap each — from this
 * browser, and for a signed-in traveller from every device (site and app).
 */
export default function RecentSearches({ locale }: { locale: Locale }) {
  const t = useDictionary().recent;
  const [list, setList] = useState<RecentSearch[]>([]);
  useEffect(() => {
    // Read once in the browser (storage does not exist on the server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setList(readRecent());
  }, []);
  const member = useMember();
  const today = new Date().toISOString().slice(0, 10);
  const merged: RecentSearch[] = [...list];
  for (const s of member.searches) {
    const d = s.data;
    if (d.date && d.date < today) continue;
    if (merged.some((r) => r.url === d.url || (r.kind === d.kind && r.from === d.from && r.to === d.to && r.date === d.date && r.back === d.back))) continue;
    merged.push({ ...d, at: s.created });
  }
  const shown = merged.sort((a, b) => b.at - a.at).slice(0, 6);
  if (!shown.length) return null;

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
        {shown.map((r) => (
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
