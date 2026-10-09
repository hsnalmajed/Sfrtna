/**
 * "6 مدن" / "6 cities".
 *
 * Arabic counts nouns in four shapes, not two: one city, two cities, three
 * to ten (broken plural), and eleven upwards (singular again). Writing
 * "{count} مدينة" for every number reads as broken Arabic to a native
 * speaker, which on a commercial site is the kind of detail that costs
 * trust — so each shape gets its own string.
 */
export function cityCountLabel(
  count: number,
  dict: { citiesCount: string; cityOne: string; cityTwo: string; cityFew: string }
): string {
  if (count === 1) return dict.cityOne;
  if (count === 2) return dict.cityTwo;
  if (count >= 3 && count <= 10) return dict.cityFew.replace("{count}", String(count));
  return dict.citiesCount.replace("{count}", String(count));
}

/**
 * The same four Arabic shapes, for any noun.
 *
 * `cityCountLabel` above solved this for cities before a second noun needed
 * it. This is that logic with the noun's four strings passed in, so months —
 * and whatever comes next — never have to repeat it. English supplies the
 * same string for `two` and `few`, which collapses it back to the usual
 * singular/plural pair at no cost.
 */
export interface CountShapes {
  /** The "{count} x" form, used for 11 and above (and for all of English). */
  many: string;
  one: string;
  two: string;
  /** 3-10, the Arabic broken plural. */
  few: string;
}

export function countLabel(count: number, shapes: CountShapes): string {
  if (count === 1) return shapes.one;
  if (count === 2) return shapes.two;
  if (count >= 3 && count <= 10) return shapes.few.replace("{count}", String(count));
  return shapes.many.replace("{count}", String(count));
}

/**
 * "6 أماكن" / "6 places".
 *
 * The city cards were reading "6 مكان", which is the singular — correct
 * English grammar applied to Arabic, and wrong in the same way "6 place"
 * would be. Four shapes, like every other counted noun on the site.
 */
export function placeCountLabel(
  count: number,
  dict: { placesCount: string; placeOne: string; placeTwo: string; placeFew: string }
): string {
  return countLabel(count, {
    many: dict.placesCount,
    one: dict.placeOne,
    two: dict.placeTwo,
    few: dict.placeFew,
  });
}

/**
 * Months (1–12) as ranges: [4, 5, 6, 9, 10] → "April – June, September –
 * October". A run may wrap round the year: [11, 12, 1, 2] → "November –
 * February".
 */
export function monthRanges(months: number[], name: (m: number) => string, locale: "ar" | "en"): string {
  const set = new Set(months);
  if (set.size === 0) return "";
  if (set.size === 12) return locale === "ar" ? "طوال العام" : "All year";
  const runs: [number, number][] = [];
  for (let m = 1; m <= 12; m++) {
    const prev = m === 1 ? 12 : m - 1;
    if (!set.has(m) || set.has(prev)) continue; // not the start of a run
    let end = m;
    while (set.has(end === 12 ? 1 : end + 1) && (end === 12 ? 1 : end + 1) !== m) end = end === 12 ? 1 : end + 1;
    runs.push([m, end]);
  }
  return runs
    .map(([a, b]) => (a === b ? name(a) : `${name(a)} – ${name(b)}`))
    .join(locale === "ar" ? "، " : ", ");
}

/**
 * "13 ليلة", not "13 ليالٍ": nights counted like every other Arabic noun
 * (ليلة واحدة · ليلتان · 3–10 ليالٍ · 11+ ليلة). Shapes from the
 * hotelResults dictionary.
 */
export function nightsLabel(
  count: number,
  t: { oneNight: string; twoNights: string; nights: string; nightsMany: string }
): string {
  return countLabel(count, { one: t.oneNight, two: t.twoNights, few: t.nights, many: t.nightsMany });
}
