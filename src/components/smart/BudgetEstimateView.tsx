"use client";

import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { countLabel } from "@/lib/format";
import type { BudgetEstimate, EstimateList, Range, Style } from "@/lib/ai/budgetEstimate";

function useMoney(locale: Locale) {
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", { maximumFractionDigits: 0 });
  return (n: number, currency: string) => `⁨${nf.format(Math.round(n))} ${currency}⁩`;
}

/** No destination yet: the cheapest places for the dates, each one tap from its own estimate. */
export function EstimatePicker({ locale, list, onPick }: { locale: Locale; list: EstimateList; onPick: (code: string) => void }) {
  const t = useDictionary().budgetAdvisor;
  const money = useMoney(locale);
  return (
    <section className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 sm:p-6">
      <h2 className="font-display text-lg font-extrabold text-navy-950">{t.pickTitle}</h2>
      <p className="mt-1 text-sm text-navy-600">{list.options.length ? t.pickHint : t.pickNone}</p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {list.options.map((o) => (
          <li key={o.code}>
            <button
              type="button"
              onClick={() => onPick(o.code)}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-mist-50 px-4 py-2.5 text-start ring-1 ring-mist-200 hover:ring-navy-300"
            >
              <span className="min-w-0">
                <span className="block truncate font-extrabold text-navy-950">
                  <span aria-hidden="true">{o.emoji}</span> {locale === "ar" ? o.nameAr : o.nameEn}
                </span>
                <span className="text-xs font-bold text-sea-700">{t.pickThis} ←</span>
              </span>
              <span className="shrink-0 font-display text-sm font-black text-navy-900">{money(o.price, list.currency)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tag({ live, children }: { live: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-extrabold ${live ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"}`}>
      {children}
    </span>
  );
}

export default function BudgetEstimateView({
  locale,
  est,
  onUse,
  onStyle,
  onAdjust,
  hotelHref,
}: {
  locale: Locale;
  est: BudgetEstimate;
  onUse: (budget: number, flightShare: number) => void;
  onStyle: (s: Style) => void;
  onAdjust: () => void;
  /** The hotel results for these dates, when no live hotel price came back. */
  hotelHref: string;
}) {
  const t = useDictionary().budgetAdvisor;
  const money = useMoney(locale);
  const m = (n: number) => money(n, est.currency);
  const r = (x: Range) => `${m(x.low)}–${m(x.high)}`;
  const city = locale === "ar" ? est.city.nameAr : est.city.nameEn;
  const nights = countLabel(est.nights, t.nightsShapes);
  const people = countLabel(est.travellers, t.peopleShapes);
  const d = est.daily;
  const perDay = (x: Range) => t.perDay.replace("{low}", m(x.low)).replace("{high}", m(x.high));
  const dailyTrip = d
    ? {
        low: ((d.food.low + d.transport.low + d.activities.low) * est.nights + d.extras.reduce((s, e) => s + e.low, 0)) * est.travellers,
        high: ((d.food.high + d.transport.high + d.activities.high) * est.nights + d.extras.reduce((s, e) => s + e.high, 0)) * est.travellers,
      }
    : null;
  const flightShare = est.flight && est.hotel ? Math.round((est.flight.price / (est.flight.price + est.hotel.typical)) * 100) : 40;
  const complete = est.missing.length === 0;
  const row = "rounded-2xl bg-mist-50 px-4 py-3 ring-1 ring-mist-200";

  return (
    <section className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 sm:p-6">
      <h2 className="font-display text-xl font-extrabold text-navy-950">{t.resultTitle.replace("{city}", city)}</h2>
      <p className="mt-1 text-sm font-bold text-navy-600">
        {t.resultSub.replace("{nights}", nights).replace("{travellers}", people).replace("{style}", t.styles[est.style])}
      </p>

      {/* The answer first. */}
      <div className="mt-4 rounded-3xl bg-navy-950 px-5 py-4 text-white">
        {complete ? (
          <>
            <p className="text-sm font-bold text-white/70">{t.recommended}</p>
            <p className="mt-1 font-display text-3xl font-black text-sun-300">{m(est.total.recommended)}</p>
            <p className="mt-1 text-sm text-white/85">{t.rangeLabel.replace("{low}", m(est.total.low)).replace("{high}", m(est.total.high))}</p>
            <p className="mt-1 text-xs text-white/60">{t.recommendedHint}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-white/70">{t.soFar}</p>
            <p className="mt-1 font-display text-3xl font-black text-sun-300">{est.total.low === est.total.high ? m(est.total.high) : `${m(est.total.low)}–${m(est.total.high)}`}</p>
            <p className="mt-2 text-xs font-bold text-amber-200">
              ⚠️ {t.notIncluded} {est.missing.map((k) => t.parts[k]).join(locale === "ar" ? " و" : ", ")}
            </p>
          </>
        )}
      </div>

      <div className="mt-4 space-y-2.5">
        <div className={row}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-extrabold text-navy-950">✈️ {t.flightRow}</p>
            {est.flight && <p className="font-display font-black text-navy-950">{m(est.flight.price)}</p>}
          </div>
          {est.flight ? (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-navy-600">
              <Tag live>{t.live}</Tag>
              {t.flightBasis}
              {est.flight.stops != null && ` · ${est.flight.stops === 0 ? t.direct0 : t.stopsN.replace("{n}", String(est.flight.stops))}`}
              {est.flight.airline && ` · ${est.flight.airline}`}
            </p>
          ) : (
            <p className="mt-1 text-xs text-navy-600">{t.noFlight}</p>
          )}
        </div>

        <div className={row}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-extrabold text-navy-950">🏨 {t.hotelRow}</p>
            {est.hotel && <p className="font-display font-black text-navy-950">{t.hotelFrom.replace("{low}", m(est.hotel.low)).replace("{typical}", m(est.hotel.typical))}</p>}
          </div>
          {est.hotel ? (
            <>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-navy-600">
                <Tag live>{t.live}</Tag>
                {t.hotelBasis.replace("{nights}", nights).replace("{rooms}", countLabel(est.hotel.rooms, t.roomsShapes)).replace("{stars}", String(est.hotel.stars))}
              </p>
              {est.hotel.examples.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-navy-700">
                  <li className="font-bold text-navy-500">{t.hotelExamples}</li>
                  {est.hotel.examples.map((h) => (
                    <li key={h.name} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate" dir="auto">
                        {h.name}
                        {h.rating ? ` · ⭐ ${h.rating.toFixed(1)}` : ""}
                      </span>
                      <span className="shrink-0 font-bold">{m(h.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <p className="mt-1 text-xs text-navy-600">{t.noHotel}</p>
              <a href={hotelHref} className="mt-2 inline-flex min-h-10 items-center rounded-full bg-navy-900 px-4 text-sm font-extrabold text-white">
                🏨 {t.seeHotels}
              </a>
            </>
          )}
        </div>

        {d && dailyTrip ? (
          <div className={row}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-extrabold text-navy-950">🍽️ {t.foodRow} · 🚇 {t.transportRow} · 🎟️ {t.activitiesRow}</p>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-navy-600">
              <Tag live={false}>{t.estimateTag}</Tag>
              {d.basis}
            </p>
            <dl className="mt-2 space-y-1 text-[13px]">
              {(
                [
                  ["🍽️", t.foodRow, perDay(d.food)],
                  ["🚇", t.transportRow, perDay(d.transport)],
                  ["🎟️", t.activitiesRow, perDay(d.activities)],
                  ...d.extras.map((e) => ["➕", e.label, t.perPerson.replace("{low}", m(e.low)).replace("{high}", m(e.high))] as const),
                ] as const
              ).map(([icon, label, val]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="min-w-0 text-navy-700">
                    <span aria-hidden="true">{icon}</span> {label}
                  </dt>
                  <dd className="shrink-0 font-bold text-navy-900">{val}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-mist-200 pt-1.5">
                <dt className="font-extrabold text-navy-900">{t.dailyTotal}</dt>
                <dd className="shrink-0 font-display font-black text-navy-950">{r(dailyTrip)}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className={`${row} text-xs text-navy-600`}>{t.noDaily}</p>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {complete && (
        <button
          type="button"
          onClick={() => onUse(est.total.recommended, Math.min(80, Math.max(20, Math.round(flightShare / 5) * 5)))}
          className="min-h-12 flex-1 rounded-full bg-sun-400 px-6 font-extrabold text-navy-950 shadow-[var(--shadow-sun)] hover:bg-sun-300"
        >
          {t.useIt}
        </button>
        )}
        <button type="button" onClick={onAdjust} className="min-h-12 rounded-full bg-white px-6 font-bold text-navy-800 ring-1 ring-mist-300">
          {t.adjust}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-navy-600">
        <span>{t.otherStyle}</span>
        {(["budget", "mid", "luxury"] as Style[])
          .filter((s) => s !== est.style)
          .map((s) => (
            <button key={s} type="button" onClick={() => onStyle(s)} className="min-h-9 rounded-full bg-white px-3 ring-1 ring-mist-300 hover:ring-navy-300">
              {t.styles[s]}
            </button>
          ))}
      </div>

      {d && d.tips.length > 0 && (
        <div className="mt-5 rounded-2xl bg-sea-50 px-4 py-3 ring-1 ring-sea-100">
          <p className="text-sm font-extrabold text-sea-900">💡 {t.tips.replace("{city}", city)}</p>
          <ul className="mt-1.5 list-disc space-y-1 ps-5 text-[13px] leading-relaxed text-sea-950">
            {d.tips.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {d && d.sources.length > 0 && (
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer font-bold text-navy-600">🔗 {t.sources}</summary>
          <ul className="mt-2 space-y-1">
            {d.sources.map((s) => (
              <li key={s.url} className="truncate">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-sea-700 hover:underline" dir="auto">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
