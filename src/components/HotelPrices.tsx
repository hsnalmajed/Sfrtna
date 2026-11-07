"use client";

import FavButton from "@/components/member/FavButton";
import { nightsLabel } from "@/lib/format";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { HotelResult, HotelSearch } from "@/lib/providers/serpapi";
import { hotelPartnerLinks } from "@/lib/affiliateLinks";
import type { Dictionary } from "@/lib/dictionaries";
import { amenityGroupLabel, amenityLabel, amenityLabels, keyAmenities } from "@/lib/hotelAmenities";
import Icon from "@/components/ui/Icon";
import PartnerLink from "@/components/PartnerLink";
import ScrollRow from "@/components/ui/ScrollRow";
import { useDictionary } from "@/lib/dict/context";
import { TRANSPORT_AR, durationLabel, topicLabel } from "@/lib/hotelFacets";
import { CITY_COORDS } from "@/data/cityCoords";

const HotelMap = dynamic(() => import("@/components/HotelMap"), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-mist-200/70 sm:h-80" />,
});

/**
 * The list's own facts for a hotel, kept for the tab when «اختر» opens its
 * page: the page shows them at once, then the full answer (by the hotel's
 * Google id) replaces them — and they stay if no search is left.
 */
const SNAP = "sfrtna:hotel:";
export function rememberHotel(h: HotelResult) {
  if (!h.token) return;
  try {
    sessionStorage.setItem(SNAP + h.token, JSON.stringify(h));
  } catch {
    /* private mode / full: the page just loads without the preview */
  }
}
function recallHotel(token: string | undefined): HotelResult | null {
  if (!token) return null;
  try {
    const raw = sessionStorage.getItem(SNAP + token);
    const h = raw ? (JSON.parse(raw) as HotelResult) : null;
    return h && typeof h.name === "string" && Array.isArray(h.images) && Array.isArray(h.offers) ? h : null;
  } catch {
    return null;
  }
}

function kmBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = Math.PI / 180;
  const x = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

/**
 * One hotel in full: photos, what it offers, and its price on every site.
 *
 * Prices come from Google Hotels (through SerpApi, cached six hours) for
 * EVERY site selling the hotel — owner's decision 13 Oct 2026: partners or
 * not, so the traveller sees the whole market here. Our partners (Booking,
 * Expedia, Agoda, Hotels.com) open through a Stay22 Allez link that lands on
 * this hotel and earns; any other site opens through the page Google gives
 * for it, on this hotel and these dates. The button shows the price —
 * «عرض السعر», never «احجز». Always in view: the cheapest, our partners and
 * well-known names (the hotel's own site, the big agencies); the rest fold
 * under «عرض N مواقع أخرى». Sorted by price, honestly.
 */

export type T = Dictionary["hotelResults"];

/** Google's name for each partner's site → our partner's name in the links. */
const PARTNERS: { match: RegExp; partner: string; label: string }[] = [
  { match: /^booking\.com$/i, partner: "Booking.com", label: "Booking.com" },
  { match: /^expedia/i, partner: "Expedia", label: "Expedia" },
  { match: /^agoda$/i, partner: "Agoda", label: "Agoda" },
  { match: /^hotels\.com$/i, partner: "Hotels.com", label: "Hotels.com" },
];

export interface Common {
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges: number[];
  nights: number;
  locale: "ar" | "en";
  t: T;
  /** The traveller's budget for the stay, 0 when none. */
  budget: number;
  /**
   * Rooms booked (src/lib/rooms.ts): `adults`/`childrenAges` above are then
   * ONE room's share (what the price search asks), `party` the whole party
   * (what partner links carry), and every total is a room's × rooms.
   */
  rooms?: number;
  party?: { adults: number; childrenAges: number[] };
  /** Our own list of the city's hotels for these dates: where a hotel with no price sends the traveller. */
  alternatives?: { href: string; city: string };
}

const nf = (locale: "ar" | "en") => (locale === "ar" ? "ar-SA-u-nu-latn" : "en-US");

/**
 * "1,074 SAR", isolated (FSI…PDI) so that inside an Arabic sentence the
 * amount and its code stay together, in order.
 */
export function money(n: number, locale: "ar" | "en") {
  return `⁨${Math.round(n).toLocaleString(nf(locale))} SAR⁩`;
}

function apiUrl(c: Common, extra: Record<string, string>) {
  const p = new URLSearchParams({ checkIn: c.checkIn, checkOut: c.checkOut, adults: String(c.adults), ...extra });
  if (c.childrenAges.length) p.set("childrenAges", c.childrenAges.join(","));
  if (c.locale === "ar") p.set("lang", "ar");
  return `/api/hotel-prices?${p.toString()}`;
}

async function fetchSearch(url: string): Promise<HotelSearch | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: HotelSearch | null };
    return body.result ?? null;
  } catch {
    return null;
  }
}

/** Every site's offer with a total, cheapest first, each with the link that opens it. */
export interface SiteOffer {
  label: string;
  /** For the GA4 partner_click event: our partner's name, or the site's. */
  partner: string;
  total: number;
  url: string | null;
  earns: boolean;
  official: boolean;
  known: boolean;
}

/** Names travellers book with out of habit or trust: always in view. */
const KNOWN = /booking\.com|agoda|expedia|hotels\.com|(^|[^a-z])trip\.com|almosafer|المسافر|wego|tajawal|marriott|hilton|accor|ihg|hyatt|rotana|radisson/i;

/** The whole stay's price from one room's: × the rooms booked. */
export const forRooms = (total: number, c: Pick<Common, "rooms">) => total * Math.max(1, c.rooms ?? 1);

export function siteOffers(hotel: HotelResult, c: Common): SiteOffer[] {
  const links = hotelPartnerLinks({
    query: hotel.name,
    checkIn: c.checkIn,
    checkOut: c.checkOut,
    adults: c.party?.adults ?? c.adults,
    childrenAges: c.party?.childrenAges ?? c.childrenAges,
    rooms: c.rooms,
    isHotel: true,
    area: hotel.address,
    lat: hotel.lat,
    lng: hotel.lng,
    locale: c.locale,
  });
  const out: SiteOffer[] = [];
  for (const o of hotel.offers) {
    const one = o.total ?? (o.perNight ? o.perNight * c.nights : null);
    if (!one) continue;
    const total = forRooms(one, c);
    const p = PARTNERS.find((x) => x.match.test(o.source));
    const partnerLink = p ? links.find((l) => l.partner === p.partner) : undefined;
    out.push({
      label: o.official ? `${o.source} · ${c.t.officialSite}` : p?.label ?? o.source,
      partner: p?.partner ?? o.source,
      total,
      url: partnerLink?.url ?? o.link,
      earns: Boolean(partnerLink),
      official: o.official,
      known: Boolean(p) || o.official || KNOWN.test(o.source),
    });
  }
  return out.sort((a, b) => a.total - b.total);
}

function ratingWord(r: number, t: T) {
  if (r >= 4.5) return t.ratingExcellent;
  if (r >= 4) return t.ratingVeryGood;
  if (r >= 3.5) return t.ratingGood;
  return "";
}

/* ───────────────────────────── small pieces ───────────────────────────── */

export function Stars({ count, className = "" }: { count: number | null; className?: string }) {
  if (!count) return null;
  return (
    <span className={`tracking-tight text-sun-500 ${className}`} aria-label={`${count}★`}>
      {"★".repeat(count)}
    </span>
  );
}

export function Rating({ hotel, c, size = "md" }: { hotel: HotelResult; c: Common; size?: "md" | "lg" }) {
  if (!hotel.rating) return null;
  const word = ratingWord(hotel.rating, c.t);
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`rounded-lg bg-navy-900 font-extrabold text-white ${size === "lg" ? "px-2.5 py-1 text-base" : "px-2 py-0.5 text-sm"}`}
        dir="ltr"
      >
        {hotel.rating.toFixed(1)}
      </span>
      <span className="text-sm font-bold text-navy-900">{word}</span>
      {hotel.reviews ? (
        <span className="text-xs text-navy-500">{c.t.reviews.replace("{count}", hotel.reviews.toLocaleString(nf(c.locale)))}</span>
      ) : null}
    </span>
  );
}

/* A photo from Google's hotel listing. Plain <img>: an external CDN the
   image optimiser cannot reach on this deployment. Hidden if it fails. */
export function Photo({ src, alt, className, eager }: { src: string; alt: string; className: string; eager?: boolean }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <NoPhoto className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Google's hotel photo CDN
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      referrerPolicy="no-referrer"
      onError={() => setOk(false)}
      className={`object-cover ${className}`}
    />
  );
}

function NoPhoto({ className }: { className: string }) {
  return (
    <div className={`grid place-items-center bg-gradient-to-br from-navy-800 to-navy-950 ${className}`}>
      <Icon name="hotel" className="h-10 w-10 text-white/25" />
    </div>
  );
}

export function Shimmer({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-mist-200/70 ${className}`} />;
}

/* ───────────────────────────── prices ───────────────────────────── */

export function PriceRows({
  hotel,
  c,
  checkedAt,
  compact,
  expanded,
}: {
  hotel: HotelResult;
  c: Common;
  checkedAt: string;
  compact?: boolean;
  /** Every site in view from the start (the hotel page's prices section). */
  expanded?: boolean;
}) {
  const { t, locale } = c;
  const offers = siteOffers(hotel, c);
  // In view: the cheapest, our partners and the well-known names; the rest
  // a tap away. Order stays by price either way.
  const [all, setAll] = useState(Boolean(expanded));
  const pinned = offers.filter((o, i) => i === 0 || o.earns || o.known);
  const shown = all ? offers : pinned;
  const hiddenCount = offers.length - pinned.length;
  const time = new Date(checkedAt).toLocaleTimeString(nf(locale), { hour: "2-digit", minute: "2-digit" });
  if (!offers.length) {
    return (
      <div>
        <p className="text-sm font-semibold text-navy-700">{t.noPartnerPrice}</p>
        <PartnerSearchLinks hotel={hotel} c={c} />
      </div>
    );
  }
  const strictlyCheapest = offers.length > 1 && offers[0].total < offers[1].total;
  return (
    <div className="space-y-2">
      {shown.map((o, i) => {
        const best = o === offers[0];
        const over = c.budget > 0 ? o.total - c.budget : 0;
        const button = `inline-flex shrink-0 items-center justify-center gap-1 rounded-xl font-extrabold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 ${
          compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm"
        } ${best ? "bg-sun-400 text-navy-950 shadow-[var(--shadow-sun)] hover:bg-sun-300" : "bg-white text-navy-900 ring-1 ring-mist-200 hover:ring-navy-300"}`;
        return (
          <div
            key={`${o.label}-${i}`}
            className={`flex items-center justify-between gap-3 rounded-xl ring-1 ${compact ? "p-2.5" : "p-3.5"} ${
              best ? "bg-sun-50 ring-sun-300" : "bg-mist-50 ring-mist-200"
            }`}
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-navy-800">
                <bdi className="truncate">{o.label}</bdi>
                {best && strictlyCheapest && (
                  <span className="rounded-full bg-sun-400 px-2 py-0.5 text-[11px] font-extrabold text-navy-950">{t.cheapest}</span>
                )}
              </p>
              <p className={`font-display font-extrabold text-navy-950 ${compact ? "text-base" : "text-xl"}`}>{money(o.total, locale)}</p>
              {!compact && c.nights > 1 && (
                <p className="text-xs text-navy-600">{t.perNight.replace("{amount}", money(o.total / c.nights, locale))}</p>
              )}
              {c.budget > 0 && (
                <p className={`mt-0.5 text-xs font-bold ${over > 0 ? "text-rose-700" : "text-sea-700"}`}>
                  {over > 0 ? t.overBudget.replace("{amount}", money(over, locale)) : `✓ ${t.withinBudget}`}
                </p>
              )}
            </div>
            {o.url ? (
              <PartnerLink partner={o.partner} href={o.url} className={button}>
                {t.viewPrice}
                <span aria-hidden="true">{locale === "ar" ? "←" : "→"}</span>
              </PartnerLink>
            ) : null}
          </div>
        );
      })}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-extrabold text-navy-800 ring-1 ring-mist-200 transition hover:ring-navy-300"
        >
          {all ? t.fewerPartners : t.moreSites.replace("{count}", String(hiddenCount))}
          <span aria-hidden="true">{all ? "▴" : "▾"}</span>
        </button>
      )}
      <p className="text-[11px] leading-relaxed text-navy-500">
        {c.nights === 1 ? t.stayTotalOne : t.stayTotal.replace("{nights}", nightsLabel(c.nights, t))}
        {(c.rooms ?? 1) > 1 && ` · ${t.roomsPriced.replace(/\{count\}/g, String(c.rooms))}`} · {t.checkedAtAll.replace("{time}", time)}
      </p>
    </div>
  );
}

/** Plain partner searches, for when there is no price to show. */
function PartnerSearchLinks({ hotel, c }: { hotel: HotelResult; c: Common }) {
  const links = hotelPartnerLinks({
    query: hotel.name,
    checkIn: c.checkIn,
    checkOut: c.checkOut,
    adults: c.party?.adults ?? c.adults,
    childrenAges: c.party?.childrenAges ?? c.childrenAges,
    rooms: c.rooms,
    isHotel: true,
    area: hotel.address,
    lat: hotel.lat,
    lng: hotel.lng,
    locale: c.locale,
  });
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {links.map((l) => (
        <PartnerLink
          key={l.partner}
          partner={l.partner}
          href={l.url}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-navy-900 ring-1 ring-mist-200 transition hover:ring-navy-300"
        >
          <Icon name="search" className="h-3.5 w-3.5 text-navy-500" />
          {c.t.openAt.replace("{partner}", l.partner)}
        </PartnerLink>
      ))}
    </div>
  );
}

/* ───────────────────────────── one hotel ───────────────────────────── */

function Gallery({ hotel, t }: { hotel: HotelResult; t: T }) {
  const imgs = hotel.images;
  // Which photo is open full screen, or null.
  const [open, setOpen] = useState<number | null>(null);
  const count = imgs.length;
  const step = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + count) % count)), [count]);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      // Arrows follow the page: in Arabic → is "previous".
      const rtl = document.documentElement.dir === "rtl";
      if (e.key === "ArrowRight") step(rtl ? -1 : 1);
      if (e.key === "ArrowLeft") step(rtl ? 1 : -1);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, step]);
  if (!count) return <NoPhoto className="aspect-[16/9] w-full rounded-2xl" />;
  const [main, ...rest] = imgs;
  const tile = (i: number, node: React.ReactNode, cls: string) => (
    <button key={i} type="button" onClick={() => setOpen(i)} className={`group relative block overflow-hidden ${cls}`} aria-label={t.photoOf.replace("{n}", String(i + 1)).replace("{count}", String(count))}>
      {node}
    </button>
  );
  const more =
    count > 1 ? (
      <button
        type="button"
        onClick={() => setOpen(0)}
        className="absolute bottom-3 end-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-2 text-xs font-extrabold text-navy-950 shadow-md ring-1 ring-black/5 hover:bg-white"
      >
        <span aria-hidden="true">🖼️</span>
        {t.allPhotos.replace("{count}", String(count))}
      </button>
    ) : null;
  return (
    <div>
      {/* Phone: one large photo and a row of three under it. */}
      <div className="sm:hidden">
        <div className="relative">
          {tile(0, <Photo src={main.full} alt={hotel.name} eager className="aspect-[16/10] w-full rounded-2xl" />, "w-full rounded-2xl")}
          {more}
        </div>
        {rest.length > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {rest.slice(0, 3).map((im, i) => tile(i + 1, <Photo src={im.thumb} alt="" className="aspect-[4/3] w-full rounded-xl" />, "rounded-xl"))}
          </div>
        )}
      </div>
      {/* Wider: a mosaic, the large photo beside four small ones. */}
      <div className="relative hidden h-[400px] grid-cols-4 grid-rows-2 gap-2 sm:grid">
        {tile(
          0,
          <Photo src={main.full} alt={hotel.name} eager className="h-full w-full rounded-2xl transition group-hover:brightness-95" />,
          `h-full w-full rounded-2xl ${rest.length ? "col-span-2 row-span-2" : "col-span-4 row-span-2"}`
        )}
        {rest.slice(0, 4).map((im, i) =>
          tile(
            i + 1,
            <Photo src={im.full} alt="" className="h-full w-full rounded-2xl transition group-hover:brightness-95" />,
            `h-full w-full rounded-2xl ${rest.length < 3 ? "col-span-2" : ""} ${rest.length === 1 ? "row-span-2" : ""}`
          )
        )}
        {more}
      </div>

      {open !== null && (
        <div role="dialog" aria-modal="true" aria-label={hotel.name} className="fixed inset-0 z-[100] flex flex-col bg-navy-950/95 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
            <p className="text-sm font-bold">
              <bdi>{t.photoOf.replace("{n}", String(open + 1)).replace("{count}", String(count))}</bdi>
            </p>
            <button type="button" onClick={() => setOpen(null)} autoFocus className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-xl hover:bg-white/20" aria-label={t.closePhotos}>
              ✕
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote hotel photos, sized by the browser */}
            <img src={imgs[open].full} alt={open === 0 ? hotel.name : ""} className="max-h-full max-w-full rounded-xl object-contain" />
            {count > 1 && (
              <>
                <button type="button" onClick={() => step(-1)} className="absolute start-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25" aria-label={t.prevPhoto}>
                  <span aria-hidden="true" className="rtl:rotate-180">‹</span>
                </button>
                <button type="button" onClick={() => step(1)} className="absolute end-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25" aria-label={t.nextPhoto}>
                  <span aria-hidden="true" className="rtl:rotate-180">›</span>
                </button>
              </>
            )}
          </div>
          {count > 1 && (
            <ScrollRow tone="dark" className="flex justify-center gap-2 px-4 py-3">
              {imgs.map((im, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setOpen(i)}
                  aria-label={t.photoOf.replace("{n}", String(i + 1)).replace("{count}", String(count))}
                  aria-current={i === open}
                  className={`shrink-0 overflow-hidden rounded-lg ring-2 ${i === open ? "ring-sun-400" : "ring-transparent opacity-60 hover:opacity-100"}`}
                >
                  <Photo src={im.thumb} alt="" className="h-14 w-20" />
                </button>
              ))}
            </ScrollRow>
          )}
        </div>
      )}
    </div>
  );
}

function HotelDetail({
  hotel,
  c,
  checkedAt,
  centre,
  checking = false,
}: {
  hotel: HotelResult;
  c: Common;
  checkedAt: string;
  /** The city centre, for «N كم من وسط المدينة» and the map. */
  centre?: { lat: number; lon: number };
  /** Showing the list's facts while the full answer loads. */
  checking?: boolean;
}) {
  const { t, locale } = c;
  const amenities = amenityLabels(hotel.amenities, locale, 40);
  const key = keyAmenities(hotel.amenities, locale);
  const offers = siteOffers(hotel, c);
  const best = offers[0];
  const hasMap = hotel.lat != null && hotel.lng != null;
  const km = hasMap && centre ? kmBetween(centre, { lat: hotel.lat!, lon: hotel.lng! }) : null;
  const kmText = km == null ? "" : km < 10 ? km.toFixed(1) : String(Math.round(km));
  const nearby = hotel.nearby ?? [];
  const rooms = hotel.rooms ?? [];
  // Google's own groups (Internet, Food & drink…), in the page's language;
  // an item with no Arabic name is left out rather than shown in English.
  const groups = (hotel.amenityGroups ?? [])
    .map((g) => ({
      title: amenityGroupLabel(g.title, locale),
      items: g.items
        .filter((x) => x.available)
        .map((x) => ({ name: amenityLabel(x.name, locale) ?? "", label: x.label && /free/i.test(x.label) ? "free" : x.label && /charge|\$/i.test(x.label) ? "extra" : null }))
        .filter((x, i, all) => x.name && all.findIndex((y) => y.name === x.name) === i),
    }))
    .filter((g) => g.items.length)
    // Same group title twice (two unknown ones → «مرافق أخرى»): merge.
    .reduce<{ title: string; items: { name: string; label: string | null }[] }[]>((acc, g) => {
      const same = acc.find((x) => x.title === g.title);
      if (same) same.items.push(...g.items.filter((i) => !same.items.some((y) => y.name === i.name)));
      else acc.push(g);
      return acc;
    }, []);
  const hasReviews = Boolean((hotel.topics ?? []).some((x) => x.positive + x.negative > 0) || (hotel.ratingsHist ?? []).some((r) => r.count > 0));
  const nav = [
    { id: "hotel-overview", label: t.navOverview, show: true },
    { id: "hotel-prices", label: t.navPrices, show: true },
    { id: "hotel-rooms", label: t.navRooms, show: rooms.length > 0 },
    { id: "hotel-reviews", label: t.navReviews, show: hasReviews },
    { id: "hotel-location", label: t.navLocation, show: nearby.length > 0 || hasMap },
    { id: "hotel-facilities", label: t.navFacilities, show: amenities.length > 0 || groups.length > 0 },
  ].filter((n) => n.show);
  const box = "scroll-mt-32 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6";
  const h3 = "font-display text-lg font-extrabold text-navy-950";
  const arrow = <span aria-hidden="true">{locale === "ar" ? "←" : "→"}</span>;
  const mapsHref = hasMap ? `https://www.google.com/maps/search/?api=1&query=${hotel.lat},${hotel.lng}` : "";
  return (
    <div>
      {/* Jump to a part of the page, as Booking does under its photos. */}
      <nav aria-label={t.navOverview} className="sticky top-16 z-20 -mx-4 mb-4 border-b border-mist-200 bg-mist-50/95 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:bg-white/95">
        <ScrollRow className="flex gap-1 px-4">
          {nav.map((n) => (
            <a key={n.id} href={`#${n.id}`} className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap px-3 text-sm font-bold text-navy-700 hover:text-navy-950">
              {n.label}
            </a>
          ))}
        </ScrollRow>
      </nav>

      {/* 1 · Name, then photos with the side column (rating, map, best price) — Booking's top. */}
      <div id="hotel-overview" className="scroll-mt-32">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Stars count={hotel.stars} className="text-sm" />
            <h2 className="font-display text-h3 font-extrabold text-navy-950">
              <bdi>{(locale === "ar" && hotel.nameAr) || hotel.name}</bdi>
            </h2>
            {locale === "ar" && hotel.nameAr && (
              <p className="text-sm font-semibold text-navy-500" dir="ltr">
                {hotel.name}
              </p>
            )}
            {hotel.address && (
              <p className="mt-1.5 flex items-start gap-1.5 text-sm text-navy-600">
                <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" />
                <bdi>{hotel.address}</bdi>
                {km != null && <span className="whitespace-nowrap font-bold text-navy-700">· {t.fromCentreShort.replace("{km}", kmText)}</span>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <FavButton locale={c.locale} fav={{ type: "hotel", name: hotel.name, area: "", label: hotel.nameAr || undefined }} />
            {best?.url && (
              <a href="#hotel-prices" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-sun-400 px-5 text-sm font-extrabold text-navy-950 shadow-[var(--shadow-sun)] hover:bg-sun-300">
                {t.bookNow}
              </a>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <Gallery hotel={hotel} t={t} />
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <Rating hotel={hotel} c={c} size="lg" />
              {best && (
                <div className="mt-4 border-t border-mist-100 pt-4">
                  <p className="text-xs font-bold text-navy-500">{t.bestPriceTitle}</p>
                  <p className="mt-0.5 text-sm font-bold text-navy-800">
                    <bdi>{t.atSite.replace("{site}", best.label)}</bdi>
                  </p>
                  <p className="font-display text-2xl font-black text-navy-950">{money(best.total, locale)}</p>
                  {hotel.dealPct ? (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-sea-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
                      <span aria-hidden="true">🔥</span>
                      {t.dealLess.replace("{pct}", String(hotel.dealPct))}
                    </p>
                  ) : null}
                  <p className="text-xs text-navy-600">{c.nights === 1 ? t.stayTotalOne : t.stayTotal.replace("{nights}", nightsLabel(c.nights, t))}</p>
                  {hotel.typical && (
                    <p className="mt-1 text-xs font-semibold text-navy-500">
                      {t.typicalRange.replace("{low}", money(hotel.typical.low, locale)).replace("{high}", money(hotel.typical.high, locale))}
                    </p>
                  )}
                  {offers.length > 1 && (
                    <a href="#hotel-prices" className="mt-3 flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-navy-900 px-4 text-sm font-extrabold text-white hover:bg-navy-800">
                      {t.compareSites.replace("{count}", String(offers.length))}
                    </a>
                  )}
                  {checking && (
                    <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-navy-600">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-navy-200 border-t-sun-500" aria-hidden="true" />
                      {t.checking}
                    </p>
                  )}
                </div>
              )}
            </div>
            {/* 2 · The map, small, beside the photos. */}
            {hasMap && (
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                <HotelMap lat={hotel.lat!} lng={hotel.lng!} centre={centre} attribution={t.mapAttribution} small />
                <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-1.5 text-sm font-extrabold text-sea-800 hover:underline">
                  <Icon name="pin" className="h-4 w-4" />
                  {t.openInMaps}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-5">
        {/* 3 · Description and 4 · the most popular facilities. */}
        {(hotel.description || key.length > 0 || hotel.locationRating) && (
          <section className={box}>
            {hotel.description && (
              <>
                <h3 className={h3}>{t.descriptionTitle}</h3>
                {locale === "ar" && <p className="mt-1 text-xs font-semibold text-navy-500">{t.descriptionEnglish}</p>}
                <p className="mt-2 text-sm leading-relaxed text-navy-700" dir="ltr" lang="en">
                  {hotel.description}
                </p>
              </>
            )}
            {(key.length > 0 || hotel.locationRating) && (
              <div className={hotel.description ? "mt-5" : ""}>
                <p className="mb-3 text-sm font-extrabold text-navy-950">{t.highlightsTitle}</p>
                <ul className="flex flex-wrap gap-2">
                  {key.map((k) => (
                    <li
                      key={k.label}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ring-1 ${k.free ? "bg-sea-50 text-sea-900 ring-sea-200" : "bg-mist-50 text-navy-800 ring-mist-200"}`}
                    >
                      <span aria-hidden="true">{k.icon}</span>
                      {k.label}
                    </li>
                  ))}
                  {hotel.locationRating ? (
                    <li className="inline-flex items-center gap-2 rounded-xl bg-mist-50 px-3 py-2 text-sm font-bold text-navy-800 ring-1 ring-mist-200">
                      <span aria-hidden="true">🗺️</span>
                      {t.locationLabel}: {hotel.locationRating.toFixed(1)} / 5
                    </li>
                  ) : null}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* 5 · Every site's price with «احجز» beside it; rooms when Google gives them. */}
        <section id="hotel-prices" className={box}>
          <h3 className={h3}>{t.pricesTitle}</h3>
          <p className="mb-4 mt-1 text-sm text-navy-600">{t.allSitesSub}</p>
          <PriceRows hotel={hotel} c={c} checkedAt={checkedAt} expanded />
          {!offers.length && c.alternatives && (
            <a
              href={c.alternatives.href}
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-sun-400 px-4 text-sm font-extrabold text-navy-950 shadow-[var(--shadow-sun)] hover:bg-sun-300"
            >
              {t.cityAlternatives.replace("{city}", c.alternatives.city)}
              {arrow}
            </a>
          )}
          {rooms.length === 0 && best?.url && (
            <PartnerLink
              partner={best.partner}
              href={best.url}
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-extrabold text-navy-900 ring-1 ring-mist-300 transition hover:ring-navy-400"
            >
              <span aria-hidden="true">🛏️</span>
              {t.seeRooms}
              <bdi className="font-semibold text-navy-500">({best.label})</bdi>
              {arrow}
            </PartnerLink>
          )}
          {rooms.length === 0 && <p className="mt-2 text-[11px] leading-relaxed text-navy-500">{t.roomsAtSite}</p>}
        </section>

        {/* 5b · Rooms, Booking's «Availability»: each room and its options. */}
        {rooms.length > 0 && (
          <section id="hotel-rooms" className={box}>
            <RoomsTable rooms={rooms} offers={offers} c={c} />
          </section>
        )}

        {/* 6 · What guests talk about. */}
        <HotelInsights hotel={hotel} locale={locale} part="reviews" />

        {/* 7 · Around the hotel. */}
        {(nearby.length > 0 || hasMap) && (
          <section id="hotel-location" className={box}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className={h3}>{t.mapTitle}</h3>
              {km != null && <p className="text-sm font-bold text-navy-600">{t.fromCentreShort.replace("{km}", kmText)}</p>}
            </div>
            {nearby.length > 0 ? (
              <NearbyList nearby={nearby} locale={locale} />
            ) : (
              mapsHref && (
                <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-sea-800 hover:underline">
                  <Icon name="pin" className="h-4 w-4" />
                  {t.openInMaps}
                </a>
              )
            )}
          </section>
        )}

        {/* 8 · Every facility. */}
        {groups.length > 0 ? (
          <section id="hotel-facilities" className={box}>
            <h3 className={h3}>{t.allAmenitiesTitle}</h3>
            <div className="mt-4 columns-1 gap-6 sm:columns-2 lg:columns-3">
              {groups.map((g) => (
                <div key={g.title} className="mb-5 break-inside-avoid">
                  <p className="mb-2 text-sm font-extrabold text-navy-950">{g.title}</p>
                  <ul className="space-y-1.5">
                    {g.items.map((x) => (
                      <li key={x.name} className="flex items-start gap-2 text-sm font-semibold text-navy-800">
                        <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-sea-600" />
                        <span>
                          {x.name}
                          {x.label && <span className={`ms-1.5 text-xs font-bold ${x.label === "free" ? "text-sea-700" : "text-navy-500"}`}>({x.label === "free" ? t.amenityFree : t.amenityExtra})</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ) : amenities.length > 0 && (
          <section id="hotel-facilities" className={box}>
            <h3 className={h3}>{t.allAmenitiesTitle}</h3>
            <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {amenities.map((a) => (
                <li key={a} className="flex items-center gap-2 text-sm font-semibold text-navy-800">
                  <Icon name="check" className="h-4 w-4 shrink-0 text-sea-600" />
                  {a}
                </li>
              ))}
            </ul>
          </section>
        )}
        <HotelInsights hotel={hotel} locale={locale} part="facts" />

        {/* 9 · Check-in and check-out (Booking's «house rules», the part we hold). */}
        {(hotel.checkInTime || hotel.checkOutTime) && (
          <section className={box}>
            <h3 className={h3}>{t.checkTimesTitle}</h3>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {hotel.checkInTime && (
                <div className="flex items-center gap-3 rounded-xl bg-mist-50 p-3.5 ring-1 ring-mist-200">
                  <span aria-hidden="true" className="text-xl">🛎️</span>
                  <div>
                    <dt className="text-xs font-bold text-navy-500">{t.checkInLabel}</dt>
                    <dd className="font-display text-base font-extrabold text-navy-950">
                      <bdi>{hotel.checkInTime}</bdi>
                    </dd>
                  </div>
                </div>
              )}
              {hotel.checkOutTime && (
                <div className="flex items-center gap-3 rounded-xl bg-mist-50 p-3.5 ring-1 ring-mist-200">
                  <span aria-hidden="true" className="text-xl">🧳</span>
                  <div>
                    <dt className="text-xs font-bold text-navy-500">{t.checkOutLabel}</dt>
                    <dd className="font-display text-base font-extrabold text-navy-950">
                      <bdi>{hotel.checkOutTime}</bdi>
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}

/** "Dec 5" (Google, English) → the page's own date, in the year of the stay. */
function cancelDate(d: string, checkIn: string, locale: "ar" | "en"): string {
  const m = /^([A-Za-z]{3})\w*\s+(\d{1,2})$/.exec(d.trim());
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const mi = m ? months.indexOf(m[1].toLowerCase()) : -1;
  if (!m || mi < 0) return d;
  const ci = new Date(`${checkIn}T00:00:00Z`);
  let y = Number.isFinite(ci.getTime()) ? ci.getUTCFullYear() : new Date().getUTCFullYear();
  // Free cancellation ends before the stay: December before a January stay is last year.
  if (Number.isFinite(ci.getTime()) && mi > ci.getUTCMonth()) y -= 1;
  return new Date(Date.UTC(y, mi, Number(m[2]))).toLocaleDateString(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

/**
 * Room types, as Booking lists them (owner, 7 Nov): one row a room — its
 * photo, who it sleeps — and under it the room's options from every site,
 * cheapest first, each with what it includes (free cancellation, breakfast)
 * and «احجز» beside it. Only what Google's answer carried.
 */
function RoomsTable({ rooms, offers, c }: { rooms: NonNullable<HotelResult["rooms"]>; offers: SiteOffer[]; c: Common }) {
  const { t, locale } = c;
  const [more, setMore] = useState<Record<string, boolean>>({});
  const [allRooms, setAllRooms] = useState(false);
  // A partner's room opens through our partner link (it lands on the hotel and
  // earns); any other site's room through Google's own link to that room.
  const linkFor = (source: string, link: string | null) => {
    const p = PARTNERS.find((x) => x.match.test(source));
    const o = p ? offers.find((x) => x.earns && x.partner === p.partner) : undefined;
    return o?.url ? { url: o.url, partner: o.partner, label: p?.label ?? source } : link ? { url: link, partner: source || "hotel", label: source } : null;
  };
  type Opt = { key: string; source: string; link: string | null; total: number; guests: number | null; freeCancel: boolean; cancelUntil: string | null; breakfast: boolean };
  const byName = new Map<string, { name: string; image: string; guests: number | null; opts: Opt[] }>();
  for (const r of rooms) {
    const row = byName.get(r.name) ?? { name: r.name, image: "", guests: null, opts: [] };
    row.image ||= r.image;
    row.guests ??= r.guests;
    const rates = r.rates?.length ? r.rates : [{ total: r.total, perNight: r.perNight, guests: r.guests, freeCancel: false, cancelUntil: null, cancelUntilTime: null, breakfast: false }];
    rates.forEach((x, i) => {
      const one = x.total ?? (x.perNight ? x.perNight * c.nights : null);
      if (!one) return;
      row.opts.push({ key: `${r.source}-${i}`, source: r.source, link: r.link, total: forRooms(one, c), guests: x.guests ?? r.guests, freeCancel: x.freeCancel, cancelUntil: x.cancelUntil, breakfast: x.breakfast });
    });
    byName.set(r.name, row);
  }
  const rows = [...byName.values()]
    .filter((r) => r.opts.length)
    .map((r) => ({ ...r, opts: r.opts.sort((a, b) => a.total - b.total) }))
    .sort((a, b) => a.opts[0].total - b.opts[0].total);
  if (!rows.length) return null;
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-extrabold text-navy-950">{t.roomsTitle}</h3>
        <p className="text-xs font-bold text-navy-500">{t.roomTypesCount.replace("{n}", String(rows.length))}</p>
      </div>
      <ul className="space-y-3">
        {(allRooms ? rows : rows.slice(0, 6)).map((r) => {
          const open = more[r.name];
          const shown = open ? r.opts.slice(0, 12) : r.opts.slice(0, 2);
          return (
            <li key={r.name} className="overflow-hidden rounded-2xl ring-1 ring-mist-300">
              <div className="flex items-center gap-3 bg-mist-50 p-3">
                {r.image ? (
                  <Photo src={r.image} alt="" className="h-20 w-28 shrink-0 rounded-xl" />
                ) : (
                  <span className="grid h-20 w-28 shrink-0 place-items-center rounded-xl bg-mist-200 text-2xl" aria-hidden="true">
                    🛏️
                  </span>
                )}
                <div className="min-w-0">
                  <p className="font-display text-sm font-extrabold leading-snug text-sea-900" dir="auto">
                    <bdi>{r.name}</bdi>
                  </p>
                  {r.guests ? (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-navy-600">
                      <span aria-hidden="true">👤</span>
                      {t.roomGuests.replace("{n}", String(r.guests))}
                    </p>
                  ) : null}
                </div>
              </div>
              <ul className="divide-y divide-mist-200">
                {shown.map((o) => {
                  const go = linkFor(o.source, o.link);
                  return (
                    <li key={o.key} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        {/* Only what Google says the option includes: no badge is "not said", not "no". */}
                        {(o.freeCancel || o.breakfast) && (
                          <ul className="flex flex-wrap gap-1.5">
                            {o.freeCancel && (
                              <li className="inline-flex items-center gap-1 rounded-full bg-sea-50 px-2 py-0.5 text-[11px] font-extrabold text-sea-800 ring-1 ring-sea-200">
                                <Icon name="check" className="h-3 w-3" />
                                {o.cancelUntil ? t.freeCancelUntil.replace("{date}", cancelDate(o.cancelUntil, c.checkIn, locale)) : t.freeCancel}
                              </li>
                            )}
                            {o.breakfast && (
                              <li className="inline-flex items-center gap-1 rounded-full bg-sea-50 px-2 py-0.5 text-[11px] font-extrabold text-sea-800 ring-1 ring-sea-200">
                                <span aria-hidden="true">🍳</span>
                                {t.breakfastIncluded}
                              </li>
                            )}
                          </ul>
                        )}
                        <p className="text-xs font-bold text-navy-600">
                          <bdi>{go?.label || o.source}</bdi>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-end">
                          <p className="whitespace-nowrap font-display text-lg font-extrabold leading-tight text-navy-950">{money(o.total, locale)}</p>
                          <p className="text-[11px] text-navy-500">{c.nights === 1 ? t.stayTotalOne : t.stayTotal.replace("{nights}", nightsLabel(c.nights, t))}</p>
                        </div>
                        {go && (
                          <PartnerLink partner={go.partner} href={go.url} className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-sun-400 px-4 text-sm font-extrabold text-navy-950 shadow-[var(--shadow-sun)] hover:bg-sun-300">
                            {t.bookNow}
                          </PartnerLink>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {r.opts.length > 2 && (
                <button
                  type="button"
                  onClick={() => setMore((m) => ({ ...m, [r.name]: !open }))}
                  aria-expanded={Boolean(open)}
                  className="flex min-h-11 w-full items-center justify-center gap-1 border-t border-mist-200 text-sm font-bold text-sea-800 hover:bg-sea-50"
                >
                  {open ? t.fewerRoomOptions : t.moreRoomOptions.replace("{n}", String(Math.min(12, r.opts.length) - 2))}
                  <span aria-hidden="true">{open ? "▴" : "▾"}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {rows.length > 6 && (
        <button
          type="button"
          onClick={() => setAllRooms((v) => !v)}
          aria-expanded={allRooms}
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-white text-sm font-extrabold text-navy-900 ring-1 ring-mist-300 hover:ring-navy-400"
        >
          {allRooms ? t.fewerRoomOptions : t.allRooms.replace("{n}", String(rows.length))}
          <span aria-hidden="true">{allRooms ? "▴" : "▾"}</span>
        </button>
      )}
    </div>
  );
}

function NearbyList({ nearby, locale }: { nearby: NonNullable<HotelResult["nearby"]>; locale: "ar" | "en" }) {
  const hp = useDictionary().hotelPrefs;
  return (
    <div className="mt-5">
      <p className="text-sm font-extrabold text-navy-950">{hp.nearbyTitle}</p>
      <ul className="mt-2 divide-y divide-mist-200">
        {nearby.map((n) => (
          <li key={n.name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="flex min-w-0 items-center gap-2 font-bold text-navy-900">
              <Icon name="pin" className="h-4 w-4 shrink-0 text-navy-400" />
              <bdi className="truncate">{n.name}</bdi>
            </span>
            <span className="shrink-0 text-xs font-semibold text-navy-600">
              {n.how
                .map((w) => `${durationLabel(w.duration, locale)} ${locale === "ar" ? TRANSPORT_AR[w.type.toLowerCase()] ?? "" : w.type.toLowerCase()}`.trim())
                .join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What Booking shows under a hotel and Google gives us in the same answer:
 * what guests say per topic, how the ratings spread, what is around the
 * hotel and how long it takes to get there, and what it does not have.
 */
function HotelInsights({ hotel, locale, part }: { hotel: HotelResult; locale: "ar" | "en"; part: "reviews" | "facts" }) {
  const hp = useDictionary().hotelPrefs;
  const topics = (hotel.topics ?? []).filter((x) => x.positive + x.negative > 0);
  const hist = [...(hotel.ratingsHist ?? [])].sort((a, b) => b.stars - a.stars);
  const histTotal = hist.reduce((n, r) => n + r.count, 0);
  const excluded = amenityLabels(hotel.excluded ?? [], locale, 12);
  const essential = locale === "en" ? hotel.essential ?? [] : [];
  if (part === "reviews" ? !topics.length && !histTotal : !excluded.length && !essential.length && !hotel.eco) return null;
  const box = "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6";
  const h3 = "font-display text-lg font-extrabold text-navy-950";
  return (
    <>
      {part === "reviews" && (topics.length > 0 || histTotal > 0) && (
        <section id="hotel-reviews" className={`${box} scroll-mt-32`}>
          <h3 className={h3}>{hp.topicsTitle}</h3>
          {hotel.reviews ? <p className="mt-1 text-xs font-semibold text-navy-500">{hp.topicsSub.replace("{n}", hotel.reviews.toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US"))}</p> : null}
          {topics.length > 0 && (
            <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {topics.map((x) => {
                const share = Math.round((x.positive / (x.positive + x.negative)) * 100);
                return (
                  <li key={x.name}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-bold text-navy-900">
                        <bdi>{topicLabel(x.name, locale)}</bdi>
                      </span>
                      <span className="flex items-baseline gap-2">
                        <span className="text-[11px] font-semibold text-navy-500">{hp.topicMentions.replace("{n}", String(x.total))}</span>
                        <bdi className="font-extrabold text-navy-950" dir="ltr">{share}%</bdi>
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-rose-100" aria-hidden="true">
                      <div className={`h-full rounded-full ${share >= 80 ? "bg-sea-600" : share >= 60 ? "bg-sun-400" : "bg-rose-500"}`} style={{ width: `${share}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {histTotal > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-bold text-navy-900">{hp.histTitle}</p>
              <ul className="space-y-1.5">
                {hist.map((r) => (
                  <li key={r.stars} className="grid grid-cols-[2.5rem_minmax(0,1fr)_3rem] items-center gap-2 text-xs font-bold text-navy-700">
                    <span dir="ltr">{r.stars} ★</span>
                    <span className="h-2 overflow-hidden rounded-full bg-mist-200" aria-hidden="true">
                      <span className="block h-full rounded-full bg-sun-400" style={{ width: `${(r.count / histTotal) * 100}%` }} />
                    </span>
                    <span className="text-end">{Math.round((r.count / histTotal) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
      {part === "facts" && (excluded.length > 0 || essential.length > 0 || hotel.eco) && (
        <section className={box}>
          {hotel.eco && <p className="mb-3 inline-flex rounded-full bg-sea-50 px-3 py-1.5 text-xs font-extrabold text-sea-800 ring-1 ring-sea-200">{hp.ecoBadge}</p>}
          {essential.length > 0 && (
            <>
              <h3 className={h3}>{hp.essentialTitle}</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {essential.map((e) => (
                  <li key={e} className="rounded-full bg-mist-100 px-3 py-1.5 text-xs font-bold text-navy-800">
                    {e}
                  </li>
                ))}
              </ul>
            </>
          )}
          {excluded.length > 0 && (
            <>
              <h3 className={`${h3} ${essential.length ? "mt-4" : ""}`}>{hp.excludedTitle}</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {excluded.map((a) => (
                  <li key={a} className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800 ring-1 ring-rose-200">
                    <span aria-hidden="true">✕</span>
                    {a}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </>
  );
}

function DetailSkeleton({ t }: { t: T }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        <Shimmer className="h-[260px] w-full sm:h-[400px]" />
        <Shimmer className="h-40 w-full" />
      </div>
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-navy-700">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-200 border-t-sun-500" aria-hidden="true" />
          {t.checking}
        </p>
        <Shimmer className="mb-3 h-24 w-full" />
        <Shimmer className="h-24 w-full" />
      </div>
    </div>
  );
}

/* ───────────────────────────── the view ───────────────────────────── */

export default function HotelPrices(
  props: Common & {
    /** The hotel's name. */
    query: string;
    /** What the price search asks: the name plus where the hotel is, when known. */
    priceQuery?: string;
    /** Shown when nothing could be checked at all: the partner buttons. */
    fallback: React.ReactNode;
    /** Google's id for the hotel, when it was picked from our list («اختر»). */
    token?: string;
    /** Our slug for the hotel's city: the centre for the distance and the map. */
    citySlug?: string;
  }
) {
  const { query, priceQuery, fallback, token, citySlug, ...c } = props;
  const url = useMemo(
    // By its id: the same search (and cache) as the list's «قارن الأسعار».
    () => apiUrl(c, token ? { q: (priceQuery || query).slice(0, 120), token } : { q: (priceQuery || query).slice(0, 120), one: "1" }),
    // c is rebuilt each render; its fields are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, priceQuery, token, c.checkIn, c.checkOut, c.adults, c.childrenAges]
  );
  const centre = citySlug ? CITY_COORDS[citySlug] : undefined;
  // The list's facts for this hotel (same tab), shown while the answer loads.
  // (This page renders in the browser only: it reads the query string.)
  const snap = useMemo(() => (typeof window === "undefined" ? null : recallHotel(token)), [token]);

  const [state, setState] = useState<{ url: string; result: HotelSearch | null } | null>(null);
  useEffect(() => {
    let live = true;
    fetchSearch(url).then((result) => {
      if (live) setState({ url, result });
    });
    return () => {
      live = false;
    };
  }, [url]);

  if (!state || state.url !== url) {
    return snap ? <HotelDetail hotel={snap} c={c} checkedAt={new Date().toISOString()} centre={centre} checking /> : <DetailSkeleton t={c.t} />;
  }

  const result = state.result;
  const found = result?.hotels.find((h) => h.name);
  // No search left: the list's own facts and offers (checked minutes ago).
  if (!found && snap) return <HotelDetail hotel={snap} c={c} checkedAt={new Date().toISOString()} centre={centre} />;
  const hotel = found && snap ? { ...snap, ...found, lat: found.lat ?? snap.lat, lng: found.lng ?? snap.lng, nameAr: found.nameAr || snap.nameAr, images: found.images.length ? found.images : snap.images } : found;
  if (!result || !hotel) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5 sm:p-8">
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-mist-100 text-navy-600">
          <Icon name="hotel" className="h-6 w-6" />
        </span>
        <p className="font-display text-lg font-extrabold text-navy-950">{c.t.unavailableTitle}</p>
        <p className="mx-auto mb-5 mt-1.5 max-w-lg text-sm text-navy-600">{c.t.unavailable}</p>
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-navy-900 px-5 py-3 text-sm font-extrabold text-white"
          >
            {c.t.retry}
          </button>
          {c.alternatives ? (
            <a href={c.alternatives.href} className="rounded-xl bg-sun-400 px-5 py-3 text-sm font-extrabold text-navy-950">
              {c.t.cityAlternatives.replace("{city}", c.alternatives.city)}
            </a>
          ) : (
            fallback
          )}
        </div>
      </div>
    );
  }
  // A name Google read as several hotels: the first is the best match for
  // a name picked from its own suggestions.
  return <HotelDetail hotel={hotel} c={c} checkedAt={result.checkedAt} centre={centre} />;
}
