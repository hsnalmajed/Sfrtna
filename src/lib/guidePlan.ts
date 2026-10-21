/**
 * «خطتي الذكية» — our own planner (owner, 21 Oct 2026: "no cost we cannot
 * recover"; "it must understand the traveller in the finest detail"). Built
 * here, per request, from stored data only — no AI call per visitor:
 *
 *   what      our guide (scripts/guide/: the city's best-known places with
 *             their kind, fame, World Heritage, our own write-up, opening
 *             hours as mapped), the stored restaurants, our climate normals,
 *             and prayer times computed for the city and date;
 *   who       company and children's ages, seniors, strollers/wheelchairs,
 *             first visit or return, pace, start of day, late nights;
 *   wants     up to 8 interests out of 18, each tied to kinds of place
 *             (mosques, palaces, zoos, souqs, viewpoints…); free places
 *             first; avoid crowds; prayer times;
 *   trip      arrival and departure time of day.
 *
 * Rules, in order:
 *   1. score every place for this traveller (interest match by kind, fame
 *      for a first visit / past the famous few for a return, children,
 *      mobility, free entry, rain → indoor);
 *   2. choose as many as the days can hold (arrival/departure days count
 *      for less), with variety caps (one place of worship a day; churches
 *      and temples only when asked for, or world-famous);
 *   3. a day per part of the city: the best-known left place open that
 *      weekday, then nearest neighbours open that day, never two of a kind in
 *      a row; theme parks fill a day alone;
 *   4. in hot months, indoor places at midday, outdoor ones morning and late
 *      afternoon; to avoid crowds the famous one first and early;
 *   5. times from the start of day, each visit's own length and the way
 *      between stops (walking under 1.5 km — 0.8 km with a stroller, a
 *      wheelchair, seniors or "less walking"); lunch and dinner at the
 *      best-documented restaurant nearby, halal-tagged first; Friday prayer
 *      kept free; free time said, not left as a gap;
 *   6. every stop says why it is in this traveller's plan.
 * Nothing invented: a fact we do not hold is left out.
 * Same shape as the AI plan (SmartPlan), so the same view shows it.
 */

import { Coordinates, CalculationMethod, HighLatitudeRule, PrayerTimes } from "adhan";
import { readableCuisine, readableHours, type GuideFile, type GuidePlace, type Group } from "@/lib/guideTypes";
import type { StoredRestaurant } from "@/lib/mapPins";
import type { PlanAnswers, PlanDay, PlanItem, PlanRequest, SmartPlan } from "@/lib/ai/plan";
import { seasonRecord } from "@/lib/travelSeason/site";
import TIMEZONES from "@/data/cityTimezones.json";

type Interest = PlanAnswers["interests"][number];
type Need = NonNullable<PlanAnswers["needs"]>[number];

/** Kinds of place each interest asks for; groups as a fallback for places without a kind. */
const WANTS: Record<Interest, { kinds: string[]; groups: Group[] }> = {
  famous: { kinds: [], groups: [] }, // fame itself, see score()
  history: { kinds: ["palace", "castle", "ancient", "monument", "oldtown", "square", "bridge", "street", "landmark"], groups: ["history"] },
  islamic: { kinds: ["mosque"], groups: [] },
  museums: { kinds: ["museum"], groups: ["museums"] },
  art: { kinds: ["gallery", "theatre", "culture"], groups: ["culture"] },
  oldtown: { kinds: ["oldtown", "square", "street", "market"], groups: ["markets"] },
  nature: { kinds: ["park", "garden", "reserve", "lake", "waterfall"], groups: ["nature"] },
  mountains: { kinds: ["mountain", "waterfall", "cave", "observation", "reserve"], groups: [] },
  beaches: { kinds: ["beach", "island", "water"], groups: ["beach"] },
  relax: { kinds: ["garden", "park", "beach", "lake"], groups: [] },
  kids: { kinds: ["zoo", "aquarium", "themepark"], groups: ["family"] },
  malls: { kinds: ["mall"], groups: ["shopping"] },
  souqs: { kinds: ["market"], groups: ["markets"] },
  food: { kinds: ["market"], groups: [] },
  modern: { kinds: ["tower", "observation", "landmark"], groups: ["views"] },
  photo: { kinds: ["observation", "tower", "bridge", "square", "garden", "landmark", "oldtown"], groups: ["views"] },
  night: { kinds: ["observation", "tower", "square", "street", "mall"], groups: [] },
  churches: { kinds: ["church", "temple", "synagogue"], groups: [] },
};

/** Places under a roof: midday in the heat, first choice in the rain. */
const INDOOR = new Set(["museum", "gallery", "mall", "aquarium", "theatre", "culture", "mosque", "church", "temple", "synagogue", "palace"]);
const isIndoor = (p: GuidePlace) => (p.kd ? INDOOR.has(p.kd) : p.g === "museums" || p.g === "shopping" || p.g === "religion");
/** Open in the evening (most museums, zoos, palaces and parks close by 17:00–18:00). */
const EVENING = new Set(["observation", "tower", "mall", "market", "square", "street", "oldtown", "landmark", "beach", "bridge", "water", "theatre", "mosque"]);
const eveningOk = (p: GuidePlace) => (p.kd ? EVENING.has(p.kd) : p.g === "views" || p.g === "shopping" || p.g === "markets");
const LATE = 17 * 60;

/** Rough ground for a stroller or a wheelchair. */
const ROUGH = new Set(["mountain", "cave", "ancient", "waterfall", "reserve", "island"]);

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
/** First day: when the plan can start; last day: when it must end. */
const ARRIVE_START = { morning: 0, noon: 13 * 60 + 30, evening: 17 * 60 + 30 } as const;
const LEAVE_END = { morning: 10 * 60 + 30, noon: 13 * 60 + 30, evening: 17 * 60 } as const;
/** How much of a day the arrival / departure day is worth in places. */
const ARRIVE_SHARE = { morning: 1, noon: 0.55, evening: 0.2 } as const;
const LEAVE_SHARE = { morning: 0, noon: 0.4, evening: 0.8 } as const;

const T = {
  ar: {
    free: "وقت حر",
    freeWhy: "للراحة في الفندق، أو تجوّل في الحي، أو تسوّق قريب.",
    lunch: "غداء",
    dinner: "عشاء",
    lunchAt: "غداء في {name}",
    dinnerAt: "عشاء في {name}",
    mealNearby: "أقرب مطعم موثّق لدينا من محطتك السابقة.",
    halalTagged: "مسجّل أنه حلال",
    halalCheck: "تأكد من الحلال قبل الطلب",
    walk: "مشياً نحو {min} دقيقة",
    ride: "بالسيارة أو التاكسي نحو {min} دقيقة",
    transit: "بالمواصلات العامة أو التاكسي نحو {min} دقيقة",
    dayTitle: "{place} وما حولها",
    arriveTitle: "يوم الوصول",
    leaveTitle: "يوم المغادرة",
    weather: "متوسط العظمى {hi}° والصغرى {lo}°{rain}",
    rainDays: "، ونحو {n} أيام ممطرة في الشهر",
    wearHot: "ملابس قطنية خفيفة، قبعة ونظارة شمسية، وماء معك",
    wearWarm: "ملابس خفيفة، وطبقة رقيقة للمساء",
    wearMild: "طبقات: قميص وسترة خفيفة",
    wearCool: "سترة دافئة وحذاء مريح مغلق",
    wearCold: "معطف شتوي، قفازات وغطاء رأس",
    umbrella: "، ومظلة",
    summary: "خطة {days} في {city} على مقاسك: {count} من أبرز الأماكن التي تناسب ما تحب، كل يوم في جزء واحد من المدينة لتقليل التنقل، مع وقت كل زيارة والطريق إليها والوجبات قريبة منك.",
    considered: "راعينا فيها: {list}.",
    cKids: "أعمار أطفالك",
    cSeniors: "راحة كبار السن",
    cStroller: "عربة الأطفال",
    cWheelchair: "الكرسي المتحرك",
    cWalk: "مشياً أقل",
    cHeat: "حرّ الظهيرة ({hi}°): الأماكن المغلقة وقت الظهر",
    cRain: "المطر: أماكن مغلقة أكثر",
    cCrowds: "تجنّب الزحام: الأشهر أولاً وفي الصباح",
    cFree: "الأماكن المجانية أولاً",
    cPrayer: "أوقات الصلاة",
    cClosed: "أيام إغلاق الأماكن",
    cArrive: "وقت وصولك ومغادرتك",
    daysOne: "يوم واحد",
    daysTwo: "يومين",
    daysFew: "{n} أيام",
    daysMany: "{n} يوماً",
    heritage: "من مواقع التراث العالمي.",
    bookAhead: "احجز التذكرة مسبقاً لتتجنب الطابور.",
    freeEntry: "الدخول مجاني.",
    early: "اذهب مع الافتتاح قبل الزحام.",
    outdoorHot: "مكان مكشوف: الأفضل صباحاً أو قبل الغروب.",
    friday: "صلاة الجمعة",
    fridayInside: "🕌 صلاة الجمعة نحو {time}: اخرج قبلها بربع ساعة إلى أقرب جامع ثم أكمل.",
    fridayWhy: "في أقرب جامع إلى مكانك.",
    rest: "استراحة في الفندق",
    restWhy: "وقت الظهيرة الحار: راحة واستعداد لبقية اليوم.",
    arriveNote: "يبدأ يومك بعد وصولك واستلام الفندق.",
    leaveNote: "ينتهي يومك قبل موعد المغادرة بوقت كافٍ.",
    packing: ["حذاء مشي مريح", "شاحن متنقل", "نسخة من جوازك وتأشيرتك"],
    packStroller: "عربة أطفال خفيفة قابلة للطي",
    packHot: "واقي شمس وزجاجة ماء",
    packRain: "مظلة أو معطف مطر خفيف",
    packMosque: "ملابس محتشمة وغطاء رأس للنساء لزيارة المساجد",
  },
  en: {
    free: "Free time",
    freeWhy: "Rest at the hotel, wander the area or shop nearby.",
    lunch: "Lunch",
    dinner: "Dinner",
    lunchAt: "Lunch at {name}",
    dinnerAt: "Dinner at {name}",
    mealNearby: "The best-documented restaurant we hold near your previous stop.",
    halalTagged: "Listed as halal",
    halalCheck: "Check it is halal before ordering",
    walk: "About {min} min on foot",
    ride: "About {min} min by car or taxi",
    transit: "About {min} min by public transport or taxi",
    dayTitle: "{place} and around",
    arriveTitle: "Arrival day",
    leaveTitle: "Departure day",
    weather: "Average high {hi}°, low {lo}°{rain}",
    rainDays: ", about {n} rainy days in the month",
    wearHot: "Light cotton clothes, a hat, sunglasses and water",
    wearWarm: "Light clothes and a thin layer for the evening",
    wearMild: "Layers: a shirt and a light jacket",
    wearCool: "A warm jacket and comfortable closed shoes",
    wearCold: "A winter coat, gloves and a hat",
    umbrella: ", and an umbrella",
    summary: "A {days} plan in {city} made for you: {count} of the city's best-known places that fit what you enjoy, each day in one part of the city to cut travel, with visit times, the way there and meals nearby.",
    considered: "It takes into account: {list}.",
    cKids: "your children's ages",
    cSeniors: "seniors' comfort",
    cStroller: "the stroller",
    cWheelchair: "the wheelchair",
    cWalk: "less walking",
    cHeat: "midday heat ({hi}°): indoor places at noon",
    cRain: "rain: more indoor places",
    cCrowds: "avoiding crowds: the famous first, early",
    cFree: "free places first",
    cPrayer: "prayer times",
    cClosed: "days places are closed",
    cArrive: "your arrival and departure times",
    daysOne: "one-day",
    daysTwo: "two-day",
    daysFew: "{n}-day",
    daysMany: "{n}-day",
    heritage: "A World Heritage site.",
    bookAhead: "Book your ticket ahead to skip the queue.",
    freeEntry: "Free entry.",
    early: "Go at opening time, before the crowds.",
    outdoorHot: "Open-air: best in the morning or before sunset.",
    friday: "Friday prayer",
    fridayInside: "🕌 Friday prayer at about {time}: leave a quarter of an hour before for the nearest mosque, then carry on.",
    fridayWhy: "At the mosque nearest to you.",
    rest: "Rest at the hotel",
    restWhy: "The hot midday hours: rest before the rest of the day.",
    arriveNote: "Your day starts after you arrive and check in.",
    leaveNote: "Your day ends with time to spare before you leave.",
    packing: ["Comfortable walking shoes", "A power bank", "A copy of your passport and visa"],
    packStroller: "A light folding stroller",
    packHot: "Sunscreen and a water bottle",
    packRain: "An umbrella or a light rain jacket",
    packMosque: "Modest clothes (and a headscarf for women) for mosques",
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
function travel(d: number, move: PlanAnswers["move"], walkKm: number, t: (typeof T)["ar"]): { min: number; how: string } {
  if (d < walkKm) {
    const min = Math.max(5, Math.round((d / 4.5) * 60));
    return { min, how: t.walk.replace("{min}", String(min)) };
  }
  const speed = move === "walk_transit" ? 18 : 24;
  const min = Math.round((d / speed) * 60 + 10);
  return { min, how: (move === "walk_transit" ? t.transit : t.ride).replace("{min}", String(min)) };
}

const usable = (p: GuidePlace) => typeof p.y === "number" && typeof p.x === "number";

/** A visit that fills a day by itself (theme parks, big parks with rides). */
const FULL_DAY = 300;

/** Chains and cafés are not a meal we would plan for someone. */
const NOT_A_MEAL = /starbucks|mcdonald|kfc|burger king|subway|domino|pizza hut|costa|tim hortons|dunkin|doutor|tully|caffè nero|caffe nero|pret a manger|hardee|wendy|popeyes|krispy|baskin|cinnabon|seven|7-eleven|lawson|familymart/i;
/** Places built around alcohol: never a halal-first traveller's meal. */
const DRINKS = /meyhane|\bpub\b|\bbar\b|tavern|brewery|brauhaus|bierhaus|beer|wine|vino|izakaya|taverna|bodega|cantina|sake/i;
const isMeal = (r: StoredRestaurant) => !NOT_A_MEAL.test(`${r.n} ${r.e ?? ""}`) && !/coffee_shop|cafe|donut|ice_cream|bubble_tea|tea\b|juice|dessert|bakery|cake/.test(r.u ?? "");

export function guidePlanReady(g: GuideFile | null): boolean {
  return Boolean(g && g.places.filter((p) => p.d && usable(p)).length >= 6);
}

// ── Opening days from OpenStreetMap hours ──────────────────────────────────

const DAY_CODES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * Whether the mapped hours say the place is closed on this weekday (0 =
 * Sunday). Only simple, common forms are read ("Tu-Su 09:00-17:00",
 * "Mo off", "Mo-Fr 10:00-18:00; Sa,Su off"); anything else counts as open.
 */
export function closedOn(oh: string | undefined, weekday: number): boolean {
  if (!oh || /\b(PH|SH|week|easter|sunrise|sunset|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b|"|\[/.test(oh)) return false;
  if (oh.trim() === "24/7") return false;
  const open = new Set<number>();
  const shut = new Set<number>();
  let explicit = false;
  for (const raw of oh.split(";")) {
    const seg = raw.trim();
    if (!seg) continue;
    const m = seg.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?\s*)+)\s*(.*)$/);
    if (!m) {
      // Times only: every day.
      if (/\d{1,2}:\d{2}/.test(seg)) for (let d = 0; d < 7; d++) open.add(d);
      continue;
    }
    explicit = true;
    const days = new Set<number>();
    for (const part of m[1].split(",").map((x) => x.trim()).filter(Boolean)) {
      const [a, b] = part.split("-").map((x) => DAY_CODES.indexOf(x.trim()));
      if (a < 0) return false;
      if (b === undefined || b < 0) days.add(a);
      else for (let d = a; ; d = (d + 1) % 7) {
        days.add(d);
        if (d === b) break;
      }
    }
    const isOff = /^(off|closed)\b/i.test(m[2].trim());
    for (const d of days) (isOff ? shut : open).add(d);
    for (const d of days) if (!isOff) shut.delete(d);
  }
  if (shut.has(weekday)) return true;
  return explicit && open.size > 0 && !open.has(weekday);
}

// ── Prayer times ───────────────────────────────────────────────────────────

const TZ = TIMEZONES as Record<string, string>;

function prayerMethod(code: string) {
  switch (code) {
    case "SA":
      return CalculationMethod.UmmAlQura();
    case "AE":
      return CalculationMethod.Dubai();
    case "QA":
      return CalculationMethod.Qatar();
    case "KW":
      return CalculationMethod.Kuwait();
    case "EG":
    case "SD":
    case "LY":
      return CalculationMethod.Egyptian();
    case "TR":
      return CalculationMethod.Turkey();
    case "PK":
    case "IN":
    case "BD":
    case "AF":
      return CalculationMethod.Karachi();
    case "MY":
    case "SG":
    case "ID":
    case "BN":
      return CalculationMethod.Singapore();
    case "US":
    case "CA":
      return CalculationMethod.NorthAmerica();
    default:
      return CalculationMethod.MuslimWorldLeague();
  }
}

/** The day's five prayers as local clock times, or undefined without a time zone. */
function prayersFor(slug: string, code: string, lat: number, lon: number, date: string) {
  const tz = TZ[slug];
  if (!tz) return undefined;
  const params = prayerMethod(code);
  // Far north in summer the night barely ends: the usual fallback rule.
  if (Math.abs(lat) > 48) params.highLatitudeRule = HighLatitudeRule.SeventhOfTheNight;
  const [y, m, d] = date.split("-").map(Number);
  const pt = new PrayerTimes(new Coordinates(lat, lon), new Date(Date.UTC(y, m - 1, d, 12)), params);
  const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz });
  return { fajr: fmt.format(pt.fajr), dhuhr: fmt.format(pt.dhuhr), asr: fmt.format(pt.asr), maghrib: fmt.format(pt.maghrib), isha: fmt.format(pt.isha) };
}

const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
};

// ── The plan ───────────────────────────────────────────────────────────────

export function buildGuidePlan(req: PlanRequest, guide: GuideFile, restaurants: StoredRestaurant[], cityName: string, cityEn: string, centre?: { lat: number; lon: number }): SmartPlan {
  const a = req.answers;
  const t = T[req.locale];
  const ar = req.locale === "ar";
  const needs = new Set<Need>(a.needs ?? []);
  const days = Math.round((Date.parse(req.to) - Date.parse(req.from)) / 86_400_000) + 1;
  const arrive = a.arrive ?? "morning";
  const leave = a.leave ?? "evening";
  const ages = a.company === "family_kids" ? (a.kidsAges ?? []) : [];
  const littleOnes = ages.some((x) => x <= 4) || needs.has("stroller");
  const kids = a.company === "family_kids" || a.interests.includes("kids");
  const seniors = a.company === "seniors";
  const easyGoing = seniors || needs.has("wheelchair") || needs.has("stroller") || needs.has("less_walking");
  const walkKm = easyGoing ? 0.8 : 1.5;
  const perDay = Math.max(2, PER_DAY[a.pace] - (seniors || littleOnes ? 1 : 0));

  // The month's climate (first day's month is enough for the choosing).
  const month = Number(req.from.slice(5, 7));
  const season0 = seasonRecord(req.slug, month);
  const hiMonth = typeof season0?.averageHighC === "number" ? season0.averageHighC : null;
  const hot = hiMonth !== null && hiMonth >= 33;
  const rainy = (season0?.precipitationDays ?? 0) >= 10;

  // ── 1. Score ─────────────────────────────────────────────────────────
  const wantedKinds = new Map<string, Interest>();
  const wantedGroups = new Map<Group, Interest>();
  for (const i of a.interests) {
    for (const k of WANTS[i].kinds) if (!wantedKinds.has(k)) wantedKinds.set(k, i);
    for (const g of WANTS[i].groups) if (!wantedGroups.has(g)) wantedGroups.set(g, i);
  }
  const askedChurches = a.interests.includes("churches");
  const pool = guide.places.filter((p) => usable(p) && !p.out);
  const scored = pool.map((p, rank) => {
    let s = 0;
    let why: Interest | undefined = p.kd ? wantedKinds.get(p.kd) : undefined;
    if (!why && !p.kd) why = wantedGroups.get(p.g);
    if (why) s += 100;
    const famous = rank < 12;
    if (a.interests.includes("famous") && famous) {
      s += 90;
      why = why ?? "famous";
    }
    s += a.firstVisit ? 80 - Math.min(80, rank) : rank < 8 ? 10 : 70 - Math.min(60, rank);
    if (p.wh) s += 15;
    if (p.d) s += 10;
    if (kids && p.kids) s += 30;
    if (kids && p.kids === false) s -= 40;
    if (littleOnes && (p.m ?? DEFAULT_MIN[p.g]) > 150 && p.kd !== "zoo" && p.kd !== "themepark" && p.kd !== "aquarium") s -= 25;
    if ((needs.has("wheelchair") || needs.has("stroller")) && p.kd && ROUGH.has(p.kd)) s -= 60;
    if (needs.has("wheelchair") && p.wc) s += 15;
    if (needs.has("free_first")) s += p.fee === "no" ? 30 : p.fee === "yes" ? -20 : 0;
    if (rainy && isIndoor(p)) s += 25;
    // Churches, temples and synagogues: when asked for, or one of the city's
    // very best known (Notre-Dame, St Peter's, Sagrada Família).
    const otherWorship = p.kd === "church" || p.kd === "temple" || p.kd === "synagogue";
    if (otherWorship && !askedChurches) s -= rank < 5 ? 20 : 400;
    return { p, s, why, rank };
  });
  scored.sort((x, y) => y.s - x.s);

  // ── 2. Choose ────────────────────────────────────────────────────────
  const capacity = Math.max(1, Math.round(perDay * (days === 1 ? Math.min(ARRIVE_SHARE[arrive], LEAVE_SHARE[leave] + 0.5) : ARRIVE_SHARE[arrive] + LEAVE_SHARE[leave] + (days - 2))));
  const target = Math.min(scored.length, capacity);
  const chosen: { p: GuidePlace; why?: Interest; rank: number }[] = [];
  const perGroup = new Map<Group, number>();
  let otherWorshipN = 0;
  const groupCap = (g: Group) => (g === "religion" ? days : Math.max(2, Math.ceil(target * (wantedGroups.has(g) || [...wantedKinds.keys()].length ? 0.5 : 0.3))));
  for (const c of scored) {
    if (chosen.length >= target) break;
    if (c.s < -100) continue;
    const n = perGroup.get(c.p.g) ?? 0;
    if (n >= groupCap(c.p.g)) continue;
    const ow = c.p.kd === "church" || c.p.kd === "temple" || c.p.kd === "synagogue";
    if (ow && !askedChurches && otherWorshipN >= 1) continue;
    // The same place mapped twice (outline and gate) — keep one.
    if (chosen.some((x) => km(x.p, c.p) < 0.15)) continue;
    chosen.push(c);
    perGroup.set(c.p.g, n + 1);
    if (ow) otherWorshipN++;
  }
  // Good places not chosen, to fill an afternoon left open.
  const extras = scored.filter((c) => c.s > 40 && !chosen.includes(c));
  const whyOf = new Map(chosen.map((c) => [c.p.q, c.why]));
  const rankOf = new Map(chosen.map((c) => [c.p.q, c.rank]));

  // ── 3. Days ──────────────────────────────────────────────────────────
  const dateOf = (d: number) => new Date(Date.parse(`${req.from}T00:00:00Z`) + d * 86_400_000);
  const share = (d: number): number => (days === 1 ? 1 : d === 0 ? ARRIVE_SHARE[arrive] : d === days - 1 ? LEAVE_SHARE[leave] : 1);
  const left = chosen.map((c) => c.p);
  const dayStops: GuidePlace[][] = [];
  let closedSkipped = false;
  for (let d = 0; d < days; d++) {
    const wd = dateOf(d).getUTCDay();
    const sizeFor = Math.round(perDay * share(d));
    if (sizeFor <= 0 || !left.length) {
      dayStops.push([]);
      continue;
    }
    const openToday = (p: GuidePlace) => !closedOn(p.oh, wd);
    const seedIdx = left.findIndex(openToday);
    if (seedIdx < 0) {
      dayStops.push([]);
      closedSkipped = true;
      continue;
    }
    if (seedIdx > 0) closedSkipped = true;
    const seed = left.splice(seedIdx, 1)[0];
    const day = [seed];
    if ((seed.m ?? DEFAULT_MIN[seed.g]) >= FULL_DAY) {
      dayStops.push(day);
      continue;
    }
    const remainingShare = Array.from({ length: days - d }, (_, i) => share(d + i)).reduce((x, y) => x + y, 0) || 1;
    const size = Math.min(sizeFor, Math.max(1, Math.round(((left.length + 1) * share(d)) / remainingShare)));
    while (day.length < size && left.length) {
      const last = day[day.length - 1];
      const ok = (p: GuidePlace) =>
        p.g !== last.g && !(p.g === "religion" && day.some((x) => x.g === "religion")) && day.filter((x) => x.g === p.g).length < 2;
      const fits = (p: GuidePlace) => (p.m ?? DEFAULT_MIN[p.g]) < FULL_DAY && openToday(p);
      left.sort((x, y) => km(last, x) - km(last, y));
      let i = left.findIndex((p) => ok(p) && fits(p));
      if (i < 0) i = left.findIndex(fits);
      if (i < 0) break;
      if (!openToday(left[i])) closedSkipped = true;
      day.push(left.splice(i, 1)[0]);
    }
    // 4. Heat: indoor places at midday, open-air ones morning and late.
    if (hot && day.length >= 3) {
      const outdoor = day.filter((p) => !isIndoor(p));
      const indoor = day.filter(isIndoor);
      if (outdoor.length && indoor.length) day.splice(0, day.length, ...outdoor.slice(0, 1), ...indoor, ...outdoor.slice(1));
    }
    // To beat the crowds, the best-known place of the day comes first.
    if (needs.has("avoid_crowds") && day.length > 1) {
      const best = day.reduce((x, y) => ((rankOf.get(y.q) ?? 99) < (rankOf.get(x.q) ?? 99) ? y : x));
      day.splice(day.indexOf(best), 1);
      day.unshift(best);
    }
    dayStops.push(day);
  }

  // ── 5. Times, meals, prayers, weather ───────────────────────────────
  const usedMeals = new Set<string>();
  const vegWords = /vegetarian|vegan/;
  const pickMeal = (at: { y: number; x: number }): StoredRestaurant | undefined => {
    const open = restaurants.filter((r) => !usedMeals.has(r.i) && isMeal(r) && !(a.halalOnly && DRINKS.test(`${r.n} ${r.e ?? ""} ${r.u ?? ""}`)));
    const close = open.filter((r) => km(at, r) < 1.2).sort((p, q) => q.f - p.f);
    let near = close.length ? close.slice(0, 15) : open.filter((r) => km(at, r) < 3).sort((p, q) => km(at, p) - km(at, q)).slice(0, 15);
    if (a.vegetarian) near = [...near.filter((r) => vegWords.test(r.u ?? "")), ...near.filter((r) => !vegWords.test(r.u ?? ""))];
    if (a.halalOnly) near = [...near.filter((r) => r.h === 1), ...near.filter((r) => r.h !== 1)];
    const r = near[0];
    if (r) usedMeals.add(r.i);
    return r;
  };
  const name = (p: { n: string; a?: string; an?: string; e?: string }) => (ar ? p.a || p.an || p.e || p.n : p.e || p.n);
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
  const lat0 = centre?.lat ?? chosen[0]?.p.y ?? 0;
  const lon0 = centre?.lon ?? chosen[0]?.p.x ?? 0;
  const wantPrayer = needs.has("prayer") || a.halalOnly;

  const out: PlanDay[] = dayStops.map((stops, di) => {
    const dt = dateOf(di);
    const date = dt.toISOString().slice(0, 10);
    const season = seasonRecord(req.slug, dt.getUTCMonth() + 1);
    const prayers = wantPrayer ? prayersFor(req.slug, req.code, lat0, lon0, date) : undefined;
    const friday = dt.getUTCDay() === 5 && wantPrayer && prayers;
    const notes: string[] = [];
    const first = di === 0 && days > 1;
    const lastDay = di === days - 1 && days > 1;
    let clock = Math.max(START_MIN[a.start], first ? ARRIVE_START[arrive] : 0);
    if (needs.has("avoid_crowds")) clock = Math.min(clock, first && arrive !== "morning" ? clock : 9 * 60);
    const dayEnd = lastDay ? LEAVE_END[leave] : (a.lateNights ? 22 : 19) * 60 + 30;
    if (first && arrive !== "morning") notes.push(t.arriveNote);
    if (lastDay && leave !== "evening") notes.push(t.leaveNote);
    let lunchDone = false;
    let fridayDone = false;
    const items: PlanItem[] = [];
    let prev: { y: number; x: number } | null = null;
    const addMeal = (kind: "lunch" | "dinner", at: { y: number; x: number }) => {
      const r = pickMeal(at);
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
    const addFriday = () => {
      if (!friday || fridayDone || !prayers) return;
      const at = toMin(prayers.dhuhr) - 20;
      if (clock + 30 < at) return;
      const it = blankItem();
      it.kind = "break";
      it.time = hhmm(Math.max(roundTo(clock), at));
      it.name = t.friday;
      it.why = t.fridayWhy;
      it.durationMin = 60;
      items.push(it);
      clock = Math.max(roundTo(clock), at) + 60;
      fridayDone = true;
    };
    // Hot middays and small children: a rest after lunch, then the day goes on.
    let rested = false;
    const addRest = () => {
      if (rested || !(hot || littleOnes) || clock > 15 * 60) return;
      const it = blankItem();
      it.kind = "break";
      it.time = hhmm(roundTo(clock));
      it.name = t.rest;
      it.why = t.restWhy;
      it.durationMin = 90;
      items.push(it);
      clock = roundTo(clock) + 90;
      rested = true;
    };
    const placeStop = (p: GuidePlace) => {
      addFriday();
      if (prev) {
        if (!lunchDone && clock >= 12 * 60) {
          addFriday();
          addMeal("lunch", prev);
          lunchDone = true;
          addRest();
        }
        clock += travel(km(prev, p), a.move, walkKm, t).min;
      }
      const it = blankItem();
      const minutes = Math.round((p.m ?? DEFAULT_MIN[p.g]) * (a.pace === "relaxed" ? 1.15 : a.pace === "packed" ? 0.85 : 1) * (seniors ? 1.15 : 1));
      it.time = hhmm(roundTo(clock));
      it.name = name(p);
      it.localName = p.n !== it.name ? p.n : "";
      it.durationMin = roundTo(minutes, 5);
      it.why = [ar ? p.d : p.de, p.wh ? t.heritage : ""].filter(Boolean).join(" ");
      const tips = [(ar ? p.tp : p.tpe) || (ar ? p.bt : p.bte) || ""];
      if (needs.has("avoid_crowds") && (rankOf.get(p.q) ?? 99) < 10 && items.filter((x) => x.kind === "place").length === 0) tips.push(t.early);
      if (hot && !isIndoor(p)) tips.push(t.outdoorHot);
      it.tip = tips.filter(Boolean).join(" ");
      it.hours = p.oh ? readableHours(p.oh, req.locale) : "";
      it.booking = p.fee === "no" ? t.freeEntry : p.fee === "yes" || p.sl >= 25 ? t.bookAhead : "";
      it.dress = (ar ? p.dr : p.dre) ?? "";
      it.website = p.web ?? "";
      it.lat = p.y;
      it.lon = p.x;
      it.mapQuery = `${p.e || p.n} ${cityEn}`;
      it.forYou = whyOf.get(p.q);
      if (p.fee === "yes" || p.sl >= 25) it.ticketQuery = `${(p.e || p.n).replace(/\s*\([^)]*\)/g, "")} ${cityEn}`;
      if (prev) {
        const d = km(prev, p);
        it.fromPrevKm = Math.round(d * 10) / 10;
        it.gettingThere = travel(d, a.move, walkKm, t).how;
      }
      // Friday prayer falls inside this visit: say when, and where to go.
      if (friday && !fridayDone && prayers) {
        const at = toMin(prayers.dhuhr);
        if (roundTo(clock) < at - 20 && roundTo(clock) + it.durationMin > at) {
          tips.push(t.fridayInside.replace("{time}", prayers.dhuhr));
          it.tip = tips.filter(Boolean).join(" ");
          fridayDone = true;
        }
      }
      // A long visit across midday: lunch is eaten there.
      if (roundTo(clock) <= 12 * 60 + 30 && roundTo(clock) + it.durationMin >= 14 * 60) lunchDone = true;
      clock = roundTo(clock) + it.durationMin;
      items.push(it);
      prev = p;
    };
    for (const p of [...stops]) {
      if (prev && clock + (p.m ?? DEFAULT_MIN[p.g]) * 0.8 > dayEnd) break;
      // Late in the day only what is open in the evening.
      if (prev && clock + 30 >= LATE && !eveningOk(p)) continue;
      placeStop(p);
    }
    addFriday();
    if (prev && !lunchDone && clock >= 12 * 60 && clock < dayEnd) {
      addMeal("lunch", prev);
      lunchDone = true;
      addRest();
    }
    // An afternoon still open: more of what they like, close by.
    const fillUntil = Math.min(dayEnd, 18 * 60 + 30);
    const wd = dt.getUTCDay();
    while (prev && !lastDay && clock < 16 * 60 + 30) {
      const here: { y: number; x: number } = prev;
      const next = extras
        .filter((c) => !closedOn(c.p.oh, wd) && (c.p.m ?? DEFAULT_MIN[c.p.g]) < FULL_DAY && km(here, c.p) < 4)
        .filter((c) => clock + travel(km(here, c.p), a.move, walkKm, t).min + (c.p.m ?? DEFAULT_MIN[c.p.g]) <= fillUntil)
        .filter((c) => !(c.p.g === "religion" && stops.some((x) => x.g === "religion")))
        .filter((c) => clock < LATE - 60 || eveningOk(c.p))
        .sort((x, y) => y.s - x.s - (km(here, y.p) - km(here, x.p)) * 8)[0];
      if (!next) break;
      extras.splice(extras.indexOf(next), 1);
      whyOf.set(next.p.q, next.why);
      rankOf.set(next.p.q, next.rank);
      stops.push(next.p);
      placeStop(next.p);
    }
    const evening = !lastDay || leave === "evening";
    if (prev && evening && !lastDay && clock <= 17 * 60 + 30) {
      // Hot afternoons (or small children): a rest, said so; otherwise free time.
      const it = blankItem();
      it.kind = "break";
      it.time = hhmm(roundTo(clock));
      it.name = t.free;
      it.why = t.freeWhy;
      it.durationMin = Math.max(30, roundTo(19 * 60 - roundTo(clock), 15) - 30);
      items.push(it);
      clock = 19 * 60 - 30;
    }
    if (prev && !lastDay && (a.lateNights || clock <= 20 * 60)) {
      clock = Math.max(clock + 30, 19 * 60);
      addMeal("dinner", prev);
    } else if (!prev && first) {
      // Arrival in the evening: dinner near the city centre.
      clock = Math.max(clock, 19 * 60);
      if (chosen[0]) addMeal("dinner", { y: lat0, x: lon0 });
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
    const title = stops[0] ? t.dayTitle.replace("{place}", name(stops[0])) : first ? t.arriveTitle : lastDay ? t.leaveTitle : cityName;
    return { date, title, area: "", weather, wear, items, prayers, notes };
  });

  // ── Summary and what to bring ────────────────────────────────────────
  const considered: string[] = [];
  if (ages.length) considered.push(t.cKids);
  if (seniors) considered.push(t.cSeniors);
  if (needs.has("stroller")) considered.push(t.cStroller);
  if (needs.has("wheelchair")) considered.push(t.cWheelchair);
  if (needs.has("less_walking")) considered.push(t.cWalk);
  if (hot && hiMonth !== null) considered.push(t.cHeat.replace("{hi}", String(Math.round(hiMonth))));
  if (rainy) considered.push(t.cRain);
  if (needs.has("avoid_crowds")) considered.push(t.cCrowds);
  if (needs.has("free_first")) considered.push(t.cFree);
  if (wantPrayer) considered.push(t.cPrayer);
  if (closedSkipped) considered.push(t.cClosed);
  if (days > 1 && (arrive !== "morning" || leave !== "evening")) considered.push(t.cArrive);
  const dayWord = days === 1 ? t.daysOne : days === 2 ? t.daysTwo : (days <= 10 ? t.daysFew : t.daysMany).replace("{n}", String(days));
  const placesN = out.reduce((n, d) => n + d.items.filter((i) => i.kind === "place").length, 0);
  const summary = [
    t.summary.replace("{days}", dayWord).replace("{city}", cityName).replace("{count}", String(placesN)),
    considered.length ? t.considered.replace("{list}", considered.join(ar ? "، " : ", ")) : "",
  ]
    .filter(Boolean)
    .join(" ");
  const packing = [...t.packing];
  if (needs.has("stroller") || littleOnes) packing.push(t.packStroller);
  if (hot) packing.push(t.packHot);
  if (rainy) packing.push(t.packRain);
  if (chosen.some((c) => c.p.kd === "mosque")) packing.push(t.packMosque);

  return {
    summary,
    days: out,
    essentials: { packing, etiquette: [], transport: [], money: [], phrases: [], safety: [], emergency: "" },
    sources: [],
    city: { code: req.code, slug: req.slug, name: cityName },
    from: req.from,
    to: req.to,
    generatedAt: new Date().toISOString(),
  };
}
