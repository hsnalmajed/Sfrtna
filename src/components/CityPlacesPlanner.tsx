"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import { countLabel } from "@/lib/format";
import { PIN_STYLES } from "@/lib/pinStyles";
import { downloadText, safeFileName, toKML } from "@/lib/mapExport";
import { GOOGLE_MY_MAPS_URL } from "@/lib/tripPlaces";
import CityPlacesExplorer, { score, type PlaceListItem } from "@/components/CityPlacesExplorer";
import PrintHeader from "@/components/PrintHeader";

/**
 * More than this in one day and the day is travelling, not visiting.
 *
 * The same figure the country guide uses, for the same reason: four stops is
 * already a full day once you add lunch and getting between them.
 */
const COMFORTABLE_ITEMS_PER_DAY = 4;

function hasCoords(p: PlaceListItem): boolean {
  return typeof p.lat === "number" && typeof p.lon === "number";
}

/** Straight-line kilometres between two places. */
function distanceKm(a: PlaceListItem, b: PlaceListItem): number {
  const R = 6371;
  const dLat = (((b.lat as number) - (a.lat as number)) * Math.PI) / 180;
  const dLon = (((b.lon as number) - (a.lon as number)) * Math.PI) / 180;
  const la1 = ((a.lat as number) * Math.PI) / 180;
  const la2 = ((b.lat as number) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** The furthest apart any two places in a day are. */
function spreadKm(day: PlaceListItem[]): number {
  const withCoords = day.filter(hasCoords);
  let max = 0;
  for (let i = 0; i < withCoords.length; i++) {
    for (let j = i + 1; j < withCoords.length; j++) {
      max = Math.max(max, distanceKm(withCoords[i], withCoords[j]));
    }
  }
  return max;
}

/**
 * Days made of places that are near each other.
 *
 * The old spread was round-robin in pick order, which put Hagia Sophia on
 * day one and Topkapı Palace on day two — two buildings you can see from
 * each other's steps. A day spent crossing a city and coming back is a worse
 * day than one spent in a neighbourhood, and the coordinates to know the
 * difference were already being fetched.
 *
 * The method is deliberately simple: walk from the place furthest from the
 * middle and repeatedly take the nearest unassigned place, filling one day
 * before starting the next. That produces geographic runs without pretending
 * to be a routing engine — we still have no opening hours and no travel
 * times, so "a sensible starting point" remains the honest claim.
 *
 * Places without coordinates (the hand-curated landmarks) are dealt out
 * afterwards to the lightest days, so they are never dropped.
 */
function groupByProximity(picked: PlaceListItem[], days: number): PlaceListItem[][] {
  const buckets: PlaceListItem[][] = Array.from({ length: days }, () => []);
  if (picked.length === 0 || days < 1) return buckets;

  const located = picked.filter(hasCoords);
  const unlocated = picked.filter((p) => !hasCoords(p));

  if (located.length === 0) {
    picked.forEach((item, i) => buckets[i % days].push(item));
    return buckets;
  }

  const perDay = Math.ceil(located.length / days);
  const remaining = [...located];

  // Start from the place furthest from the centre of gravity, so the first
  // day is an edge of the city rather than its middle — otherwise the last
  // day inherits whatever is left over on both sides.
  const midLat = located.reduce((n, p) => n + (p.lat as number), 0) / located.length;
  const midLon = located.reduce((n, p) => n + (p.lon as number), 0) / located.length;
  const centre = { lat: midLat, lon: midLon } as PlaceListItem;

  let cursor =
    remaining.sort((a, b) => distanceKm(centre, b) - distanceKm(centre, a))[0] ?? remaining[0];

  for (let day = 0; day < days && remaining.length > 0; day++) {
    for (let n = 0; n < perDay && remaining.length > 0; n++) {
      const idx = remaining.reduce(
        (best, p, i) => (distanceKm(cursor, p) < distanceKm(cursor, remaining[best]) ? i : best),
        0
      );
      const [next] = remaining.splice(idx, 1);
      buckets[day].push(next);
      cursor = next;
    }
  }
  // Anything left over (rounding) joins the lightest day.
  for (const leftover of remaining) {
    buckets.reduce((a, b) => (a.length <= b.length ? a : b)).push(leftover);
  }
  for (const p of unlocated) {
    buckets.reduce((a, b) => (a.length <= b.length ? a : b)).push(p);
  }
  return buckets;
}

type Interest = "sights" | "activities" | "shopping";
const SHOPPING_KINDS = new Set(["mall", "marketplace"]);
const MAX_DAYS = 21;

function interestOf(p: PlaceListItem): Interest | null {
  if (p.category === "historic") return "sights";
  if (p.category === "activity") return p.kind && SHOPPING_KINDS.has(p.kind) ? "shopping" : "activities";
  return null;
}

/** Days between two yyyy-mm-dd dates, both counted. */
function tripDays(from: string, to: string): number | null {
  if (!from || !to) return null;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000) + 1;
}

function addDays(iso: string, n: number): Date {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000);
}

interface Plan {
  source: "pick" | "auto";
  from: string;
  to: string;
  days: PlaceListItem[][];
  short: boolean;
}

/**
 * A city's places, turned into the traveller's own days — two ways.
 *
 *   "Build a plan from my picks": every card gets "Add to my plan"; a "My
 *   plan" button at the top collects them; the travel dates give the number
 *   of days; the picks are spread over them, each day's places near each
 *   other. Too many for the days is said plainly, with the advice, and the
 *   traveller can still have them all spread.
 *
 *   "Build me a plan": the dates and what they are into (sights, activities,
 *   shopping); we choose the best-documented places of those kinds and lay
 *   them out the same way.
 *
 * Either way the plan opens over the page, day by day with dates, with a
 * PDF (the browser's own print-to-PDF — JavaScript PDF libraries break
 * Arabic) on the site's letterhead, the locations as a file for Google Maps,
 * and each day's route opened in Google Maps.
 */
export default function CityPlacesPlanner({
  locale,
  places,
  cityName,
  countryCode,
  dict,
  onShowOnMap,
  showOnMapLabel,
}: {
  locale: Locale;
  places: PlaceListItem[];
  cityName: string;
  countryCode: string;
  countryName: string;
  dict: React.ComponentProps<typeof CityPlacesExplorer>["dict"];
  onShowOnMap?: (place: PlaceListItem) => void;
  showOnMapLabel?: string;
}) {
  const full = getDictionary(locale);
  const t = full.tripPlan;

  const [mode, setMode] = useState<"pick" | "auto" | null>(null);
  const [picked, setPicked] = useState<PlaceListItem[]>([]);
  const [basketOpen, setBasketOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [interests, setInterests] = useState<Interest[]>(["sights"]);
  const [plan, setPlan] = useState<Plan | null>(null);
  // The last add or remove, said out loud for a moment — a button changing
  // colour at the bottom of a card is easy to miss.
  const [toast, setToast] = useState<{ text: string; added: boolean; id: number } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const days = tripDays(from, to);
  const datesError = !from || !to ? t.datesNeeded : days === null || days < 1 ? t.datesInvalid : days > MAX_DAYS ? t.tooLong : null;

  const selectedKeys = useMemo(() => new Set(picked.map((p) => p.key)), [picked]);
  function toggle(place: PlaceListItem) {
    const removing = picked.some((p) => p.key === place.key);
    setPicked((current) =>
      current.some((p) => p.key === place.key) ? current.filter((p) => p.key !== place.key) : [...current, place]
    );
    setToast({
      text: (removing ? t.removedToast : t.addedToast).replace("{name}", place.name),
      added: !removing,
      id: (toast?.id ?? 0) + 1,
    });
  }

  const daysText = (n: number) =>
    countLabel(n, { one: t.daysOne, two: t.daysTwo, few: t.daysFew, many: t.daysMany });
  const placesText = (n: number) =>
    countLabel(n, { one: t.placesOne, two: t.placesTwo, few: t.placesFew, many: t.placesMany });

  const maxComfortable = days ? days * COMFORTABLE_ITEMS_PER_DAY : 0;
  const extra = days ? picked.length - maxComfortable : 0;

  function buildFromPicks() {
    if (!days || datesError || picked.length === 0) return;
    setPlan({ source: "pick", from, to, days: groupByProximity(picked, days), short: false });
    setBasketOpen(false);
  }

  function buildAuto() {
    if (!days || datesError || interests.length === 0) return;
    const target = days * COMFORTABLE_ITEMS_PER_DAY;
    const lists = interests.map((i) =>
      places.filter((p) => hasCoords(p) && interestOf(p) === i).sort((a, b) => score(b) - score(a))
    );
    // Taken in turn from each interest, best-documented first, so a plan for
    // "sights and shopping" is both rather than all of one.
    const chosen: PlaceListItem[] = [];
    for (let round = 0; chosen.length < target && lists.some((l) => l.length > round); round++) {
      for (const l of lists) if (l[round] && chosen.length < target) chosen.push(l[round]);
    }
    setPlan({ source: "auto", from, to, days: groupByProximity(chosen, days), short: chosen.length < days * 2 });
    setAutoOpen(false);
  }

  const card =
    "group flex flex-1 items-start gap-3 rounded-2xl bg-white/10 p-4 text-start ring-1 ring-white/20 transition hover:bg-white/15 hover:ring-sun-400/60";

  return (
    <div>
      {/* ---- The two ways in ---- */}
      <div className="print:hidden mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-navy-800 to-navy-990 p-5 text-white shadow-[var(--shadow-card)] sm:p-6">
        <p className="font-display text-xl font-extrabold">🧳 {t.startTitle.replace("{city}", cityName)}</p>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/70">{t.startBody}</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setMode("pick")}
            aria-pressed={mode === "pick"}
            className={`${card} ${mode === "pick" ? "!bg-sun-400 !text-navy-950 !ring-sun-400" : ""}`}
          >
            <span className="text-2xl leading-none" aria-hidden="true">✍️</span>
            <span>
              <span className="block font-display font-extrabold">{t.pickMode}</span>
              <span className={`mt-0.5 block text-xs ${mode === "pick" ? "text-navy-900/75" : "text-white/65"}`}>{t.pickModeHint}</span>
            </span>
          </button>
          <button type="button" onClick={() => setAutoOpen(true)} className={card}>
            <span className="text-2xl leading-none" aria-hidden="true">✨</span>
            <span>
              <span className="block font-display font-extrabold">{t.autoMode}</span>
              <span className="mt-0.5 block text-xs text-white/65">{t.autoModeHint}</span>
            </span>
          </button>
        </div>
      </div>

      {/* ---- Picking: the plan so far, kept in view at the top ---- */}
      {mode === "pick" && (
        <div
          className={`print:hidden sticky top-[4.75rem] z-30 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-[var(--shadow-lift)] ring-1 backdrop-blur transition-colors ${
            picked.length ? "bg-emerald-50/95 ring-emerald-200" : "bg-white/95 ring-mist-200"
          }`}
        >
          <p className={`text-sm font-bold ${picked.length ? "text-emerald-900" : "text-navy-700"}`}>
            {picked.length ? `✅ ${t.pickedBar.replace("{count}", placesText(picked.length))}` : `👆 ${t.pickingHint}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setMode(null);
                setPicked([]);
              }}
              className="rounded-full px-3 py-2 text-xs font-bold text-navy-500 hover:text-navy-800"
            >
              {t.cancel}
            </button>
            <button
              key={picked.length}
              type="button"
              onClick={() => setBasketOpen(true)}
              aria-haspopup="dialog"
              className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-extrabold transition ${
                picked.length
                  ? "plan-bump bg-sun-400 text-navy-950 shadow-[var(--shadow-sun)] hover:bg-sun-300"
                  : "bg-navy-900 text-white hover:bg-navy-800"
              }`}
            >
              🧳 {picked.length ? t.viewPlan : t.myPlan}
              <span
                className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-black ${
                  picked.length ? "bg-navy-900 text-white" : "bg-white/20 text-white"
                }`}
              >
                {picked.length}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* What just happened, for a moment, where the eye already is. */}
      {toast && (
        <div className="print:hidden pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4" aria-live="polite">
          <p
            key={toast.id}
            className={`toast-in max-w-md rounded-full px-5 py-3 text-sm font-extrabold shadow-2xl ${
              toast.added ? "bg-emerald-600 text-white" : "bg-navy-900 text-white"
            }`}
          >
            {toast.added ? "✓ " : "− "}
            {toast.text}
          </p>
        </div>
      )}

      <CityPlacesExplorer
        places={places}
        dict={dict}
        selectedKeys={mode === "pick" ? selectedKeys : undefined}
        onToggleSelect={mode === "pick" ? toggle : undefined}
        addLabel={t.add}
        addedLabel={t.added}
        onShowOnMap={onShowOnMap}
        showOnMapLabel={showOnMapLabel}
      />

      {/* ---- My plan: the picks, the dates, build ---- */}
      {basketOpen && (
        <Sheet onClose={() => setBasketOpen(false)} label={t.basketTitle} closeLabel={t.close}>
          <p className="font-display text-xl font-extrabold text-navy-900">
            🧳 {t.basketTitle} <span className="text-navy-400">({picked.length})</span>
          </p>
          {picked.length === 0 ? (
            <p className="mt-3 rounded-xl bg-mist-50 px-4 py-6 text-center text-sm text-navy-500">{t.basketEmpty}</p>
          ) : (
            <ul className="mt-3 max-h-64 divide-y divide-mist-200 overflow-y-auto rounded-2xl ring-1 ring-mist-200">
              {picked.map((p) => (
                <li key={p.key} className="flex items-center gap-3 px-3 py-2.5">
                  <span aria-hidden="true">{PIN_STYLES[p.category].glyph}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-navy-900" dir={p.englishOnly ? "ltr" : undefined}>
                    {p.name}
                  </span>
                  <button type="button" onClick={() => toggle(p)} className="text-xs font-bold text-rose-600 hover:underline">
                    {t.remove}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <DatesFields t={t} from={from} to={to} setFrom={setFrom} setTo={setTo} days={days} error={datesError} daysText={daysText} />

          {!datesError && days && extra > 0 && (
            <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 ring-1 ring-amber-200">
              ⚠️{" "}
              {t.tooMany
                .replace("{count}", placesText(picked.length))
                .replace("{days}", daysText(days))
                .replace("{comfortable}", String(COMFORTABLE_ITEMS_PER_DAY))
                .replace("{max}", placesText(maxComfortable))
                .replace("{extra}", placesText(extra))}
            </p>
          )}

          <button
            type="button"
            onClick={buildFromPicks}
            disabled={picked.length === 0 || Boolean(datesError)}
            className="mt-5 w-full rounded-2xl bg-sun-400 px-5 py-4 font-display text-base font-extrabold text-navy-950 shadow-[var(--shadow-sun)] transition hover:bg-sun-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {!datesError && extra > 0 ? t.buildAnyway : t.build}
          </button>
        </Sheet>
      )}

      {/* ---- Build me a plan: dates and interests ---- */}
      {autoOpen && (
        <Sheet onClose={() => setAutoOpen(false)} label={t.autoTitle.replace("{city}", cityName)} closeLabel={t.close}>
          <p className="font-display text-xl font-extrabold text-navy-900">✨ {t.autoTitle.replace("{city}", cityName)}</p>
          <DatesFields t={t} from={from} to={to} setFrom={setFrom} setTo={setTo} days={days} error={datesError} daysText={daysText} />
          <p className="mt-5 text-sm font-extrabold text-navy-900">{t.interests}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(
              [
                ["sights", "🏛", t.interestSights],
                ["activities", "🎟", t.interestActivities],
                ["shopping", "🛍", t.interestShopping],
              ] as [Interest, string, string][]
            ).map(([key, icon, label]) => {
              const on = interests.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setInterests((cur) => (on ? cur.filter((x) => x !== key) : [...cur, key]))}
                  className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-4 text-sm font-extrabold ring-1 transition ${
                    on ? "bg-navy-900 text-white ring-navy-900" : "bg-white text-navy-800 ring-mist-200 hover:ring-navy-300"
                  }`}
                >
                  <span className="text-2xl" aria-hidden="true">{icon}</span>
                  {label}
                  <span className={`text-xs ${on ? "text-sun-300" : "text-transparent"}`} aria-hidden="true">✓</span>
                </button>
              );
            })}
          </div>
          {interests.length === 0 && <p className="mt-2 text-xs font-bold text-rose-600">{t.interestNeeded}</p>}
          <button
            type="button"
            onClick={buildAuto}
            disabled={interests.length === 0 || Boolean(datesError)}
            className="mt-5 w-full rounded-2xl bg-sun-400 px-5 py-4 font-display text-base font-extrabold text-navy-950 shadow-[var(--shadow-sun)] transition hover:bg-sun-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {t.autoBuild}
          </button>
        </Sheet>
      )}

      {plan && (
        <PlanView
          plan={plan}
          locale={locale}
          cityName={cityName}
          countryCode={countryCode}
          daysText={daysText}
          placesText={placesText}
          onEdit={() => {
            setPlan(null);
            if (plan.source === "pick") setBasketOpen(true);
            else setAutoOpen(true);
          }}
          onClose={() => setPlan(null)}
        />
      )}
    </div>
  );
}

type TripDict = ReturnType<typeof getDictionary>["tripPlan"];

function DatesFields({
  t,
  from,
  to,
  setFrom,
  setTo,
  days,
  error,
  daysText,
}: {
  t: TripDict;
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  days: number | null;
  error: string | null;
  daysText: (n: number) => string;
}) {
  const input =
    "mt-1 w-full rounded-xl border border-mist-300 bg-white px-3 py-2.5 text-sm font-bold text-navy-900 outline-none transition focus:border-sun-400 focus:ring-4 focus:ring-sun-400/20";
  return (
    <div className="mt-5">
      <p className="text-sm font-extrabold text-navy-900">🗓 {t.datesTitle}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs font-bold text-navy-500">
          {t.depart}
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              if (!to || e.target.value > to) setTo(e.target.value);
            }}
            className={input}
          />
        </label>
        <label className="text-xs font-bold text-navy-500">
          {t.return}
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={input} />
        </label>
      </div>
      {error ? (
        <p className="mt-2 text-xs font-semibold text-navy-500">{error}</p>
      ) : (
        days && <p className="mt-2 inline-flex rounded-full bg-sea-50 px-3 py-1 text-xs font-extrabold text-sea-800 ring-1 ring-sea-100">⏱ {daysText(days)}</p>
      )}
    </div>
  );
}

/** A window over the page — a bottom sheet on a phone. */
function Sheet({
  children,
  onClose,
  label,
  closeLabel,
}: {
  children: React.ReactNode;
  onClose: () => void;
  label: string;
  closeLabel: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = before;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-990/70 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className="tab-fade relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 text-start shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="absolute end-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-mist-100 text-navy-700 transition hover:bg-mist-200"
        >
          ✕
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}

/** The plan, day by day, over the page — and what prints as the PDF. */
function PlanView({
  plan,
  locale,
  cityName,
  countryCode,
  daysText,
  placesText,
  onEdit,
  onClose,
}: {
  plan: Plan;
  locale: Locale;
  cityName: string;
  countryCode: string;
  daysText: (n: number) => string;
  placesText: (n: number) => string;
  onEdit: () => void;
  onClose: () => void;
}) {
  const t = getDictionary(locale).tripPlan;
  const isAr = locale === "ar";
  const all = plan.days.flat();
  const title = t.planTitle.replace("{city}", cityName);
  const fmt = (d: Date, withDay: boolean) =>
    new Intl.DateTimeFormat(isAr ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
      ...(withDay ? { weekday: "long" } : {}),
      day: "numeric",
      month: "long",
      ...(withDay ? {} : { year: "numeric" }),
      timeZone: "UTC",
    }).format(d);
  const dates = t.planDates
    .replace("{from}", fmt(addDays(plan.from, 0), false))
    .replace("{to}", fmt(addDays(plan.to, 0), false));
  const subtitle = `${dates} · ${daysText(plan.days.length)} · ${placesText(all.length)}`;

  // While the plan is open it is the page: printing it prints only the plan.
  useEffect(() => {
    document.body.classList.add("plan-open");
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("plan-open");
      document.body.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function downloadKml() {
    const located = all.filter(hasCoords);
    if (!located.length) return;
    downloadText(
      toKML(
        located.map((p) => ({ name: p.name, lat: p.lat as number, lon: p.lon as number, description: p.description })),
        title
      ),
      safeFileName(`sfrtna-plan-${countryCode}-${cityName}`, "kml"),
      "application/vnd.google-earth.kml+xml"
    );
  }

  const routeUrl = (items: PlaceListItem[]) => {
    const pts = items.filter(hasCoords).slice(0, 10).map((p) => `${p.lat},${p.lon}`);
    if (pts.length === 0) return null;
    if (pts.length === 1) return `https://www.google.com/maps/search/?api=1&query=${pts[0]}`;
    const url = new URL("https://www.google.com/maps/dir/");
    url.searchParams.set("api", "1");
    url.searchParams.set("origin", pts[0]);
    url.searchParams.set("destination", pts[pts.length - 1]);
    if (pts.length > 2) url.searchParams.set("waypoints", pts.slice(1, -1).join("|"));
    url.searchParams.set("travelmode", "walking");
    return url.toString();
  };

  const btn =
    "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400";

  return createPortal(
    <div className="plan-root fixed inset-0 z-[70] overflow-y-auto bg-mist-50">
      {/* The toolbar: back, edit, PDF, Google Maps. */}
      <div className="print:hidden sticky top-0 z-10 border-b border-mist-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <button type="button" onClick={onClose} className={`${btn} bg-mist-100 text-navy-800 hover:bg-mist-200`}>
            <span aria-hidden="true">{isAr ? "→" : "←"}</span> {t.close}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onEdit} className={`${btn} text-navy-700 ring-1 ring-mist-300 hover:ring-navy-300`}>
              ✏️ {t.edit}
            </button>
            <button type="button" onClick={downloadKml} className={`${btn} bg-sea-600 text-white hover:bg-sea-700`}>
              🗺️ {t.mapsKml}
            </button>
            <button type="button" onClick={() => window.print()} title={t.pdfHint} className={`${btn} bg-sun-400 text-navy-950 hover:bg-sun-300`}>
              📄 {t.pdf}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <PrintHeader locale={locale} title={title} subtitle={subtitle} />

        {/* On screen: the same heading, in the site's own style. */}
        <div className="print:hidden overflow-hidden rounded-3xl bg-gradient-to-br from-navy-800 to-navy-990 p-6 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- local asset; image optimizer is off on Workers */}
          <img src="/sfrtna-logo.png" alt="" className="mb-4 h-10 w-auto rounded-lg bg-white px-2 py-1" />
          <h2 className="font-display text-2xl font-black sm:text-3xl">{title}</h2>
          <p className="mt-2 text-sm font-bold text-sun-300">{subtitle}</p>
        </div>

        <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm leading-relaxed text-navy-700 ring-1 ring-mist-200 print-block">
          {plan.source === "auto" ? t.planNoteAuto : t.planNotePick}
        </p>
        {plan.short && (
          <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 ring-1 ring-amber-200">
            ⚠️ {t.autoShort}
          </p>
        )}
        <p className="print:hidden mt-3 rounded-2xl bg-sea-50 px-4 py-3 text-xs leading-relaxed text-navy-700 ring-1 ring-sea-100">
          🗺️ {t.mapsHint}{" "}
          <a href={GOOGLE_MY_MAPS_URL} target="_blank" rel="noopener noreferrer" className="font-bold text-sea-700 underline">
            {t.openMyMaps} ↗
          </a>
        </p>

        <ol className="mt-5 space-y-4">
          {plan.days.map((items, i) => {
            const route = routeUrl(items);
            const spread = items.length > 1 ? spreadKm(items) : 0;
            return (
              <li key={i} className="print-block overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-card)] ring-1 ring-navy-950/5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-mist-200 bg-mist-50 px-5 py-3">
                  <p className="flex items-center gap-2.5">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-sm font-black text-sun-300">
                      {i + 1}
                    </span>
                    <span>
                      <span className="block font-display font-extrabold text-navy-900">{t.dayLabel.replace("{n}", String(i + 1))}</span>
                      <span className="block text-xs font-semibold text-navy-500">{fmt(addDays(plan.from, i), true)}</span>
                    </span>
                    {items.length > COMFORTABLE_ITEMS_PER_DAY && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">{t.busyDay}</span>
                    )}
                  </p>
                  {route && (
                    <a
                      href={route}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="print:hidden inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-sea-700 ring-1 ring-sea-200 transition hover:ring-sea-400"
                    >
                      🧭 {t.dayRoute} ↗
                    </a>
                  )}
                </div>

                {items.length === 0 ? (
                  <p className="px-5 py-4 text-sm font-semibold text-navy-500">🌿 {t.freeDay}</p>
                ) : (
                  <ol className="divide-y divide-mist-100">
                    {items.map((p, n) => (
                      <li key={p.key} className="flex items-start gap-3 px-5 py-3">
                        <span
                          className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
                          style={{ backgroundColor: `${PIN_STYLES[p.category].color}1a` }}
                          aria-hidden="true"
                        >
                          {PIN_STYLES[p.category].glyph}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold text-navy-900" dir={p.englishOnly ? "ltr" : undefined}>
                            <span className="text-navy-400">{n + 1}. </span>
                            {p.name}
                          </span>
                          {p.description && <span className="block text-xs text-navy-500">{p.description}</span>}
                        </span>
                        {hasCoords(p) && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="print:hidden shrink-0 text-xs font-bold text-sea-700 hover:underline"
                          >
                            📍 {t.directions}
                          </a>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
                {spread >= 1 && (
                  <p className="border-t border-mist-100 px-5 py-2 text-2xs font-semibold text-navy-400">
                    {t.daySpread.replace("{km}", spread.toFixed(1))}
                  </p>
                )}
              </li>
            );
          })}
        </ol>

        <p className="mt-6 text-center text-xs font-bold text-navy-400">{t.printedFrom}</p>
      </div>
    </div>,
    document.body
  );
}
