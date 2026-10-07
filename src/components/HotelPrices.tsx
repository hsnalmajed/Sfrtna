"use client";

import { nightsLabel } from "@/lib/format";

import { useEffect, useMemo, useState } from "react";
import type { HotelResult, HotelSearch } from "@/lib/providers/serpapi";
import { hotelPartnerLinks } from "@/lib/affiliateLinks";
import type { getDictionary } from "@/lib/dictionaries";
import { amenityLabels } from "@/lib/hotelAmenities";
import Icon from "@/components/ui/Icon";
import PartnerLink from "@/components/PartnerLink";

/**
 * One hotel in full: photos, what it offers, and its price at each partner.
 *
 * Prices come from Google Hotels (through SerpApi, cached six hours) and
 * only for the booking sites we earn from — Booking.com, Expedia, Agoda and
 * Hotels.com, each through a Stay22 Allez link that lands on this hotel —
 * each beside its own booking button. A hotel with no partner price shows no number, only the partner
 * searches. (A city's hotels are Stay22's widget — see Stay22HotelMap.)
 */

type T = ReturnType<typeof getDictionary>["hotelResults"];

/** Google's name for each partner's site → our partner's name in the links. */
const PARTNERS: { match: RegExp; partner: string; label: string }[] = [
  { match: /^booking\.com$/i, partner: "Booking.com", label: "Booking.com" },
  { match: /^expedia/i, partner: "Expedia", label: "Expedia" },
  { match: /^agoda$/i, partner: "Agoda", label: "Agoda" },
  { match: /^hotels\.com$/i, partner: "Hotels.com", label: "Hotels.com" },
];

interface Common {
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges: number[];
  nights: number;
  locale: "ar" | "en";
  t: T;
  /** The traveller's budget for the stay, 0 when none. */
  budget: number;
}

const nf = (locale: "ar" | "en") => (locale === "ar" ? "ar-SA-u-nu-latn" : "en-US");

/**
 * "1,074 SAR", isolated (FSI…PDI) so that inside an Arabic sentence the
 * amount and its code stay together, in order.
 */
function money(n: number, locale: "ar" | "en") {
  return `⁨${Math.round(n).toLocaleString(nf(locale))} SAR⁩`;
}

function apiUrl(c: Common, extra: Record<string, string>) {
  const p = new URLSearchParams({ checkIn: c.checkIn, checkOut: c.checkOut, adults: String(c.adults), ...extra });
  if (c.childrenAges.length) p.set("childrenAges", c.childrenAges.join(","));
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

/** Partner offers with a total, cheapest first, each with its booking link. */
function partnerOffers(hotel: HotelResult, c: Common) {
  const links = hotelPartnerLinks({
    query: hotel.name,
    checkIn: c.checkIn,
    checkOut: c.checkOut,
    adults: c.adults,
    childrenAges: c.childrenAges,
    isHotel: true,
    area: hotel.address,
    lat: hotel.lat,
    lng: hotel.lng,
    locale: c.locale,
  });
  const out: { label: string; partner: string; total: number; url: string }[] = [];
  for (const p of PARTNERS) {
    const offer = hotel.offers.find((o) => p.match.test(o.source));
    const link = links.find((l) => l.partner === p.partner);
    const total = offer?.total ?? (offer?.perNight ? offer.perNight * c.nights : null);
    if (offer && link && total) out.push({ label: p.label, partner: p.partner, total, url: link.url });
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

function Stars({ count, className = "" }: { count: number | null; className?: string }) {
  if (!count) return null;
  return (
    <span className={`tracking-tight text-sun-500 ${className}`} aria-label={`${count}★`}>
      {"★".repeat(count)}
    </span>
  );
}

function Rating({ hotel, c, size = "md" }: { hotel: HotelResult; c: Common; size?: "md" | "lg" }) {
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
function Photo({ src, alt, className, eager }: { src: string; alt: string; className: string; eager?: boolean }) {
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

function Shimmer({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-mist-200/70 ${className}`} />;
}

/* ───────────────────────────── prices ───────────────────────────── */

function PriceRows({
  hotel,
  c,
  checkedAt,
  compact,
}: {
  hotel: HotelResult;
  c: Common;
  checkedAt: string;
  compact?: boolean;
}) {
  const { t, locale } = c;
  const offers = partnerOffers(hotel, c);
  // The cheapest first and alone; the others a tap away, for travellers who
  // book with one site out of habit or for its points.
  const [all, setAll] = useState(false);
  const shown = all ? offers : offers.slice(0, 1);
  const time = new Date(checkedAt).toLocaleTimeString(nf(locale), { hour: "2-digit", minute: "2-digit" });
  if (!offers.length) {
    return (
      <div>
        <p className="text-sm font-semibold text-navy-700">{t.noPartnerPrice}</p>
        <PartnerSearchLinks hotel={hotel} c={c} />
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {shown.map((o, i) => {
        // The first row is the one to book: highlighted even on a tie, but
        // called "cheapest" only when it is.
        const best = i === 0;
        const strictlyCheapest = offers.length > 1 && o.total < offers[1].total;
        const over = c.budget > 0 ? o.total - c.budget : 0;
        return (
          <div
            key={o.label}
            className={`rounded-xl ring-1 ${compact ? "p-3" : "p-4"} ${
              best ? "bg-sun-50 ring-sun-300" : "bg-mist-50 ring-mist-200"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-navy-800">
                  {o.label}
                  {best && strictlyCheapest && (
                    <span className="rounded-full bg-sun-400 px-2 py-0.5 text-[11px] font-extrabold text-navy-950">{t.cheapest}</span>
                  )}
                </p>
                <p className={`font-display font-extrabold text-navy-950 ${compact ? "text-lg" : "text-2xl"}`}>{money(o.total, locale)}</p>
                <p className="text-xs text-navy-600">
                  {c.nights === 1 ? t.stayTotalOne : t.stayTotal.replace("{nights}", nightsLabel(c.nights, t))}
                  {c.nights > 1 && !compact && ` · ${t.perNight.replace("{amount}", money(o.total / c.nights, locale))}`}
                </p>
                {c.budget > 0 && (
                  <p className={`mt-1 text-xs font-bold ${over > 0 ? "text-rose-700" : "text-sea-700"}`}>
                    {over > 0 ? t.overBudget.replace("{amount}", money(over, locale)) : `✓ ${t.withinBudget}`}
                  </p>
                )}
              </div>
              <PartnerLink
                partner={o.partner}
                href={o.url}
                className={`inline-flex shrink-0 items-center justify-center rounded-xl font-extrabold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 ${
                  compact ? "px-3.5 py-2.5 text-xs" : "px-5 py-3 text-sm"
                } ${best ? "bg-sun-400 text-navy-950 shadow-[var(--shadow-sun)] hover:bg-sun-300" : "bg-white text-navy-900 ring-1 ring-mist-200 hover:ring-navy-300"}`}
              >
                {t.bookShort}
              </PartnerLink>
            </div>
          </div>
        );
      })}
      {offers.length > 1 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-extrabold text-navy-800 ring-1 ring-mist-200 transition hover:ring-navy-300"
        >
          {all ? t.fewerPartners : t.morePartners.replace("{count}", String(offers.length - 1))}
          <span aria-hidden="true">{all ? "▴" : "▾"}</span>
        </button>
      )}
      <p className="text-[11px] leading-relaxed text-navy-500">{t.checkedAt.replace("{time}", time)}</p>
    </div>
  );
}

/** Plain partner searches, for when there is no price to show. */
function PartnerSearchLinks({ hotel, c }: { hotel: HotelResult; c: Common }) {
  const links = hotelPartnerLinks({
    query: hotel.name,
    checkIn: c.checkIn,
    checkOut: c.checkOut,
    adults: c.adults,
    childrenAges: c.childrenAges,
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

function Gallery({ hotel }: { hotel: HotelResult }) {
  const imgs = hotel.images;
  if (!imgs.length) return <NoPhoto className="aspect-[16/9] w-full rounded-2xl" />;
  const [main, ...rest] = imgs;
  return (
    <div>
      {/* Phone: one large photo and a row of three under it. */}
      <div className="sm:hidden">
        <Photo src={main.full} alt={hotel.name} eager className="aspect-[16/10] w-full rounded-2xl" />
        {rest.length > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {rest.slice(0, 3).map((im, i) => (
              <Photo key={i} src={im.thumb} alt="" className="aspect-[4/3] w-full rounded-xl" />
            ))}
          </div>
        )}
      </div>
      {/* Wider: a mosaic, the large photo beside four small ones. */}
      <div className="hidden h-[400px] grid-cols-4 grid-rows-2 gap-2 sm:grid">
        <Photo
          src={main.full}
          alt={hotel.name}
          eager
          className={`h-full w-full rounded-2xl ${rest.length ? "col-span-2 row-span-2" : "col-span-4 row-span-2"}`}
        />
        {rest.slice(0, 4).map((im, i) => (
          <Photo
            key={i}
            src={im.full}
            alt=""
            className={`h-full w-full rounded-2xl ${rest.length < 3 ? "col-span-2" : ""} ${rest.length === 1 ? "row-span-2" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}

function HotelDetail({ hotel, c, checkedAt }: { hotel: HotelResult; c: Common; checkedAt: string }) {
  const { t, locale } = c;
  const amenities = amenityLabels(hotel.amenities, locale, 8);
  return (
    // Phone order: photos, then the prices, then the details — the price is
    // what was asked for. Wide screens: photos and details on one side, the
    // prices beside them, following the scroll.
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        <Gallery hotel={hotel} />
      </div>

      <aside className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <div className="rounded-2xl bg-white p-5 shadow-[0_10px_40px_-15px_rgb(10_30_60/0.35)] ring-1 ring-black/5 sm:p-6">
          <p className="font-display text-lg font-extrabold text-navy-950">{t.comparePrices}</p>
          <p className="mb-4 mt-0.5 text-xs text-navy-500">{t.compareSub}</p>
          <PriceRows hotel={hotel} c={c} checkedAt={checkedAt} />
        </div>
        <div className="mt-4 px-1">
          <p className="text-xs font-bold text-navy-600">{t.otherPartners}</p>
          <PartnerSearchLinks hotel={hotel} c={c} />
        </div>
      </aside>

      <div className="min-w-0 lg:col-start-1 lg:row-start-2">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Stars count={hotel.stars} className="text-sm" />
              <h2 className="font-display text-h3 font-extrabold text-navy-950">
                <bdi>{hotel.name}</bdi>
              </h2>
              {hotel.address && (
                <p className="mt-1.5 flex items-start gap-1.5 text-sm text-navy-600">
                  <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" />
                  <bdi>{hotel.address}</bdi>
                </p>
              )}
            </div>
            <Rating hotel={hotel} c={c} size="lg" />
          </div>

          {(hotel.locationRating || hotel.checkInTime || hotel.checkOutTime) && (
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {hotel.locationRating ? (
                <Fact label={t.locationLabel} value={`${hotel.locationRating.toFixed(1)} / 5`} />
              ) : null}
              {hotel.checkInTime && <Fact label={t.checkInLabel} value={hotel.checkInTime} />}
              {hotel.checkOutTime && <Fact label={t.checkOutLabel} value={hotel.checkOutTime} />}
            </dl>
          )}

          {amenities.length > 0 && (
            <div className="mt-5">
              <p className="mb-2.5 text-sm font-bold text-navy-900">{t.amenitiesTitle}</p>
              <ul className="flex flex-wrap gap-2">
                {amenities.map((a) => (
                  <li key={a} className="inline-flex items-center gap-1.5 rounded-full bg-mist-100 px-3 py-1.5 text-xs font-bold text-navy-800">
                    <Icon name="check" className="h-3.5 w-3.5 text-sea-600" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {locale === "en" && hotel.description && (
            <p className="mt-5 text-sm leading-relaxed text-navy-700">{hotel.description}</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-mist-50 px-3.5 py-2.5 ring-1 ring-mist-200">
      <dt className="text-[11px] font-bold text-navy-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-extrabold text-navy-900">
        <bdi>{value}</bdi>
      </dd>
    </div>
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
  }
) {
  const { query, priceQuery, fallback, ...c } = props;
  const url = useMemo(
    () => apiUrl(c, { q: (priceQuery || query).slice(0, 120) }),
    // c is rebuilt each render; its fields are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, priceQuery, c.checkIn, c.checkOut, c.adults, c.childrenAges]
  );

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

  if (!state || state.url !== url) return <DetailSkeleton t={c.t} />;

  const result = state.result;
  const hotel = result?.hotels.find((h) => h.name);
  if (!result || !hotel) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5 sm:p-8">
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-mist-100 text-navy-600">
          <Icon name="hotel" className="h-6 w-6" />
        </span>
        <p className="font-display text-lg font-extrabold text-navy-950">{c.t.unavailableTitle}</p>
        <p className="mx-auto mb-5 mt-1.5 max-w-lg text-sm text-navy-600">{c.t.unavailable}</p>
        {fallback}
      </div>
    );
  }
  // A name Google read as several hotels: the first is the best match for
  // a name picked from its own suggestions.
  return <HotelDetail hotel={hotel} c={c} checkedAt={result.checkedAt} />;
}
