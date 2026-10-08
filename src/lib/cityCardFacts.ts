// What every city card says, wherever a city is shown: this month's
// travel-season rating, the season's name, the usual temperatures, and the
// entry status for a Saudi passport. One function, so the country page, the
// maps pages and the season lists cannot drift apart.

import { getDictionary } from "@/lib/dictionaries";
import { seasonRecord, CLASS_DOT } from "@/lib/travelSeason/site";
import { visaStatusFor, type VisaCategory } from "@/data/visaStatus";
import type { Locale } from "@/lib/types";

export interface CityCardFacts {
  /** "🟢 أفضل وقت للزيارة" — this month's rating, when there is one. */
  classLabel?: string;
  /** "🍂 خريف" */
  season?: string;
  /** "14° – 21°" */
  temps?: string;
  visa?: { category: VisaCategory; short: string };
  /** Shown when no visa status is confirmed. */
  visaUnknown: string;
}

export function cityCardFacts(countryCode: string, slug: string, locale: Locale, month = new Date().getMonth() + 1): CityCardFacts {
  const dict = getDictionary(locale);
  const r = seasonRecord(slug, month);
  const v = visaStatusFor(countryCode);
  const short = {
    free: dict.home.cardVisaFree,
    arrival: dict.home.cardVisaArrival,
    eta: dict.home.cardVisaEta,
    required: dict.home.cardVisaRequired,
  };
  const temps =
    r?.averageHighC == null
      ? undefined
      : r.averageLowC == null
        ? `${Math.round(r.averageHighC)}°`
        : dict.travelSeasons.highLow
            .replace("{low}", String(Math.round(r.averageLowC)))
            .replace("{high}", String(Math.round(r.averageHighC)));
  return {
    classLabel: r?.classification ? `${CLASS_DOT[r.classification]} ${dict.travelSeasons.classes[r.classification]}` : undefined,
    season: r ? `${r.seasonIcon} ${locale === "ar" ? r.seasonNameAr : r.seasonNameEn}` : undefined,
    temps,
    visa: v ? { category: v.category, short: short[v.category] } : undefined,
    visaUnknown: dict.home.cardVisaUnknown,
  };
}
