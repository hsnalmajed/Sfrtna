"use client";

import { useEffect, useState } from "react";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import { type Currency } from "@/lib/currencies";
import { flagImageUrl } from "@/lib/visaProviders";
import { googleRateUrl } from "@/lib/rates";

/**
 * A flag drawn as an image, not an emoji.
 *
 * Windows ships no flag glyphs, so 🇸🇦 renders there as the bare letters
 * "SA" — which is why the rest of the site already draws flags from flagcdn.
 * Declared at module scope: a component defined inside a render is a new
 * type on every pass and remounts on each one.
 */
function Flag({ currency }: { currency: Currency }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- flag CDN, and the
       app runs with the Next image optimizer disabled on Workers. */
    <img
      src={flagImageUrl(currency.country, 80)}
      alt=""
      loading="lazy"
      className="inline-block h-4 w-6 shrink-0 rounded-[3px] object-cover align-[-2px] ring-1 ring-black/10"
    />
  );
}

/**
 * What your money is worth where you're going.
 *
 * Someone flying Riyadh → Istanbul is about to think in a currency they don't
 * use, and the first question is always the same: what is a riyal worth in
 * lira? Answering it here, on the page where they're already looking at
 * prices, saves a trip to a converter and stops them landing without a feel
 * for the numbers.
 *
 * Both directions are given, because travellers use them for different
 * things — one riyal in lira to price a coffee, a hundred lira in riyals to
 * check a taxi fare. And the strip says plainly that this is the mid-market
 * reference rate: it is not what an exchange counter hands over, and someone
 * budgeting off it should know that before they land, not after.
 */
export default function TripCurrencyStrip({
  from,
  to,
  locale,
}: {
  from: Currency;
  to: Currency;
  locale: Locale;
}) {
  const dict = getDictionary(locale);
  const [rate, setRate] = useState<number | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // The converter opens in place. Sending someone to the currency page to
  // work out one number meant losing the results they were reading, and the
  // back button as the only way home.
  const [converting, setConverting] = useState(false);
  const [amount, setAmount] = useState("");
  // Which way round. Both directions get used — one to price a coffee, the
  // other to check a taxi fare — so neither can be the only one offered.
  const [reversed, setReversed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rates?from=${from.code}&to=${to.code}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((d: { rate: number | null; source: string | null }) => {
        if (cancelled) return;
        if (d.rate == null) setFailed(true);
        else {
          setRate(d.rate);
          setSource(d.source);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [from.code, to.code]);

  // Nothing useful to say yet, and a skeleton here would only push the prices
  // down the page.
  if (failed || rate == null) return null;

  const name = (c: Currency) => (locale === "ar" ? c.nameAr : c.nameEn);

  const fmt = (value: number, decimals: number) =>
    value.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  // A hundred of the destination's money is the useful reverse figure: one
  // lira in riyals rounds to almost nothing and tells a traveller less than
  // the price of a taxi does.
  const reverse = 100 / rate;

  // Which currency the typed number is in, and which it comes out in.
  const source_ = reversed ? to : from;
  const target = reversed ? from : to;
  const typed = Number(amount.replace(/,/g, ""));
  const hasAmount = amount.trim() !== "" && Number.isFinite(typed) && typed > 0;
  const converted = hasAmount ? (reversed ? typed / rate : typed * rate) : null;

  return (
    <section className="h-full rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div>
          <p className="text-xs font-bold text-navy-500">{dict.results.currencyHeading}</p>

          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-lg font-extrabold text-gray-900">
            <Flag currency={from} />
            <span>
              1 {name(from)} ={" "}
              <span className="text-brand-800">
                {fmt(rate, to.decimals)} {name(to)}
              </span>
            </span>
            <Flag currency={to} />
          </p>

          <p className="mt-1 text-sm text-gray-500">
            100 {name(to)} ={" "}
            <span className="font-bold text-gray-700">
              {fmt(reverse, from.decimals)} {name(from)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-expanded={converting}
            onClick={() => setConverting((v) => !v)}
            className="rounded-xl border border-brand-200 px-4 py-2.5 text-sm font-bold text-brand-800 transition hover:bg-brand-50"
          >
            {converting ? dict.results.currencyConvertClose : dict.results.currencyConvert}
          </button>
          <a
            href={googleRateUrl(hasAmount ? typed : 1, source_.code, target.code)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:border-gray-300"
          >
            {dict.currency.checkOnGoogle}
          </a>
        </div>
      </div>

      {converting && (
        <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[10rem] flex-1">
              <label
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500"
                htmlFor="trip-convert-amount"
              >
                {dict.currency.amount} · {name(source_)}
              </label>
              <input
                id="trip-convert-amount"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={dict.results.currencyAmountPlaceholder}
                className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-bold text-gray-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              />
            </div>

            <button
              type="button"
              onClick={() => setReversed((v) => !v)}
              title={dict.currency.swap}
              aria-label={dict.currency.swap}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-600 transition hover:border-brand-300 hover:text-brand-800"
            >
              ⇄
            </button>

            <div className="min-w-[10rem] flex-1">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {name(target)}
              </p>
              <p className="rounded-lg border border-transparent bg-white/70 px-3.5 py-2.5 text-sm font-extrabold text-brand-900">
                {converted == null ? "—" : `${fmt(converted, target.decimals)} ${name(target)}`}
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-gray-400">
        {dict.results.currencyNote}
        {source ? ` · ${source}` : ""}
      </p>
    </section>
  );
}
