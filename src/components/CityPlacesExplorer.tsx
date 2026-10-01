"use client";

import { useMemo, useState } from "react";
import { PIN_STYLES, type PinCategory } from "@/lib/pinStyles";
import Photo from "@/components/Photo";
import { searchMatches } from "@/lib/search";

export interface PlaceListItem {
  key: string;
  name: string;
  description?: string;
  photo?: string;
  category: PinCategory;
  /** What OpenStreetMap calls it ("mall", "museum"), when it came from there. */
  kind?: string;
  /**
   * Where the place is.
   *
   * Carried purely so the day planner can put places that are near each
   * other on the same day — a plan that sends someone across the city and
   * back is a worse plan than one that doesn't, and the coordinates were
   * already fetched. Also what the "open in Google Maps" link points at.
   */
  lat?: number;
  lon?: number;
  /** The reader wanted Arabic and no Arabic name is recorded for this place. */
  englishOnly: boolean;
  /**
   * How you get in — free, official site, tour operator, on arrival.
   *
   * Only on the landmarks the guide covers by hand. A map knows what a place
   * is; it does not know whether you need to book it, and that is the
   * line a traveller planning a day actually needs. Present on a handful of
   * places per city, absent on the rest, and never invented.
   */
  bookingLabel?: string;
}

interface ExplorerDict {
  attractionsHeading: string;
  activitiesHeading: string;
  cuisineHeading: string;
  otherHeading: string;
  placesCount: string;
  emptyCategory: string;
  englishOnly: string;
  directions: string;
  loadMore: string;
  searchPlaceholder: string;
}

// How many cards to show before the visitor asks for more. A city can carry
// a couple of hundred places, and rendering all of them at once means a very
// long page of images on a phone for no reason.
const PAGE = 24;

const TAB_ORDER: PinCategory[] = ["historic", "activity", "food", "place"];

/** How well known a place probably is, from how well documented it is. */
function score(p: PlaceListItem): number {
  let n = 0;
  if (p.key.startsWith("guide-")) n += 10; // hand-picked by us
  if (p.bookingLabel) n += 4; // we know how you get in
  if (p.photo) n += 3;
  if (p.description) n += 2;
  if (!p.englishOnly) n += 1; // named in the reader's language
  return n;
}

// The three sections the site has always had — sights, things to do, places
// to eat — plus the honest fourth: mapped places whose tags didn't put them
// in any of them. They'd otherwise be dropped, and
// they're often the most interesting finds in a city.
export default function CityPlacesExplorer({
  places,
  dict,
  selectedKeys,
  onToggleSelect,
  addLabel,
  addedLabel,
  onShowOnMap,
  showOnMapLabel,
}: {
  // Names and descriptions arrive already resolved to the reader's language,
  // so this component never needs to know which language that is.
  places: PlaceListItem[];
  dict: ExplorerDict;
  /**
   * The traveller's picks. Optional, because this list is a perfectly good
   * list on its own — the add buttons only appear once a parent is actually
   * collecting a selection, which keeps 280 cards free of a control nobody
   * asked for.
   */
  selectedKeys?: Set<string>;
  onToggleSelect?: (place: PlaceListItem) => void;
  addLabel?: string;
  addedLabel?: string;
  /** Opens this place on the city's map, on the same page. */
  onShowOnMap?: (place: PlaceListItem) => void;
  showOnMapLabel?: string;
}) {
  const picking = Boolean(onToggleSelect && selectedKeys);
  const labels: Record<PinCategory, string> = {
    historic: dict.attractionsHeading,
    activity: dict.activitiesHeading,
    food: dict.cuisineHeading,
    place: dict.otherHeading,
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of places) c[p.category] = (c[p.category] ?? 0) + 1;
    return c;
  }, [places]);

  const tabs = TAB_ORDER.filter((t) => (counts[t] ?? 0) > 0);
  const [active, setActive] = useState<PinCategory>(tabs[0] ?? "historic");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);

  const visible = useMemo(() => {
    const q = query.trim();
    return places
      .filter((p) => p.category === active)
      .filter((p) => searchMatches([p.name, p.description], q))
      // Best-documented first.
      //
      // We have no popularity data and will not invent a ranking. Curated
      // landmarks, which we checked ourselves, come first; then places we
      // know more about — how to get in, a photograph, a name in the
      // reader's language.
      .sort((a, b) => score(b) - score(a));
  }, [places, active, query]);

  function pick(tab: PinCategory) {
    setActive(tab);
    // A fresh tab starts at the top of its own list rather than inheriting
    // however far the visitor had scrolled the previous one.
    setShown(PAGE);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = tab === active;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => pick(tab)}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition ${
                isActive
                  ? "bg-brand-800 text-white shadow-sm"
                  : "bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-brand-300"
              }`}
            >
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
                style={{ backgroundColor: PIN_STYLES[tab].color }}
                aria-hidden="true"
              >
                {PIN_STYLES[tab].glyph}
              </span>
              {labels[tab]}
              <span className={isActive ? "text-white/70" : "text-gray-400"}>({counts[tab]})</span>
            </button>
          );
        })}
      </div>

      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShown(PAGE);
        }}
        placeholder={dict.searchPlaceholder}
        className="mb-5 w-full max-w-sm rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 placeholder:text-gray-400"
      />

      {visible.length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          {dict.emptyCategory}
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.slice(0, shown).map((p) => (
              <article
                key={p.key}
                id={`place-${p.key}`}
                className="scroll-mt-28 flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <Photo
                  src={p.photo}
                  className="h-40 w-full object-cover"
                  fallback={
                    <div
                      className="flex h-40 w-full items-center justify-center text-4xl"
                      style={{ backgroundColor: `${PIN_STYLES[p.category].color}14` }}
                      aria-hidden="true"
                    >
                      {PIN_STYLES[p.category].glyph}
                    </div>
                  }
                />

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className="font-bold leading-snug text-gray-900"
                      // An English name inside an Arabic page needs its own
                      // direction, or trailing punctuation jumps to the wrong end.
                      dir={p.englishOnly ? "ltr" : undefined}
                    >
                      {p.name}
                    </h3>
                    {/* This one place on the map, on the same page. */}
                    {onShowOnMap && p.lat !== undefined && p.lon !== undefined && (
                      <button
                        type="button"
                        onClick={() => onShowOnMap(p)}
                        title={showOnMapLabel}
                        aria-label={`${showOnMapLabel}: ${p.name}`}
                        className="-mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sun-50 text-base ring-1 ring-sun-200 transition hover:bg-sun-100 hover:ring-sun-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400"
                      >
                        <span aria-hidden="true">📍</span>
                      </button>
                    )}
                  </div>

                  {p.description && (
                    <p
                      className="mt-1.5 text-sm leading-relaxed text-gray-600"
                      dir={p.englishOnly ? "ltr" : undefined}
                    >
                      {p.description}
                    </p>
                  )}

                  {p.bookingLabel && (
                    <p className="mt-2.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-sun-50 px-2.5 py-1 text-[11px] font-bold text-sun-800 ring-1 ring-sun-200">
                      <span aria-hidden="true">🎟️</span>
                      {p.bookingLabel}
                    </p>
                  )}

                  {p.englishOnly && (
                    <p className="mt-2 text-[11px] leading-snug text-amber-700">{dict.englishOnly}</p>
                  )}

                  {p.lat !== undefined && p.lon !== undefined && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-xs font-semibold text-brand-700 hover:underline"
                      >
                        {dict.directions} ↗
                      </a>
                    </div>
                  )}

                  {/* Pushed to the bottom edge so the button lines up across a
                      row of cards whose descriptions are all different
                      lengths — a ragged row of controls reads as broken. */}
                  {picking && (
                    <button
                      type="button"
                      onClick={() => onToggleSelect?.(p)}
                      aria-pressed={selectedKeys?.has(p.key) ?? false}
                      className={`mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 ${
                        selectedKeys?.has(p.key)
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "border border-brand-200 bg-white text-brand-800 hover:bg-brand-50"
                      }`}
                    >
                      <span aria-hidden="true">{selectedKeys?.has(p.key) ? "✓" : "+"}</span>
                      {selectedKeys?.has(p.key) ? addedLabel : addLabel}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          {shown < visible.length && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="mx-auto mt-6 block rounded-full bg-white px-6 py-3 text-sm font-bold text-brand-800 shadow-sm ring-1 ring-brand-100 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {dict.loadMore} ({visible.length - shown})
            </button>
          )}
        </>
      )}

      <p className="sr-only" aria-live="polite">
        {dict.placesCount.replace("{count}", String(visible.length))}
      </p>
    </div>
  );
}
