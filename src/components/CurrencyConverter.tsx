"use client";

import { useMemo, useState } from "react";
import type { Locale } from "@/lib/types";
import { CURRENCIES, findCurrency } from "@/lib/currencies";
import SearchableSelect, { type SearchableOption } from "@/components/SearchableSelect";
import { googleRateUrl, rateBetween, type Rates } from "@/lib/rates";

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

  return (
    <div>
      <div className="overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-card)] ring-1 ring-navy-950/5">
        <div className="p-4 sm:p-6">
          {/* What you have: the currency, then the amount, large. */}
          <div className="relative z-30 rounded-2xl bg-mist-50 p-4 ring-1 ring-mist-200 sm:p-5">
            <SearchableSelect
              value={from}
              options={options}
              onChange={setFrom}
              label={dict.from}
              labelClassName="text-navy-600"
              searchPlaceholder={dict.searchPlaceholder}
              emptyText={dict.noMatches}
            />
            <label className="mt-4 block">
              <span className="sr-only">{dict.amount}</span>
              <span className="flex items-baseline gap-2 border-b-2 border-mist-200 pb-1 transition focus-within:border-sun-400" dir="ltr">
                <input
                  // Not type="number": its spinner and locale-dependent decimal
                  // handling get in the way on phones, and we parse the text
                  // ourselves anyway.
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-label={dict.amount}
                  className="w-full min-w-0 bg-transparent font-display text-4xl font-black text-navy-900 outline-none"
                />
                <span className="shrink-0 text-lg font-extrabold text-navy-400">{from}</span>
              </span>
            </label>
            <div className="mt-3 flex flex-wrap gap-1.5" dir="ltr">
              {QUICK_AMOUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAmount(String(n))}
                  aria-pressed={validAmount === n}
                  className={`rounded-full px-3 py-1 text-xs font-bold ring-1 transition ${
                    validAmount === n
                      ? "bg-navy-900 text-white ring-navy-900"
                      : "bg-white text-navy-700 ring-mist-200 hover:ring-navy-300"
                  }`}
                >
                  {nf(n, 0)}
                </button>
              ))}
            </div>
          </div>

          {/* Swap, sitting on the seam between the two halves. */}
          <div className="relative z-20 -my-3 flex justify-center">
            <button
              type="button"
              onClick={swap}
              aria-label={dict.swap}
              title={dict.swap}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-sun-400 text-navy-950 shadow-[var(--shadow-sun)] ring-4 ring-white transition hover:rotate-180 hover:bg-sun-300"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L4 7m3-3l3 3M17 8v12m0 0l3-3m-3 3l-3-3" />
              </svg>
            </button>
          </div>

          {/* What you get. */}
          <div className="relative z-10 rounded-2xl bg-gradient-to-br from-navy-900 to-navy-990 p-4 pt-6 text-white sm:p-5 sm:pt-7">
            <SearchableSelect
              value={to}
              options={options}
              onChange={setTo}
              label={dict.to}
              labelClassName="text-white/80"
              searchPlaceholder={dict.searchPlaceholder}
              emptyText={dict.noMatches}
            />
            {!rates ? (
              <p className="mt-4 text-sm leading-relaxed text-white/85">{dict.unavailable}</p>
            ) : !ready ? (
              <p className="mt-4 text-sm leading-relaxed text-white/85">{dict.pairUnavailable}</p>
            ) : (
              <p className="mt-4 flex items-baseline gap-2 font-display text-4xl font-black tracking-tight text-sun-300 sm:text-5xl" dir="ltr">
                {nf(converted as number, toCurrency!.decimals)}
                <span className="text-lg font-extrabold text-white/70">{toCurrency!.code}</span>
              </p>
            )}
          </div>

          {/* Both directions of the rate. */}
          {ready && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2" dir="ltr">
              {[
                dict.rateLine
                  .replace("{from}", fromCurrency!.code)
                  .replace("{rate}", nf(rate as number, rateDecimals(rate as number)))
                  .replace("{to}", toCurrency!.code),
                dict.inverseLine
                  .replace("{to}", toCurrency!.code)
                  .replace("{rate}", nf(1 / (rate as number), rateDecimals(1 / (rate as number))))
                  .replace("{from}", fromCurrency!.code),
              ].map((line) => (
                <p key={line} className="rounded-xl bg-sea-50 px-3 py-2.5 text-center text-sm font-bold text-navy-800 ring-1 ring-sea-100">
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1.5 border-t border-mist-200 bg-mist-50 px-4 py-4 text-center sm:flex-row sm:justify-between sm:text-start">
          <p className="text-xs leading-relaxed text-navy-500">{dict.googleHint}</p>
          <a
            href={googleRateUrl(validAmount || 1, from, to)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-navy-800 ring-1 ring-mist-300 transition hover:ring-navy-300"
          >
            🔎 {dict.checkOnGoogle} ↗
          </a>
        </div>
      </div>

      <p className="mt-4 px-2 text-center text-xs leading-relaxed text-navy-500">ℹ️ {dict.disclaimer}</p>
    </div>
  );
}
