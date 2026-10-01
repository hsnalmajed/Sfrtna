"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Locale } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";
import { countLabel } from "@/lib/format";
import { formStyles, type FormTone } from "@/lib/formTone";
import { keepPopoverOnScreen } from "@/lib/popover";
import Icon from "@/components/ui/Icon";

/**
 * Departure and return, chosen in one calendar.
 *
 * The native `<input type="date">` this replaces looked fine and was not.
 * Chromium renders its segments in the page's writing direction, so in an
 * Arabic form the DD/MM/YYYY box lays out right-to-left while the keyboard
 * still fills segments in visual order — type 12/11/2026 and you get the 11th
 * of December. A travel site that silently moves someone's flight by a month
 * has a worse bug than one that looks dated.
 *
 * It also could not express the thing the form is actually asking. Departure
 * and return are one decision, and two separate boxes let you pick a return
 * before the departure, or the same day twice, and then report it in a
 * validation message afterwards. A two-month grid where the second click is
 * always the return cannot produce either.
 *
 * So: no typing, one grid, and the chosen range written out in words
 * underneath — "الخميس ١٢ نوفمبر ← الثلاثاء ١٧ نوفمبر (٥ ليالٍ)" — because
 * the number a traveller is really checking is the number of nights, and no
 * date field has ever shown it.
 */

const MS_DAY = 86_400_000;

function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

function parseIso(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function todayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function nightsBetween(a: string, b: string): number {
  const d1 = parseIso(a);
  const d2 = parseIso(b);
  if (!d1 || !d2) return 0;
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / MS_DAY));
}

/**
 * Gregorian, with Latin digits, in Arabic.
 *
 * "ar-SA" alone would format in the Hijri calendar — 12 November would come
 * back as 21 Jumada al-Awwal, which is not the date the traveller picked and
 * not the one on their ticket.
 */
function localeTag(locale: Locale): string {
  return locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB";
}

function longDate(isoDate: string, locale: Locale): string {
  const d = parseIso(isoDate);
  if (!d) return "";
  return d.toLocaleDateString(localeTag(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function monthTitle(year: number, month: number, locale: Locale): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString(localeTag(locale), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Sunday-first weekday initials, taken from the locale rather than hardcoded. */
function weekdayNames(locale: Locale): string[] {
  const fmt = new Intl.DateTimeFormat(localeTag(locale), { weekday: locale === "ar" ? "narrow" : "short", timeZone: "UTC" });
  // 2024-01-07 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 7 + i))));
}

interface MonthGrid {
  year: number;
  month: number;
  /** Leading blanks then the days, so the first lands under its weekday. */
  cells: (string | null)[];
}

function buildMonth(year: number, month: number): MonthGrid {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(first.getUTCDay()).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(iso(new Date(Date.UTC(year, month, d))));
  return { year, month, cells };
}

export default function DateRangeInput({
  locale,
  departDate,
  returnDate,
  onChange,
  /** Hidden entirely for a one-way trip, where there is no second date. */
  withReturn = true,
  required = false,
  error,
  tone = "light",
  fareRoute,
}: {
  locale: Locale;
  departDate: string;
  returnDate: string;
  onChange: (next: { departDate: string; returnDate: string }) => void;
  withReturn?: boolean;
  required?: boolean;
  error?: string;
  /** Only the trigger changes; the calendar popover stays light. */
  tone?: FormTone;
  /**
   * Write the cheapest fare seen under each day: out on the departure pass,
   * back on the return pass (/api/day-fares). Omitted, or with either end
   * empty, the calendar is plain.
   */
  fareRoute?: { origin: string; destination: string; currency?: string };
}) {
  const dict = getDictionary(locale);
  const isAr = locale === "ar";
  const [open, setOpen] = useState(false);
  // Which end the next click sets. Always "depart" when the panel opens, so
  // a second visit starts a new range rather than editing half of the old one.
  const [picking, setPicking] = useState<"depart" | "return">("depart");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const today = useMemo(() => iso(todayUtc()), []);

  const [cursor, setCursor] = useState(() => {
    const start = parseIso(departDate) ?? todayUtc();
    return { year: start.getUTCFullYear(), month: start.getUTCMonth() };
  });

  // Fares seen per day, by "FROM>TO:YYYY-MM" → { "YYYY-MM-DD": price }.
  const [fareTable, setFareTable] = useState<Record<string, Record<string, number>>>({});
  const fareFrom = fareRoute ? (picking === "return" && withReturn ? fareRoute.destination : fareRoute.origin).trim() : "";
  const fareTo = fareRoute ? (picking === "return" && withReturn ? fareRoute.origin : fareRoute.destination).trim() : "";
  const fareCurrency = (fareRoute?.currency || "SAR").toUpperCase();

  // Close on an outside click or Escape. Subscribe-only: no state is written
  // in the effect body.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const months = useMemo(() => {
    const a = buildMonth(cursor.year, cursor.month);
    const nextMonth = cursor.month === 11 ? 0 : cursor.month + 1;
    const nextYear = cursor.month === 11 ? cursor.year + 1 : cursor.year;
    return [a, buildMonth(nextYear, nextMonth)];
  }, [cursor]);

  const monthKeys = months.map((m) => `${m.year}-${String(m.month + 1).padStart(2, "0")}`);
  const fareKey = (month: string) => `${fareFrom}>${fareTo}:${fareCurrency}:${month}`;
  useEffect(() => {
    if (!open || !fareFrom || !fareTo || fareFrom === fareTo) return;
    let live = true;
    for (const month of monthKeys) {
      const key = fareKey(month);
      if (key in fareTable) continue;
      const qs = new URLSearchParams({ origin: fareFrom, destination: fareTo, month, currency: fareCurrency });
      fetch(`/api/day-fares?${qs}`)
        .then((r) => (r.ok ? r.json() : { fares: {} }))
        .then((body: { fares?: Record<string, number> }) => {
          if (live) setFareTable((t) => ({ ...t, [key]: body.fares ?? {} }));
        })
        .catch(() => {
          if (live) setFareTable((t) => ({ ...t, [key]: {} }));
        });
    }
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fareFrom, fareTo, fareCurrency, monthKeys.join(",")]);

  const visibleFares: Record<string, number> = {};
  for (const month of monthKeys) Object.assign(visibleFares, fareTable[fareKey(month)] ?? {});
  const futureFares = Object.entries(visibleFares).filter(([day]) => day >= today);
  const cheapest = futureFares.length ? Math.min(...futureFares.map(([, p]) => p)) : null;
  const showFares = Boolean(fareFrom && fareTo && fareFrom !== fareTo);
  const compact = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : n.toLocaleString("en-US"));

  const weekdays = useMemo(() => weekdayNames(locale), [locale]);
  const nights = withReturn && departDate && returnDate ? nightsBetween(departDate, returnDate) : 0;

  function step(delta: number) {
    setCursor((c) => {
      const m = c.month + delta;
      if (m < 0) return { year: c.year - 1, month: 11 };
      if (m > 11) return { year: c.year + 1, month: 0 };
      return { year: c.year, month: m };
    });
  }

  function pick(day: string) {
    if (!withReturn) {
      onChange({ departDate: day, returnDate: "" });
      setOpen(false);
      return;
    }
    if (picking === "depart") {
      // Starting a new range always clears the old return — otherwise a
      // departure after the existing return leaves an impossible pair on
      // screen until the next click.
      onChange({ departDate: day, returnDate: "" });
      setPicking("return");
      return;
    }
    // A return on or before the departure is not a correction to warn about;
    // it is a new departure. Treating it that way is what a traveller means.
    if (day <= departDate) {
      onChange({ departDate: day, returnDate: "" });
      setPicking("return");
      return;
    }
    onChange({ departDate, returnDate: day });
    setPicking("depart");
    setOpen(false);
  }

  const summary = departDate
    ? withReturn && returnDate
      ? `${longDate(departDate, locale)} ${isAr ? "←" : "→"} ${longDate(returnDate, locale)} · ${countLabel(
          nights,
          {
            one: dict.results.nightsOne,
            two: dict.results.nightsTwo,
            few: dict.results.nightsFew,
            many: dict.results.nightsMany,
          }
        )}`
      : longDate(departDate, locale)
    : "";

  const dayClass = (day: string) => {
    const disabled = day < today;
    const isStart = day === departDate;
    const isEnd = withReturn && day === returnDate;
    const inRange =
      withReturn && departDate && returnDate && day > departDate && day < returnDate;

    if (disabled) return "text-mist-300 cursor-not-allowed";
    if (isStart || isEnd) return "bg-sun-400 font-extrabold text-navy-950";
    if (inRange) return "bg-sun-100 text-navy-800";
    return "text-navy-700 hover:bg-mist-100";
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setPicking("depart");
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-controls={panelId}
        className={`${formStyles(tone).input} flex items-center justify-between gap-3 text-start ${
          error ? "!border-red-400" : ""
        }`}
      >
        <span
          className={
            departDate
              ? tone === "dark"
                ? "text-white"
                : "text-navy-900"
              : tone === "dark"
                ? "text-white/45"
                : "text-navy-400"
          }
        >
          {summary || (withReturn ? dict.form.pickDates : dict.form.pickDate)}
        </span>
        <Icon name="calendar" className={`h-4 w-4 ${tone === "dark" ? "text-white/55" : "text-navy-400"}`} />
      </button>

      {/* A hidden required field, so the browser's own form validation still
          blocks an empty submit even though there is no text input. */}
      {required && (
        <input
          type="text"
          required
          value={departDate}
          onChange={() => {}}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      )}

      {open && (
        <div
          id={panelId}
          ref={keepPopoverOnScreen}
          className="absolute z-30 mt-2 w-[19rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-mist-200 bg-white p-4 shadow-[var(--shadow-lift)] sm:w-[34rem]"
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={dict.form.previousMonth}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-navy-600 transition hover:bg-mist-100"
            >
              {isAr ? "›" : "‹"}
            </button>
            <p className="flex items-center gap-1.5 text-sm font-bold text-navy-900">
              {withReturn ? (
                <>
                  {dict.form.pickLead}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-black ${
                      picking === "depart" ? "bg-sun-400 text-navy-950" : "bg-sea-600 text-white"
                    }`}
                  >
                    <span aria-hidden="true">{picking === "depart" ? "🛫" : "🛬"}</span>
                    {picking === "depart" ? dict.form.legDepart : dict.form.legReturn}
                  </span>
                </>
              ) : (
                dict.form.departDate
              )}
            </p>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label={dict.form.nextMonth}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-navy-600 transition hover:bg-mist-100"
            >
              {isAr ? "‹" : "›"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {months.map((m, i) => (
              <div key={`${m.year}-${m.month}`} className={i === 1 ? "hidden sm:block" : undefined}>
                <p className="mb-2 text-center text-xs font-bold text-navy-700">
                  {monthTitle(m.year, m.month, locale)}
                </p>
                <div className="grid grid-cols-7 gap-0.5">
                  {weekdays.map((w, wi) => (
                    <span
                      key={wi}
                      className="pb-1 text-center text-2xs font-bold text-navy-400"
                      aria-hidden="true"
                    >
                      {w}
                    </span>
                  ))}
                  {m.cells.map((day, ci) =>
                    day === null ? (
                      <span key={`b${ci}`} />
                    ) : (
                      <button
                        key={day}
                        type="button"
                        disabled={day < today}
                        onClick={() => pick(day)}
                        aria-label={longDate(day, locale)}
                        aria-pressed={day === departDate || day === returnDate}
                        className={`flex flex-col items-center justify-center rounded-lg text-xs tabular-nums transition ${
                          showFares ? "h-11" : "h-9"
                        } ${dayClass(day)}`}
                      >
                        <span>{Number(day.slice(8))}</span>
                        {showFares && day >= today && visibleFares[day] !== undefined && (
                          <span
                            className={`text-[9px] leading-tight ${
                              visibleFares[day] === cheapest
                                ? "rounded bg-emerald-600 px-1 font-black text-white"
                                : day === departDate || day === returnDate
                                  ? "font-bold text-navy-900"
                                  : "font-semibold text-navy-500"
                            }`}
                          >
                            {compact(visibleFares[day])}
                          </span>
                        )}
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>

          {showFares && Object.keys(visibleFares).length > 0 && (
            <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] leading-relaxed text-emerald-900 ring-1 ring-emerald-100">
              <span aria-hidden="true">💡</span>
              <span>
                {dict.form.fareLegend.replace("{currency}", fareCurrency === "SAR" && isAr ? "ر.س" : fareCurrency)}
                {picking === "return" && withReturn ? ` · ${dict.form.fareLegendReturn}` : ""}
              </span>
            </p>
          )}

          {summary && (
            <p className="mt-3 border-t border-mist-200 pt-3 text-center text-xs font-semibold text-navy-600">
              {summary}
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
