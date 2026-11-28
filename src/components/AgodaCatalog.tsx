"use client";

import { useEffect, useMemo, useState } from "react";
import { useDictionary } from "@/lib/dict/context";
import ScrollRow from "@/components/ui/ScrollRow";

/**
 * Every Agoda hotel of the city (Agoda Partners, direct): our copy of Agoda's
 * hotel file for the list, photos and details; Agoda's live rate for the page
 * shown. 30 at a time with «show more», searchable by Arabic or English name.
 * The price is per night BEFORE taxes and fees, as agoda.com shows it, and is
 * labelled so; the button says «عرض السعر», never «احجز».
 */

interface AgodaCard {
  id: number;
  name: string;
  nameAr: string | null;
  stars: number | null;
  rating: number | null;
  reviews: number;
  lat: number;
  lng: number;
  photo: string;
  type: string;
  shard: number;
  perNight: number | null;
  crossedOut: number | null;
  breakfast: boolean;
  room: string | null;
  url: string;
}
interface AgodaPage {
  total: number;
  matching: number;
  page: number;
  pageSize: number;
  ratesOk: boolean;
  hotels: AgodaCard[];
}
interface AgodaInfo {
  photos: string[];
  address: string;
  addressAr: string;
  overview: string;
  overviewAr: string;
  checkIn: string;
  checkOut: string;
  rooms: number | null;
}

const fmt = (n: number, locale: "ar" | "en") => `⁨${Math.round(n).toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US")} SAR⁩`;

export default function AgodaCatalog({
  citySlug,
  cityName,
  checkIn,
  checkOut,
  adults,
  childrenAges,
  rooms,
  locale,
}: {
  citySlug: string;
  cityName: string;
  checkIn: string;
  checkOut: string;
  /** One room's share (what the rate is asked for). */
  adults: number;
  childrenAges: number[];
  rooms: number;
  locale: "ar" | "en";
}) {
  const t = useDictionary().hotelResults;
  const [query, setQuery] = useState("");
  const [typed, setTyped] = useState("");
  const [sort, setSort] = useState<"popular" | "rating" | "stars">("popular");
  // One search = city, dates, party, name and sort; its pages accumulate.
  const base = useMemo(() => {
    const p = new URLSearchParams({ city: citySlug, checkIn, checkOut, adults: String(adults), rooms: String(rooms), sort });
    if (childrenAges.length) p.set("childrenAges", childrenAges.join(","));
    if (query) p.set("q", query);
    return `/api/agoda-hotels?${p.toString()}`;
  }, [citySlug, checkIn, checkOut, adults, rooms, childrenAges, query, sort]);
  const [state, setState] = useState<{ base: string; pages: AgodaPage[]; gone: boolean; busy: boolean }>({ base: "", pages: [], gone: false, busy: false });

  // Debounced name search.
  useEffect(() => {
    const id = setTimeout(() => setQuery(typed.trim()), 350);
    return () => clearTimeout(id);
  }, [typed]);

  useEffect(() => {
    let live = true;
    fetch(`${base}&page=0`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { result?: AgodaPage | null } | null) => live && setState({ base, pages: b?.result ? [b.result] : [], gone: !b?.result, busy: false }))
      .catch(() => live && setState({ base, pages: [], gone: true, busy: false }));
    return () => {
      live = false;
    };
  }, [base]);

  const current = state.base === base ? state : null;
  const loading = !current || current.busy;
  const more = async (page: number) => {
    setState((s) => ({ ...s, busy: true }));
    try {
      const b = (await fetch(`${base}&page=${page}`).then((r) => r.json())) as { result?: AgodaPage | null };
      setState((s) => (s.base === base && b.result ? { ...s, pages: [...s.pages, b.result], busy: false } : { ...s, busy: false }));
    } catch {
      setState((s) => ({ ...s, busy: false }));
    }
  };

  const gone = current?.gone ?? false;
  const pages = current?.pages ?? state.pages;
  if (gone) return null;
  const first = pages[0];
  const last = pages[pages.length - 1];
  const shown = pages.flatMap((p) => p.hotels);
  const left = last ? last.matching - (last.page + 1) * last.pageSize : 0;

  return (
    <section className="mt-10" aria-labelledby="agoda-all">
      <h2 id="agoda-all" className="font-display text-xl font-extrabold text-navy-950">
        {t.agodaTitle.replace("{city}", cityName)}
      </h2>
      {first && (
        <p className="mt-1 text-sm text-navy-600">{t.agodaSub.replace("{n}", first.total.toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US"))}</p>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={t.agodaSearch}
          aria-label={t.agodaSearch}
          className="min-h-11 flex-1 rounded-xl border border-navy-200 bg-white px-4 text-sm text-navy-950 outline-none focus:border-navy-500"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          aria-label={t.agodaSortPopular}
          className="min-h-11 rounded-xl border border-navy-200 bg-white px-3 text-sm font-bold text-navy-900"
        >
          <option value="popular">{t.agodaSortPopular}</option>
          <option value="rating">{t.agodaSortRating}</option>
          <option value="stars">{t.agodaSortStars}</option>
        </select>
      </div>
      {first && !first.ratesOk && <p className="mt-3 rounded-xl bg-sun-50 px-4 py-2 text-sm text-navy-800">{t.agodaRatesDown}</p>}
      {first && first.matching === 0 && <p className="mt-4 text-sm text-navy-600">{t.agodaNone}</p>}
      <ul className="mt-4 grid gap-3">
        {shown.map((h) => (
          <AgodaRow key={h.id} h={h} citySlug={citySlug} locale={locale} t={t} />
        ))}
      </ul>
      {loading && <p className="mt-3 text-center text-sm text-navy-600">{t.agodaLoading}</p>}
      {!loading && last && left > 0 && (
        <button
          type="button"
          onClick={() => void more(last.page + 1)}
          className="mx-auto mt-4 flex min-h-11 items-center rounded-xl bg-navy-900 px-6 text-sm font-extrabold text-white hover:bg-navy-800"
        >
          {t.agodaMore.replace("{n}", left.toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US"))}
        </button>
      )}
    </section>
  );
}

type T = ReturnType<typeof useDictionary>["hotelResults"];

function AgodaRow({ h, citySlug, locale, t }: { h: AgodaCard; citySlug: string; locale: "ar" | "en"; t: T }) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<AgodaInfo | null>(null);
  const name = locale === "ar" && h.nameAr ? h.nameAr : h.name;
  const other = locale === "ar" && h.nameAr && h.nameAr !== h.name ? h.name : null;
  const map = `https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lng}`;

  const toggle = async () => {
    setOpen((o) => !o);
    if (info) return;
    try {
      const res = await fetch(`/api/agoda-hotel?${new URLSearchParams({ city: citySlug, shard: String(h.shard), id: String(h.id) })}`);
      const json = (await res.json()) as { result?: AgodaInfo | null };
      if (json.result) setInfo(json.result);
    } catch {
      /* details stay closed-empty; the Agoda button still works */
    }
  };

  return (
    <li className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm">
      <div className="flex gap-3 p-3">
        {h.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- Agoda's hotel photo CDN, sized by the browser
          <img src={h.photo} alt={name} loading="lazy" className="h-28 w-28 shrink-0 rounded-xl object-cover sm:h-32 sm:w-44" />
        ) : (
          <div className="h-28 w-28 shrink-0 rounded-xl bg-navy-50 sm:h-32 sm:w-44" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold leading-snug text-navy-950">{name}</h3>
          {other && <p className="truncate text-xs text-navy-500" dir="ltr">{other}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-navy-700">
            {h.stars ? <span className="text-sun-500" aria-label={`${h.stars}★`}>{"★".repeat(Math.round(h.stars))}</span> : null}
            {h.rating ? (
              <span className="rounded-md bg-navy-900 px-1.5 py-0.5 font-bold text-white">{h.rating.toFixed(1)}</span>
            ) : null}
            {h.reviews ? <span>{t.agodaReviews.replace("{n}", h.reviews.toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US"))}</span> : null}
            {h.type && <span className="text-navy-500">{h.type}</span>}
          </div>
          <div className="mt-2">
            {h.perNight !== null ? (
              <p className="text-sm">
                {h.crossedOut && <s className="me-1 text-xs text-navy-400">{fmt(h.crossedOut, locale)}</s>}
                <strong className="text-lg font-extrabold text-navy-950">{fmt(h.perNight, locale)}</strong>{" "}
                <span className="text-xs text-navy-600">{t.agodaPerNight}</span>
                {h.breakfast && <span className="ms-2 text-xs font-bold text-emerald-700">{t.agodaBreakfast}</span>}
              </p>
            ) : (
              <p className="text-xs text-navy-500">{t.agodaNoRoom}</p>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-navy-50 px-3 py-2">
        <a
          href={h.url}
          target="_blank"
          rel="noopener nofollow sponsored"
          className="inline-flex min-h-11 items-center rounded-xl bg-sun-400 px-4 text-sm font-extrabold text-navy-950 hover:bg-sun-300"
        >
          {h.perNight !== null ? t.agodaView : t.agodaCheck}
        </a>
        <button type="button" onClick={() => void toggle()} aria-expanded={open} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-navy-800 hover:bg-navy-50">
          {open ? t.agodaHide : t.agodaDetails}
        </button>
        <a href={map} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-navy-800 hover:bg-navy-50">
          📍 {t.agodaMap}
        </a>
      </div>
      {open && info && (
        <div className="border-t border-navy-50 p-3 text-sm text-navy-800">
          {info.photos.length > 0 && (
            <ScrollRow className="flex gap-2 pb-2">
              {info.photos.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element -- Agoda's hotel photo CDN
                <img key={src} src={src} alt={name} loading="lazy" className="h-40 w-60 shrink-0 rounded-xl object-cover" />
              ))}
            </ScrollRow>
          )}
          {(locale === "ar" ? info.addressAr || info.address : info.address) && (
            <p className="mt-1 text-navy-700">📍 {locale === "ar" ? info.addressAr || info.address : info.address}</p>
          )}
          {(info.checkIn || info.checkOut) && (
            <p className="mt-1 text-navy-700">{t.agodaInOut.replace("{in}", info.checkIn || "—").replace("{out}", info.checkOut || "—")}</p>
          )}
          {info.rooms ? <p className="mt-1 text-navy-700">{t.agodaRooms.replace("{n}", String(info.rooms))}</p> : null}
          {(locale === "ar" ? info.overviewAr || info.overview : info.overview) && (
            <p className="mt-2 leading-relaxed" dir={locale === "ar" && info.overviewAr ? "rtl" : "auto"}>
              {locale === "ar" ? info.overviewAr || info.overview : info.overview}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
