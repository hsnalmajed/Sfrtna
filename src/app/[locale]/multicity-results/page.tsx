"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getDictionary } from "@/lib/dictionaries";
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
 * Every card ends in its own booking button, which opens our live flight
 * search for that one-way flight — the same partner search, with the same
 * commission, as any other trip. The prices on the cards are fares seen
 * recently for each flight on its own, and the page says so; the live price
 * is the one on the partner's page.
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

  const paying = Math.max(1, Number(adults) + (childrenAges ? childrenAges.split(",").length : 0));
  const pricedCount = result?.legs.filter((l) => l.flight).length ?? 0;
  const isMock = Boolean(result?.isMock) && process.env.NODE_ENV !== "development";

  return (
    <div className="mx-auto max-w-4xl px-4 pb-10 pt-28 sm:px-6 sm:pt-32">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-950 sm:text-3xl">{m.resultsTitle}</h1>
          {legs.length >= 2 && (
            <p className="mt-1.5 text-navy-500">
              {m.searchSummary
                .replace("{count}", String(legs.length))
                .replace("{first}", dateLabel(legs[0].date))
                .replace("{last}", dateLabel(legs[legs.length - 1].date))
                .replace("{budget}", money(Number(budget)))}
            </p>
          )}
        </div>
        <Link
          href={`/${locale}?${editSearchParams}#plan`}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-navy-800 shadow-sm ring-1 ring-mist-200 transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <span aria-hidden="true">{locale === "ar" ? "→" : "←"}</span>
          {m.backToSearch}
        </Link>
      </div>

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
              const f = isMock ? null : leg.flight;
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
                    {f ? (
                      <div>
                        <p className="font-display text-xl font-black text-navy-950">{money(f.price)}</p>
                        <p className="text-xs text-navy-500">
                          {dict.discoverResults.totalFor.replace("{count}", String(paying))} · ✈️ {f.airline}
                        </p>
                        {f.priceOnly && (
                          <p className="mt-0.5 text-xs text-navy-400">
                            {f.datesApproximate ? dict.results.approxDatesNote : dict.results.priceObserved}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="max-w-sm text-sm text-navy-600">{m.legNotPriced}</p>
                    )}
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

          {!isMock && pricedCount > 0 && (
            <div className="mt-5 rounded-2xl bg-navy-950 p-5 text-white">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-white/70">
                  {result.allPriced
                    ? m.totalSeparate
                    : m.totalPartial.replace("{count}", String(pricedCount)).replace("{all}", String(result.legs.length))}
                </p>
                <p className="font-display text-2xl font-black text-sun-400">{money(result.totalPrice)}</p>
              </div>
              {result.allPriced && result.budgetTotal > 0 && (
                <p className={`mt-2 text-sm font-bold ${result.withinBudget ? "text-emerald-300" : "text-rose-300"}`}>
                  {result.withinBudget
                    ? `${m.remaining}: ${money(result.remainingBudget)}`
                    : m.overBudget.replace("{amount}", money(result.remainingBudget))}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
