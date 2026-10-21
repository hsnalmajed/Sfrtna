/**
 * «خطتي الذكية» without an AI call per visitor (owner, 21 Oct 2026: "no cost
 * we cannot recover"): the plan is built here, from our stored guide
 * (scripts/guide/ — the city's best-known places with our own write-up),
 * the stored restaurants and our climate normals, by rules:
 *
 *   - places matched to the traveller's interests, the best known first (a
 *     first visit) or past the famous few (a return visit); with children,
 *     places good with children first;
 *   - variety: no more than two places of one kind a day, one place of
 *     worship a day, never two of one kind in a row;
 *   - each day one part of the city (nearest neighbours from the most
 *     famous unplaced stop), stops in walking order;
 *   - times from the traveller's start, each visit's own length and the
 *     distance between stops at their way of moving; lunch and dinner at the
 *     nearest stored restaurant (halal-tagged first when asked);
 *   - weather and what to wear from our climate normals for that month;
 *   - nothing invented: a fact we do not hold is left out.
 * Same shape as the AI plan (SmartPlan), so the same view shows it.
 */

import { readableCuisine, readableHours, type GuideFile, type GuidePlace, type Group } from "@/lib/guideTypes";
import type { StoredRestaurant } from "@/lib/mapPins";
import type { PlanAnswers, PlanDay, PlanItem, PlanRequest, SmartPlan } from "@/lib/ai/plan";
import { seasonRecord } from "@/lib/travelSeason/site";

type Interest = PlanAnswers["interests"][number];

const GROUPS_FOR: Record<Interest, Group[]> = {
  landmarks: ["history", "religion", "views"],
  museums: ["museums", "culture"],
  nature: ["nature", "views"],
  shopping: ["shopping", "markets"],
  adventure: ["nature", "views", "family"],
  beaches: ["beach", "nature"],
  local_life: ["markets", "history", "culture"],
  kids_fun: ["family", "nature", "beach"],
  photography: ["views", "history", "nature"],
  food: ["markets"],
  nightlife_calm: ["views", "markets", "shopping"],
  wellness: ["nature", "beach"],
};

/** A visit's length when the write-up gives none. */
const DEFAULT_MIN: Record<Group, number> = {
  history: 75,
  religion: 45,
  museums: 120,
  nature: 90,
  beach: 150,
  views: 40,
  family: 180,
  shopping: 120,
  markets: 75,
  culture: 90,
};

const PER_DAY = { relaxed: 3, balanced: 4, packed: 5 } as const;
const START_MIN = { early: 8 * 60, normal: 10 * 60, late: 12 * 60 } as const;

const T = {
  ar: {
    lunch: "غداء",
    dinner: "عشاء",
    lunchAt: "غداء في {name}",
    dinnerAt: "عشاء في {name}",
    mealNearby: "أقرب مطعم مسجّل لدينا من محطتك السابقة.",
    halalTagged: "مسجّل أنه حلال",
    halalCheck: "تأكد من الحلال قبل الطلب",
    walk: "مشياً نحو {min} دقيقة",
    ride: "بالسيارة أو التاكسي نحو {min} دقيقة",
    transit: "بالمواصلات العامة أو التاكسي نحو {min} دقيقة",
    dayTitle: "{place} وما حولها",
    weather: "متوسط العظمى {hi}° والصغرى {lo}°{rain}",
    rainDays: "، ونحو {n} أيام ممطرة في الشهر",
    wearHot: "ملابس قطنية خفيفة، قبعة ونظارة شمسية، وماء معك",
    wearWarm: "ملابس خفيفة، وطبقة رقيقة للمساء",
    wearMild: "طبقات: قميص وسترة خفيفة",
    wearCool: "سترة دافئة وحذاء مريح مغلق",
    wearCold: "معطف شتوي، قفازات وغطاء رأس",
    umbrella: "، ومظلة",
    summary: "خطة {days} في {city} على ذوقك: {count} من أبرز الأماكن، كل يوم في جزء واحد من المدينة لتقليل التنقل، مع وقت كل زيارة والطريق إليها والوجبات قريبة منك.",
    daysOne: "يوم واحد",
    daysTwo: "يومين",
    daysFew: "{n} أيام",
    daysMany: "{n} يوماً",
    heritage: "من مواقع التراث العالمي.",
    bookAhead: "احجز التذكرة مسبقاً لتتجنب الطابور.",
    freeEntry: "الدخول مجاني.",
    packing: ["حذاء مشي مريح", "شاحن متنقل", "نسخة من جوازك وتأشيرتك"],
  },
  en: {
    lunch: "Lunch",
    dinner: "Dinner",
    lunchAt: "Lunch at {name}",
    dinnerAt: "Dinner at {name}",
    mealNearby: "The nearest restaurant we hold to your previous stop.",
    halalTagged: "Listed as halal",
    halalCheck: "Check it is halal before ordering",
    walk: "About {min} min on foot",
    ride: "About {min} min by car or taxi",
    transit: "About {min} min by public transport or taxi",
    dayTitle: "{place} and around",
    weather: "Average high {hi}°, low {lo}°{rain}",
    rainDays: ", about {n} rainy days in the month",
    wearHot: "Light cotton clothes, a hat, sunglasses and water",
    wearWarm: "Light clothes and a thin layer for the evening",
    wearMild: "Layers: a shirt and a light jacket",
    wearCool: "A warm jacket and comfortable closed shoes",
    wearCold: "A winter coat, gloves and a hat",
    umbrella: ", and an umbrella",
    summary: "A {days} plan in {city} to your taste: {count} of the city's best-known places, each day in one part of the city to cut travel, with visit times, the way there and meals nearby.",
    daysOne: "one-day",
    daysTwo: "two-day",
    daysFew: "{n}-day",
    daysMany: "{n}-day",
    heritage: "A World Heritage site.",
    bookAhead: "Book your ticket ahead to skip the queue.",
    freeEntry: "Free entry.",
    packing: ["Comfortable walking shoes", "A power bank", "A copy of your passport and visa"],
  },
};

function km(a: { y: number; x: number }, b: { y: number; x: number }): number {
  const R = 6371;
  const dLat = ((b.y - a.y) * Math.PI) / 180;
  const dLon = ((b.x - a.x) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.y * Math.PI) / 180) * Math.cos((b.y * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`;
const roundTo = (min: number, step = 15) => Math.ceil(min / step) * step;

/** Minutes to get from one stop to the next, and how. */
function travel(d: number, move: PlanAnswers["move"], t: (typeof T)["ar"]): { min: number; how: string } {
  if (d < 1.5) {
    const min = Math.max(5, Math.round((d / 4.5) * 60));
    return { min, how: t.walk.replace("{min}", String(min)) };
  }
  const speed = move === "walk_transit" ? 18 : 24;
  const min = Math.round((d / speed) * 60 + 10);
  return { min, how: (move === "walk_transit" ? t.transit : t.ride).replace("{min}", String(min)) };
}

/** Whether a guide place is usable for a plan. */
const usable = (p: GuidePlace) => typeof p.y === "number" && typeof p.x === "number";

/** A visit that fills a day by itself (theme parks, big parks with rides). */
const FULL_DAY = 300;

/** Chains and cafés are not a meal we would plan for someone. */
const NOT_A_MEAL = /starbucks|mcdonald|kfc|burger king|subway|domino|pizza hut|costa|tim hortons|dunkin|doutor|tully|caffè nero|caffe nero|pret a manger|hardee|wendy|popeyes|krispy|baskin|cinnabon|seven|7-eleven|lawson|familymart/i;
const isMeal = (r: StoredRestaurant) => !NOT_A_MEAL.test(`${r.n} ${r.e ?? ""}`) && !/coffee_shop|cafe|donut|ice_cream|bubble_tea|tea\b|juice|dessert|bakery|cake/.test(r.u ?? "");

export function guidePlanReady(g: GuideFile | null): boolean {
  return Boolean(g && g.places.filter((p) => p.d && usable(p)).length >= 6);
}

export function buildGuidePlan(req: PlanRequest, guide: GuideFile, restaurants: StoredRestaurant[], cityName: string, cityEn: string): SmartPlan {
  const a = req.answers;
  const t = T[req.locale];
  const ar = req.locale === "ar";
  const days = Math.round((Date.parse(req.to) - Date.parse(req.from)) / 86_400_000) + 1;
  const perDay = PER_DAY[a.pace] - (a.company === "seniors" || (a.company === "family_kids" && a.pace !== "packed") ? 1 : 0);
  const want = new Set<Group>(a.interests.flatMap((i) => GROUPS_FOR[i]));
  const kids = a.company === "family_kids" || a.interests.includes("kids_fun");

  // ── Choose ────────────────────────────────────────────────────────────
  // Places visitors cannot enter are not stops in a plan.
  const pool = guide.places.filter((p) => usable(p) && !p.out);
  const scored = pool.map((p, rank) => {
    let s = 0;
    if (want.has(p.g)) s += 100;
    // A first visit: the famous ones; a return: past the famous few.
    s += a.firstVisit ? 80 - Math.min(80, rank) : rank < 8 ? 10 : 70 - Math.min(60, rank);
    if (p.wh) s += 15;
    if (p.d) s += 10;
    if (kids && p.kids) s += 30;
    if (kids && p.kids === false) s -= 30;
    return { p, s };
  });
  scored.sort((x, y) => y.s - x.s);
  const target = Math.min(scored.length, perDay * days);
  const chosen: GuidePlace[] = [];
  const perGroup = new Map<Group, number>();
  const groupCap = (g: Group) => (g === "religion" ? days : Math.max(2, Math.ceil((target * (want.has(g) ? 0.45 : 0.25)))));
  for (const { p } of scored) {
    if (chosen.length >= target) break;
    const n = perGroup.get(p.g) ?? 0;
    if (n >= groupCap(p.g)) continue;
    // The same place mapped twice (outline and gate) — keep one.
    if (chosen.some((c) => km(c, p) < 0.15)) continue;
    chosen.push(p);
    perGroup.set(p.g, n + 1);
  }

  // ── Days: one part of the city each ───────────────────────────────────
  const left = [...chosen];
  const dayStops: GuidePlace[][] = [];
  for (let d = 0; d < days && left.length; d++) {
    const seed = left.shift() as GuidePlace; // the best-known left
    const day = [seed];
    if ((seed.m ?? DEFAULT_MIN[seed.g]) >= FULL_DAY) {
      dayStops.push(day);
      continue;
    }
    const size = Math.min(perDay, Math.ceil((left.length + 1) / (days - d)));
    while (day.length < size && left.length) {
      const last = day[day.length - 1];
      // Nearest that keeps the day varied: no two of a kind in a row, one
      // place of worship a day, at most two of a kind.
      const ok = (p: GuidePlace) =>
        p.g !== last.g && !(p.g === "religion" && day.some((x) => x.g === "religion")) && day.filter((x) => x.g === p.g).length < 2;
      left.sort((x, y) => km(last, x) - km(last, y));
      const fits = (p: GuidePlace) => (p.m ?? DEFAULT_MIN[p.g]) < FULL_DAY;
      const i = left.findIndex((p) => ok(p) && fits(p)) >= 0 ? left.findIndex((p) => ok(p) && fits(p)) : left.findIndex(fits);
      if (i < 0) break;
      day.push(left.splice(i, 1)[0]);
    }
    dayStops.push(day);
  }

  // ── Times, meals, weather ─────────────────────────────────────────────
  const usedMeals = new Set<string>();
  const halalFirst = (rs: StoredRestaurant[]) => (a.halalOnly ? [...rs.filter((r) => r.h === 1), ...rs.filter((r) => r.h !== 1)] : rs);
  const meal = (at: { y: number; x: number }): StoredRestaurant | undefined => {
    // The best documented of the restaurants within a short walk (fame =
    // how much the map knows about it), else the nearest farther out.
    const close = restaurants.filter((r) => !usedMeals.has(r.i) && isMeal(r) && km(at, r) < 1.2).sort((p, q) => q.f - p.f);
    const near = close.length ? close.slice(0, 12) : restaurants.filter((r) => !usedMeals.has(r.i) && isMeal(r) && km(at, r) < 3).sort((p, q) => km(at, p) - km(at, q)).slice(0, 12);
    const r = halalFirst(near)[0];
    if (r) usedMeals.add(r.i);
    return r;
  };
  const name = (p: { n: string; a?: string; e?: string }) => (ar ? p.a || p.e || p.n : p.e || p.n);
  const blankItem = (): PlanItem => ({
    time: "",
    kind: "place",
    name: "",
    localName: "",
    area: "",
    rating: "",
    website: "",
    durationMin: 0,
    why: "",
    tip: "",
    hours: "",
    booking: "",
    dress: "",
    dish: "",
    halal: "",
    gettingThere: "",
  });

  const out: PlanDay[] = dayStops.map((stops, di) => {
    const date = new Date(Date.parse(`${req.from}T00:00:00Z`) + di * 86_400_000).toISOString().slice(0, 10);
    const month = Number(date.slice(5, 7));
    const season = seasonRecord(req.slug, month);
    let clock = START_MIN[a.start];
    let lunchDone = false;
    const items: PlanItem[] = [];
    let prev: { y: number; x: number } | null = null;
    const addMeal = (kind: "lunch" | "dinner", at: { y: number; x: number }) => {
      const r = meal(at);
      const it = blankItem();
      it.kind = "meal";
      it.time = hhmm(roundTo(clock));
      it.durationMin = kind === "lunch" ? 60 : 75;
      if (r) {
        const rn = name(r);
        it.name = (kind === "lunch" ? t.lunchAt : t.dinnerAt).replace("{name}", rn);
        it.localName = r.n !== rn ? r.n : "";
        it.why = t.mealNearby;
        it.dish = readableCuisine(r.u, req.locale);
        it.halal = r.h === 1 ? t.halalTagged : a.halalOnly ? t.halalCheck : "";
        it.lat = r.y;
        it.lon = r.x;
        it.mapQuery = `${r.n} ${cityEn}`;
        it.fromPrevKm = Math.round(km(at, r) * 10) / 10;
      } else {
        it.name = kind === "lunch" ? t.lunch : t.dinner;
        it.halal = a.halalOnly ? t.halalCheck : "";
      }
      clock = roundTo(clock) + it.durationMin;
      items.push(it);
    };
    const dayEnd = (a.lateNights ? 22 : 19) * 60 + 30;
    for (const p of stops) {
      if (prev && clock + (p.m ?? DEFAULT_MIN[p.g]) * 0.8 > dayEnd) break;
      if (prev) {
        // Lunch near the stop just finished, once it is past noon.
        if (!lunchDone && clock >= 12 * 60) {
          addMeal("lunch", prev);
          lunchDone = true;
        }
        clock += travel(km(prev, p), a.move, t).min;
      }
      const it = blankItem();
      const minutes = Math.round((p.m ?? DEFAULT_MIN[p.g]) * (a.pace === "relaxed" ? 1.15 : a.pace === "packed" ? 0.85 : 1));
      it.time = hhmm(roundTo(clock));
      it.name = name(p);
      it.localName = p.n !== it.name ? p.n : "";
      it.durationMin = roundTo(minutes, 5);
      it.why = [ar ? p.d : p.de, p.wh ? t.heritage : ""].filter(Boolean).join(" ");
      it.tip = (ar ? p.tp : p.tpe) || (ar ? p.bt : p.bte) || "";
      it.hours = p.oh ? readableHours(p.oh, req.locale) : "";
      it.booking = p.fee === "no" ? t.freeEntry : p.fee === "yes" || p.sl >= 25 ? t.bookAhead : "";
      it.dress = (ar ? p.dr : p.dre) ?? "";
      it.website = p.web ?? "";
      it.lat = p.y;
      it.lon = p.x;
      it.mapQuery = `${p.e || p.n} ${cityEn}`;
      if (p.fee === "yes" || p.sl >= 25) it.ticketQuery = `${(p.e || p.n).replace(/\s*\([^)]*\)/g, "")} ${cityEn}`;
      if (prev) {
        const d = km(prev, p);
        it.fromPrevKm = Math.round(d * 10) / 10;
        it.gettingThere = travel(d, a.move, t).how;
      }
      // A long visit across midday: lunch is eaten there.
      if (roundTo(clock) <= 12 * 60 + 30 && roundTo(clock) + it.durationMin >= 14 * 60) lunchDone = true;
      clock = roundTo(clock) + it.durationMin;
      items.push(it);
      prev = p;
    }
    if (prev && !lunchDone && clock >= 12 * 60) addMeal("lunch", prev);
    if (prev && (a.lateNights || clock <= 20 * 60)) {
      clock = Math.max(clock + 30, 19 * 60);
      addMeal("dinner", prev);
    }
    const hi = typeof season?.averageHighC === "number" ? Math.round(season.averageHighC) : null;
    const lo = typeof season?.averageLowC === "number" ? Math.round(season.averageLowC) : null;
    const rain = season?.precipitationDays ?? 0;
    const weather =
      hi !== null && lo !== null
        ? t.weather.replace("{hi}", String(hi)).replace("{lo}", String(lo)).replace("{rain}", rain >= 6 ? t.rainDays.replace("{n}", String(Math.round(rain))) : "")
        : "";
    const wear =
      hi === null ? "" : (hi >= 32 ? t.wearHot : hi >= 25 ? t.wearWarm : hi >= 17 ? t.wearMild : hi >= 8 ? t.wearCool : t.wearCold) + (rain >= 8 ? t.umbrella : "");
    return {
      date,
      title: t.dayTitle.replace("{place}", stops[0] ? name(stops[0]) : cityName),
      area: "",
      weather,
      wear,
      items,
    };
  });

  const dayWord = days === 1 ? t.daysOne : days === 2 ? t.daysTwo : (days <= 10 ? t.daysFew : t.daysMany).replace("{n}", String(days));
  return {
    summary: t.summary.replace("{days}", dayWord).replace("{city}", cityName).replace("{count}", String(chosen.length)),
    days: out,
    essentials: { packing: t.packing, etiquette: [], transport: [], money: [], phrases: [], safety: [], emergency: "" },
    sources: [],
    city: { code: req.code, slug: req.slug, name: cityName },
    from: req.from,
    to: req.to,
    generatedAt: new Date().toISOString(),
  };
}
