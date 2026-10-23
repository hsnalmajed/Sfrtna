"use client";

import Link from "next/link";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { myTripProgress, useMyTrip } from "@/lib/myTrip";

/** «🧳 رحلتي: 2 من 5 جاهزة ›» — under results, when this city is the trip. */
export default function MyTripChip({ locale, slug, className = "" }: { locale: Locale; slug?: string; className?: string }) {
  const t = useDictionary().myTrip;
  const trip = useMyTrip();
  if (!trip || (slug && trip.slug !== slug)) return null;
  const p = myTripProgress(trip);
  return (
    <Link
      href={`/${locale}/my-trip`}
      className={`inline-flex min-h-10 items-center gap-2 rounded-full bg-navy-990 px-4 text-sm font-extrabold text-white shadow-sm ${className}`}
    >
      <span aria-hidden="true">🧳</span>
      {t.linkLabel.replace("{done}", String(p.done)).replace("{total}", String(p.total))}
      <span aria-hidden="true" className="text-white/50 rtl:rotate-180">
        ›
      </span>
    </Link>
  );
}
