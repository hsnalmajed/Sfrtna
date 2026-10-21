"use client";

import ViatorOffers from "@/components/ViatorOffers";
import { useDictionary } from "@/lib/dict/context";
import type { Locale } from "@/lib/types";
import PartnerLink from "@/components/PartnerLink";
import { activityLinks } from "@/lib/activityLinks";
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
  /** How widely known it is (languages it is named in, a Wikipedia article) — see mapPins.ts. */
  fame?: number;
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
  /**
   * What to search the activity partners for ("Hagia Sophia Istanbul") —
   * only on places a ticket or a tour is usually sold for (see
   * activityLinks.ts). Absent: no ticket buttons.
   */
  ticketQuery?: string;
  /**
   * Our own guide (scripts/guide/, public/data/guide): set on the places
   * the world knows (Wikidata fame, World Heritage, visitors), already in the
   * reader's language. `rank` 0 is the city's best-known place.
   */
  guide?: {
    rank: number;
    heritage?: boolean;
    visitorsM?: number;
    minutes?: number;
    best?: string;
    dress?: string;
    tip?: string;
    /** Opening hours as mapped (OpenStreetMap syntax). */
    hours?: string;
    website?: string;
    kids?: boolean;
    free?: boolean;
    outside?: boolean;
  };
}

export interface GuideLabels {
  top: string;
  heritage: string;
  minutes: string;
  hours: string;
  hoursMin: string;
  visit: string;
  best: string;
  dress: string;
  tip: string;
  open: string;
  website: string;
  kids: string;
  free: string;
  details: string;
  featured: string;
  all: string;
  visitors: string;
  outside: string;
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
  /** "Tickets & tours" — the label before the partner buttons on a place. */
  tickets?: string;
  loadMore: string;
  searchPlaceholder: string;
  guide?: GuideLabels;
}

/** "1 h 30 min" / "45 min". */
export function visitLength(m: number, g: GuideLabels): string {
  if (m < 60) return g.minutes.replace("{n}", String(m));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r >= 10 ? g.hoursMin.replace("{h}", String(h)).replace("{m}", String(r)) : g.hours.replace("{h}", String(h));
}

// How many cards to show before the visitor asks for more. A city can carry
// a couple of hundred places, and rendering all of them at once means a very
// long page of images on a phone for no reason.
const PAGE = 24;

const TAB_ORDER: PinCategory[] = ["historic", "activity", "food", "place"];

/** How well known a place probably is, from how well documented it is. */
export function score(p: PlaceListItem): number {
  let n = 0;
  // In our guide: the places the world knows, best known first.
  if (p.guide) n += 200 - Math.min(150, p.guide.rank);
  if (p.key.startsWith("guide-")) n += 10; // hand-picked by us
  if (p.bookingLabel) n += 4; // we know how you get in
  if (p.photo) n += 3;
  if (p.description) n += 2;
  if (!p.englishOnly) n += 1; // named in the reader's language
  // How widely known it is, from the map's own data: a place named in dozens
  // of languages, with a Wikipedia article, is one travellers come for.
  n += Math.min(p.fame ?? 0, 60) / 3;
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
  citySlug,
  locale = "ar",
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
  /** The city (our slug): Viator's ticket offers per place, on demand. */
  citySlug?: string;
  locale?: Locale;
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
  const [offersOpen, setOffersOpen] = useState<Set<string>>(new Set());
  const ct = useDictionary().attractions;
  // «الأبرز»: only the places in our guide, when the tab has enough of them;
  // «الكل» keeps every mapped place one tap away (never a shorter list).
  const featuredCount = useMemo(() => places.filter((p) => p.category === active && p.guide).length, [places, active]);
  const [featuredOnly, setFeaturedOnly] = useState(true);
  const onlyFeatured = featuredOnly && featuredCount >= 4 && Boolean(dict.guide);

  const visible = useMemo(() => {
    const q = query.trim();
    return places
      .filter((p) => p.category === active)
      .filter((p) => !onlyFeatured || p.guide)
      .filter((p) => searchMatches([p.name, p.description], q))
      // Best-documented first.
      //
      // We have no popularity data and will not invent a ranking. Curated
      // landmarks, which we checked ourselves, come first; then places we
      // know more about — how to get in, a photograph, a name in the
      // reader's language.
      .sort((a, b) => score(b) - score(a));
  }, [places, active, query, onlyFeatured]);

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

      {dict.guide && featuredCount >= 4 && (
        <div className="mb-3 inline-flex rounded-full bg-white p-1 ring-1 ring-mist-200" role="tablist">
          {[true, false].map((f) => (
            <button
              key={String(f)}
              type="button"
              role="tab"
              aria-selected={featuredOnly === f}
              onClick={() => {
                setFeaturedOnly(f);
                setShown(PAGE);
              }}
              className={`min-h-9 rounded-full px-4 text-sm font-bold ${featuredOnly === f ? "bg-sun-400 text-navy-950" : "text-navy-600"}`}
            >
              {f ? `⭐ ${dict.guide?.featured} (${featuredCount})` : `${dict.guide?.all} (${counts[active] ?? 0})`}
            </button>
          ))}
        </div>
      )}

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
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {visible.slice(0, shown).map((p) => (
              <article
                key={p.key}
                id={`place-${p.key}`}
                className={`relative scroll-mt-28 flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  selectedKeys?.has(p.key) ? "ring-2 ring-emerald-500" : "ring-1 ring-black/5"
                }`}
              >
                {selectedKeys?.has(p.key) && (
                  <span className="absolute start-2 top-2 z-10 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-extrabold sm:start-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-xs text-white shadow-md">
                    ✓ {addedLabel}
                  </span>
                )}
                <Photo
                  src={p.photo}
                  className="h-24 w-full object-cover sm:h-40"
                  fallback={
                    <div
                      className="flex h-24 w-full items-center justify-center text-3xl sm:h-40 sm:text-4xl"
                      style={{ backgroundColor: `${PIN_STYLES[p.category].color}14` }}
                      aria-hidden="true"
                    >
                      {PIN_STYLES[p.category].glyph}
                    </div>
                  }
                />

                <div className="flex flex-1 flex-col p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className="text-sm font-bold leading-snug text-gray-900 sm:text-base"
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
                        className="-mt-0.5 inline-flex h-9 w-9 shrink-0 text-sm sm:h-9 sm:w-9 sm:text-base items-center justify-center rounded-full bg-sun-50 text-base ring-1 ring-sun-200 transition hover:bg-sun-100 hover:ring-sun-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400"
                      >
                        <span aria-hidden="true">📍</span>
                      </button>
                    )}
                  </div>

                  {p.guide && dict.guide && (p.guide.heritage || p.guide.minutes || p.guide.rank < 10 || p.guide.outside) && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.guide.heritage && (
                        <span className="rounded-full bg-sea-50 px-2 py-0.5 text-[10px] font-extrabold text-sea-800 ring-1 ring-sea-200 sm:text-[11px]">🏛️ {dict.guide.heritage}</span>
                      )}
                      {!p.guide.heritage && p.guide.rank < 10 && (
                        <span className="rounded-full bg-sun-50 px-2 py-0.5 text-[10px] font-extrabold text-sun-800 ring-1 ring-sun-200 sm:text-[11px]">⭐ {dict.guide.top}</span>
                      )}
                      {p.guide.outside && (
                        <span className="rounded-full bg-mist-50 px-2 py-0.5 text-[10px] font-bold text-navy-600 ring-1 ring-mist-200 sm:text-[11px]">👀 {dict.guide.outside}</span>
                      )}
                      {p.guide.minutes && !p.guide.outside && (
                        <span className="rounded-full bg-mist-50 px-2 py-0.5 text-[10px] font-bold text-navy-700 ring-1 ring-mist-200 sm:text-[11px]">⏱ {visitLength(p.guide.minutes, dict.guide)}</span>
                      )}
                    </div>
                  )}

                  {p.description && (
                    <p
                      className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-600 sm:mt-1.5 sm:line-clamp-none sm:text-sm"
                      dir={p.englishOnly ? "ltr" : undefined}
                    >
                      {p.description}
                    </p>
                  )}

                  {p.guide && dict.guide && (p.guide.best || p.guide.dress || p.guide.tip || p.guide.hours || p.guide.website || p.guide.kids || p.guide.free || p.guide.visitorsM) && (
                    <details className="group/d mt-2 text-xs">
                      <summary className="cursor-pointer list-none font-bold text-sea-700 [&::-webkit-details-marker]:hidden">
                        <span className="group-open/d:hidden">＋ </span>
                        <span className="hidden group-open/d:inline">－ </span>
                        {dict.guide.details}
                      </summary>
                      <dl className="mt-1.5 space-y-1 leading-relaxed text-gray-700">
                        {(
                          [
                            ["🌤", dict.guide.best, p.guide.best],
                            ["👕", dict.guide.dress, p.guide.dress],
                            ["💡", dict.guide.tip, p.guide.tip],
                            ["🕘", dict.guide.open, p.guide.hours],
                          ] as const
                        )
                          .filter(([, , v]) => v)
                          .map(([icon, label, v]) => (
                            <div key={label}>
                              <dt className="inline font-bold text-navy-800">
                                <span aria-hidden="true">{icon}</span> {label}:{" "}
                              </dt>
                              <dd className="inline">
                                {v}
                              </dd>
                            </div>
                          ))}
                        {p.guide.free && <p className="font-bold text-emerald-700">✓ {dict.guide.free}</p>}
                        {p.guide.kids && <p className="font-bold text-emerald-700">👨‍👩‍👧 {dict.guide.kids}</p>}
                        {p.guide.visitorsM && <p className="text-navy-600">👥 {dict.guide.visitors.replace("{n}", String(p.guide.visitorsM))}</p>}
                        {p.guide.website && (
                          <a href={p.guide.website} target="_blank" rel="noopener noreferrer" className="inline-block font-bold text-brand-700 hover:underline">
                            🌐 {dict.guide.website} ↗
                          </a>
                        )}
                      </dl>
                    </details>
                  )}

                  {p.bookingLabel && (
                    <p className="mt-2 inline-flex w-fit max-w-full items-center gap-1 truncate rounded-full bg-sun-50 px-2 py-0.5 text-[11px] sm:mt-2.5 sm:gap-1.5 sm:px-2.5 sm:py-1 font-bold text-sun-800 ring-1 ring-sun-200">
                      <span aria-hidden="true">🎟️</span>
                      {p.bookingLabel}
                    </p>
                  )}

                  {p.englishOnly && (
                    <p className="mt-2 text-[11px] leading-snug text-amber-700">{dict.englishOnly}</p>
                  )}

                  {p.ticketQuery && citySlug && (
                    <div className="mt-2">
                      <button
                        type="button"
                        aria-expanded={offersOpen.has(p.key)}
                        onClick={() =>
                          setOffersOpen((cur) => {
                            const next = new Set(cur);
                            if (next.has(p.key)) next.delete(p.key);
                            else next.add(p.key);
                            return next;
                          })
                        }
                        className="inline-flex min-h-9 items-center gap-1 rounded-full bg-sun-400 px-3 text-[11px] font-extrabold text-navy-950 sm:text-xs"
                      >
                        🎟️ {ct.ticketOffers} {offersOpen.has(p.key) ? "▴" : "▾"}
                      </button>
                      {offersOpen.has(p.key) && (
                        <div className="mt-2">
                          <ViatorOffers locale={locale} city={citySlug} q={p.ticketQuery} n={3} compact />
                        </div>
                      )}
                    </div>
                  )}

                  {p.ticketQuery && dict.tickets && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:mt-3">
                      <span className="text-[11px] font-bold text-navy-700">
                        <span aria-hidden="true">🎟️ </span>
                        {dict.tickets}
                      </span>
                      {activityLinks(p.ticketQuery).map((l) => (
                        <PartnerLink
                          key={l.partner}
                          partner={l.partner}
                          href={l.href}
                          data-product="activity"
                          data-placement="place_card"
                          dir="ltr"
                          className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-navy-900 ring-1 ring-mist-200 transition hover:ring-sea-300"
                        >
                          {l.name}
                        </PartnerLink>
                      ))}
                    </div>
                  )}

                  {p.lat !== undefined && p.lon !== undefined && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 sm:mt-3">
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
