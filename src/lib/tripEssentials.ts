import pages from "@/data/partnerPages.json";
import { activityLinks } from "@/lib/activityLinks";

/**
 * Everything a traveller needs around the trip, from every partner we earn
 * from for it (Travelpayouts, GetYourGuide) — not one pick per need: the
 * traveller compares, we don't choose for them.
 *
 * Two kinds of link:
 *  - a page for this very place (a city's airport transfers, a country's
 *    eSIM), only when scripts/partners/check-pages.ts found it exists
 *    (src/data/partnerPages.json) — never a guessed address;
 *  - the partner's own home, for partners that are themselves a search
 *    (car-rental and transfer comparison sites, eSIM stores): the traveller
 *    picks the place there.
 * Every link goes through our redirect (/api/go/tp, /api/go/gyg), which looks
 * the page up again by key — never a free URL.
 */

export type ServiceKind = "activity" | "esim" | "transfer" | "car" | "luggage";
export type PlaceBrand =
  | "airalo"
  | "yesim"
  | "saily"
  | "kiwitaxi"
  | "welcomepickups"
  | "intui"
  | "gettransfer"
  | "localrent"
  | "getrentacar"
  | "economybookings"
  | "qeeq"
  | "autoeurope"
  | "radicalstorage"
  | "gocity"
  | "kkday"
  | "wegotrip"
  | "airhelp";

interface BrandInfo {
  name: string;
  kind: ServiceKind | "compensation";
  /** Checked page per country or per city (partnerPages.json). */
  scope?: "country" | "city";
  /** The partner's own home, when it is itself a search. */
  home?: string;
}

export const BRANDS: Record<PlaceBrand, BrandInfo> = {
  airalo: { name: "Airalo", kind: "esim", scope: "country" },
  yesim: { name: "Yesim", kind: "esim", home: "https://yesim.app/" },
  // GigSky dropped 10 Oct: Travelpayouts would not make a link for its web
  // store (app links only), so a visit would not be ours.
  saily: { name: "Saily", kind: "esim", home: "https://saily.com/" },
  kiwitaxi: { name: "Kiwitaxi", kind: "transfer", scope: "city" },
  welcomepickups: { name: "Welcome Pickups", kind: "transfer", scope: "city" },
  intui: { name: "intui.travel", kind: "transfer", home: "https://intui.travel/" },
  gettransfer: { name: "GetTransfer", kind: "transfer", home: "https://gettransfer.com/" },
  localrent: { name: "Localrent", kind: "car", scope: "city" },
  getrentacar: { name: "GetRentacar", kind: "car", home: "https://getrentacar.com/" },
  economybookings: { name: "Economybookings", kind: "car", home: "https://www.economybookings.com/" },
  qeeq: { name: "QEEQ", kind: "car", home: "https://www.qeeq.com/" },
  // The program is Auto Europe's EU/UK site; links to .com were not tracked.
  autoeurope: { name: "Auto Europe", kind: "car", home: "https://www.autoeurope.eu/" },
  radicalstorage: { name: "Radical Storage", kind: "luggage", scope: "city" },
  gocity: { name: "Go City", kind: "activity", scope: "city" },
  kkday: { name: "KKday", kind: "activity", home: "https://www.kkday.com/en" },
  wegotrip: { name: "WeGoTrip", kind: "activity", home: "https://wegotrip.com/en/" },
  airhelp: { name: "AirHelp", kind: "compensation", home: "https://www.airhelp.com/" },
};

interface Pages {
  countries: Record<string, Partial<Record<PlaceBrand, string>>>;
  cities: Record<string, Partial<Record<PlaceBrand, string>>>;
}
const PAGES = pages as unknown as Pages;

/** The checked page for this place, or the partner's home, or null. */
export function brandPage(brand: PlaceBrand, place: { country?: string; city?: string }): string | null {
  const b = BRANDS[brand];
  if (!b) return null;
  const checked =
    b.scope === "country"
      ? place.country && PAGES.countries[place.country]?.[brand]
      : b.scope === "city"
        ? place.city && PAGES.cities[place.city]?.[brand]
        : undefined;
  return checked || b.home || null;
}

export interface ServiceLink {
  partner: string;
  name: string;
  href: string;
}
export interface ServiceGroup {
  kind: ServiceKind;
  links: ServiceLink[];
}

const ORDER: Record<ServiceKind, PlaceBrand[]> = {
  activity: ["gocity", "kkday", "wegotrip"],
  esim: ["airalo", "yesim", "saily"],
  transfer: ["kiwitaxi", "welcomepickups", "intui", "gettransfer"],
  car: ["localrent", "getrentacar", "economybookings", "qeeq", "autoeurope"],
  luggage: ["radicalstorage"],
};

function hrefFor(brand: PlaceBrand, country: string, city: string): string {
  return `/api/go/tp?b=${brand}&c=${country}&p=${city}`;
}

/**
 * Every need with at least one partner for this city: place pages first (they
 * land on the city itself), then partners that are a search of their own.
 */
export function servicesFor(country: string, city: string, cityNameEn: string): ServiceGroup[] {
  const groups: ServiceGroup[] = [];
  for (const kind of Object.keys(ORDER) as ServiceKind[]) {
    const links: ServiceLink[] = [];
    if (kind === "activity") {
      for (const l of activityLinks(cityNameEn)) links.push({ partner: l.partner, name: l.name, href: l.href });
    }
    const brands = ORDER[kind];
    const placed = brands.filter((b) => BRANDS[b].scope && brandPage(b, { country, city }) && !BRANDS[b].home);
    const homes = brands.filter((b) => BRANDS[b].home);
    for (const b of [...placed, ...homes]) links.push({ partner: b, name: BRANDS[b].name, href: hrefFor(b, country, city) });
    if (links.length) groups.push({ kind, links });
  }
  return groups;
}

/** A flight that was late or cancelled: compensation claims (flight results only). */
export const COMPENSATION_LINK: ServiceLink = { partner: "airhelp", name: "AirHelp", href: "/api/go/tp?b=airhelp" };
