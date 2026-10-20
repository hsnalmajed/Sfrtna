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
  // Every factor that shaped the month, each with its own figure (owner,
  // 21 Oct 2026: "explain in detail — humidity, rain… not only one reason"):
  // limits first, then temperature, humidity, rain, wind, snow.
  const { month: m, sub, caps, signal, tourism } = args;
  const parts: Bilingual[] = [];
  const r = (x: number) => Math.round(x);

  for (const c of [...caps].sort((a, b) => a.cap - b.cap)) {
    // Several heat limits say the same thing: keep the strongest one.
    if (parts.length && /heat|hot/i.test(c.id) && parts.some((p) => /حرارة/.test(p.ar))) continue;
    if (parts.length && /rain/i.test(c.id) && parts.some((p) => /أمطار/.test(p.ar))) continue;
    parts.push(CAP_TEXT[c.id](m));
  }

  if (sub) {
    const capsSayHeat = parts.some((p) => /حرارة/.test(p.ar));
    if (sub.profile === "ski" && sub.snow !== null) {
      parts.push(sub.snow >= 80 ? { ar: "غطاء ثلجي جيد", en: "Good snow cover" } : { ar: "غطاء ثلجي محدود", en: "Limited snow cover" });
    } else if (!capsSayHeat && m.highC !== null) {
      const t = m.lowC !== null ? { ar: `العظمى ${r(m.highC)}° والصغرى ${r(m.lowC)}°`, en: `highs ${r(m.highC)}°, lows ${r(m.lowC)}°` } : { ar: `العظمى ${r(m.highC)}°`, en: `highs ${r(m.highC)}°` };
      const prof = sub.profile === "ski" ? null : SCORING.profiles[sub.profile];
      const cold = prof ? m.highC < prof.idealHigh[0] : false;
      const word =
        sub.high >= 85 && (sub.low === null || sub.low >= 70)
          ? { ar: "حرارة مريحة", en: "Comfortable temperatures" }
          : sub.high < 70
            ? cold
              ? { ar: "أجواء باردة", en: "Cold weather" }
              : { ar: "حرارة مرتفعة", en: "High temperatures" }
            : sub.low !== null && sub.low < 60 && m.lowC !== null && prof && m.lowC < prof.idealLow[0]
              ? { ar: "نهار معتدل وليالٍ باردة", en: "Mild days, cold nights" }
              : { ar: "حرارة مقبولة", en: "Fair temperatures" };
      parts.push({ ar: `${word.ar} (${t.ar})`, en: `${word.en} (${t.en})` });
    }
    if (sub.humidity !== null && sub.humidity < 60 && !parts.some((p) => /رطوبة/.test(p.ar))) {
      const hi = heatIndexC(m);
      parts.push(
        hi !== null && m.highC !== null && hi >= m.highC + 2
          ? { ar: `رطوبة مرتفعة (الحرارة المحسوسة نحو ${r(hi)}°)`, en: `high humidity (feels like about ${r(hi)}°)` }
          : { ar: "رطوبة مرتفعة", en: "high humidity" }
      );
    }
    if (sub.precipitation !== null && !parts.some((p) => /أمطار|هطول/.test(p.ar))) {
      const days = m.precipDays !== null ? r(m.precipDays) : null;
      const mm = m.precipMm !== null ? r(m.precipMm) : null;
      const fig = days !== null && mm !== null ? { ar: ` (نحو ${days} ${days >= 3 && days <= 10 ? "أيام" : "يوماً"}، ${mm} ملم)`, en: ` (about ${days} days, ${mm} mm)` } : { ar: "", en: "" };
      // At freezing highs the precipitation is snow as much as rain.
      const snowy = m.highC !== null && m.highC <= 2;
      const w = snowy ? { ar: "هطول ثلج أو مطر", en: "snow or rain" } : { ar: "أمطار", en: "rain" };
      if (sub.precipitation < 55) parts.push({ ar: `${w.ar} متكرر${snowy ? "" : "ة"}${fig.ar}`, en: `frequent ${w.en}${fig.en}` });
      else if (sub.precipitation < 80) parts.push({ ar: `${w.ar} متفرق${snowy ? "" : "ة"}${fig.ar}`, en: `some ${w.en}${fig.en}` });
      else parts.push({ ar: snowy ? "هطول قليل" : "أمطار قليلة", en: snowy ? "little snow or rain" : "little rain" });
    }
    if (m.windMs !== null && m.windMs >= SCORING.wind.good + 2) parts.push({ ar: "رياح نشطة", en: "windy" });
    if (sub.profile !== "ski" && m.snowCoverPct !== null && m.snowCoverPct >= SCORING.seasonNames.snowCoverPct)
      parts.push({ ar: "ثلوج على الأرض", en: "snow on the ground" });
  }

  const ar = parts.slice(0, 5).map((p) => p.ar).join("، ");
  const en = parts.slice(0, 5).map((p, i) => (i === 0 ? p.en : p.en.charAt(0).toLowerCase() + p.en.slice(1))).join(", ");
  // The tourism source counts in the score but is not named to visitors.
  void signal;
  void tourism;
  return { ar: `${ar}.`, en: `${en}.` };
}
