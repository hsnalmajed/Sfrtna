"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import { type Currency } from "@/lib/currencies";
import { flagImageUrl } from "@/lib/visaProviders";
import { googleRateUrl } from "@/lib/rates";

/** A flag as an image: Windows has no flag emoji. */
function Flag({ currency }: { currency: Currency }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- flag CDN; the
       app runs with the Next image optimizer disabled on Workers. */
    <img
      src={flagImageUrl(currency.country, 80)}
      alt=""
      loading="lazy"
      className="inline-block h-4 w-6 shrink-0 rounded-[3px] object-cover ring-1 ring-black/10"
    />
  );
}

/**
 * The trip's money in one line, in the results band: what one riyal is in
 * the destination's currency — and a button that opens the converter over
 * the page, both ways round, so no one leaves their results to work out a
 * price. Nothing shows until the rate has come back.
 */
export default function TripCurrencyInline({
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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rates?from=${from.code}&to=${to.code}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((d: { rate: number | null; source: string | null }) => {
        if (cancelled || d.rate == null) return;
        setRate(d.rate);
        setSource(d.source);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [from.code, to.code]);

  if (rate == null) return null;
  const name = (c: Currency) => (locale === "ar" ? c.nameAr : c.nameEn);
  // In the band's single line: "ريال سعودي", not "الريال السعودي".
  const short = (c: Currency) => (locale === "ar" ? c.nameAr.replace(/(^|\s)ال/g, "$1") : c.nameEn);
  const fmt = (value: number, decimals: number) =>
    value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  return (
    <>
      <span className="inline-flex shrink-0 items-center overflow-hidden whitespace-nowrap rounded-full bg-white/10 text-[13px] font-bold text-white ring-1 ring-white/15">
        <span className="inline-flex items-center gap-2 px-3 py-1.5">
          <Flag currency={to} />
          <span>
            1 {short(from)} = <span className="text-sun-400">{fmt(rate, to.decimals)} {short(to)}</span>
          </span>
        </span>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 self-stretch border-s border-white/15 bg-white px-3 py-1.5 font-extrabold text-navy-950 transition hover:bg-sun-100"
        >
          {dict.results.currencyConvert}
        </button>
      </span>
      {open && (
        <ConverterDialog
          from={from}
          to={to}
          rate={rate}
          source={source}
          locale={locale}
          name={name}
          fmt={fmt}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ConverterDialog({
  from,
  to,
  rate,
  source,
  locale,
  name,
  fmt,
  onClose,
}: {
  from: Currency;
  to: Currency;
  rate: number;
  source: string | null;
  locale: Locale;
  name: (c: Currency) => string;
  fmt: (value: number, decimals: number) => string;
  onClose: () => void;
}) {
  const dict = getDictionary(locale);
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const inputId = useId();
  const [amount, setAmount] = useState("");
  const [reversed, setReversed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const source_ = reversed ? to : from;
  const target = reversed ? from : to;
  const typed = Number(amount.replace(/,/g, ""));
  const hasAmount = amount.trim() !== "" && Number.isFinite(typed) && typed > 0;
  const converted = hasAmount ? (reversed ? typed / rate : typed * rate) : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (!panelRef.current?.contains(e.target as Node)) onClose();
      }}
    >
      <div className="absolute inset-0 bg-navy-990/70 backdrop-blur-sm" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl"
      >
        {/* The rate, both ways round. */}
        <div className="relative bg-gradient-to-br from-navy-900 to-navy-990 px-5 pb-5 pt-5 text-white sm:px-6">
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-sun-300 to-sun-500" aria-hidden="true" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sun-400 text-xl" aria-hidden="true">
                💱
              </span>
              <div>
                <h2 id={headingId} className="font-display text-base font-extrabold">
                  {dict.results.currencyHeading}: {name(to)}
                </h2>
                <p className="text-xs text-white/60">{dict.results.currencyCardHint}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={dict.results.closeOptions}
              className="-me-1 rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <p className="mt-4 flex flex-wrap items-center gap-x-2 text-lg font-extrabold">
            <Flag currency={from} />
            <span>
              1 {name(from)} = <span className="text-sun-400">{fmt(rate, to.decimals)} {name(to)}</span>
            </span>
            <Flag currency={to} />
          </p>
          <p className="mt-1 text-sm text-white/70">
            100 {name(to)} = <span className="font-bold text-white">{fmt(100 / rate, from.decimals)} {name(from)}</span>
          </p>
        </div>

        {/* The converter. */}
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[9rem] flex-1">
              <label className="mb-1.5 block text-xs font-semibold text-navy-500" htmlFor={inputId}>
                {dict.currency.amount} · {name(source_)}
              </label>
              <input
                id={inputId}
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={dict.results.currencyAmountPlaceholder}
                className="w-full rounded-lg border border-mist-200 bg-white px-3.5 py-2.5 text-sm font-bold text-navy-950 shadow-sm outline-none transition focus:border-sea-500 focus:ring-4 focus:ring-sea-100"
              />
            </div>
            <button
              type="button"
              onClick={() => setReversed((v) => !v)}
              title={dict.currency.swap}
              aria-label={dict.currency.swap}
              className="rounded-lg border border-mist-200 bg-white px-3 py-2.5 text-sm font-bold text-navy-600 transition hover:border-navy-300 hover:text-navy-900"
            >
              ⇄
            </button>
            <div className="min-w-[9rem] flex-1">
              <p className="mb-1.5 text-xs font-semibold text-navy-500">{name(target)}</p>
              <p className="rounded-lg bg-mist-50 px-3.5 py-2.5 text-sm font-extrabold text-navy-950 ring-1 ring-mist-200">
                {converted == null ? "—" : `${fmt(converted, target.decimals)} ${name(target)}`}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs leading-relaxed text-navy-500">
              {dict.results.currencyNote}
              {source ? ` · ${source}` : ""}
            </p>
            <a
              href={googleRateUrl(hasAmount ? typed : 1, source_.code, target.code)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-sea-700 hover:underline"
            >
              {dict.currency.checkOnGoogle} ↗
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
