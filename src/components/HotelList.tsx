"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { HotelResult, HotelSearch } from "@/lib/providers/serpapi";
import { keyAmenities, otherAmenities } from "@/lib/hotelAmenities";
import { CITY_COORDS } from "@/data/cityCoords";
import Icon from "@/components/ui/Icon";
import FilterPill from "@/components/ui/FilterPill";
import FilterSheet, { type SheetGroup } from "@/components/ui/FilterSheet";
import FilterSidebar from "@/components/ui/FilterSidebar";
import BudgetSlider from "@/components/ui/BudgetSlider";
import ScrollRow from "@/components/ui/ScrollRow";
import FavButton from "@/components/member/FavButton";
import dynamic from "next/dynamic";
import type { MapHotel } from "@/components/HotelsMap";

const HotelsMap = dynamic(() => import("@/components/HotelsMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-mist-200/70" />,
});
import {
  FACILITIES,
  NEAR_BANDS,
  NO_FACETS,
  RATING_FLOORS_5,
  activeCount,
  brandOf,
  hasFacility,
  nearbyText,
  passes,
  priceBands,
  type FacetInput,
  type Facets,
  type Facility,
} from "@/lib/hotelFacets";
import { PriceRows, Photo, Shimmer, Stars, money, forRooms, ratingWord, rememberHotel, type Common } from "@/components/HotelPrices";
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
  // «اختر»: the hotel's own page, same dates and party, with the way back
  // to this list (and the list's facts, so it opens at once).
  const sp = useSearchParams();
  const pathname = usePathname();
  const pageHref = useCallback(
    (h: HotelResult) => {
      const p = new URLSearchParams(sp.toString());
      for (const k of ["city", "label", "minStars", "breakfast", "page"]) p.delete(k);
      p.set("hmode", "known");
      p.set("hotel", h.name);
      if (c.locale === "ar" && h.nameAr) p.set("label", h.nameAr);
      if (h.token) p.set("token", h.token);
      p.set("hotelArea", cityQuery);
      p.set("areaLabel", cityName);
      if (citySlug) p.set("hcity", citySlug);
      p.set("back", `${pathname}?${sp.toString()}`);
      return `${pathname}?${p.toString()}`;
    },
    [sp, pathname, cityQuery, cityName, citySlug, c.locale]
  );
  const { t, locale } = c;
  const hp = useDictionary().hotelPrefs;
  type Sort = "best" | "cheapest" | "expensive" | "rating" | "stars" | "reviews" | "near";
  const [sort, setSort] = useState<Sort>(prefs.nearTo ? "near" : "best");
  // Booking-style: the price for the whole stay, or a night.
  const [perNight, setPerNight] = useState(false);
  // Booking-style filters on the list we hold: instant, no extra search.
  const [facets, setFacets] = useState<Facets>(NO_FACETS);
  // The list on a full-screen map (Booking's «Show on map»).
  const [mapOpen, setMapOpen] = useState(false);
  useEffect(() => {
    if (!mapOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMapOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mapOpen]);
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

  // Facets: every option shows how many hotels it would keep, given the
  // other filters already chosen (as Booking counts them).
  const inputs: FacetInput[] = hotels.map((h) => ({ hotel: h, perNight: price(h) / Math.max(1, c.nights), km: dist(h) }));
  const bands = priceBands(inputs.map((x) => x.perNight));
  const count = (skip: keyof Facets, test: (x: FacetInput) => boolean) =>
    inputs.filter((x) => passes(x, facets, bands, skip) && test(x)).length;
  const fx = hp.facets;
  const totalHeld = hotels.length;
  hotels = inputs.filter((x) => passes(x, facets, bands)).map((x) => x.hotel);
  const set = (patch: Partial<Facets>) => {
    setFacets((f) => ({ ...f, ...patch }));
    track("hotel_filter", { filter: Object.keys(patch)[0] });
  };
  const amount = (n: number) => money(n, locale);
  const priceOpts = bands.map((top, i) => {
    const low = i > 0 ? bands[i - 1] : 0;
    return {
      value: Number.isFinite(top) ? top : -1,
      label: !Number.isFinite(top) ? fx.priceOver.replace("{a}", amount(low)) : i === 0 ? fx.priceUpTo.replace("{b}", amount(top)) : fx.priceBetween.replace("{a}", amount(low)).replace("{b}", amount(top)),
      count: count("price", (x) => x.perNight > low && x.perNight <= top),
    };
  });
  const brandCounts = new Map<string, number>();
  for (const x of inputs) {
    const b = brandOf(x.hotel.name);
    if (b && passes(x, facets, bands, "brands")) brandCounts.set(b, (brandCounts.get(b) ?? 0) + 1);
  }
  for (const b of facets.brands) if (!brandCounts.has(b)) brandCounts.set(b, 0);
  const facilityOpts = FACILITIES.map((f) => ({ value: f, label: fx.facility[f], count: count("facilities", (x) => hasFacility(x.hotel, f) && facets.facilities.every((g) => hasFacility(x.hotel, g))) })).filter(
    (o) => o.count > 0 || facets.facilities.includes(o.value)
  );
  const starOpts = [5, 4, 3, 2].map((n) => ({ value: n, label: fx.starsN.replace("{n}", String(n)), count: count("stars", (x) => x.hotel.stars === n) })).filter((o) => o.count > 0 || facets.stars.includes(o.value));
  const anyEco = inputs.some((x) => x.hotel.eco);
  // Every group in one sheet behind «الفلاتر» (Booking's phone layout); the
  // chosen ones stay in sight as chips that remove themselves on a tap.
  const groups: SheetGroup[] = [
    ...(priceOpts.length
      ? [{ key: "price", title: fx.price, icon: "💰", multi: true, options: priceOpts, value: facets.price.map((p) => (Number.isFinite(p) ? p : -1)), onChange: (v: (string | number)[]) => set({ price: v.map((n) => (n === -1 ? Infinity : Number(n))) }) }]
      : []),
    {
      key: "rating",
      title: fx.rating,
      icon: "⭐",
      options: RATING_FLOORS_5.map((r) => ({ value: r, label: fx.ratingFloor.replace("{r}", String(r)), count: count("rating", (x) => (x.hotel.rating ?? 0) >= r) })),
      value: facets.rating,
      onChange: (v) => set({ rating: v.map(Number) }),
    },
    ...(starOpts.length ? [{ key: "stars", title: fx.stars, icon: "🏨", multi: true, options: starOpts, value: facets.stars, onChange: (v: (string | number)[]) => set({ stars: v.map(Number) }) }] : []),
    ...(facilityOpts.length
      ? [{ key: "facilities", title: fx.facilities, icon: "🛎️", multi: true, options: facilityOpts, value: facets.facilities, onChange: (v: (string | number)[]) => set({ facilities: v as Facility[] }) }]
      : []),
    ...(centre
      ? [
          {
            key: "near",
            title: fromName ? fx.nearFromPlace.replace("{place}", fromName) : fx.near,
            icon: "📍",
            options: NEAR_BANDS.map((k) => ({ value: k, label: fx.nearBand.replace("{km}", String(k)), count: count("near", (x) => x.km <= k) })),
            value: facets.near ? [facets.near] : [],
            onChange: (v: (string | number)[]) => set({ near: v.length ? Number(v[0]) : 0 }),
          },
        ]
      : []),
    ...(brandCounts.size
      ? [
          {
            key: "brands",
            title: fx.brands,
            icon: "🏷️",
            multi: true,
            options: [...brandCounts].sort((a, b) => b[1] - a[1]).map(([b, n]) => ({ value: b, label: b, count: n })),
            value: facets.brands,
            onChange: (v: (string | number)[]) => set({ brands: v.map(String) }),
          },
        ]
      : []),
    ...(anyEco ? [{ key: "eco", title: fx.eco, icon: "🌿", options: [{ value: 1, label: fx.eco, count: count("eco", (x) => Boolean(x.hotel.eco)) }], value: facets.eco ? [1] : [], onChange: (v: (string | number)[]) => set({ eco: v.length > 0 }) }] : []),
  ];
  const chosen = [
    ...(facets.range
      ? [{ key: "range", label: t.rangeChip.replace("{a}", amount(facets.range[0])).replace("{b}", amount(facets.range[1])), drop: () => set({ range: null }) }]
      : []),
    ...groups.flatMap((g) =>
      g.value.map((v) => ({
        key: `${g.key}:${v}`,
        label: g.options.find((o) => o.value === v)?.label ?? String(v),
        drop: () => g.onChange(g.value.filter((x) => x !== v)),
      }))
    ),
  ];
  // The list's hotels on the map: every one we know the place of, each pin its price.
  const mapHotels: MapHotel[] = hotels
    .filter((h) => h.lat != null && h.lng != null)
    .map((h) => {
      const pn = price(h) / Math.max(1, c.nights);
      return {
        key: h.token || h.name,
        lat: h.lat as number,
        lng: h.lng as number,
        price: Number.isFinite(pn) ? amount(perNight && c.nights > 1 ? pn : price(h)) : "",
        name: (locale === "ar" && h.nameAr) || h.name,
        sub: [h.stars ? "★".repeat(h.stars) : "", h.rating ? `${h.rating.toFixed(1)} / 5` : ""].filter(Boolean).join("  ·  "),
        href: pageHref(h),
        thumb: h.images[0]?.thumb,
      };
    });
  const byKey = new Map(hotels.map((h) => [h.token || h.name, h]));
  const mapCard =
    mapHotels.length > 1 ? (
      <button
        type="button"
        onClick={() => setMapOpen(true)}
        className="group relative block h-32 w-full overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5"
      >
        <span className="pointer-events-none absolute inset-0">
          <HotelsMap hotels={mapHotels} centre={centre} attribution={t.mapAttribution} compact choose={t.choose} />
        </span>
        <span className="absolute inset-x-0 bottom-3 z-[500] flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-900 px-4 py-2 text-sm font-extrabold text-white shadow-md transition group-hover:bg-navy-800">
            <Icon name="pin" className="h-4 w-4" />
            {t.showOnMap}
          </span>
        </span>
      </button>
    ) : null;
  const budgetShown = inputs.filter((x) => Number.isFinite(x.perNight)).length >= 4;
  const budget = (
    <BudgetSlider
      title={t.budgetNight}
      all={inputs.map((x) => x.perNight)}
      kept={inputs.filter((x) => passes(x, facets, bands, "range")).map((x) => x.perNight)}
      value={facets.range}
      onChange={(range) => set({ range })}
      format={amount}
      resultLabel={(n) => t.budgetKeeps.replace("{n}", String(n))}
    />
  );
  // Phone and tablet: one button and a sheet. Wide screen (lg): the same groups
  // as a column beside the list, on the reading-start side (right in Arabic), as
  // Booking lays it out — the button is hidden there so the two never double.
  // Phone (owner, 7 Nov «الفلاتر خارج»): the most used filters as one-tap
  // chips under the bar, not only inside the sheet.
  const quick = groups.flatMap((g) => {
    const take =
      g.key === "facilities" ? g.options.filter((o) => (o.count ?? 0) > 0).slice(0, 6)
      : g.key === "stars" ? g.options.filter((o) => Number(o.value) >= 4 && (o.count ?? 0) > 0)
      : g.key === "rating" || g.key === "near" ? g.options.filter((o) => (o.count ?? 0) > 0).slice(0, 1)
      : g.key === "eco" ? g.options
      : [];
    return take.map((o) => {
      const on = g.value.includes(o.value);
      return {
        key: `${g.key}:${o.value}`,
        label: g.key === "stars" ? `${o.label} ★` : o.label,
        icon: g.key === "facilities" ? "" : g.icon,
        on,
        toggle: () => g.onChange(on ? g.value.filter((v) => v !== o.value) : g.multi ? [...g.value, o.value] : [o.value]),
      };
    });
  });
  const quickRow =
    quick.length > 0 ? (
      <ScrollRow className="-mx-4 flex gap-2 px-4 pb-1 lg:hidden">
        {quick.map((q) => (
          <button
            key={q.key}
            type="button"
            aria-pressed={q.on}
            onClick={q.toggle}
            className={`inline-flex min-h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3.5 text-sm font-bold ring-1 transition ${q.on ? "bg-navy-900 text-white ring-navy-900" : "bg-white text-navy-800 ring-mist-300 hover:ring-navy-400"}`}
          >
            {q.on && <Icon name="check" className="h-3.5 w-3.5" />}
            {q.icon && <span aria-hidden="true">{q.icon}</span>}
            {q.label}
          </button>
        ))}
      </ScrollRow>
    ) : null;
  const filterBar = (
    <div className="lg:hidden">
      <FilterSheet
        label={fx.button}
        groups={budgetShown ? groups.filter((g) => g.key !== "price") : groups}
        top={budget}
        extraActive={facets.range ? 1 : 0}
        results={fx.showResults.replace("{n}", String(hotels.length))}
        onClear={() => setFacets(NO_FACETS)}
      />
    </div>
  );
  const layout = (main: ReactNode) => (
    <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      <aside className="hidden space-y-3 lg:sticky lg:top-24 lg:block">
        {mapCard}
        <FilterSidebar
          label={fx.button}
          groups={budgetShown ? groups.filter((g) => g.key !== "price") : groups}
          onClear={() => setFacets(NO_FACETS)}
          top={budget}
          extraActive={facets.range ? 1 : 0}
        />
      </aside>
      <div className="min-w-0">{main}</div>
    </div>
  );
  const chips =
    chosen.length > 0 ? (
      <ul className="flex flex-wrap gap-1.5">
        {chosen.map((ch) => (
          <li key={ch.key}>
            <button type="button" onClick={ch.drop} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-navy-900 px-3 text-xs font-bold text-white">
              {ch.label}
              <span aria-hidden="true">✕</span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => setFacets(NO_FACETS)} className="min-h-8 rounded-full px-2 text-xs font-extrabold text-sea-800 hover:underline">
            {fx.clear}
          </button>
        </li>
      </ul>
    ) : null;
  if (!hotels.length) {
    return layout(
      <div className="space-y-3">
        <div className="flex items-center gap-2">{filterBar}</div>
        {quickRow}
        {chips}
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
          <p className="text-sm font-semibold text-navy-700">{fx.none}</p>
          <button type="button" onClick={() => setFacets(NO_FACETS)} className="mt-3 min-h-10 rounded-full bg-sun-400 px-5 text-sm font-extrabold text-navy-950">
            {fx.clear}
          </button>
        </div>
      </div>
    );
  }
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
  return layout(
    <div className="space-y-3">
      {/* Phone: the bar (filters, map, sort) and the quick chips stay in view while scrolling, as on Booking's app. */}
      <div className="sticky top-16 z-20 -mx-4 space-y-2 border-b border-mist-200 bg-mist-50/95 px-4 py-2 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
      {/* One control, like Booking's "Sort by" (owner, 27 Oct): the chosen order on the pill, every order in its sheet. */}
      <div className="flex flex-wrap items-center gap-2">
        {filterBar}
        {mapHotels.length > 1 && (
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-bold text-navy-900 ring-1 ring-mist-300 lg:hidden"
          >
            <Icon name="pin" className="h-4 w-4 text-navy-500" />
            {t.showOnMap}
          </button>
        )}
        <FilterPill<Sort>
          icon="↕️"
          label={hp.sortLabel}
          options={sorts.map(([value, label]) => ({ value, label }))}
          value={sort}
          onChange={(v) => setSort(v === "all" ? "best" : v)}
          locale={c.locale}
        />
        <span className="text-xs font-semibold text-navy-500">
          {activeCount(facets) ? fx.showing.replace("{n}", String(hotels.length)).replace("{m}", String(totalHeld)) : t.hotelsCount.replace("{count}", String(hotels.length))}
        </span>
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
      {quickRow}
      </div>
      {chips}
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
          href={pageHref(h)}
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
      {mapOpen && (
        <div role="dialog" aria-modal="true" aria-label={t.mapOfHotels.replace("{city}", cityName)} className="fixed inset-0 z-[100] flex flex-col bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-mist-200 px-4 py-3">
            <p className="font-display text-base font-extrabold text-navy-950">{t.mapOfHotels.replace("{city}", cityName)}</p>
            <button type="button" autoFocus onClick={() => setMapOpen(false)} className="grid h-11 w-11 place-items-center rounded-full bg-mist-100 text-lg text-navy-900 hover:bg-mist-200" aria-label={t.closeMap}>
              ✕
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <HotelsMap
              hotels={mapHotels}
              centre={centre}
              attribution={t.mapAttribution}
              choose={t.choose}
              onChoose={(k) => {
                const h = byKey.get(k);
                if (h) rememberHotel(h);
              }}
            />
          </div>
        </div>
      )}
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
  href,
}: {
  /** The hotel's own page («اختر»). */
  href: string;
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
  const hp = useDictionary().hotelPrefs;
  const [open, setOpen] = useState(false);
  const one = hotel.total ?? (hotel.perNight ? hotel.perNight * c.nights : null);
  const total = one === null ? null : forRooms(one, c);
  // The framed «خدمات الفندق» box (owner, 7 Nov): breakfast, internet,
  // parking… as Google lists them for this hotel, then everything else it has.
  const key = keyAmenities(hotel.amenities, locale);
  const others = otherAmenities(hotel.amenities, locale, 40);
  const [allServices, setAllServices] = useState(false);
  const name = (locale === "ar" && hotel.nameAr) || hotel.name;
  const choose = () => {
    rememberHotel(hotel);
    track("hotel_select", { hotel: hotel.name });
  };
  const shownPrice = total == null ? null : perNight && c.nights > 1 ? total / c.nights : total;
  // The frame shows the services that decide a booking (breakfast, wifi,
  // parking, pool…) on one line each; everything else is a tap away, so the
  // card stays calm (owner, 7 Nov: «مستوانا احترافي ومرتب»).
  const lead = key.slice(0, 6);
  const rest = [...key.slice(6).map((k) => k.label), ...others];
  const word = hotel.rating ? ratingWord(hotel.rating, t) : "";
  const kmText = distance == null ? "" : distance < 10 ? distance.toFixed(1) : String(Math.round(distance));
  return (
    <article className="group/card overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgb(10_30_60/0.06)] ring-1 ring-mist-300 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-14px_rgb(10_30_60/0.35)] hover:ring-navy-300">
      <div className="grid sm:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_200px]">
        {/* 1 · Photos: swipe or arrows; a tap opens the hotel's page. */}
        <CardPhotos hotel={hotel} href={href} onOpen={choose} t={t} locale={locale} />

        {/* 2 · The hotel: name, where it is, the framed services. */}
        <div className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Stars count={hotel.stars} className="text-xs" />
              {hotel.eco && <span className="rounded-full bg-sea-50 px-2 py-0.5 text-[10px] font-extrabold text-sea-800 ring-1 ring-sea-200">{hp.ecoBadge}</span>}
            </div>
            <h3 className="mt-0.5 font-display text-lg font-extrabold leading-snug text-navy-950">
              <a href={href} onClick={choose} className="decoration-2 underline-offset-4 hover:text-sea-800 hover:underline">
                <bdi>{name}</bdi>
              </a>
            </h3>
            {locale === "ar" && hotel.nameAr && (
              <p className="truncate text-xs font-semibold text-navy-400" dir="ltr">
                {hotel.name}
              </p>
            )}
          </div>

          <ul className="space-y-1 text-[13px] text-navy-700">
            {distance != null && (
              <li className="flex items-center gap-1.5">
                <Icon name="pin" className="h-4 w-4 shrink-0 text-sea-700" />
                <span className="font-bold text-navy-900">
                  {fromPlace ? t.fromPlace.replace("{km}", kmText).replace("{city}", cityName) : t.fromCentreShort.replace("{km}", kmText)}
                </span>
                {hotel.locationRating ? (
                  <span className="text-xs font-bold text-sea-800">· {hp.locationScore.replace("{r}", hotel.locationRating.toFixed(1))}</span>
                ) : null}
              </li>
            )}
            {hotel.nearby?.[0] && (
              <li className="flex items-center gap-1.5 text-xs">
                <span aria-hidden="true" className="w-4 text-center">🚶</span>
                <span className="truncate">{nearbyText(hotel.nearby[0], hp.nearbyLine, locale)}</span>
              </li>
            )}
          </ul>

          {(lead.length > 0 || rest.length > 0) && (
            <div className="mt-auto rounded-xl bg-mist-50 px-3.5 py-3 ring-1 ring-inset ring-mist-200">
              <p className="mb-2 text-[11px] font-extrabold tracking-wide text-navy-500">{t.servicesTitle}</p>
              {lead.length > 0 && (
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {lead.map((k) => (
                    <li key={k.label} className={`flex min-w-0 items-center gap-1.5 text-[13px] font-bold ${k.free ? "text-sea-800" : "text-navy-800"}`}>
                      <span aria-hidden="true" className="shrink-0 text-sm">{k.icon}</span>
                      <span className="leading-tight">{k.label}</span>
                    </li>
                  ))}
                </ul>
              )}
              {rest.length > 0 && (
                <div className={lead.length ? "mt-2 border-t border-mist-200 pt-2" : ""}>
                  {allServices ? (
                    <ul className="flex flex-wrap gap-1">
                      {rest.map((a) => (
                        <li key={a} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-navy-700 ring-1 ring-mist-200">
                          {a}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="truncate text-xs text-navy-600">{rest.slice(0, 4).join(" · ")}</p>
                  )}
                  {rest.length > 4 && (
                    <button type="button" onClick={() => setAllServices((v) => !v)} aria-expanded={allServices} className="mt-1 inline-flex min-h-8 items-center text-xs font-extrabold text-sea-800 hover:underline">
                      {allServices ? t.fewerRoomOptions : t.moreServices.replace("{n}", String(rest.length - 4))}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3 · Rating, price, «اختر»: a column on wide screens, the card's foot on phones. */}
        <div className="flex flex-col gap-3 border-t border-mist-200 bg-gradient-to-b from-white to-mist-50/60 p-4 sm:col-span-2 sm:p-5 xl:col-span-1 xl:border-s xl:border-t-0">
          {hotel.rating ? (
            <div className="flex items-center gap-2.5 xl:justify-end">
              <span className="order-2 xl:order-1 xl:text-end">
                <span className="block text-sm font-extrabold text-navy-950">{word}</span>
                {hotel.reviews ? <span className="block text-[11px] text-navy-500">{t.reviews.replace("{count}", hotel.reviews.toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US"))}</span> : null}
              </span>
              <span className="order-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg rounded-es-none bg-navy-900 xl:order-2 font-display text-base font-extrabold text-white" dir="ltr">
                {hotel.rating.toFixed(1)}
              </span>
            </div>
          ) : (
            <span className="hidden xl:block" />
          )}

          <div className="mt-auto flex items-end justify-between gap-3 xl:block xl:text-end">
            {shownPrice != null ? (
              <div>
                {hotel.dealPct ? (
                  <span className="mb-1 inline-flex items-center gap-1 rounded-md bg-sea-600 px-1.5 py-0.5 text-[11px] font-extrabold text-white" title={t.dealLess.replace("{pct}", String(hotel.dealPct))}>
                    {t.dealShort.replace("{pct}", String(hotel.dealPct))}
                  </span>
                ) : null}
                <p className="text-[11px] font-semibold text-navy-500">{perNight && c.nights > 1 ? t.lowestNight : t.lowestStay}</p>
                <p className="font-display text-2xl font-black leading-tight text-navy-950">{money(shownPrice, locale)}</p>
                {perNight && c.nights > 1 && total != null && <p className="text-[11px] text-navy-500">{t.stayTotalShort.replace("{amount}", money(total, locale))}</p>}
                {c.budget > 0 && total != null && (
                  <p className={`text-[11px] font-bold ${total > c.budget ? "text-rose-700" : "text-sea-700"}`}>
                    {total > c.budget ? t.overBudget.replace("{amount}", money(total - c.budget, locale)) : `✓ ${t.withinBudget}`}
                  </p>
                )}
              </div>
            ) : (
              <span />
            )}
            <div className="flex shrink-0 flex-col gap-1 xl:mt-3">
              <a
                href={href}
                onClick={choose}
                title={t.chooseHint}
                className="inline-flex min-h-12 min-w-[140px] items-center justify-center gap-1.5 rounded-xl bg-sun-400 px-5 text-base font-extrabold text-navy-950 shadow-[var(--shadow-sun)] transition hover:bg-sun-300 xl:w-full"
              >
                {t.choose}
                <span aria-hidden="true" className="transition group-hover/card:-translate-x-0.5 ltr:group-hover/card:translate-x-0.5">
                  {locale === "ar" ? "←" : "→"}
                </span>
              </a>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg px-2 text-xs font-bold text-sea-800 hover:bg-sea-50"
              >
                {t.pricesEverySite}
                <span aria-hidden="true">{open ? "▴" : "▾"}</span>
              </button>
            </div>
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

/**
 * The card's photos (owner, 7 Nov: «صور الفندق» in the frame): the arrows or
 * a swipe step through Google's photos of the hotel, a tap opens its page.
 * No sideways scrolling (one photo at a time), so no rail is needed.
 */
function CardPhotos({ hotel, href, onOpen, t, locale }: { hotel: HotelResult; href: string; onOpen: () => void; t: Common["t"]; locale: "ar" | "en" }) {
  const imgs = hotel.images;
  const [i, setI] = useState(0);
  const [x0, setX0] = useState<number | null>(null);
  if (!imgs.length) return <div className="hidden bg-gradient-to-br from-navy-800 to-navy-950 sm:block" />;
  const n = imgs.length;
  const go = (d: number) => setI((v) => (v + d + n) % n);
  const rtl = locale === "ar";
  return (
    <div
      className="group relative aspect-[16/10] overflow-hidden bg-mist-100 sm:aspect-auto sm:h-full sm:min-h-[230px]"
      onTouchStart={(e) => setX0(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (x0 == null) return;
        const dx = e.changedTouches[0].clientX - x0;
        setX0(null);
        if (Math.abs(dx) > 40) go((dx < 0 ? 1 : -1) * (rtl ? -1 : 1));
      }}
    >
      <a href={href} onClick={onOpen} tabIndex={-1} aria-hidden="true" className="absolute inset-0">
        <Photo key={i} src={imgs[i].full || imgs[i].thumb} alt="" className="h-full w-full" />
      </a>
      <span className="pointer-events-none absolute end-2 top-2 z-[1]">
        <span className="pointer-events-auto">
          <FavButton locale={locale} fav={{ type: "hotel", name: hotel.name, area: "", label: hotel.nameAr || undefined }} />
        </span>
      </span>
      {n > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={t.prevPhoto}
            className="absolute start-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-lg font-bold text-navy-900 shadow transition sm:opacity-0 sm:group-hover:opacity-100"
          >
            <span aria-hidden="true" className="rtl:rotate-180">‹</span>
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={t.nextPhoto}
            className="absolute end-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-lg font-bold text-navy-900 shadow transition sm:opacity-0 sm:group-hover:opacity-100"
          >
            <span aria-hidden="true" className="rtl:rotate-180">›</span>
          </button>
          <span className="pointer-events-none absolute bottom-2 start-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white" dir="ltr">
            {i + 1} / {n}
          </span>
          <span className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1" aria-hidden="true">
            {imgs.slice(0, 8).map((_, k) => (
              <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-4 bg-white" : "w-1.5 bg-white/60"}`} />
            ))}
          </span>
        </>
      )}
    </div>
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
