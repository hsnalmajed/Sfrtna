"use client";

import { useEffect, useMemo, useState } from "react";
import type { HotelResult, HotelSearch } from "@/lib/providers/serpapi";
import { amenityLabels } from "@/lib/hotelAmenities";
import { CITY_COORDS } from "@/data/cityCoords";
import Icon from "@/components/ui/Icon";
import FilterPill from "@/components/ui/FilterPill";
import { PriceRows, Photo, Rating, Shimmer, Stars, money, forRooms, type Common } from "@/components/HotelPrices";
import { AMENITY_CODE, BREAKFAST_CODE, NO_HOTEL_PREFS, PLACE_TYPE_CODE, type HotelPrefs } from "@/lib/hotelPrefs";
import { useDictionary } from "@/lib/dict/context";
import { track } from "@/lib/analytics";

/**
 * «اقترح لي فندق»: a city's hotels as cards, like the flight cards — photo,
 * stars, rating, distance from the centre, check-in/out, the main amenities,
 * free breakfast, and the lowest price for the whole stay. «عرض السعر في كل
 * المواقع» opens that hotel's price on every site (one more search, only
 * when asked), the same rows as a named hotel's page.
 *
 * One Google Hotels search for the list (SerpApi, cached six hours, paced
 * on the free allowance). When none can be made — `onUnavailable` — the
 * page shows our partners' own hotel list instead.
 */

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = Math.PI / 180;
  const x = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

// Google writes "Free breakfast" when it is included and "Breakfast ($)"
// when it is paid: only the first counts.
const hasBreakfast = (h: HotelResult) => h.amenities.some((a) => /free breakfast/i.test(a));

export default function HotelList({
  cityQuery,
  citySlug,
  cityName,
  minStars,
  maxPerNight,
  breakfast,
  prefs = NO_HOTEL_PREFS,
  c,
  onUnavailable,
}: {
  /** What Google is asked: "Istanbul, Türkiye". */
  cityQuery: string;
  citySlug?: string;
  cityName: string;
  minStars: number;
  maxPerNight: number;
  breakfast: boolean;
  /** Kind of place, facilities, rating, free cancellation — applied by Google itself. */
  prefs?: HotelPrefs;
  c: Common;
  onUnavailable: () => void;
}) {
  const { t, locale } = c;
  const hp = useDictionary().hotelPrefs;
  type Sort = "best" | "cheapest" | "expensive" | "rating" | "stars" | "reviews" | "near";
  const [sort, setSort] = useState<Sort>(prefs.nearTo ? "near" : "best");
  // Booking-style: the price for the whole stay, or a night.
  const [perNight, setPerNight] = useState(false);
  const prefsKey = `${prefs.place}|${prefs.amenities.join(",")}|${prefs.rating}|${prefs.freeCancel ? 1 : 0}|${breakfast ? 1 : 0}`;
  const url = useMemo(() => {
    const p = new URLSearchParams({ q: `hotels in ${cityQuery}`.slice(0, 120), checkIn: c.checkIn, checkOut: c.checkOut, adults: String(c.adults) });
    if (c.childrenAges.length) p.set("childrenAges", c.childrenAges.join(","));
    if (minStars >= 2) p.set("minStars", String(minStars));
    if (maxPerNight > 0) p.set("maxPerNight", String(Math.round(maxPerNight)));
    const [place, amen, rating, fc, bf] = prefsKey.split("|");
    const type = PLACE_TYPE_CODE[place as HotelPrefs["place"]];
    if (type) p.set("types", String(type));
    if (place === "rental") p.set("vr", "1");
    const codes = amen ? amen.split(",").map((a) => AMENITY_CODE[a as keyof typeof AMENITY_CODE]) : [];
    if (bf === "1") codes.push(BREAKFAST_CODE);
    if (codes.length) p.set("amen", codes.join(","));
    if (rating !== "0") p.set("rating", rating);
    if (fc === "1") p.set("fc", "1");
    if (locale === "ar") p.set("lang", "ar");
    return `/api/hotel-prices?${p.toString()}`;
  }, [cityQuery, c.checkIn, c.checkOut, c.adults, c.childrenAges, minStars, maxPerNight, prefsKey, locale]);

  const [state, setState] = useState<{ url: string; result: HotelSearch | null } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { result?: HotelSearch | null } | null) => live && setState({ url, result: b?.result ?? null }))
      .catch(() => live && setState({ url, result: null }));
    return () => {
      live = false;
    };
  }, [url]);

  // Further pages, each one more search, only when asked.
  const [more, setMore] = useState<{ url: string; hotels: HotelResult[]; next: string | null; busy: boolean; ended: boolean }>({
    url: "",
    hotels: [],
    next: null,
    busy: false,
    ended: false,
  });
  const extra = more.url === url ? more : { url, hotels: [] as HotelResult[], next: null, busy: false, ended: false };

  const result = state?.url === url ? state.result : undefined;
  const failed = result === null || (result && result.kind !== "list");
  useEffect(() => {
    if (!failed) return;
    onUnavailable();
    track("service_failure", { service: "hotel_list", reason: result === null ? "no_answer" : "not_a_list" });
  }, [failed, onUnavailable, result]);

  const nextToken = extra.hotels.length ? extra.next : result?.nextPage ?? null;
  const loadMore = () => {
    if (!nextToken || extra.busy) return;
    setMore({ ...extra, busy: true });
    fetch(`${url}&page=${encodeURIComponent(nextToken)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { result?: HotelSearch | null } | null) => {
        const r = b?.result;
        setMore({
          url,
          hotels: [...extra.hotels, ...(r?.hotels ?? [])],
          next: r?.nextPage ?? null,
          busy: false,
          ended: !r,
        });
      })
      .catch(() => setMore({ ...extra, busy: false, ended: true }));
  };

  if (result === undefined) {
    return (
      <div className="space-y-3" aria-busy="true">
        <p className="flex items-center gap-2 text-sm font-semibold text-navy-700">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-200 border-t-sun-500" aria-hidden="true" />
          {t.listChecking.replace("{city}", cityName)}
        </p>
        {[0, 1, 2].map((i) => (
          <Shimmer key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }
  if (failed || !result) return null;

  // Distances from the place the traveller chose («قريب من»), else the centre.
  const centre = prefs.nearTo ? { lat: prefs.nearTo.y, lon: prefs.nearTo.x } : citySlug ? CITY_COORDS[citySlug] : undefined;
  const fromName = prefs.nearTo?.n ?? null;
  const seen = new Set<string>();
  let hotels = [...result.hotels, ...extra.hotels].filter((h) => {
    const key = h.token || h.name;
    if (!h.name || !(h.total || h.perNight) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  let note = "";
  if (breakfast) {
    const withBreakfast = hotels.filter(hasBreakfast);
    if (withBreakfast.length) hotels = withBreakfast;
    else note = t.listNoBreakfast;
  }
  // «قريب من المركز» (owner, 27 Oct: preferences as on Booking): only hotels
  // whose position we know and that are within the chosen distance.
  if (prefs.near && centre) {
    const near = hotels.filter((h) => h.lat != null && h.lng != null && km(centre, { lat: h.lat, lon: h.lng }) <= prefs.near);
    if (near.length) hotels = near;
    else {
      note = [note, t.listNoNear.replace("{km}", String(prefs.near))].filter(Boolean).join(" ");
      const d = (h: HotelResult) => (h.lat != null && h.lng != null ? km(centre, { lat: h.lat, lon: h.lng }) : Infinity);
      hotels = [...hotels].sort((a, b) => d(a) - d(b));
    }
  }
  if (!hotels.length) {
    return <p className="rounded-2xl bg-white p-6 text-center text-sm font-semibold text-navy-700 shadow-sm ring-1 ring-black/5">{t.listEmpty}</p>;
  }
  const dist = (h: HotelResult) => (centre && h.lat != null && h.lng != null ? km(centre, { lat: h.lat, lon: h.lng }) : Infinity);
  const price = (h: HotelResult) => forRooms(h.total ?? (h.perNight ? h.perNight * c.nights : Infinity), c);
  // The most expensive first, hotels with no price at the end.
  const priceDown = (h: HotelResult) => (Number.isFinite(price(h)) ? price(h) : -1);
  if (sort !== "best") {
    hotels = [...hotels].sort((a, b) =>
      sort === "cheapest"
        ? price(a) - price(b)
        : sort === "expensive"
          ? priceDown(b) - priceDown(a)
          : sort === "stars"
            ? (b.stars ?? 0) - (a.stars ?? 0) || (b.rating ?? 0) - (a.rating ?? 0)
            : sort === "rating"
          ? (b.rating ?? 0) - (a.rating ?? 0) || (b.reviews ?? 0) - (a.reviews ?? 0)
          : sort === "reviews"
            ? (b.reviews ?? 0) - (a.reviews ?? 0)
            : dist(a) - dist(b)
    );
  }
  const sorts: [Sort, string][] = [
    ["best", hp.sortBest],
    ["cheapest", hp.sortCheapest],
    ["expensive", hp.sortExpensive],
    ["rating", hp.sortRating],
    ["stars", hp.sortStars],
    ["reviews", hp.sortReviews],
    ...(centre ? ([["near", hp.sortNear]] as [Sort, string][]) : []),
  ];
  return (
    <div className="space-y-3">
      {/* One control, like Booking's "Sort by" (owner, 27 Oct): the chosen order on the pill, every order in its sheet. */}
      <div className="flex items-center gap-2">
        <FilterPill<Sort>
          icon="↕️"
          label={hp.sortLabel}
          options={sorts.map(([value, label]) => ({ value, label }))}
          value={sort}
          onChange={(v) => setSort(v === "all" ? "best" : v)}
          locale={c.locale}
        />
        <span className="text-xs font-semibold text-navy-500">{t.hotelsCount.replace("{count}", String(hotels.length))}</span>
        {c.nights > 1 && (
          <div className="ms-auto flex rounded-full bg-mist-100 p-1 text-xs font-bold" role="group" aria-label={t.priceShowLabel}>
            {[false, true].map((pn) => (
              <button
                key={String(pn)}
                type="button"
                aria-pressed={perNight === pn}
                onClick={() => setPerNight(pn)}
                className={`min-h-8 rounded-full px-3 ${perNight === pn ? "bg-navy-950 text-white" : "text-navy-700"}`}
              >
                {pn ? t.pricePerNight : t.priceWholeStay}
              </button>
            ))}
          </div>
        )}
      </div>
      {note && <p className="text-sm font-semibold text-navy-700">{note}</p>}
      {hotels.map((h) => (
        <HotelCard
          key={h.token || h.name}
          hotel={h}
          c={c}
          distance={centre && h.lat != null && h.lng != null ? km(centre, { lat: h.lat, lon: h.lng }) : null}
          cityName={fromName ?? cityName}
          fromPlace={Boolean(fromName)}
          perNight={perNight}
          cityQuery={cityQuery}
          locale={locale}
        />
      ))}
      {nextToken && !extra.ended && (
        <button
          type="button"
          onClick={loadMore}
          disabled={extra.busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-navy-900 ring-1 ring-mist-200 transition hover:ring-navy-300 disabled:opacity-60"
        >
          {extra.busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-200 border-t-sun-500" aria-hidden="true" />}
          {t.moreHotels.replace("{count}", String(hotels.length))}
        </button>
      )}
      {extra.ended && <p className="text-center text-xs font-semibold text-navy-600">{t.moreHotelsLater}</p>}
    </div>
  );
}

function HotelCard({
  hotel,
  c,
  distance,
  cityName,
  cityQuery,
  locale,
  perNight = false,
  fromPlace = false,
}: {
  perNight?: boolean;
  /** The distance is from a place the traveller chose, not the centre. */
  fromPlace?: boolean;
  hotel: HotelResult;
  c: Common;
  distance: number | null;
  cityName: string;
  cityQuery: string;
  locale: "ar" | "en";
}) {
  const { t } = c;
  const [open, setOpen] = useState(false);
  const one = hotel.total ?? (hotel.perNight ? hotel.perNight * c.nights : null);
  const total = one === null ? null : forRooms(one, c);
  const amenities = amenityLabels(hotel.amenities.filter((a) => !/free breakfast/i.test(a)), locale, 4);
  const img = hotel.images[0];
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="grid sm:grid-cols-[220px_minmax(0,1fr)]">
        {img ? (
          <Photo src={img.thumb} alt={hotel.name} className="aspect-[16/9] w-full sm:aspect-auto sm:h-full" />
        ) : (
          <div className="hidden bg-gradient-to-br from-navy-800 to-navy-950 sm:block" />
        )}
        <div className="flex min-w-0 flex-col gap-2 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <Stars count={hotel.stars} className="text-xs" />
              <h3 className="font-display text-base font-extrabold leading-snug text-navy-950">
                <bdi>{(locale === "ar" && hotel.nameAr) || hotel.name}</bdi>
              </h3>
              {locale === "ar" && hotel.nameAr && (
                <p className="text-xs font-semibold text-navy-500" dir="ltr">
                  {hotel.name}
                </p>
              )}
            </div>
            <Rating hotel={hotel} c={c} />
          </div>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-navy-600">
            {distance != null && (
              <li className="inline-flex items-center gap-1">
                <Icon name="pin" className="h-3.5 w-3.5 text-navy-400" />
                {(fromPlace ? t.fromPlace : t.fromCentre).replace("{km}", distance < 10 ? distance.toFixed(1) : String(Math.round(distance))).replace("{city}", cityName)}
              </li>
            )}
            {hotel.checkInTime && (
              <li>
                {t.checkInLabel}: <bdi>{hotel.checkInTime}</bdi>
              </li>
            )}
            {hotel.checkOutTime && (
              <li>
                {t.checkOutLabel}: <bdi>{hotel.checkOutTime}</bdi>
              </li>
            )}
          </ul>
          {(hasBreakfast(hotel) || amenities.length > 0) && (
            <ul className="flex flex-wrap gap-1.5">
              {hasBreakfast(hotel) && (
                <li className="rounded-full bg-sea-50 px-2.5 py-1 text-[11px] font-extrabold text-sea-800 ring-1 ring-sea-200">☕ {t.freeBreakfast}</li>
              )}
              {amenities.map((a) => (
                <li key={a} className="rounded-full bg-mist-100 px-2.5 py-1 text-[11px] font-bold text-navy-700">
                  {a}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-1">
            {total ? (
              <div>
                <p className="text-[11px] font-bold text-navy-500">{perNight && c.nights > 1 ? t.lowestNight : t.lowestStay}</p>
                <p className="font-display text-xl font-extrabold text-navy-950">{money(perNight && c.nights > 1 ? total / c.nights : total, locale)}</p>
                {perNight && c.nights > 1 && <p className="text-[11px] text-navy-500">{t.stayTotalShort.replace("{amount}", money(total, locale))}</p>}
                {c.budget > 0 && (
                  <p className={`text-xs font-bold ${total > c.budget ? "text-rose-700" : "text-sea-700"}`}>
                    {total > c.budget ? t.overBudget.replace("{amount}", money(total - c.budget, locale)) : `✓ ${t.withinBudget}`}
                  </p>
                )}
              </div>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sun-400 px-4 py-2.5 text-sm font-extrabold text-navy-950 shadow-[var(--shadow-sun)] transition hover:bg-sun-300"
            >
              {t.pricesEverySite}
              <span aria-hidden="true">{open ? "▴" : "▾"}</span>
            </button>
          </div>
        </div>
      </div>
      {open && (
        <div className="border-t border-mist-200 bg-mist-50/60 p-4">
          <AllSites hotel={hotel} c={c} cityQuery={cityQuery} />
        </div>
      )}
    </article>
  );
}

/** The hotel's price on every site: one more search, by its Google id. */
function AllSites({ hotel, c, cityQuery }: { hotel: HotelResult; c: Common; cityQuery: string }) {
  const url = useMemo(() => {
    const p = new URLSearchParams({ q: `${hotel.name} ${cityQuery}`.slice(0, 120), checkIn: c.checkIn, checkOut: c.checkOut, adults: String(c.adults) });
    if (c.childrenAges.length) p.set("childrenAges", c.childrenAges.join(","));
    if (hotel.token) p.set("token", hotel.token);
    return `/api/hotel-prices?${p.toString()}`;
  }, [hotel.name, hotel.token, cityQuery, c.checkIn, c.checkOut, c.adults, c.childrenAges]);
  const [state, setState] = useState<{ url: string; result: HotelSearch | null } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { result?: HotelSearch | null } | null) => live && setState({ url, result: b?.result ?? null }))
      .catch(() => live && setState({ url, result: null }));
    return () => {
      live = false;
    };
  }, [url]);
  if (!state || state.url !== url) {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-navy-700">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-200 border-t-sun-500" aria-hidden="true" />
        {c.t.checking}
      </p>
    );
  }
  // No search left: the list's own hotel, with whatever offers it carried.
  const full = state.result?.hotels.find((h) => h.name) ?? hotel;
  return <PriceRows hotel={{ ...hotel, ...full, lat: full.lat ?? hotel.lat, lng: full.lng ?? hotel.lng }} c={c} checkedAt={state.result?.checkedAt ?? new Date().toISOString()} compact />;
}
