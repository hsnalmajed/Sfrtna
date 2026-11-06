"use client";

import { useMemo } from "react";

/**
 * «ميزانيتك (لليلة)» as Booking draws it (owner, 7 Nov): a bar chart of how
 * many hotels sit at each price, and a two-handled slider under it. Bars
 * inside the chosen range are dark, the rest light, so the traveller sees
 * how much of the list a budget keeps before letting go.
 *
 * `all` = every hotel's price a night (for the chart's span, so it does not
 * jump while the other filters change); `kept` = the prices the other
 * filters keep (the bars' heights).
 */
const BINS = 24;

export default function BudgetSlider({
  title,
  all,
  kept,
  value,
  onChange,
  format,
  resultLabel,
}: {
  title: string;
  all: number[];
  kept: number[];
  value: [number, number] | null;
  onChange: (v: [number, number] | null) => void;
  format: (n: number) => string;
  /** «{n} فندق» under the chart. */
  resultLabel: (n: number) => string;
}) {
  const prices = useMemo(() => all.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b), [all]);
  const step = prices.length && prices[prices.length - 1] > 3000 ? 50 : 10;
  const lo = prices.length ? Math.floor(prices[0] / step) * step : 0;
  const hi = prices.length ? Math.ceil(prices[prices.length - 1] / step) * step : 0;
  const bins = useMemo(() => {
    const out = new Array<number>(BINS).fill(0);
    if (hi <= lo) return out;
    for (const p of kept) {
      if (!Number.isFinite(p)) continue;
      out[Math.min(BINS - 1, Math.max(0, Math.floor(((p - lo) / (hi - lo)) * BINS)))]++;
    }
    return out;
  }, [kept, lo, hi]);
  if (prices.length < 4 || hi <= lo) return null;
  const [a, b] = value ?? [lo, hi];
  const peak = Math.max(1, ...bins);
  const inRange = kept.filter((p) => p >= a && p <= b).length;
  const set = (x: number, y: number) => {
    const low = Math.max(lo, Math.min(x, y));
    const high = Math.min(hi, Math.max(x, y));
    onChange(low <= lo && high >= hi ? null : [low, high]);
  };
  const pct = (n: number) => ((n - lo) / (hi - lo)) * 100;
  const thumb =
    "pointer-events-none absolute inset-x-0 top-0 h-6 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-navy-900 [&::-moz-range-thumb]:shadow [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-navy-900 [&::-webkit-slider-thumb]:shadow";
  return (
    <fieldset className="px-4 py-3">
      <legend className="mb-1 text-sm font-extrabold text-navy-950">
        <span aria-hidden="true">💰 </span>
        {title}
      </legend>
      <p className="mb-3 text-sm font-bold text-navy-800" dir="auto">
        <bdi>{format(a)}</bdi> – <bdi>{format(b)}</bdi>
        {b >= hi && "+"}
      </p>
      {/* The chart reads left-to-right (cheap → dear) in both languages, like the slider under it. */}
      <div dir="ltr">
        <div className="flex h-14 items-end gap-px" aria-hidden="true">
          {bins.map((n, i) => {
            const from = lo + ((hi - lo) * i) / BINS;
            const to = lo + ((hi - lo) * (i + 1)) / BINS;
            const on = to > a && from < b;
            return <span key={i} className={`flex-1 rounded-t-sm ${on ? "bg-navy-800" : "bg-mist-300"}`} style={{ height: n ? `${Math.max(8, (n / peak) * 100)}%` : "2px" }} />;
          })}
        </div>
        <div className="relative h-6">
          <div className="absolute inset-x-0 top-[11px] h-1 rounded-full bg-mist-200" />
          <div className="absolute top-[11px] h-1 rounded-full bg-navy-900" style={{ left: `${pct(a)}%`, right: `${100 - pct(b)}%` }} />
          <input
            type="range"
            min={lo}
            max={hi}
            step={step}
            value={a}
            onChange={(e) => set(Number(e.target.value), b)}
            aria-label={`${title} — min`}
            aria-valuetext={format(a)}
            className={thumb}
          />
          <input
            type="range"
            min={lo}
            max={hi}
            step={step}
            value={b}
            onChange={(e) => set(a, Number(e.target.value))}
            aria-label={`${title} — max`}
            aria-valuetext={format(b)}
            className={thumb}
          />
        </div>
      </div>
      <p className="mt-1 text-xs font-semibold text-navy-500">{resultLabel(inRange)}</p>
    </fieldset>
  );
}
