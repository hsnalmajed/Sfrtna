import type { Trip, TripStep } from "@/lib/memberItems";
import { serializeChildrenAges } from "@/lib/searchParamsUtil";
import { findAirport } from "@/lib/airports";

/** The trip's city in the page's language. */
export function tripCityName(t: Trip, isAr: boolean): string {
  const name = isAr ? t.cityAr : t.cityEn;
  if (name) return name;
  const a = findAirport(t.destination);
  return a ? (isAr ? a.cityAr : a.cityEn) : t.destination;
}

/** Whole days from today (local) to an ISO day; negative when past. */
export function daysUntil(iso: string): number {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - today) / 86_400_000);
}

const party = (t: Trip) => ({ adults: String(t.adults), childrenAges: serializeChildrenAges(t.childrenAges), infants: String(t.infants) });

/** Where each step of getting ready is done, for this trip. */
export function stepHref(locale: string, t: Trip, step: TripStep): string | null {
  const isAr = locale === "ar";
  if (step === "hotel") {
    if (!t.back) return null;
    return `/${locale}/hotel-results?${new URLSearchParams({ hmode: "discover", city: t.cityEn || tripCityName(t, false), label: tripCityName(t, isAr), checkIn: t.depart, checkOut: t.back, ...party(t) })}`;
  }
  if (step === "services") return t.code && t.slug ? `/${locale}/services?code=${t.code}&city=${t.slug}` : `/${locale}/services`;
  if (step === "plan") {
    if (!t.code || !t.slug) return null;
    const p = new URLSearchParams({ from: t.depart, to: t.back || t.depart, plan: "1" });
    return `/${locale}/attractions/${t.code}/${t.slug}?${p}#trip-plan`;
  }
  if (step === "visa") return t.code ? `/${locale}/visa/${t.code}` : null;
  return null;
}

/** The live flight search for this trip, as it was asked. */
export function tripSearchHref(locale: string, t: Trip, currency = "SAR"): string {
  const p = new URLSearchParams({
    tripType: "flight",
    tripRoute: t.back ? "roundtrip" : "oneway",
    origin: t.origin,
    destination: t.destination,
    departDate: t.depart,
    currency,
    ...party(t),
  });
  if (t.back) p.set("returnDate", t.back);
  return `/${locale}/results?${p}`;
}

/** Steps that apply to this trip (no visa line for a Saudi city). */
export function tripSteps(t: Trip): TripStep[] {
  const out: TripStep[] = [];
  if (t.back) out.push("hotel");
  out.push("services");
  if (t.code && t.slug) out.push("plan");
  if (t.code && t.code !== "SA") out.push("visa");
  return out;
}
