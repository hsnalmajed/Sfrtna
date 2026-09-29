"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getDictionary } from "@/lib/dictionaries";
import ResultsBand from "@/components/ResultsBand";
import type { Locale, MultiCityLegInput, MultiCityTripResult } from "@/lib/types";

export default function MultiCityResultsPage() {
  return (
    <Suspense fallback={null}>
      <MultiCityResultsContent />
    </Suspense>
  );
}

/** "RUH الرياض — مطار الملك خالد" → "RUH الرياض". The field's label, shortened. */
function shortPlace(text: string): string {
  return text.split(" - ")[0].split("—")[0].trim();
}

/**
 * A multi-city trip: the flights the traveller listed, one card each.
 *
 * Every card ends in its own button, which opens our live flight search for
 * that one-way flight — the same partner search, with the same commission,
 * as any other trip. No price is printed on the cards: the ones we have are
 * fares seen recently, and the site shows the live price or none.
 */
function MultiCityResultsContent() {
  const params = useParams();
  const locale = (params.locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(locale);
  const m = dict.multicity;
  const sp = useSearchParams();

  const adults = sp.get("adults") || "1";
  const childrenAges = sp.get("childrenAges") || "";
  const infants = sp.get("infants") || "0";
  const budget = sp.get("budget") || "0";
  const currency = sp.get("currency") || "SAR";
  const directOnly = sp.get("directOnly") === "true";
  const baggageIncluded = sp.get("baggageIncluded") === "true";
  const legsRaw = sp.get("legs") || "[]";
  const editSearchParams = useMemo(() => {
    const p = new URLSearchParams(sp.toString());
    p.set("mode", "known");
    p.set("tripRoute", "multicity");
    p.set("product", "flights");
    return p.toString();
  }, [sp]);

  const legs = useMemo<MultiCityLegInput[]>(() => {
    try {
      const parsed = JSON.parse(legsRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [legsRaw]);

  const [result, setResult] = useState<MultiCityTripResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (legs.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    fetch("/api/multicity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legs,
        adults: Number(adults),
        childrenAges: childrenAges ? childrenAges.split(",").map(Number) : [],
        infants: Number(infants),
        budgetTotal: Number(budget),
        currency,
        directFlightsOnly: directOnly,
        baggageIncluded,
      }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: MultiCityTripResult) => setResult(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [legs, adults, childrenAges, infants, budget, currency, directOnly, baggageIncluded]);

  const money = (n: number) => `${Math.abs(n).toLocaleString("en-US")} ${currency}`;
  const dateLabel = (iso: string) =>
    iso
      ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale === "ar" ? "ar-u-ca-gregory-nu-latn" : "en-GB", {
          weekday: "short",
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        })
      : "";

  /** The live search for one flight of the trip, as a one-way search. */
  const legHref = (leg: MultiCityLegInput) =>
    `/${locale}/results?${new URLSearchParams({
      tripType: "flight",
      tripRoute: "oneway",
      mode: "known",
      origin: leg.origin,
      destination: leg.destination,
      departDate: leg.date,
      returnDate: "",
      adults,
      childrenAges,
      infants,
      currency,
      directOnly: String(directOnly),
      baggageIncluded: String(baggageIncluded),
    })}`;


  return (
    <div className="bg-mist-50">
    <ResultsBand
      locale={locale}
      title={m.resultsTitle}
      facts={
        legs.length >= 2
          ? m.searchSummary
              .replace("{count}", String(legs.length))
              .replace("{first}", dateLabel(legs[0].date))
              .replace("{last}", dateLabel(legs[legs.length - 1].date))
              .replace("{budget}", money(Number(budget)))
              .split(" · ")
          : []
      }
      backHref={`/${locale}?${editSearchParams}#plan`}
      backLabel={m.backToSearch}
    />
    <div className="mx-auto max-w-4xl px-4 pb-10 pt-6 sm:px-6">
      {loading && (
        <div className="space-y-4">
          {legs.map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-white ring-1 ring-black/5" />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="py-4 text-center text-sm text-red-600">
          {locale === "ar" ? "حدث خطأ أثناء البحث، حاول مرة أخرى." : "Something went wrong while searching. Please try again."}
        </p>
      )}

      {!loading && !error && result && (
        <>
          <p className="mb-5 rounded-xl bg-sea-50 px-4 py-3 text-sm text-navy-800 ring-1 ring-sea-100">
            ℹ️ {m.separateNotice}
          </p>

          <ol className="space-y-4">
            {result.legs.map((leg, i) => {
              return (
                <li key={i} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-navy-950/10">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sun-400 text-xs font-black text-navy-950">
                      {i + 1}
                    </span>
                    <p className="font-bold text-navy-950">{m.legFlight.replace("{n}", String(i + 1))}</p>
                    <span className="ms-auto text-sm font-semibold text-navy-600">{dateLabel(leg.date)}</span>
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-navy-950">
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-2xl font-black">{leg.originIata}</p>
                      {shortPlace(leg.origin) !== leg.originIata && (
                        <p className="truncate text-xs text-navy-500">{shortPlace(leg.origin).replace(leg.originIata, "").trim()}</p>
                      )}
                    </div>
                    <span className="text-xl text-sun-500" aria-hidden="true">
                      {locale === "ar" ? "←" : "→"}
                    </span>
                    <div className="min-w-0 flex-1 text-end">
                      <p className="font-display text-2xl font-black">{leg.destinationIata}</p>
                      {shortPlace(leg.destination) !== leg.destinationIata && (
                        <p className="truncate text-xs text-navy-500">{shortPlace(leg.destination).replace(leg.destinationIata, "").trim()}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-dashed border-mist-200 pt-4">
                    <p className="max-w-sm text-xs text-navy-500">{m.legLiveHint}</p>
                    <Link
                      href={legHref(leg)}
                      className="rounded-xl bg-sun-400 px-5 py-3 text-sm font-extrabold text-navy-950 shadow-[var(--shadow-sun)] transition hover:bg-sun-300"
                    >
                      ✈️ {m.bookLeg}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>

        </>
      )}
    </div>
    </div>
  );
}
