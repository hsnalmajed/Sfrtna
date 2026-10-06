"use client";

import { useMemo, useState } from "react";
import type { Locale } from "@/lib/types";
import { CURRENCIES, findCurrency } from "@/lib/currencies";
import SearchableSelect, { type SearchableOption } from "@/components/SearchableSelect";
import { googleRateUrl, rateBetween, type Rates } from "@/lib/rates";
import { track } from "@/lib/analytics";

interface ConverterDict {
  amount: string;
  from: string;
  to: string;
  swap: string;
  searchPlaceholder: string;
  noMatches: string;
  rateLine: string;
  inverseLine: string;
  checkOnGoogle: string;
  googleHint: string;
  unavailable: string;
  pairUnavailable: string;
  disclaimer: string;
}

/**
 * The conversion runs entirely in the browser off one rates table fetched on
 * the server, so changing the amount or either currency is instant — no
 * request per keystroke, and no rate that shifts underneath the visitor
 * mid-edit.
 */
export default function CurrencyConverter({
  locale,
  rates,
  dict,
  initialFrom,
  initialTo,
}: {
  locale: Locale;
  /** Null when both rate feeds were unreachable. */
  rates: Rates | null;
  dict: ConverterDict;
  /**
   * The pair to open on. Set when the visitor arrived from somewhere that
   * already knows which two currencies they care about — the results page
   * sends the trip's own pair — so they land on their conversion rather than
   * having to re-pick it.
   */
  initialFrom?: string;
  initialTo?: string;
}) {
  const [amount, setAmount] = useState("100");
  // Riyal to dollar is the conversion a Saudi traveller reaches for most —
  // it's the pair almost every other rate is quoted through.
  const [from, setFrom] = useState(() => (initialFrom && findCurrency(initialFrom) ? initialFrom.toUpperCase() : "SAR"));
  const [to, setTo] = useState(() => (initialTo && findCurrency(initialTo) ? initialTo.toUpperCase() : "USD"));

  const fromCurrency = findCurrency(from);
  const toCurrency = findCurrency(to);

  // An empty or half-typed box shouldn't flash "NaN" at the reader; it just
  // means there's nothing to convert yet.
  const parsedAmount = Number(amount.replace(/,/g, ""));
  const validAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;

  const rate = useMemo(
    () => (rates ? rateBetween(from, to, rates) : null),
    [rates, from, to]
  );

  // Arabic gets Latin digits on purpose. Prices, bank statements and exchange
  // boards across the Gulf are written in Latin numerals, and the amount box
  // above is typed in them — formatting the answer in Arabic-Indic digits
  // would make the two halves of the same calculation look unrelated.
  const nf = (value: number, decimals: number) =>
    new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);

  // A rate is shown to more places than money is. "1 JPY = 0 SAR" is useless;
  // "1 JPY = 0.0251 SAR" is the number the traveller came for.
  const rateDecimals = (r: number) => (r >= 100 ? 2 : r >= 1 ? 4 : 6);

  const converted = rate === null ? null : validAmount * rate;

  function swap() {
    setFrom(to);
    setTo(from);
  }

  // The code is searchable as well as the name, so "SAR", "ريال" and "Riyal"
  // all find the same entry.
  const options: SearchableOption[] = CURRENCIES.map((c) => ({
    value: c.code,
    label: `${c.code} — ${locale === "ar" ? c.nameAr : c.nameEn}`,
    keywords: `${c.nameAr} ${c.nameEn}`,
  }));

  const QUICK_AMOUNTS = [100, 500, 1000, 5000];
  const ready = Boolean(rates && rate !== null && fromCurrency && toCurrency);

  // The two rows share one shape: the currency on one side, the amount on
  // the other, the same height, so the eye reads straight down.
  const row = "grid grid-cols-2 items-stretch gap-2 sm:grid-cols-[15rem_1fr]";
  const box = "h-14 rounded-xl px-4";

  return (
    <div>
      <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 sm:p-7">
        {/* From: currency and amount. */}
        <p className="mb-2 text-sm font-extrabold text-navy-900">{dict.from}</p>
        <div className={`relative z-30 ${row}`}>
          <SearchableSelect
            value={from}
            options={options}
            onChange={(code: string) => {
              setFrom(code);
              track("currency_convert", { from: code, to });
            }}
            label={dict.from}
            labelClassName="sr-only"
            buttonClassName="h-14"
            searchPlaceholder={dict.searchPlaceholder}
            emptyText={dict.noMatches}
          />
          <input
            // Not type="number": its spinner and locale-dependent decimal
            // handling get in the way on phones, and we parse the text
            // ourselves anyway.
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label={dict.amount}
            dir="ltr"
            className={`${box} w-full min-w-0 border border-gray-200 bg-white py-0 text-start leading-none font-display text-2xl font-black text-navy-900 outline-none transition focus:border-sun-400 focus:ring-4 focus:ring-sun-400/20`}
          />
        </div>
        <div className="mt-2 flex flex-wrap justify-end gap-1.5">
          {QUICK_AMOUNTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setAmount(String(n))}
              aria-pressed={validAmount === n}
              className={`rounded-full px-3 py-1 text-xs font-bold ring-1 transition ${
                validAmount === n ? "bg-navy-900 text-white ring-navy-900" : "bg-mist-50 text-navy-700 ring-mist-200 hover:ring-navy-300"
              }`}
            >
              {nf(n, 0)}
            </button>
          ))}
        </div>

        {/* Swap, on a rule between the two rows. */}
        <div className="relative z-20 my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-mist-200" />
          <button
            type="button"
            onClick={swap}
            aria-label={dict.swap}
            title={dict.swap}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-sun-400 text-navy-950 shadow-[var(--shadow-sun)] transition hover:rotate-180 hover:bg-sun-300"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L4 7m3-3l3 3M17 8v12m0 0l3-3m-3 3l-3-3" />
            </svg>
          </button>
          <span className="h-px flex-1 bg-mist-200" />
        </div>

        {/* To: currency and the result, in the same two columns. */}
        <p className="mb-2 text-sm font-extrabold text-navy-900">{dict.to}</p>
        <div className={`relative z-10 ${row}`}>
          <SearchableSelect
            value={to}
            options={options}
            onChange={(code: string) => {
              setTo(code);
              track("currency_convert", { from, to: code });
            }}
            label={dict.to}
            labelClassName="sr-only"
            buttonClassName="h-14"
            searchPlaceholder={dict.searchPlaceholder}
            emptyText={dict.noMatches}
          />
          <output
            dir="ltr"
            aria-live="polite"
            className={`${box} flex min-w-0 items-center bg-navy-900 font-display text-2xl font-black text-sun-300`}
          >
            <span className="truncate">{ready ? nf(converted as number, toCurrency!.decimals) : "—"}</span>
          </output>
        </div>

        {/* The rate, both ways, on one quiet line. */}
        <p className="mt-4 text-center text-sm font-bold text-navy-600" dir="ltr">
          {!rates
            ? null
            : ready
              ? `${dict.rateLine
                  .replace("{from}", fromCurrency!.code)
                  .replace("{rate}", nf(rate as number, rateDecimals(rate as number)))
                  .replace("{to}", toCurrency!.code)}   ·   ${dict.inverseLine
                  .replace("{to}", toCurrency!.code)
                  .replace("{rate}", nf(1 / (rate as number), rateDecimals(1 / (rate as number))))
                  .replace("{from}", fromCurrency!.code)}`
              : null}
        </p>
        {!rates && <p className="mt-4 text-center text-sm leading-relaxed text-navy-600">{dict.unavailable}</p>}
        {rates && !ready && <p className="mt-4 text-center text-sm leading-relaxed text-navy-600">{dict.pairUnavailable}</p>}

        <a
          href={googleRateUrl(validAmount || 1, from, to)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-mist-50 px-4 py-3 text-sm font-bold text-navy-800 ring-1 ring-mist-200 transition hover:ring-navy-300"
        >
          🔎 {dict.checkOnGoogle} ↗
        </a>
        <p className="mt-2 text-center text-xs text-navy-500">{dict.googleHint}</p>
      </div>

      <p className="mt-4 px-2 text-center text-xs leading-relaxed text-navy-500">{dict.disclaimer}</p>
    </div>
  );
}
