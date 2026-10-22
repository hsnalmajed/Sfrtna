"use client";

import type { Locale, MultiCityLegInput } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import ScrollRow from "@/components/ui/ScrollRow";
import { findAirport } from "@/lib/airports";
import Icon from "@/components/ui/Icon";

/**
 * A multi-city trip as one tab per flight (owner's decision, 13 Oct).
 *
 * Live fares exist for one route at a time, so each flight is its own live
 * search: the tab opens that flight's results on this same page. What makes
 * it one trip is the budget — the fare the traveller goes to book on each
 * flight is kept, and the flight on screen is held to the whole-trip budget
 * minus what was picked on the others.
 *
 * Each tab is a full page load (a plain link), never a client-side change:
 * the flight widget reads its route once, when its script starts.
 */
export default function MultiCityTabs({
  locale,
  legs,
  active,
  hrefFor,
  picks,
  budget,
  currency,
}: {
  locale: Locale;
  legs: MultiCityLegInput[];
  active: number;
  hrefFor: (index: number) => string;
  /** Fare picked per flight, by index. */
  picks: Record<number, number>;
  /** Whole-trip budget; 0 when none was given. */
  budget: number;
  currency: string;
}) {
  const t = useDictionary().multicity;
  const isAr = locale === "ar";
  const money = (n: number) => `${Math.round(Math.abs(n)).toLocaleString("en-US")} ${currency}`;
  const city = (code: string) => {
    const a = findAirport(code);
    return a ? (isAr ? a.cityAr : a.cityEn) : code;
  };
  const day = (iso: string) =>
    iso
      ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(isAr ? "ar-u-ca-gregory-nu-latn" : "en-GB", {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        })
      : "";

  const sum = Object.values(picks).reduce((a, b) => a + b, 0);
  const anyPicked = Object.keys(picks).length > 0;
  const next = active + 1 < legs.length ? active + 1 : null;

  return (
    <section className="mb-6" aria-label={t.tabsTitle}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-extrabold text-navy-950">{t.tabsTitle}</h2>
        {anyPicked && (
          <p className={`text-sm font-bold ${budget > 0 && sum > budget ? "text-rose-700" : "text-navy-700"}`}>
            {budget > 0
              ? sum > budget
                ? t.tabBudgetOver.replace("{sum}", money(sum)).replace("{budget}", money(budget)).replace("{over}", money(sum - budget))
                : t.tabBudget.replace("{sum}", money(sum)).replace("{budget}", money(budget)).replace("{left}", money(budget - sum))
              : t.tabNoBudget.replace("{sum}", money(sum))}
          </p>
        )}
      </div>

      {/* One swipeable row on a phone; every tab in view on a wide screen. */}
      <ScrollRow role="tablist" outerClassName="-mx-4 sm:mx-0" className="flex gap-2 px-4 pb-1 sm:px-0">
        {legs.map((leg, i) => {
          const on = i === active;
          const picked = picks[i];
          const body = (
            <>
              <span className={`flex items-center gap-1.5 text-xs font-bold ${on ? "text-sun-300" : "text-navy-500"}`}>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black ${
                    on ? "bg-sun-400 text-navy-950" : "bg-mist-100 text-navy-700"
                  }`}
                >
                  {i + 1}
                </span>
                {day(leg.date)}
              </span>
              <span className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-sm font-extrabold">
                {city(leg.origin)}
                <span aria-hidden="true" className={on ? "text-sun-400" : "text-navy-400"}>
                  {isAr ? "←" : "→"}
                </span>
                {city(leg.destination)}
              </span>
              <span
                className={`mt-1 flex items-center gap-1 text-xs font-bold ${
                  picked !== undefined ? (on ? "text-emerald-300" : "text-emerald-700") : on ? "text-white/60" : "text-navy-400"
                }`}
              >
                {picked !== undefined && <Icon name="check" className="h-3.5 w-3.5" />}
                {picked !== undefined ? t.tabPicked.replace("{amount}", money(picked)) : t.tabNotPicked}
              </span>
            </>
          );
          const cls = `min-w-[150px] shrink-0 rounded-2xl px-4 py-3 text-start transition ${
            on ? "bg-navy-950 text-white shadow-sm" : "bg-white text-navy-950 ring-1 ring-mist-200 hover:ring-navy-300"
          }`;
          return on ? (
            <div key={i} role="tab" aria-selected="true" className={cls}>
              {body}
            </div>
          ) : (
            <a key={i} role="tab" aria-selected="false" href={hrefFor(i)} className={cls}>
              {body}
            </a>
          );
        })}
      </ScrollRow>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-navy-500">{t.tabHint}</p>
        {next !== null && (
          <a
            href={hrefFor(next)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-navy-800 ring-1 ring-mist-300 transition hover:ring-navy-300"
          >
            {t.tabNext}
            <span aria-hidden="true">{isAr ? "←" : "→"}</span>
          </a>
        )}
      </div>
    </section>
  );
}
