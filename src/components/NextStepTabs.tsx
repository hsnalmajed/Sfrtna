"use client";

import { markMyTripForCity } from "@/lib/myTrip";
import MyTripChip from "@/components/member/MyTripChip";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { COUNTRY_CITIES, type CityEntry } from "@/lib/cities";
import { CITY_AIRPORTS } from "@/data/cityAirports";
import { searchEquals } from "@/lib/search";
import { serializeChildrenAges } from "@/lib/searchParamsUtil";
import TripServices from "@/components/TripServices";

/**
 * The next steps of a trip, under the results (owner, 13 Oct): four tabs in
 * one row — book a hotel (or a flight, on the hotel page), trip services,
 * a trip plan, the attractions — each with its own picture.
 *
 *   hotel    → the hotel results for this city, dates and party, filled in
 *   flight   → the flight form, filled in with this city and dates
 *   services → a sheet over the page with every partner per need
 *   plan     → the city's attractions page, opened on «أنشئ لي / أختار بنفسي»
 *   places   → the city's attractions page
 *
 * Every page they open carries `back`, the page they came from. A tab the
 * traveller has already opened for this trip (this browser tab) is not
 * offered again; the page's own service is never offered.
 */

export type StepKey = "hotel" | "flight" | "services" | "plan" | "places";

export interface TripCity {
  countryCode: string;
  slug: string;
  nameAr: string;
  nameEn: string;
}

/** A covered city by its Arabic or English name, or an airport code. */
export function tripCityFrom(nameOrCode: string): TripCity | undefined {
  const n = nameOrCode.trim();
  if (!n) return undefined;
  for (const [countryCode, cities] of Object.entries(COUNTRY_CITIES)) {
    const hit = cities.find(
      (c: CityEntry) => CITY_AIRPORTS[c.slug]?.iata === n.toUpperCase() || searchEquals(c.nameEn, n) || searchEquals(c.nameAr, n)
    );
    if (hit) return { countryCode, slug: hit.slug, nameAr: hit.nameAr, nameEn: hit.nameEn };
  }
  return undefined;
}

const STORE = "sfr-steps";
function openedFor(slug: string): StepKey[] {
  try {
    const all = JSON.parse(window.sessionStorage.getItem(STORE) || "{}") as Record<string, StepKey[]>;
    return Array.isArray(all[slug]) ? all[slug] : [];
  } catch {
    return [];
  }
}
/** Remember that this step was taken for this city (also used by «احجز»). */
export function markStep(slug: string, step: StepKey) {
  try {
    const all = JSON.parse(window.sessionStorage.getItem(STORE) || "{}") as Record<string, StepKey[]>;
    all[slug] = [...new Set([...(all[slug] ?? []), step])];
    window.sessionStorage.setItem(STORE, JSON.stringify(all));
  } catch {
    /* storage off: every tab stays offered */
  }
  markMyTripForCity(slug, step);
}

export default function NextStepTabs({
  locale,
  current,
  city,
  checkIn,
  checkOut,
  adults,
  childrenAges = [],
  infants = 0,
  withCompensation = false,
}: {
  locale: Locale;
  /** The page's own service — never offered as a next step. */
  current: "flight" | "hotel";
  city: TripCity;
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges?: number[];
  infants?: number;
  withCompensation?: boolean;
}) {
  const dict = useDictionary();
  const t = dict.nextSteps;
  const isAr = locale === "ar";
  const name = isAr ? city.nameAr : city.nameEn;
  const [opened, setOpened] = useState<StepKey[]>([]);
  const [here, setHere] = useState("");
  const [servicesOpen, setServicesOpen] = useState(false);

  useEffect(() => {
    // Read after mount: storage and the address are the browser's.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one read on mount
    setOpened(openedFor(city.slug));
    setHere(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  }, [city.slug]);

  const party = {
    adults: String(Math.max(1, adults)),
    childrenAges: serializeChildrenAges(childrenAges),
    infants: String(infants || 0),
  };
  const withBack = (path: string, p: URLSearchParams, hash = "") => {
    if (here) p.set("back", here);
    return `${path}?${p.toString()}${hash}`;
  };
  const dates = checkIn && checkOut ? { from: checkIn, to: checkOut } : null;
  const iata = CITY_AIRPORTS[city.slug]?.iata;

  const tabs: { key: StepKey; title: string; sub: string; href?: string; art: React.ReactNode }[] = [];
  if (current !== "hotel" && dates) {
    tabs.push({
      key: "hotel",
      title: t.hotel,
      sub: t.hotelSub.replace("{city}", name),
      href: withBack(
        `/${locale}/hotel-results`,
        new URLSearchParams({ hmode: "discover", city: city.nameEn, label: name, checkIn, checkOut, ...party })
      ),
      art: <HotelArt />,
    });
  }
  if (current !== "flight" && iata) {
    tabs.push({
      key: "flight",
      title: t.flight,
      sub: t.flightSub.replace("{city}", name),
      href: `/${locale}?${new URLSearchParams({
        mode: "known",
        tripRoute: dates ? "roundtrip" : "oneway",
        product: "flights",
        destination: iata,
        departDate: checkIn,
        returnDate: checkOut,
        ...party,
      })}#plan`,
      art: <PlaneArt />,
    });
  }
  tabs.push({ key: "services", title: t.services, sub: t.servicesSub, art: <ServicesArt /> });
  const cityPath = `/${locale}/attractions/${city.countryCode}/${city.slug}`;
  const placeParams = () => new URLSearchParams(dates ? { from: checkIn, to: checkOut } : {});
  tabs.push({
    key: "plan",
    title: t.plan,
    sub: t.planSub,
    href: withBack(cityPath, (() => { const p = placeParams(); p.set("plan", "1"); return p; })(), "#trip-plan"),
    art: <PlanArt />,
  });
  tabs.push({ key: "places", title: t.places, sub: t.placesSub, href: withBack(cityPath, placeParams()), art: <PlacesArt /> });

  const shown = tabs.filter((tab) => !opened.includes(tab.key));
  // Every next step opened: the trip page still gathers them.
  if (shown.length === 0) return <MyTripChip locale={locale} slug={city.slug} className="mt-8" />;

  const tile =
    "group flex h-full flex-col overflow-hidden rounded-2xl bg-white text-center shadow-sm ring-1 ring-mist-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-sun-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400";
  const body = (tab: (typeof tabs)[number]) => (
    <>
      <span className="relative block aspect-[16/10] overflow-hidden bg-gradient-to-br from-navy-800 to-navy-990" aria-hidden="true">
        {tab.art}
      </span>
      <span className="flex flex-1 flex-col items-center justify-center px-2 py-2 sm:px-4 sm:py-3">
        <span className="font-display text-[13px] font-extrabold leading-tight text-navy-950 sm:text-base">{tab.title}</span>
        <span className="mt-0.5 hidden text-xs text-navy-500 sm:block">{tab.sub}</span>
      </span>
    </>
  );

  return (
    <section className="mt-10" aria-label={t.title.replace("{city}", name)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-extrabold text-navy-950 sm:text-xl">{t.title.replace("{city}", name)}</h2>
        <MyTripChip locale={locale} slug={city.slug} />
      </div>
      <div className={`grid gap-2 sm:gap-4 ${shown.length >= 4 ? "grid-cols-4" : shown.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {shown.map((tab) =>
          tab.href ? (
            <a key={tab.key} href={tab.href} className={tile} onClick={() => markStep(city.slug, tab.key)}>
              {body(tab)}
            </a>
          ) : (
            <button
              key={tab.key}
              type="button"
              className={tile}
              aria-haspopup="dialog"
              onClick={() => {
                setServicesOpen(true);
                markStep(city.slug, "services");
              }}
            >
              {body(tab)}
            </button>
          )
        )}
      </div>

      {servicesOpen && (
        <ServicesSheet title={t.services} closeLabel={t.close} onClose={() => setServicesOpen(false)}>
          <TripServices
            locale={locale}
            countryCode={city.countryCode}
            citySlug={city.slug}
            cityName={name}
            cityNameEn={city.nameEn}
            withCompensation={withCompensation}
            t={dict.attractions}
          />
        </ServicesSheet>
      )}
    </section>
  );
}

/** A sheet over the page: from the bottom on a phone, centred on a wider screen. */
function ServicesSheet({
  title,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const close = useCallback(() => onClose(), [onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (!panelRef.current?.contains(e.target as Node)) close();
      }}
    >
      <div className="absolute inset-0 bg-navy-990/70 backdrop-blur-sm" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className="relative max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-mist-50 p-4 shadow-2xl app:pb-[calc(1rem+var(--app-tabbar))] outline-none sm:rounded-2xl sm:p-6"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <p id={headingId} className="sr-only">
            {title}
          </p>
          <span className="mx-auto h-1.5 w-10 rounded-full bg-mist-300 sm:hidden" aria-hidden="true" />
          <button
            type="button"
            onClick={close}
            aria-label={closeLabel}
            className="absolute end-3 top-3 rounded-lg p-2 text-navy-400 transition hover:bg-mist-100 hover:text-navy-800"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/* ── The four pictures: one drawing style, brand colours, no text. ── */

const SUN = "var(--color-sun-400, #ffa630)";
const SEA = "var(--color-sea-400, #38bdf8)";

function Sky({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 160 100" className="absolute inset-0 h-full w-full transition duration-500 group-hover:scale-[1.05]" preserveAspectRatio="xMidYMid slice">
      <circle cx="128" cy="24" r="12" fill={SUN} opacity="0.9" />
      <path d="M0 86 Q40 78 80 84 T160 82 V100 H0Z" fill="#fff" opacity="0.08" />
      {children}
    </svg>
  );
}

function HotelArt() {
  return (
    <Sky>
      <rect x="44" y="30" width="56" height="62" rx="3" fill="#fff" opacity="0.92" />
      <rect x="62" y="20" width="20" height="12" rx="2" fill={SUN} />
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}${c}`} x={52 + c * 15} y={38 + r * 12} width="9" height="7" rx="1.5" fill="#0b2a4f" opacity={(r + c) % 3 ? 0.75 : 0.35} />
        ))
      )}
      <rect x="66" y="80" width="12" height="12" rx="2" fill={SUN} />
      <rect x="104" y="58" width="22" height="34" rx="3" fill="#fff" opacity="0.5" />
    </Sky>
  );
}

function PlaneArt() {
  return (
    <Sky>
      <path d="M18 74 Q70 40 138 36" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="5 5" />
      <g transform="translate(86 34) rotate(-12)">
        <path d="M-26 0 L22 -3 Q30 0 22 3 Z" fill="#fff" />
        <path d="M-4 -2 L-14 -18 L-8 -18 L8 -2 Z M-4 2 L-14 18 L-8 18 L8 2 Z" fill="#fff" opacity="0.9" />
        <path d="M-24 -1 L-30 -9 L-26 -9 L-18 -1 Z" fill={SUN} />
      </g>
    </Sky>
  );
}

function ServicesArt() {
  return (
    <Sky>
      <rect x="36" y="42" width="48" height="44" rx="6" fill={SUN} />
      <rect x="50" y="34" width="20" height="10" rx="3" fill="none" stroke={SUN} strokeWidth="4" />
      <rect x="36" y="58" width="48" height="4" fill="#0b2a4f" opacity="0.25" />
      <rect x="92" y="40" width="30" height="46" rx="6" fill="#fff" opacity="0.92" />
      <rect x="99" y="48" width="16" height="12" rx="2" fill={SEA} />
      <path d="M100 74 a7 7 0 0 1 14 0" fill="none" stroke="#0b2a4f" strokeWidth="2.5" opacity="0.6" />
      <path d="M103 74 a4 4 0 0 1 8 0" fill="none" stroke="#0b2a4f" strokeWidth="2.5" opacity="0.6" />
    </Sky>
  );
}

function PlanArt() {
  return (
    <Sky>
      <path d="M28 34 L60 26 L96 34 L130 26 V84 L96 92 L60 84 L28 92 Z" fill="#fff" opacity="0.92" />
      <path d="M60 26 V84 M96 34 V92" stroke="#0b2a4f" strokeOpacity="0.12" strokeWidth="2" />
      <path d="M42 76 Q58 52 76 62 T114 44" fill="none" stroke={SUN} strokeWidth="3" strokeDasharray="6 5" strokeLinecap="round" />
      {[
        [42, 76],
        [76, 62],
        [114, 44],
      ].map(([x, y]) => (
        <g key={`${x}`}>
          <circle cx={x} cy={y - 6} r="6" fill={SEA} />
          <circle cx={x} cy={y - 6} r="2.2" fill="#fff" />
        </g>
      ))}
    </Sky>
  );
}

function PlacesArt() {
  return (
    <Sky>
      <path d="M38 92 V62 Q38 44 58 40 Q78 44 78 62 V92 Z" fill="#fff" opacity="0.92" />
      <rect x="56" y="28" width="4" height="14" fill="#fff" />
      <rect x="84" y="36" width="8" height="56" fill="#fff" opacity="0.75" />
      <path d="M84 36 L88 22 L92 36 Z" fill="#fff" opacity="0.75" />
      <rect x="100" y="56" width="26" height="36" rx="2" fill="#fff" opacity="0.6" />
      <path d="M98 56 L113 44 L128 56 Z" fill={SUN} />
      <rect x="52" y="72" width="12" height="20" rx="6" fill={SEA} />
    </Sky>
  );
}
