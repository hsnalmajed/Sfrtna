"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/types";
import type { ViatorTour } from "@/lib/viator";
import { useDictionary } from "@/lib/dict/context";
import TourCard from "@/components/TourCard";

/**
 * Viator's tours and tickets for a city, or for one place in it — asked for
 * by the browser (/api/viator/offers), so Viator's own words and photos are
 * never part of our indexed HTML (their licence). Live prices, ratings,
 * booking links that carry our affiliate id. Nothing when there is nothing.
 */
export default function ViatorOffers({
  locale,
  city,
  q,
  n = 6,
  compact = false,
  onEmpty,
}: {
  locale: Locale;
  city: string;
  q?: string;
  n?: number;
  compact?: boolean;
  /** Told when Viator has nothing, so the caller can say so or hide. */
  onEmpty?: () => void;
}) {
  const t = useDictionary().attractions;
  const [offers, setOffers] = useState<ViatorTour[] | null>(null);

  useEffect(() => {
    let live = true;
    const p = new URLSearchParams({ city, n: String(n) });
    if (q) p.set("q", q);
    fetch(`/api/viator/offers?${p}`)
      .then((r) => r.json() as Promise<{ ok: boolean; offers?: ViatorTour[] }>)
      .then((j) => {
        if (!live) return;
        const list = j.ok ? (j.offers ?? []) : [];
        setOffers(list);
        if (!list.length) onEmpty?.();
      })
      .catch(() => {
        if (!live) return;
        setOffers([]);
        onEmpty?.();
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one ask per city/place
  }, [city, q, n]);

  if (offers === null) {
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: compact ? 2 : 3 }, (_, i) => (
          <div key={i} className={`animate-pulse rounded-2xl bg-mist-100 ${compact ? "h-16" : "h-40"}`} />
        ))}
      </div>
    );
  }
  if (!offers.length) return compact ? <p className="text-xs text-navy-500">{t.noOffers}</p> : null;

  const money = (o: ViatorTour) =>
    typeof o.priceFrom === "number"
      ? o.priceFrom.toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", { style: "currency", currency: o.currency, maximumFractionDigits: 0 })
      : "";

  if (compact) {
    return (
      <ul className="space-y-2">
        {offers.map((o) => (
          <li key={o.code}>
            <a
              href={o.url}
              target="_blank"
              rel="noopener noreferrer nofollow sponsored"
              data-partner="viator"
              data-product="activity"
              data-placement={q ? "place_offers" : "city_offers"}
              className="flex items-center gap-3 rounded-2xl bg-white p-2 ring-1 ring-mist-200 transition hover:ring-sea-300"
            >
              {o.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.photo} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-mist-100 text-xl">🎟️</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[12px] font-bold leading-snug text-navy-900" dir="ltr">
                  {o.title}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-navy-600">
                  {typeof o.rating === "number" && (
                    <span>
                      ★ {o.rating.toFixed(1)}
                      {typeof o.reviewCount === "number" ? ` (${o.reviewCount.toLocaleString("en-US")})` : ""}
                    </span>
                  )}
                  {money(o) && (
                    <span className="font-extrabold text-navy-950" dir="ltr">
                      {money(o)}
                    </span>
                  )}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-sun-400 px-3 py-1.5 text-[11px] font-extrabold text-navy-950">{t.bookNow}</span>
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {offers.map((o) => (
        <TourCard key={o.code} tour={o} locale={locale} dict={t} />
      ))}
    </div>
  );
}
