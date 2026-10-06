"use client";

import { useEffect, useMemo, useState } from "react";
import type { HotelResult, HotelSearch } from "@/lib/providers/serpapi";
import { hotelPartnerLinks } from "@/lib/affiliateLinks";
import type { getDictionary } from "@/lib/dictionaries";
import Icon from "@/components/ui/Icon";

/**
 * Live hotel prices, from our partners only.
 *
 * Google Hotels lists some thirty booking sites per hotel; a commission comes
 * only from the ones we have an affiliate link with. So a price shows here
 * only for a partner whose button sits next to it — Booking.com (paid through
 * Stay22's link swap) and Expedia — and every other site is left out. A hotel
 * with no partner price shows no number, only the search buttons.
 *
 * A hotel's name asks its prices at once. A city asks Google's list of hotels
 * first, which carries no per-site prices; each hotel's partner prices are
 * then asked when the traveller taps «اعرض الأسعار» — one search, and only
 * for a hotel someone wanted to see. Both are cached six hours on the server.
 */

type T = ReturnType<typeof getDictionary>["hotelResults"];

/** Google's name for each partner's site → our partner's name in the links. */
const PARTNERS: { match: RegExp; partner: string; label: string }[] = [
  { match: /^booking\.com$/i, partner: "Booking.com", label: "Booking.com" },
  { match: /^expedia/i, partner: "Expedia", label: "Expedia" },
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

/**
 * "1,074 SAR", isolated (FSI…PDI) so that inside an Arabic sentence the
 * amount and its code stay together, in order, instead of the code jumping
 * to the other side of the number.
 */
function money(n: number, locale: "ar" | "en") {
  return `\u2068${Math.round(n).toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US")} SAR\u2069`;
}

function apiUrl(c: Common, extra: Record<string, string>) {
  const p = new URLSearchParams({
    checkIn: c.checkIn,
    checkOut: c.checkOut,
    adults: String(c.adults),
    ...extra,
  });
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
    locale: c.locale,
  });
  const out: { label: string; total: number; url: string }[] = [];
  for (const p of PARTNERS) {
    const offer = hotel.offers.find((o) => p.match.test(o.source));
    const link = links.find((l) => l.partner === p.partner);
    const total = offer?.total ?? (offer?.perNight ? offer.perNight * c.nights : null);
    if (offer && link && total) out.push({ label: p.label, total, url: link.url });
  }
  return out.sort((a, b) => a.total - b.total);
}

function Stars({ count }: { count: number | null }) {
  if (!count) return null;
  return (
    <span className="text-sun-500" aria-hidden="true">
      {"★".repeat(count)}
    </span>
  );
}

function HotelHead({ hotel, c }: { hotel: HotelResult; c: Common }) {
  const { t } = c;
  return (
    <div className="min-w-0">
      <p className="font-display text-lg font-extrabold text-navy-900">{hotel.name}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-navy-600">
        {hotel.stars ? (
          <span>
            <Stars count={hotel.stars} /> <span className="sr-only">{t.starsShort.replace("{count}", String(hotel.stars))}</span>
          </span>
        ) : null}
        {hotel.rating ? (
          <span>
            {t.googleRating.replace("{score}", hotel.rating.toFixed(1))}
            {hotel.reviews ? ` ${t.reviews.replace("{count}", hotel.reviews.toLocaleString(c.locale === "ar" ? "ar-SA-u-nu-latn" : "en-US"))}` : ""}
          </span>
        ) : null}
      </p>
    </div>
  );
}

/** One hotel's partner prices, or the honest "no partner price" line. */
function PriceRows({ hotel, c, checkedAt }: { hotel: HotelResult; c: Common; checkedAt: string }) {
  const { t, locale } = c;
  const offers = partnerOffers(hotel, c);
  const time = new Date(checkedAt).toLocaleTimeString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!offers.length) {
    return <p className="mt-3 text-sm font-semibold text-navy-700">{t.noPartnerPrice}</p>;
  }
  return (
    <div className="mt-4 space-y-2.5">
      {offers.map((o, i) => {
        const over = c.budget > 0 ? o.total - c.budget : 0;
        const best = i === 0 && (offers.length === 1 || o.total < offers[1].total);
        return (
          <div
            key={o.label}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-3.5 ring-1 sm:p-4 ${
              best ? "bg-sun-50 ring-sun-300" : "bg-mist-50 ring-mist-200"
            }`}
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-bold text-navy-800">
                {o.label}
                {i === 0 && offers.length > 1 && o.total < offers[1].total && (
                  <span className="rounded-full bg-sun-400 px-2 py-0.5 text-[11px] font-extrabold text-navy-950">{t.cheapest}</span>
                )}
              </p>
              <p className="mt-0.5 font-display text-xl font-extrabold text-navy-950" dir="ltr">
                {money(o.total, locale)}
              </p>
              <p className="text-xs text-navy-600">
                {c.nights === 1 ? t.stayTotalOne : t.stayTotal.replace("{count}", String(c.nights))}
                {c.nights > 1 && ` · ${t.perNight.replace("{amount}", money(o.total / c.nights, locale))}`}
              </p>
              {c.budget > 0 && (
                <p className={`mt-1 text-xs font-bold ${over > 0 ? "text-rose-700" : "text-sea-700"}`}>
                  {over > 0 ? t.overBudget.replace("{amount}", money(over, locale)) : t.withinBudget}
                </p>
              )}
            </div>
            <a
              href={o.url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 ${
                best ? "bg-sun-400 text-navy-950 hover:bg-sun-300" : "bg-white text-navy-900 ring-1 ring-mist-200 hover:ring-navy-300"
              }`}
            >
              {t.bookAt.replace("{partner}", o.label)}
            </a>
          </div>
        );
      })}
      <p className="text-xs text-navy-500">{t.checkedAt.replace("{time}", time)}</p>
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2.5 text-sm font-semibold text-navy-700">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-200 border-t-sun-500" aria-hidden="true" />
      {text}
    </p>
  );
}

/** A hotel from a city list: its prices are asked when the traveller taps. */
function ListHotel({ hotel, c, query }: { hotel: HotelResult; c: Common; query: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "failed">("idle");
  const [detail, setDetail] = useState<HotelSearch | null>(null);

  const load = async () => {
    if (!hotel.token) return;
    setState("loading");
    const r = await fetchSearch(apiUrl(c, { q: `${hotel.name} ${query}`.slice(0, 120), token: hotel.token }));
    setDetail(r);
    setState(r ? "done" : "failed");
  };

  return (
    <li className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <HotelHead hotel={hotel} c={c} />
        {state === "idle" && hotel.token && (
          <button
            type="button"
            onClick={load}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400"
          >
            <Icon name="search" className="h-4 w-4" strokeWidth={2.4} />
            {c.t.showPrices}
          </button>
        )}
      </div>
      {state === "loading" && (
        <div className="mt-3">
          <Loading text={c.t.checking} />
        </div>
      )}
      {state === "failed" && <p className="mt-3 text-sm font-semibold text-navy-700">{c.t.unavailable}</p>}
      {state === "done" && detail && <PriceRows hotel={detail.hotels[0]} c={c} checkedAt={detail.checkedAt} />}
      {(state === "failed" || (state === "done" && detail && !partnerOffers(detail.hotels[0], c).length)) && (
        <PartnerSearchLinks query={hotel.name} c={c} isHotel />
      )}
    </li>
  );
}

/** Plain partner searches, for when there is no price to show. */
export function PartnerSearchLinks({ query, c, isHotel }: { query: string; c: Common; isHotel: boolean }) {
  const links = hotelPartnerLinks({
    query,
    checkIn: c.checkIn,
    checkOut: c.checkOut,
    adults: c.adults,
    childrenAges: c.childrenAges,
    isHotel,
    locale: c.locale,
  });
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.partner}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="rounded-full bg-white px-3.5 py-2 text-xs font-bold text-navy-900 ring-1 ring-mist-200 transition hover:ring-navy-300"
        >
          {c.t.openAt.replace("{partner}", l.partner)}
        </a>
      ))}
    </div>
  );
}

export default function HotelPrices(
  props: Common & {
    /** The hotel's name (known) or the city (discover). */
    query: string;
    mode: "known" | "discover";
    minStars: number;
    /** Shown when no price could be checked at all: the partner buttons. */
    fallback: React.ReactNode;
  }
) {
  const { query, mode, minStars, fallback, ...c } = props;
  const url = useMemo(() => {
    if (mode === "known") return apiUrl(c, { q: query });
    const extra: Record<string, string> = { q: `hotels in ${query}` };
    if (minStars) extra.minStars = String(minStars);
    if (c.budget > 0 && c.nights > 0) extra.maxPerNight = String(Math.round(c.budget / c.nights));
    return apiUrl(c, extra);
    // c is rebuilt each render; its fields are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, query, minStars, c.checkIn, c.checkOut, c.adults, c.childrenAges, c.budget, c.nights]);

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
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <Loading text={c.t.checking} />
      </div>
    );
  }

  const result = state.result;
  if (!result) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl bg-white p-5 text-sm font-semibold text-navy-700 shadow-sm ring-1 ring-black/5">{c.t.unavailable}</p>
        {fallback}
      </div>
    );
  }

  if (result.kind === "hotel") {
    const hotel = result.hotels[0];
    const hasPrice = partnerOffers(hotel, c).length > 0;
    return (
      <div className="space-y-5">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
          <HotelHead hotel={hotel} c={c} />
          <PriceRows hotel={hotel} c={c} checkedAt={result.checkedAt} />
        </div>
        {!hasPrice ? fallback : (
          <div>
            <p className="mb-1 text-xs font-bold text-navy-600">{c.t.otherPartners}</p>
            <PartnerSearchLinks query={query} c={c} isHotel={mode === "known"} />
          </div>
        )}
      </div>
    );
  }

  // Best rated first, more reviews breaking ties: Google's own order mixes
  // in promoted listings.
  const hotels = result.hotels
    .filter((h) => h.name)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.reviews ?? 0) - (a.reviews ?? 0))
    .slice(0, 12);
  if (!hotels.length) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl bg-white p-5 text-sm font-semibold text-navy-700 shadow-sm ring-1 ring-black/5">{c.t.noList}</p>
        {fallback}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-lg font-extrabold text-navy-900">{c.t.listTitle}</p>
        <p className="mt-1 text-sm text-navy-600">
          {c.t.listNote}
          {mode === "discover" && (minStars || c.budget > 0) ? ` ${c.t.listFiltered}` : ""}
        </p>
      </div>
      <ul className="space-y-3">
        {hotels.map((h, i) => (
          <ListHotel key={`${h.name}-${i}`} hotel={h} c={c} query={mode === "discover" ? query : ""} />
        ))}
      </ul>
      <div>
        <p className="mb-1 text-xs font-bold text-navy-600">{c.t.otherPartners}</p>
        <PartnerSearchLinks query={query} c={c} isHotel={mode === "known"} />
      </div>
    </div>
  );
}
