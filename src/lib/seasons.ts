// When each destination is actually worth visiting.
//
// The guides already carry a hand-written best-season line ("November –
// March", "April – June, September – October"). Rather than hand-typing a
// second, structured copy of that — which would drift out of step with the
// first the moment either is edited — this reads the existing line and works
// out which months it names. One source of truth, and the calendar can never
// disagree with the country page it came from.

import { COUNTRY_GUIDES } from "@/lib/countryGuides";

export interface Month {
  /** 1 = January. */
  number: number;
  nameAr: string;
  nameEn: string;
  /** Northern-hemisphere season, purely for the page's colour coding. */
  season: "winter" | "spring" | "summer" | "autumn";
}

export const MONTHS: Month[] = [
  { number: 1, nameAr: "يناير", nameEn: "January", season: "winter" },
  { number: 2, nameAr: "فبراير", nameEn: "February", season: "winter" },
  { number: 3, nameAr: "مارس", nameEn: "March", season: "spring" },
  { number: 4, nameAr: "أبريل", nameEn: "April", season: "spring" },
  { number: 5, nameAr: "مايو", nameEn: "May", season: "spring" },
  { number: 6, nameAr: "يونيو", nameEn: "June", season: "summer" },
  { number: 7, nameAr: "يوليو", nameEn: "July", season: "summer" },
  { number: 8, nameAr: "أغسطس", nameEn: "August", season: "summer" },
  { number: 9, nameAr: "سبتمبر", nameEn: "September", season: "autumn" },
  { number: 10, nameAr: "أكتوبر", nameEn: "October", season: "autumn" },
  { number: 11, nameAr: "نوفمبر", nameEn: "November", season: "autumn" },
  { number: 12, nameAr: "ديسمبر", nameEn: "December", season: "winter" },
];

export function monthName(number: number, locale: "ar" | "en"): string {
  const month = MONTHS.find((m) => m.number === number);
  if (!month) return String(number);
  return locale === "ar" ? month.nameAr : month.nameEn;
}

const MONTH_NUMBERS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

/**
 * The months named by a best-season line such as
 * "April – June, September – October".
 *
 * Handles the three shapes the guides actually use: a single month, a range,
 * and several of either separated by commas. Ranges that cross the new year
 * ("November – March") wrap rather than coming back empty — that shape is the
 * most common one in the guides, since it's every warm-winter destination.
 *
 * Parenthetical notes ("March – May (cherry blossoms)") are stripped: they're
 * there for a human reading the country page, not for this.
 *
 * Anything it can't read contributes no months at all. A destination missing
 * from a month is a visible gap someone can fix; a destination placed in the
 * wrong month is a wrong recommendation.
 */
export function parseBestMonths(line: string): number[] {
  const months = new Set<number>();

  for (const part of line.replace(/\([^)]*\)/g, "").split(",")) {
    // The guides use an en dash; accept a hyphen too so a future edit that
    // types the easier character still parses.
    const ends = part
      .split(/[–—-]/)
      .map((s) => MONTH_NUMBERS[s.trim().toLowerCase()])
      .filter((n): n is number => typeof n === "number");

    if (ends.length === 1) {
      months.add(ends[0]);
    } else if (ends.length === 2) {
      const [start, end] = ends;
      // Walk forward from the start, wrapping past December, until the end
      // month is reached. Bounded at 12 steps so a malformed pair can never
      // loop forever.
      let current = start;
      for (let step = 0; step < 12; step++) {
        months.add(current);
        if (current === end) break;
        current = current === 12 ? 1 : current + 1;
      }
    }
  }

  return [...months].sort((a, b) => a - b);
}

/** The months this country's guide recommends. Empty if it has no guide. */
export function bestMonthsFor(countryCode: string): number[] {
  const guide = COUNTRY_GUIDES[countryCode];
  if (!guide) return [];
  return parseBestMonths(guide.bestMonthsEn);
}

