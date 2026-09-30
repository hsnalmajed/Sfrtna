// Short Arabic and English texts built from computed facts by fixed rules —
// no model writes them, and no number in them is anything but a stored value.

import { SCORING, type Classification } from "./config.ts";
import type { CapHit, MonthClimate, TourismSignalInput } from "./types.ts";
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

  const humid = m.dewPointC !== null && m.dewPointC >= s.humidDewPoint && m.highC >= s.humidFromHighC;
  const days = m.precipDays;
  const rain: "dry" | "occasional" | "frequent" | null =
    days === null
      ? null
      : days <= s.dryDays && (m.precipMm === null || m.precipMm <= s.dryMm)
        ? "dry"
        : days <= s.occasionalDays
          ? "occasional"
          : "frequent";

  const w = TEMP[t];
  if (humid) {
    if (rain === "frequent") return { ar: `${w.ar} ورطب مع أمطار متكررة`, en: `${w.en} and humid with frequent rain` };
    if (rain === "occasional") return { ar: `${w.ar} ورطب مع أمطار متفرقة`, en: `${w.en} and humid with occasional rain` };
    return { ar: `${w.ar} ورطب`, en: `${w.en} and humid` };
  }
  if (rain === "dry") {
    if (t === "hot") return { ar: "حار وجاف", en: "Hot and dry" };
    return { ar: `${w.ar} وجاف غالبًا`, en: `${w.en} and mostly dry` };
  }
  if (rain === "occasional") return { ar: `${w.ar} مع أمطار متفرقة`, en: `${w.en} with occasional rain` };
  if (rain === "frequent") return { ar: `${w.ar} مع أمطار متكررة`, en: `${w.en} with frequent rain` };
  return w;
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
