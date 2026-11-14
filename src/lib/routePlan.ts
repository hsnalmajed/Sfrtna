/**
 * A trip longer than the city needs (owner's friend, 14 Nov 2026: «Sri Lanka
 * in one city is a waste — give each city the days it deserves, then move
 * on»): the plan becomes a route across the country's cities.
 *
 *   1. the chosen city gets the days it needs (cityNeedsDays) — at least;
 *   2. while days are left, the nearest city of the same country that our
 *      guide covers (≤ 300 km in a straight line from the last one) gets its
 *      own days; up to five cities;
 *   3. days still left go back to the cities in turn (no city past its need
 *      + 2), the rest to the first city;
 *   4. each city is planned by the same engine (guidePlan.ts) with the ride
 *      from the city before at the start of its first day, and no place
 *      twice across the route.
 * The traveller can keep the whole trip in one city (answers.route «single»);
 * then the cities that could have been added are offered instead.
 * Ride times are road estimates from the distance, said as «نحو».
 */

import { buildGuidePlan, cityNeedsDays, guidePlanReady } from "@/lib/guidePlan";
import { readGuide } from "@/lib/guide";
import { readStoredRestaurants } from "@/lib/mapPins";
import { COUNTRY_CITIES, findCity } from "@/lib/cities";
import { findCountry } from "@/lib/countries";
import { CITY_COORDS } from "@/data/cityCoords";
import type { GuideFile } from "@/lib/guideTypes";
import type { PlanDay, PlanItem, PlanLeg, PlanRequest, SmartPlan } from "@/lib/ai/plan";

const MAX_CITIES = 5;
const REACH_KM = 300;
/** A city this close to where the traveller sleeps is a day trip, not a hotel move. */
const DAY_TRIP_KM = 60;

const T = {
  ar: {
    move: "الانتقال إلى {city}",
    moveWhy: "من {from} نحو {km} كم على الطريق، قرابة {time} بالسيارة. احجز التوصيل أو السيارة من «قبل أن تسافر» أسفل الخطة.",
    dayTrip: "رحلة يوم إلى {city}",
    dayTripWhy: "من فندقك في {from} نحو {km} كم (قرابة {time} بالسيارة)، وتعود إليه مساءً — لا حاجة لتغيير الفندق.",
    goBack: "طريق العودة: من {from} إلى {to} نحو {km} كم (قرابة {time}) — احسبه قبل موعد رحلتك.",
    summary: "خطة {days} على مسار من {n} مدن: {list}. كل مدينة بالأيام التي تكفي لترى أبرز ما فيها، ثم ننتقل إلى الأقرب.",
    stay: "{city} ({n})",
    arrow: " ← ",
  },
  en: {
    move: "On to {city}",
    moveWhy: "From {from}, about {km} km by road, roughly {time} by car. Book the transfer or a car under «Before you travel» below the plan.",
    dayTrip: "Day trip to {city}",
    dayTripWhy: "From your hotel in {from}, about {km} km (roughly {time} by car), back in the evening — no need to change hotels.",
    goBack: "The way back: from {from} to {to}, about {km} km (roughly {time}) — allow for it before your flight.",
    summary: "A {days} route across {n} cities: {list}. Each city gets the days it needs to see its best, then on to the nearest.",
    stay: "{city} ({n})",
    arrow: " → ",
  },
};

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Usual road speed between cities (km/h): motorways in the Gulf and Europe, winding hill roads in Sri Lanka or Nepal. */
const ROAD_KMH: Record<string, number> = {
  AE: 95, SA: 95, QA: 90, OM: 85, BH: 80, KW: 90, US: 90, CA: 85, AU: 85,
  DE: 85, FR: 85, ES: 85, IT: 80, PT: 80, GB: 75, NL: 80, BE: 80, AT: 80, CH: 75, CZ: 75, PL: 75, HU: 80, GR: 70,
  TR: 75, EG: 65, MA: 65, TN: 65, JO: 65, AZ: 60, UZ: 60, KZ: 70, MY: 70, TH: 60, JP: 60, KR: 70, CN: 70,
  GE: 45, AM: 50, LK: 35, NP: 28, ID: 35, PH: 35, VN: 40, IN: 45, PK: 45, BD: 30, KH: 45, LA: 35, KE: 45, TZ: 45,
};

/** Road distance and drive time from a straight line (winding roads, towns on the way). */
function ride(d: number, code: string): { roadKm: number; min: number } {
  const roadKm = Math.round((d * 1.3) / 5) * 5;
  const kmh = ROAD_KMH[code] ?? 60;
  return { roadKm, min: Math.max(30, Math.round(((roadKm / kmh) * 60) / 15) * 15) };
}

function rideText(min: number, ar: boolean): string {
  const h = Math.floor(min / 60);
  const half = min % 60 >= 25;
  if (ar) {
    if (h === 0) return "نصف ساعة";
    const base = h === 1 ? "ساعة" : h === 2 ? "ساعتين" : h <= 10 ? `${h} ساعات` : `${h} ساعة`;
    return half ? `${base} ونصف` : base;
  }
  if (h === 0) return "half an hour";
  return `${h}${half ? ".5" : ""} hour${h === 1 && !half ? "" : "s"}`;
}

interface Candidate {
  slug: string;
  code: string;
  name: string;
  lat: number;
  lon: number;
  guide: GuideFile;
  needs: number;
}

/** The country's other cities our guide covers, with their positions and needs. */
async function countryCities(code: string, except: string, locale: "ar" | "en"): Promise<Candidate[]> {
  const list = (COUNTRY_CITIES[code] ?? []).filter((c) => c.slug !== except && CITY_COORDS[c.slug]);
  const guides = await Promise.all(list.map((c) => readGuide(c.slug).catch(() => null)));
  const out: Candidate[] = [];
  list.forEach((c, i) => {
    const g = guides[i];
    if (!guidePlanReady(g)) return;
    const pt = CITY_COORDS[c.slug];
    out.push({ slug: c.slug, code, name: locale === "ar" ? c.nameAr : c.nameEn, lat: pt.lat, lon: pt.lon, guide: g as GuideFile, needs: cityNeedsDays(g) });
  });
  return out;
}

/** The plan for this request: one city, or a route when the trip is longer than the city needs. */
export async function buildRoutePlan(req: PlanRequest, guide: GuideFile): Promise<SmartPlan | null> {
  const city = findCity(req.code, req.slug);
  const centre = CITY_COORDS[req.slug];
  if (!city) return null;
  const t = T[req.locale];
  const ar = req.locale === "ar";
  const nameOf = (c: { nameAr: string; nameEn: string }) => (ar ? c.nameAr : c.nameEn);
  const days = Math.round((Date.parse(req.to) - Date.parse(req.from)) / 86_400_000) + 1;
  const needs0 = cityNeedsDays(guide);
  const country = findCountry(req.code);
  const countryNames = country ? [country.nameAr, country.nameEn] : [];

  const single = async (): Promise<SmartPlan> => {
    const restaurants = await readStoredRestaurants(req.slug);
    return buildGuidePlan(req, guide, restaurants, nameOf(city), city.nameEn, centre, { countryNames });
  };

  // Short enough for the city, or nowhere to place it: one city.
  if (!centre || days - needs0 < 2) return single();
  const others = await countryCities(req.code, req.slug, req.locale);
  // Which cities: the nearest the guide covers, one after another.
  const picked: (PlanLeg & { guide: GuideFile })[] = [{ slug: req.slug, code: req.code, name: nameOf(city), days: needs0, lat: centre.lat, lon: centre.lon, needs: needs0, guide }];
  let left = days - needs0;
  const pool = [...others];
  while (left >= 1 && picked.length < MAX_CITIES) {
    const last = picked[picked.length - 1];
    pool.sort((a, b) => km(last, a) - km(last, b));
    const next = pool.find((c) => km(last, c) <= REACH_KM && left >= Math.min(2, c.needs));
    if (!next) break;
    pool.splice(pool.indexOf(next), 1);
    const take = Math.min(next.needs, left);
    picked.push({ slug: next.slug, code: next.code, name: next.name, days: take, lat: next.lat, lon: next.lon, needs: next.needs, guide: next.guide });
    left -= take;
  }
  // In which order: the shortest way through them and back to the first city (the flight home).
  const rest = picked.slice(1);
  let best = rest;
  let bestKm = Infinity;
  const perms = (xs: typeof rest): (typeof rest)[] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));
  for (const order of perms(rest)) {
    const path = [picked[0], ...order, picked[0]];
    const total = path.slice(1).reduce((n, c, i) => n + km(path[i], c), 0);
    if (total < bestKm - 0.5) {
      bestKm = total;
      best = order;
    }
  }
  // A city close to where the traveller sleeps is a day trip from there.
  const legs: (PlanLeg & { guide: GuideFile; base: PlanLeg })[] = [];
  for (const c of [picked[0], ...best]) {
    const { guide: g, ...leg } = c;
    const base = legs.length ? legs[legs.length - 1].base : leg;
    if (legs.length && km(base, leg) <= DAY_TRIP_KM) leg.dayTrip = true;
    legs.push({ ...leg, guide: g, base: leg.dayTrip ? base : leg });
  }

  if (legs.length === 1) {
    const plan = await single();
    return plan;
  }
  if (req.answers.route === "single") {
    const plan = await single();
    plan.suggest = legs.slice(1).map((l) => ({ slug: l.slug, code: l.code, name: l.name, days: l.days, lat: l.lat, lon: l.lon, needs: l.needs }));
    return plan;
  }
  // Days still left: back to the cities in turn, none past its need + 2.
  for (let guard = 0; left > 0 && guard < 50; guard++) {
    const grow = legs.filter((l) => l.days < l.needs + 2);
    if (!grow.length) {
      legs[0].days += left;
      left = 0;
      break;
    }
    grow[guard % grow.length].days++;
    left--;
  }

  // Each city by the same engine, one after the other.
  const used = new Set<string>();
  const outDays: PlanDay[] = [];
  const plans: SmartPlan[] = [];
  let dayAt = 0;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const from = new Date(Date.parse(`${req.from}T00:00:00Z`) + dayAt * 86_400_000).toISOString().slice(0, 10);
    const to = new Date(Date.parse(`${req.from}T00:00:00Z`) + (dayAt + leg.days - 1) * 86_400_000).toISOString().slice(0, 10);
    // Where the traveller wakes up that morning: the base of the leg before.
    const prev = i > 0 ? (leg.dayTrip ? leg.base : legs[i - 1].base) : undefined;
    const r = prev ? ride(km(prev, leg), req.code) : null;
    const startAt = r ? Math.ceil((9 * 60 + r.min + (leg.dayTrip ? 0 : 45)) / 15) * 15 : undefined;
    const legReq: PlanRequest = { ...req, slug: leg.slug, from, to };
    // The flight home is from the first city: on the last day, leave the last city earlier by the ride back.
    if (i === legs.length - 1 && i > 0) {
      const back = ride(km(leg.base, legs[0]), req.code).min;
      const leave = req.answers.leave ?? "evening";
      if (back >= 90) legReq.answers = { ...req.answers, leave: leave === "evening" ? "noon" : "morning" };
    }
    const restaurants = await readStoredRestaurants(leg.slug);
    const cityEntry = findCity(leg.code, leg.slug);
    const plan = buildGuidePlan(legReq, leg.guide, restaurants, leg.name, cityEntry?.nameEn ?? leg.name, { lat: leg.lat, lon: leg.lon }, {
      startAt,
      openEnd: i < legs.length - 1,
      used,
      countryNames,
    });
    for (const d of plan.days) for (const it of d.items) if (it.key?.startsWith("p:")) used.add(it.key.slice(2));
    plan.days.forEach((d) => {
      d.city = { code: leg.code, slug: leg.slug, name: leg.name };
      d.area = d.area || leg.name;
    });
    for (const [di, day] of plan.days.entries()) {
      if (!prev || !r || (di > 0 && !leg.dayTrip)) break;
      const move: PlanItem = {
        time: "09:00",
        kind: "move",
        name: (leg.dayTrip ? t.dayTrip : t.move).replace("{city}", leg.name),
        localName: "",
        area: "",
        rating: "",
        website: "",
        durationMin: r.min,
        why: (leg.dayTrip ? t.dayTripWhy : t.moveWhy).replace("{from}", prev.name).replace("{km}", String(r.roadKm)).replace("{time}", rideText(r.min, ar)),
        tip: "",
        hours: "",
        booking: "",
        dress: "",
        dish: "",
        halal: "",
        gettingThere: "",
        lat: leg.lat,
        lon: leg.lon,
        from: { lat: prev.lat, lon: prev.lon },
      };
      day.items.unshift(move);
    }
    outDays.push(...plan.days);
    plans.push(plan);
    dayAt += leg.days;
  }
  // The flight home is from the first city: say how far the last one is.
  const lastLeg = legs[legs.length - 1].base;
  const home = ride(km(lastLeg, legs[0]), req.code);
  if (home.roadKm >= 40 && outDays.length) {
    const last = outDays[outDays.length - 1];
    last.notes = [...(last.notes ?? []), t.goBack.replace("{from}", lastLeg.name).replace("{to}", legs[0].name).replace("{km}", String(home.roadKm)).replace("{time}", rideText(home.min, ar))];
  }

  const main = plans[0];
  const dayWord = ar ? (days <= 10 ? `${days} أيام` : `${days} يوماً`) : `${days}-day`;
  const list = legs.map((l) => t.stay.replace("{city}", l.name).replace("{n}", String(l.days))).join(t.arrow);
  // Keep the engine's «what we took into account» sentence.
  const cut = main.summary.search(ar ? /راعينا فيها/ : /It takes into account/);
  const considered = cut >= 0 ? main.summary.slice(cut) : "";
  const packing = [...new Set(plans.flatMap((p) => p.essentials.packing))];
  return {
    ...main,
    summary: [t.summary.replace("{days}", dayWord).replace("{n}", String(legs.length)).replace("{list}", list), considered].filter(Boolean).join(" "),
    days: outDays,
    essentials: { ...main.essentials, packing },
    city: { code: req.code, slug: req.slug, name: nameOf(city) },
    from: req.from,
    to: req.to,
    cityDays: needs0,
    route: legs.map((l) => ({ slug: l.slug, code: l.code, name: l.name, days: l.days, lat: l.lat, lon: l.lon, needs: l.needs, ...(l.dayTrip ? { dayTrip: true } : {}) })),
  };
}
