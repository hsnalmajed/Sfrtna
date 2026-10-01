// Short Arabic and English texts built from computed facts by fixed rules —
// no model writes them, and no number in them is anything but a stored value.

import { SCORING, type Classification } from "./config.ts";
import type { CapHit, ClimatePattern, MonthClimate, Season, TourismSignalInput } from "./types.ts";
import type { SubScores } from "./engine.ts";
import { heatIndexC } from "./heat.ts";

export interface Bilingual {
  ar: string;
  en: string;
}

type TempWord = "cold" | "cool" | "mild" | "warm" | "hot";

const TEMP: Record<TempWord, Bilingual> = {
  cold: { ar: "بارد", en: "Cold" },
  cool: { ar: "بارد نسبيًا", en: "Cool" },
  mild: { ar: "معتدل", en: "Mild" },
  warm: { ar: "دافئ", en: "Warm" },
  hot: { ar: "حار", en: "Hot" },
};

/** A few words for what the month is like — from the normals, by rule. */
export function weatherSummary(m: MonthClimate): Bilingual | null {
  if (m.highC === null) return null;
  const s = SCORING.summary;
  const t: TempWord =
    m.highC < s.cold ? "cold" : m.highC < s.cool ? "cool" : m.highC < s.mild ? "mild" : m.highC < s.warm ? "warm" : "hot";

  const snowy = m.snowCoverPct !== null && m.snowCoverPct >= SCORING.patterns.snowCoverPct;
  if (t === "cold" && snowy) return { ar: "بارد مع احتمالية ثلوج", en: "Cold and snowy" };

  const dew = m.dewPointC;
  const warmEnough = m.highC >= s.humidFromHighC;
  const humidity: "very" | "humid" | "some" | null =
    dew === null || !warmEnough
      ? null
      : dew >= s.veryHumidDewPoint
        ? "very"
        : dew >= s.humidDewPoint
          ? "humid"
          : dew >= s.moderateHumidDewPoint
            ? "some"
            : null;
  const mm = m.precipMm;
  const days = m.precipDays;
  const rain: "dry" | "occasional" | "frequent" | null =
    days === null && mm === null
      ? null
      : (mm !== null && mm <= s.dryMm) || (days !== null && days <= s.dryDays && (mm === null || mm <= s.dryDaysMaxMm))
        ? "dry"
        : days === null || days <= s.occasionalDays
          ? "occasional"
          : "frequent";

  const w = TEMP[t];
  const hum: Record<"very" | "humid" | "some", Bilingual> = {
    very: { ar: `${w.ar} وشديد الرطوبة`, en: `${w.en} and very humid` },
    humid: { ar: `${w.ar} ورطب`, en: `${w.en} and humid` },
    some: { ar: `${w.ar} مع رطوبة معتدلة`, en: `${w.en} with some humidity` },
  };
  const base = humidity ? hum[humidity] : w;
  if (rain === "dry") {
    if (!humidity && t === "hot") return { ar: "حار وجاف", en: "Hot and dry" };
    return humidity
      ? { ar: `${base.ar}، وجاف غالبًا`, en: `${base.en}, mostly dry` }
      : { ar: `${w.ar} وجاف غالبًا`, en: `${w.en} and mostly dry` };
  }
  if (rain === "occasional") return { ar: `${base.ar} مع أمطار متفرقة`, en: `${base.en} with occasional rain` };
  if (rain === "frequent") return { ar: `${base.ar} مع أمطار متكررة`, en: `${base.en} with frequent rain` };
  return base;
}

export interface SeasonName extends Bilingual {
  icon: string;
}

const SEASON_WORD: Record<Season, Bilingual & { icon: string }> = {
  winter: { ar: "شتاء", en: "Winter", icon: "❄️" },
  spring: { ar: "ربيع", en: "Spring", icon: "🌸" },
  summer: { ar: "صيف", en: "Summer", icon: "☀️" },
  autumn: { ar: "خريف", en: "Autumn", icon: "🍂" },
};

/**
 * What to call the month where the destination is: "Rainy winter", "Snowy
 * winter", "Summer" — or, for a destination warm all year, its rainy or dry
 * season ("Start of the rainy season"). See SCORING.seasonNames.
 */
export function seasonName(args: {
  temperate: boolean;
  season: Season;
  month: MonthClimate;
  /** The twelve months' totals, mm, for "wetter than usual here". */
  yearMm: (number | null)[];
  /** Mean of the twelve average highs, °C. */
  yearMeanHighC: number | null;
  pattern: ClimatePattern;
  prevPattern: ClimatePattern;
  nextPattern: ClimatePattern;
  yearHasWetDry: boolean;
}): SeasonName {
  const n = SCORING.seasonNames;
  const m = args.month;
  const known = args.yearMm.filter((x): x is number => x !== null).sort((a, b) => a - b);
  const median = known.length ? (known[(known.length - 1) >> 1] + known[known.length >> 1]) / 2 : null;
  const rainy =
    args.pattern === "rainy_season" ||
    (m.precipMm !== null &&
      m.precipDays !== null &&
      median !== null &&
      m.precipMm >= n.rainyMinMm &&
      m.precipDays >= n.rainyMinDays &&
      m.precipMm >= n.rainyShareOfMedian * median);
  if (args.temperate) {
    const w = SEASON_WORD[args.season];
    if (m.snowCoverPct !== null && m.snowCoverPct >= n.snowCoverPct)
      return { ar: `${w.ar} مع ثلوج`, en: `Snowy ${w.en.toLowerCase()}`, icon: "❄️" };
    if (rainy) return { ar: `${w.ar} ممطر`, en: `Rainy ${w.en.toLowerCase()}`, icon: "🌧️" };
    return w;
  }
  if (args.pattern === "rainy_season") return { ar: "موسم الأمطار", en: "Rainy season", icon: "🌧️" };
  if (args.pattern === "dry_season") return { ar: "موسم الجفاف", en: "Dry season", icon: "☀️" };
  if (args.yearHasWetDry) {
    if (args.nextPattern === "rainy_season") return { ar: "بداية موسم الأمطار", en: "Start of the rainy season", icon: "🌦️" };
    if (args.prevPattern === "rainy_season") return { ar: "نهاية موسم الأمطار", en: "End of the rainy season", icon: "🌦️" };
    if (args.nextPattern === "dry_season") return { ar: "بداية موسم الجفاف", en: "Start of the dry season", icon: "🌤️" };
    if (args.prevPattern === "dry_season") return { ar: "نهاية موسم الجفاف", en: "End of the dry season", icon: "🌤️" };
    return { ar: "بين موسمي الأمطار والجفاف", en: "Between the rainy and dry seasons", icon: "🌦️" };
  }
  const mean = args.yearMeanHighC ?? 0;
  const allYear: Bilingual =
    mean >= n.hotAllYearC
      ? { ar: "حار طوال العام", en: "Hot all year" }
      : mean >= n.warmAllYearC
        ? { ar: "دافئ طوال العام", en: "Warm all year" }
        : { ar: "معتدل طوال العام", en: "Mild all year" };
  return rainy
    ? { ar: `${allYear.ar}، ذروة الأمطار`, en: `${allYear.en}, peak rains`, icon: "🌧️" }
    : { ...allYear, icon: "🌴" };
}

const CAP_TEXT: Record<string, (m: MonthClimate) => Bilingual> = {
  extremeHeat: (m) => ({ ar: `حرارة شديدة جدًا (متوسط العظمى ${Math.round(m.highC ?? 0)}°)`, en: `Extreme heat (average high ${Math.round(m.highC ?? 0)}°)` }),
  veryHot: (m) => ({ ar: `حرارة شديدة (متوسط العظمى ${Math.round(m.highC ?? 0)}°)`, en: `Very hot (average high ${Math.round(m.highC ?? 0)}°)` }),
  extremeHeatIndex: (m) => ({ ar: `حرارة ورطوبة خطرتان (الحرارة المحسوسة نحو ${Math.round(heatIndexC(m) ?? 0)}°)`, en: `Dangerous heat and humidity (feels like about ${Math.round(heatIndexC(m) ?? 0)}°)` }),
  hotHumid: (m) => ({ ar: `حرارة مع رطوبة خانقة (الحرارة المحسوسة نحو ${Math.round(heatIndexC(m) ?? 0)}°)`, en: `Heat with oppressive humidity (feels like about ${Math.round(heatIndexC(m) ?? 0)}°)` }),
  extremeRain: () => ({ ar: "أمطار غزيرة جدًا", en: "Very heavy rainfall" }),
  monsoonRain: () => ({ ar: "أمطار في معظم أيام الشهر", en: "Rain on most days of the month" }),
  heavyRain: () => ({ ar: "أمطار غزيرة", en: "Heavy rainfall" }),
  extremeCold: () => ({ ar: "برد شديد جدًا", en: "Extreme cold" }),
  veryCold: () => ({ ar: "برد شديد", en: "Very cold" }),
};

/** Why the month got its class — the one or two facts that decided it. */
export function reasonText(args: {
  month: MonthClimate;
  sub: SubScores | null;
  caps: CapHit[];
  signal: "listed" | "unlisted" | "unavailable";
  tourism: TourismSignalInput | null;
  classification: Classification;
}): Bilingual {
  const { month: m, sub, caps, signal, tourism } = args;
  const parts: Bilingual[] = [];

  if (caps.length) {
    const worst = [...caps].sort((a, b) => a.cap - b.cap)[0];
    parts.push(CAP_TEXT[worst.id](m));
  } else if (sub) {
    if (sub.profile === "ski" && sub.snow !== null) {
      parts.push(sub.snow >= 80 ? { ar: "غطاء ثلجي جيد", en: "Good snow cover" } : { ar: "غطاء ثلجي محدود", en: "Limited snow cover" });
    } else if (sub.high >= 85 && (sub.low === null || sub.low >= 70)) {
      parts.push({ ar: "درجات حرارة مريحة", en: "Comfortable temperatures" });
    } else if (sub.high < 70 && m.highC !== null) {
      const prof = sub.profile === "ski" ? null : SCORING.profiles[sub.profile];
      const cold = prof ? m.highC < prof.idealHigh[0] : false;
      parts.push(cold ? { ar: "أجواء باردة", en: "Cold weather" } : { ar: "حرارة مرتفعة", en: "High temperatures" });
    } else {
      parts.push({ ar: "درجات حرارة مقبولة", en: "Fair temperatures" });
    }
    if (sub.humidity !== null && sub.humidity < 60) parts.push({ ar: "رطوبة مرتفعة", en: "high humidity" });
    if (sub.precipitation !== null) {
      if (sub.precipitation < 55) parts.push({ ar: "أمطار متكررة", en: "frequent rain" });
      else if (sub.precipitation >= 90 && parts.length < 2) parts.push({ ar: "أمطار قليلة", en: "little rain" });
    }
  }

  const ar = parts.slice(0, 2).map((p) => p.ar).join("، و");
  const en = parts.slice(0, 2).map((p, i) => (i === 0 ? p.en : p.en.charAt(0).toLowerCase() + p.en.slice(1))).join(", with ");
  let tailAr = "";
  let tailEn = "";
  if (signal === "listed" && tourism) {
    tailAr = ` — ومن الأشهر التي يذكرها ${tourism.sourceNameAr}`;
    tailEn = ` — and named by ${tourism.sourceName}`;
  }
  return { ar: `${ar}${tailAr}.`, en: `${en}${tailEn}.` };
}
