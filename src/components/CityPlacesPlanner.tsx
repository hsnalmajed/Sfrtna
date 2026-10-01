"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import CityPlacesExplorer, { type PlaceListItem } from "@/components/CityPlacesExplorer";
import PlanActions from "@/components/PlanActions";
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

/**
 * Turning a city's list of places into that traveller's own days.
 *
 * The list on this page is the answer to "what is there"; it was never the
 * answer to "what should I do on Tuesday". This adds the second half without
 * touching the first: the picking controls stay switched off until someone
 * asks for them, so a visitor who only wants to read about Istanbul reads
 * about Istanbul, and 280 cards don't each grow a button they'll never press.
 *
 * The number of days is not asked for. They already said how long they are
 * staying when they searched, so it arrives in the link and is filled in —
 * editable, because plans change, but never a question answered twice.
 *
 * The spread is round-robin in the order things were picked, which keeps each
 * day mixed instead of stacking every museum on one afternoon. It is offered
 * as a first draft and says so: we have no opening hours and no travel times
 * between these places, so "a sensible starting point" is the honest claim and
 * "an optimised route" would not be.
 */
export default function CityPlacesPlanner({
  locale,
  places,
  cityName,
  countryCode,
  countryName,
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
  const d = getDictionary(locale);
  const sp = useSearchParams();

  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<PlaceListItem[]>([]);
  const [showPlan, setShowPlan] = useState(false);
  // Counts presses of "build", not whether a plan exists. The plan is
  // rendered under a list that can run to hundreds of cards, so building one
  // while standing at the top of that list looked exactly like nothing
  // happening. Every press scrolls to the result, including the second press
  // after adding more places — which a boolean would have swallowed.
  const [builds, setBuilds] = useState(0);
  const planRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (builds === 0) return;
    const el = planRef.current;
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "start" });

    // Smooth scrolling is not always available — a browser honouring
    // "reduce motion" skips it, and Chrome suspends the animation outright in
    // a tab that isn't visible. Either way the traveller would press the
    // button and stay exactly where they were, which is the bug this whole
    // effect exists to fix. So: check where we actually ended up, and if the
    // animation never happened, jump.
    const settle = setTimeout(() => {
      if (Math.abs(el.getBoundingClientRect().top) > 120) {
        el.scrollIntoView({ block: "start" });
      }
    }, 700);
    return () => clearTimeout(settle);
  }, [builds]);

  // Their own stay when they came from a search; a sane default when they
  // arrived here cold.
  const [days, setDays] = useState(() => {
    const fromSearch = Number(sp.get("nights") || 0);
    return fromSearch >= 1 && fromSearch <= 21 ? fromSearch : 3;
  });

  const selectedKeys = useMemo(() => new Set(picked.map((p) => p.key)), [picked]);

  function toggle(place: PlaceListItem) {
    setPicked((current) =>
      current.some((p) => p.key === place.key)
        ? current.filter((p) => p.key !== place.key)
        : [...current, place]
    );
  }

  const schedule = useMemo(() => groupByProximity(picked, days), [picked, days]);

  const busiestDay = schedule.reduce((max, day) => Math.max(max, day.length), 0);
  const overloaded = busiestDay > COMFORTABLE_ITEMS_PER_DAY;

  /**
   * Days with nothing in them, and something to do about it.
   *
   * Picking two places for a three-day trip used to produce a day three that
   * was simply blank, with no acknowledgement — which reads as the planner
   * having failed rather than the traveller having picked two things. Naming
   * the empty day and offering the nearest unpicked places turns a silence
   * into the obvious next step.
   */
  const emptyDays = schedule
    .map((day, i) => (day.length === 0 ? i + 1 : 0))
    .filter((n) => n > 0);

  const suggestions = useMemo(() => {
    if (picked.length === 0 || emptyDays.length === 0) return [];
    const chosen = new Set(picked.map((p) => p.key));
    const anchors = picked.filter(hasCoords);
    const rest = places.filter((p) => !chosen.has(p.key) && hasCoords(p));
    if (anchors.length === 0) return rest.slice(0, 3);
    // Nearest to anything already chosen, so a suggestion is somewhere they
    // were going to be anyway.
    return [...rest]
      .map((p) => ({
        place: p,
        d: Math.min(...anchors.map((a) => distanceKm(a, p))),
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .map((x) => x.place);
  }, [picked, places, emptyDays.length]);

  const planTitle = d.picker.cityPlanTitle.replace("{city}", cityName);
  const planLines = picked.map((p) => p.name);

  return (
    <div>
      {/* ---- The invitation, above the lists ---- */}
      <div className="print:hidden mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 to-brand-950 p-5 text-white shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-display text-lg font-extrabold">{d.picker.cityStartTitle}</p>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/70">
              {picking ? d.picker.cityPickingBody : d.picker.cityStartBody}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-end gap-3">
            {/* The trip length, asked for the moment picking starts rather
                than hidden in the bar at the bottom of the screen — it is
                half of what the plan is built from. */}
            {picking && (
              <label className="text-xs font-semibold text-white/70">
                <span className="mb-1.5 block">{d.picker.cityDaysLabel}</span>
                <input
                  type="number"
                  min={1}
                  max={21}
                  value={days}
                  onChange={(e) => setDays(Math.min(21, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-20 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-center text-sm font-bold text-white outline-none focus:border-sun-400"
                />
              </label>
            )}

            <button
              type="button"
              onClick={() => {
                setPicking((on) => !on);
                // Leaving selection mode puts the page back as it was rather
                // than leaving a basket hanging over a list with no buttons.
                if (picking) {
                  setPicked([]);
                  setShowPlan(false);
                }
              }}
              aria-pressed={picking}
              className={`rounded-xl px-5 py-3 text-sm font-bold shadow-sm transition ${
                picking
                  ? "bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25"
                  : "bg-sun-400 text-navy-950 hover:bg-sun-300"
              }`}
            >
              {picking ? d.picker.cityStop : d.picker.cityStart}
            </button>
          </div>
        </div>
      </div>

      <CityPlacesExplorer
        places={places}
        dict={dict}
        selectedKeys={picking ? selectedKeys : undefined}
        onToggleSelect={picking ? toggle : undefined}
        addLabel={d.picker.addInterest}
        addedLabel={d.picker.addedInterest}
        onShowOnMap={onShowOnMap}
        showOnMapLabel={showOnMapLabel}
      />

      {/* ---- The plan ---- */}
      {showPlan && picked.length > 0 && (
        <div ref={planRef} className="mt-8 space-y-4 scroll-mt-24">
          <PrintHeader
            locale={locale}
            title={planTitle}
            subtitle={`${d.itinerary.daysCount.replace("{count}", String(days))} · ${d.picker.itemsCount.replace(
              "{count}",
              String(picked.length)
            )}`}
          />

          <PlanActions
            locale={locale}
            countryCode={countryCode}
            countryName={countryName}
            planLines={planLines}
            fileBase={`sfrtna-${countryCode}-${cityName}`}
            title={planTitle}
          />

          {overloaded && (
            <p className="print:hidden rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 ring-1 ring-amber-100">
              {d.picker.overloadNotice
                .replace("{count}", String(busiestDay))
                .replace("{comfortable}", String(COMFORTABLE_ITEMS_PER_DAY))}
            </p>
          )}

          <div className="print-block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            {/* Both of these are on the letterhead when printing. */}
            <h2 className="print:hidden text-lg font-extrabold text-gray-900">{planTitle}</h2>
            <p className="print:hidden mt-1 text-sm font-semibold text-gray-500">
              {d.itinerary.daysCount.replace("{count}", String(days))} ·{" "}
              {d.picker.itemsCount.replace("{count}", String(picked.length))}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-gray-500">{d.picker.planNote}</p>
          </div>

          {schedule.map((items, index) => (
            <div
              key={index}
              className="print-block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5"
            >
              <h3 className="mb-2.5 flex items-center gap-2 font-bold text-gray-900">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-900 text-xs font-bold text-white">
                  {index + 1}
                </span>
                {d.itinerary.day} {index + 1}
                {items.length > COMFORTABLE_ITEMS_PER_DAY && (
                  <span className="print:hidden rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                    {d.picker.busyDay}
                  </span>
                )}
              </h3>

              {items.length === 0 ? (
                <div>
                  <p className="text-sm font-semibold text-navy-500">
                    {d.picker.emptyDayTitle.replace("{day}", String(index + 1))}
                  </p>
                  {suggestions.length > 0 && (
                    <div className="print:hidden mt-2">
                      <p className="text-xs text-navy-500">{d.picker.emptyDayBody}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {suggestions.map((sug) => (
                          <button
                            key={sug.key}
                            type="button"
                            onClick={() => toggle(sug)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-mist-100 px-3 py-1.5 text-xs font-bold text-navy-700 ring-1 ring-mist-200 transition hover:bg-sun-100 hover:ring-sun-300"
                          >
                            <span aria-hidden="true">＋</span>
                            <span dir={sug.englishOnly ? "ltr" : undefined}>{sug.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <ul className="space-y-1.5 text-sm text-gray-700">
                  {items.map((item) => (
                    <li key={item.key} className="flex flex-wrap items-center gap-2">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400"
                        aria-hidden="true"
                      />
                      {/* An English name inside an Arabic line needs its own
                          direction or its punctuation jumps to the wrong end. */}
                      <span className="font-semibold" dir={item.englishOnly ? "ltr" : undefined}>
                        {item.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Only when there is a real distance to report: "0 km" under a
                  single place is noise, and a day in one neighbourhood does
                  not need a number to say so. */}
              {items.length > 1 && spreadKm(items) >= 1 && (
                <p className="mt-2.5 text-2xs font-semibold text-navy-400">
                  {d.picker.daySpread.replace("{km}", spreadKm(items).toFixed(1))}
                </p>
              )}
            </div>
          ))}

          <p className="print-signoff hidden print:block">{d.plan.printedFrom}</p>
        </div>
      )}

      {/* ---- The basket, fixed so it follows a long list ---- */}
      {picking && picked.length > 0 && (
        <div className="print:hidden pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl bg-navy-990/95 px-4 py-3 text-white shadow-2xl backdrop-blur-xl sm:px-5">
            <div className="min-w-0">
              <p className="text-sm font-extrabold">
                {d.picker.itemsCount.replace("{count}", String(picked.length))}
              </p>
              <button
                type="button"
                onClick={() => {
                  setPicked([]);
                  setShowPlan(false);
                }}
                className="text-[11px] font-semibold text-white/50 underline underline-offset-2 transition hover:text-white/80"
              >
                {d.picker.clear}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-white/70">
                {d.picker.daysLabel}
                <input
                  type="number"
                  min={1}
                  max={21}
                  value={days}
                  onChange={(e) => setDays(Math.min(21, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-16 rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-center text-sm font-bold text-white outline-none focus:border-sun-400"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowPlan(true);
                  setBuilds((n) => n + 1);
                }}
                className="rounded-xl bg-sun-400 px-4 py-2.5 text-sm font-bold text-navy-950 transition hover:bg-sun-300"
              >
                {d.picker.cityBuild}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room for the fixed bar so it never covers the last card. */}
      {picking && picked.length > 0 && <div className="h-24" aria-hidden="true" />}
    </div>
  );
}
