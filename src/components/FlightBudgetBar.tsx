"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";
import Icon from "@/components/ui/Icon";
import { lastSearchContext, track } from "@/lib/analytics";

/**
 * The traveller's budget, held up against the live fares.
 *
 * The flight widget draws its own results inside a shadow root and knows
 * nothing about our budget. So this reads the fares it has put on screen —
 * each ticket card's price carries `data-testid="flight-card-price-…"`, kept
 * apart from the baggage surcharges and the direct-flights strip — and says
 * what they mean for this traveller: the cheapest fare, what is left of the
 * budget after it, and how many of the fares shown fit.
 *
 * Two rules, because this is reading a page that is not ours:
 *
 *  - It only compares like with like. If the widget's currency is not the
 *    budget's currency, it says the fares are for the whole party and stops
 *    there; converting at some rate would be a number we made up.
 *  - If the widget changes shape and the marker stops matching, the bar
 *    simply shows no fares. It never guesses at a price.
 *
 * Fares are for every traveller together — checked on sfrtna.com: one adult
 * RUH→IST was 705 SAR, two adults the same flight 1,409 SAR — and the bar
 * says so, because the widget does not.
 */

const CURRENCY_MARKS: [RegExp, string][] = [
  [/ر\.س|SAR/, "SAR"],
  [/د\.إ|AED/, "AED"],
  [/د\.ك|KWD/, "KWD"],
  [/ر\.ق|QAR/, "QAR"],
  [/د\.ب|BHD/, "BHD"],
  [/ر\.ع|OMR/, "OMR"],
  [/US\$|\$|USD/, "USD"],
  [/€|EUR/, "EUR"],
  [/£|GBP/, "GBP"],
];

function currencyOf(text: string): string | null {
  for (const [re, code] of CURRENCY_MARKS) if (re.test(text)) return code;
  return null;
}

/** "‪1 409‬ ر.س" → 1409. Arabic-Indic digits folded, every kind of space dropped. */
function amountOf(text: string): number | null {
  const digits = text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[^\d.,]/g, "")
    .replace(/,/g, "");
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

interface Fares {
  prices: number[];
  currency: string | null;
  /** The widget is still asking agencies — its progress bar is on screen. */
  searching: boolean;
}

function readFares(): Fares {
  const root = document.getElementById("tpwl-tickets")?.shadowRoot;
  if (!root) return { prices: [], currency: null, searching: false };
  const cells = root.querySelectorAll('[data-testid^="flight-card-price-"]');
  const prices: number[] = [];
  let currency: string | null = null;
  cells.forEach((el) => {
    const text = el.textContent || "";
    const n = amountOf(text);
    if (n !== null) prices.push(n);
    currency ??= currencyOf(text);
  });
  // The first agencies answer within seconds and the rest over the next
  // twenty or so, and the cheapest fare often arrives late. A verdict read
  // off the first few cards ("everything is over your budget") would be
  // wrong half the time, so while the progress bar is up there is none.
  const searching = Boolean(root.querySelector('[class*="SearchProgressbar"]'));
  return { prices, currency, searching };
}

/**
 * If the progress-bar marker is never seen (the widget renamed it), fares
 * unchanged for this long are taken as final.
 */
const SETTLE_MS = 4000;

export default function FlightBudgetBar({
  locale,
  budget,
  currency,
  travelers,
}: {
  locale: Locale;
  /** The flight budget for the whole party; 0 when none was given. */
  budget: number;
  currency: string;
  travelers: number;
}) {
  const t = getDictionary(locale).results;
  const [fares, setFares] = useState<Fares>({ prices: [], currency: null, searching: true });
  const [settled, setSettled] = useState(false);

  // The widget fills in over several seconds and re-renders when the
  // traveller filters or sorts, so this keeps reading. Cheap: one query
  // inside one shadow root, once a second.
  useEffect(() => {
    let lastKey = "";
    let lastChange = Date.now();
    let sawProgress = false;
    const tick = () => {
      const next = readFares();
      const key = `${next.currency}|${next.prices.join()}|${next.searching}`;
      if (key !== lastKey) {
        lastKey = key;
        lastChange = Date.now();
        setFares(next);
      }
      // While the progress bar is up: never settled. Once it has come and
      // gone: settled after a second's calm. If it was never seen at all (a
      // renamed marker), fall back to a longer calm.
      if (next.searching) sawProgress = true;
      const calm = Date.now() - lastChange;
      // A finished search with no fares at all is settled too — the bar
      // then just has nothing to compare, rather than waiting forever.
      setSettled(
        !next.searching &&
          (next.prices.length > 0 || sawProgress) &&
          calm >= (sawProgress ? 1000 : SETTLE_MS)
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const fmt = (n: number) =>
    `${Math.round(n).toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US")} ${currency}`;

  const partyLine = t.budgetBarParty.replace("{count}", String(travelers));
  const comparable = settled && budget > 0 && fares.prices.length > 0 && fares.currency === currency;
  const waiting = !settled && budget > 0;
  const cheapest = comparable ? Math.min(...fares.prices) : 0;
  const within = comparable ? fares.prices.filter((p) => p <= budget).length : 0;
  const allOver = comparable && within === 0;

  // One flight_results per search, sent when the widget has finished and the
  // verdict on screen is final. A later filter or sort re-renders the
  // widget but is not a new search, so it is not counted again.
  const reported = useRef(false);
  useEffect(() => {
    if (!settled || reported.current) return;
    reported.current = true;
    track("flight_results", {
      results_count: fares.prices.length,
      fare_currency: fares.currency ?? undefined,
      cheapest_fare: fares.prices.length ? Math.min(...fares.prices) : undefined,
      budget: budget || undefined,
      currency,
      within_budget_count: comparable ? within : undefined,
      all_over_budget: comparable ? allOver : undefined,
      ...lastSearchContext(),
    });
  }, [settled, fares, budget, currency, comparable, within, allOver]);

  return (
    <div
      className={`mt-8 rounded-2xl p-4 ring-1 sm:p-5 ${
        allOver ? "bg-sun-50 ring-sun-300" : "bg-white shadow-sm ring-black/5"
      }`}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        {budget > 0 && (
          <p className="flex items-center gap-1.5 font-bold text-navy-900">
            <Icon name="wallet" className="h-4 w-4 text-sun-600" />
            {t.budgetBarBudget.replace("{amount}", fmt(budget))}
          </p>
        )}
        <p className="flex items-center gap-1.5 text-navy-600">
          <Icon name="users" className="h-4 w-4 text-sun-600" />
          {partyLine}
        </p>
      </div>

      {waiting && (
        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-navy-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-sun-400" aria-hidden="true" />
          {t.budgetBarWaiting}
        </p>
      )}

      {comparable && !allOver && (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-mist-100 px-3 py-1.5 text-xs font-bold text-navy-800 ring-1 ring-mist-200">
            {t.budgetBarCheapest.replace("{amount}", fmt(cheapest))}
          </span>
          <span className="rounded-full bg-sea-50 px-3 py-1.5 text-xs font-bold text-sea-800 ring-1 ring-sea-200">
            {t.budgetBarLeft.replace("{amount}", fmt(budget - cheapest))}
          </span>
          <span className="rounded-full bg-mist-100 px-3 py-1.5 text-xs font-bold text-navy-800 ring-1 ring-mist-200">
            {t.budgetBarWithin
              .replace("{within}", String(within))
              .replace("{total}", String(fares.prices.length))}
          </span>
          {within < fares.prices.length && (
            <span className="rounded-full bg-sun-50 px-3 py-1.5 text-xs font-bold text-sun-800 ring-1 ring-sun-300">
              {t.budgetBarOver.replace("{count}", String(fares.prices.length - within))}
            </span>
          )}
        </div>
      )}

      {allOver && (
        <p className="mt-3 text-sm font-bold leading-relaxed text-navy-900">
          {t.budgetBarAllOver
            .replace("{amount}", fmt(cheapest))
            .replace("{over}", fmt(cheapest - budget))}
        </p>
      )}

      {settled && budget > 0 && fares.prices.length > 0 && fares.currency && fares.currency !== currency && (
        <p className="mt-2 text-xs text-navy-500">{t.budgetBarOtherCurrency}</p>
      )}
    </div>
  );
}
