"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/types";
import { AIRPORTS } from "@/lib/airports";
import { ORIGIN_COOKIE } from "@/lib/originInfo";
import SearchableSelect from "@/components/SearchableSelect";

/**
 * "Prices from: Dammam · change" — the airport every fare and flight time on
 * the page is measured from. Found from where the visitor is (the nearest
 * airport), and theirs to change: the choice is kept in a cookie for a year
 * and the page re-renders from the new airport.
 */
export default function OriginPicker({
  locale,
  iata,
  cityName,
  labels,
  tone = "dark",
}: {
  locale: Locale;
  iata: string;
  cityName: string;
  labels: { from: string; change: string; search: string; noMatches: string };
  tone?: "dark" | "light";
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, start] = useTransition();
  const isAr = locale === "ar";

  function choose(code: string) {
    document.cookie = `${ORIGIN_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`;
    setEditing(false);
    start(() => router.refresh());
  }

  if (editing) {
    return (
      <div className="w-full max-w-xs text-navy-900">
        <SearchableSelect
          value={iata}
          options={AIRPORTS.map((a) => ({
            value: a.iata,
            label: `${isAr ? a.cityAr : a.cityEn} (${a.iata})`,
            hint: isAr ? a.countryAr : a.countryEn,
            keywords: `${a.cityAr} ${a.cityEn} ${a.nameAr} ${a.nameEn} ${a.countryAr} ${a.countryEn}`,
          }))}
          onChange={choose}
          label={labels.from}
          labelClassName={tone === "dark" ? "text-white/80" : "text-navy-700"}
          searchPlaceholder={labels.search}
          emptyText={labels.noMatches}
        />
      </div>
    );
  }

  return (
    <p
      className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full px-3.5 py-1.5 text-xs font-bold ring-1 ${
        tone === "dark" ? "bg-white/10 text-white/85 ring-white/20" : "bg-white text-navy-700 ring-mist-200"
      } ${busy ? "opacity-60" : ""}`}
    >
      <span aria-hidden="true">🛫</span>
      {labels.from}{" "}
      <span className={tone === "dark" ? "text-sun-300" : "text-navy-900"}>
        {cityName} ({iata})
      </span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`underline underline-offset-2 ${tone === "dark" ? "text-white/70 hover:text-white" : "text-sea-700 hover:text-sea-800"}`}
      >
        {labels.change}
      </button>
    </p>
  );
}
