// The Sfrtna travel-season engine: climate normals + tourism signal →
// one scored record per destination × month.
//
// Pure functions only — no data files, no network — so the same code runs in
// the site, in the generator script and in the tests. Every number it uses
// lives in ./config.ts under a version.
//
//   1. Climate suitability (absolute): the month is scored against each trip
//      profile the destination carries (city, beach, mountain, ski…) from its
//      average high and low, humidity (dew point), rain (days and mm) and wind
//      — the best profile wins — then capped by universal limits (extreme
//      heat, heat with humidity, monsoon-scale rain, deep cold for non-ski).
//   2. Relative ranking: the destination's best three months get a small
//      bonus, but only when already good in absolute terms, so the least bad
//      of twelve bad months is never "the best time".
//   3. Tourism signal: a month named by the tourism board or guide gains a
//      little; a sourced destination's unnamed month loses a little. No
//      source means no adjustment, never an invented one. The caps still
//      apply afterwards, so no source can rescue 42 °C.
//   4. Classification by final score, with a minimum climate score for the
//      top two classes.

import { SCORING, type Classification, type DestinationType, type ThermalProfile } from "./config.ts";
import type {
  CapHit,
  ClimatePattern,
  ConfidenceLevel,
  DestinationClimate,
  FavorablePhase,
  MonthClimate,
  Season,
  SeasonRecord,
  TourismSignalInput,
} from "./types.ts";
import { reasonText, weatherSummary } from "./text.ts";

const clamp = (x: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, x));
const round1 = (x: number) => Math.round(x * 10) / 10;

/** 100 inside [a, b], falling by the given slope per unit outside. */
function band(value: number, [a, b]: readonly [number, number], below: number, above: number): number {
  if (value < a) return clamp(100 - (a - value) * below);
  if (value > b) return clamp(100 - (value - b) * above);
  return 100;
}

/** 100 at or below `good`, 0 at or above `bad`, linear between. */
function falling(value: number, good: number, bad: number): number {
  if (value <= good) return 100;
  if (value >= bad) return 0;
  return clamp(100 - ((value - good) / (bad - good)) * 100);
}

// ── Season and climate pattern ─────────────────────────────────────────────

/** Meteorological seasons, flipped south of the equator. */
export function seasonFor(latitude: number, month: number): Season {
  const north: Season[] = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
  const flip: Record<Season, Season> = { winter: "summer", summer: "winter", spring: "autumn", autumn: "spring" };
  const s = north[month - 1];
  return latitude < 0 ? flip[s] : s;
}

/**
 * What the month is like within its own year, separately from the season:
 * rainy or dry season where the year has a marked wet/dry contrast, snow
 * season where the cell is mostly snow-covered. null when none applies.
 */
export function climatePatterns(months: MonthClimate[]): ClimatePattern[] {
  const p = SCORING.patterns;
  const mm = months.map((m) => m.precipMm);
  const known = mm.filter((x): x is number => x !== null);
  const max = known.length ? Math.max(...known) : null;
  const min = known.length ? Math.min(...known) : null;
  const wetDry = max !== null && min !== null && max >= p.wetMonthMinMm && max >= p.wetDryRatio * Math.max(min, 1);
  return months.map((m) => {
    if (m.snowCoverPct !== null && m.snowCoverPct >= p.snowCoverPct) return "snow_season";
    if (!wetDry || m.precipMm === null || max === null) return null;
    if (m.precipMm >= p.rainyShareOfMax * max) return "rainy_season";
    if (m.precipMm <= p.dryShareOfMax * max && m.precipMm <= p.dryMaxMm) return "dry_season";
    return null;
  });
}

// ── Climate sub-scores ─────────────────────────────────────────────────────

export interface SubScores {
  profile: DestinationType;
  thermal: number;
  high: number;
  low: number | null;
  humidity: number | null;
  precipitation: number | null;
  wind: number | null;
  snow: number | null;
  other: number | null;
  score: number;
}

function precipitationScore(m: MonthClimate): number | null {
  const p = SCORING.precipitation;
  const days = m.precipDays === null ? null : falling(m.precipDays, p.daysGood, p.daysBad);
  const mm = m.precipMm === null ? null : falling(m.precipMm, p.mmGood, p.mmBad);
  if (days === null && mm === null) return null;
  if (days === null) return mm;
  if (mm === null) return days;
  return days * p.daysShare + mm * (1 - p.daysShare);
}

function windScore(m: MonthClimate): number | null {
  return m.windMs === null ? null : falling(m.windMs, SCORING.wind.good, SCORING.wind.bad);
}

/** Weighted mean over the parts that exist; missing parts drop out, never count as 0. */
function weighted(parts: [number | null, number][]): number {
  let sum = 0;
  let w = 0;
  for (const [v, weight] of parts) {
    if (v === null) continue;
    sum += v * weight;
    w += weight;
  }
  return w > 0 ? sum / w : 0;
}

function scoreProfile(m: MonthClimate, type: Exclude<DestinationType, "ski">): SubScores | null {
  if (m.highC === null) return null;
  const prof: ThermalProfile = SCORING.profiles[type];
  const high = band(m.highC, prof.idealHigh, prof.perDegreeBelow, prof.perDegreeAbove);
  const low = m.lowC === null ? null : band(m.lowC, prof.idealLow, prof.perDegreeLowBelow, prof.perDegreeLowAbove);
  const humidity =
    m.dewPointC === null
      ? null
      : m.highC < SCORING.humidityAppliesFromHighC
        ? 100
        : falling(m.dewPointC, prof.dewPointComfort, prof.dewPointOppressive);
  const precipitation = precipitationScore(m);
  const wind = windScore(m);
  const w = SCORING.weights;
  const score = weighted([
    [high, w.high],
    [low, w.low],
    [humidity, w.humidity],
    [precipitation, w.precipitation],
    [wind, w.wind],
  ]);
  const thermal = weighted([
    [high, w.high],
    [low, w.low],
  ]);
  return { profile: type, thermal, high, low, humidity, precipitation, wind, snow: null, other: wind, score };
}

function scoreSki(m: MonthClimate): SubScores | null {
  if (m.highC === null) return null;
  const s = SCORING.ski;
  const high = band(m.highC, s.idealHigh, s.perDegreeBelow, s.perDegreeAbove);
  const snow =
    m.snowCoverPct === null
      ? null
      : clamp(((m.snowCoverPct - s.snowCoverNone) / (s.snowCoverFull - s.snowCoverNone)) * 100);
  const precipitation = precipitationScore(m);
  const wind = windScore(m);
  // Without snow data a ski month cannot be judged as ski.
  if (snow === null) return null;
  const score = weighted([
    [snow, s.weights.snow],
    [high, s.weights.thermal],
    [precipitation, s.weights.precipitation],
    [wind, s.weights.wind],
  ]);
  return { profile: "ski", thermal: high, high, low: null, humidity: null, precipitation, wind, snow, other: weighted([[snow, 0.8], [wind, 0.2]]), score };
}

/** Best profile for the month, before caps. */
export function bestProfileScore(m: MonthClimate, types: DestinationType[]): SubScores | null {
  const list = types.length ? types : (["city"] as DestinationType[]);
  let best: SubScores | null = null;
  for (const t of list) {
    const s = t === "ski" ? scoreSki(m) : scoreProfile(m, t);
    if (s && (!best || s.score > best.score)) best = s;
  }
  return best;
}

/** Universal caps that apply to the month. */
export function capsFor(m: MonthClimate, types: DestinationType[]): CapHit[] {
  const isSki = types.includes("ski");
  const hits: CapHit[] = [];
  for (const c of SCORING.caps) {
    const w = c.when as Record<string, number | undefined>;
    if ("exceptSki" in c && c.exceptSki && isSki) continue;
    const checks: boolean[] = [];
    if (w.highAtLeast !== undefined) checks.push(m.highC !== null && m.highC >= w.highAtLeast);
    if (w.highAtMost !== undefined) checks.push(m.highC !== null && m.highC <= w.highAtMost);
    if (w.dewPointAtLeast !== undefined) checks.push(m.dewPointC !== null && m.dewPointC >= w.dewPointAtLeast);
    if (w.precipMmAtLeast !== undefined) checks.push(m.precipMm !== null && m.precipMm >= w.precipMmAtLeast);
    if (w.precipDaysAtLeast !== undefined) checks.push(m.precipDays !== null && m.precipDays >= w.precipDaysAtLeast);
    if (checks.length && checks.every(Boolean)) hits.push({ id: c.id, cap: c.cap });
  }
  return hits;
}

// ── Classification, confidence, phases ─────────────────────────────────────

export function classify(finalScore: number, climateScore: number): Classification {
  for (const c of SCORING.classes) {
    if (finalScore >= c.minFinal && climateScore >= c.minClimate) return c.id;
  }
  return "NOT_RECOMMENDED";
}

const FAVORABLE: Classification[] = ["EXCELLENT", "VERY_GOOD"];

/**
 * Start, peak and end of the favourable period, read from neighbouring
 * months once all twelve are classified. A month is favourable when it is
 * VERY_GOOD or EXCELLENT; GOOD or ACCEPTABLE says nothing about where a
 * season begins or ends by itself.
 */
export function favorablePhases(classes: (Classification | null)[], finals: (number | null)[]): FavorablePhase[] {
  const fav = classes.map((c) => c !== null && FAVORABLE.includes(c));
  if (fav.every(Boolean) || !fav.some(Boolean)) return classes.map(() => null);
  const out: FavorablePhase[] = classes.map(() => null);
  for (let i = 0; i < 12; i++) {
    if (!fav[i]) continue;
    const prev = fav[(i + 11) % 12];
    const next = fav[(i + 1) % 12];
    if (!prev && next) out[i] = "start";
    else if (prev && !next) out[i] = "end";
  }
  // Peak: the highest final score within each run of favourable months.
  for (let i = 0; i < 12; i++) {
    if (!fav[i] || fav[(i + 11) % 12]) continue; // run starts at i
    let best = i;
    let j = i;
    while (fav[j % 12] && j < i + 12) {
      if ((finals[j % 12] ?? -1) > (finals[best % 12] ?? -1)) best = j;
      j++;
    }
    const len = j - i;
    if (len >= 3 && out[best % 12] === null) out[best % 12] = "peak";
  }
  return out;
}

export function confidenceFor(
  months: MonthClimate[],
  prov: DestinationClimate["provenance"],
  tourism: TourismSignalInput | null
): { score: number; level: ConfidenceLevel } {
  const c = SCORING.confidence;
  const complete = months.every(
    (m) => m.highC !== null && m.lowC !== null && m.precipMm !== null && m.precipDays !== null && m.dewPointC !== null
  );
  let score: number = complete ? c.climateComplete : c.climatePartial;
  score += prov.distanceKm <= 0.5 ? c.gridExact : prov.distanceKm <= c.gridNearbyKm ? c.gridNearby : c.gridFar;
  score += prov.kind === "station" ? c.stationOverride : c.reanalysis;
  score += tourism ? (tourism.official ? c.tourismOfficial : c.tourismGuide) : c.tourismNone;
  score = clamp(score);
  const level: ConfidenceLevel = score >= c.high ? "high" : score >= c.medium ? "medium" : "low";
  return { score, level };
}

// ── The whole year for one destination ─────────────────────────────────────

export function scoreDestination(
  climate: DestinationClimate,
  types: DestinationType[],
  tourism: TourismSignalInput | null,
  generatedAt: string
): SeasonRecord[] {
  const { months, provenance: prov } = climate;
  const patterns = climatePatterns(months);

  const subs = months.map((m) => bestProfileScore(m, types));
  const caps = months.map((m) => capsFor(m, types));
  const climateScores = subs.map((s, i) => {
    if (!s) return null;
    const cap = Math.min(100, ...caps[i].map((c) => c.cap));
    return Math.min(s.score, cap);
  });

  // Rank of each month's climate score within its own year (1 = best).
  const order = climateScores
    .map((s, i) => ({ s, i }))
    .filter((x): x is { s: number; i: number } => x.s !== null)
    .sort((a, b) => b.s - a.s);
  const rank = new Map(order.map((x, k) => [x.i, k + 1]));

  const r = SCORING.relative;
  const t = SCORING.tourism;
  const finals: (number | null)[] = [];
  const adjustments: { relative: number; tourism: number; signal: SeasonRecord["tourismSignal"] }[] = [];
  months.forEach((_, i) => {
    const cs = climateScores[i];
    const month = i + 1;
    const signal: SeasonRecord["tourismSignal"] = !tourism
      ? "unavailable"
      : tourism.recommendedMonths.includes(month)
        ? "listed"
        : "unlisted";
    if (cs === null) {
      finals.push(null);
      adjustments.push({ relative: 0, tourism: 0, signal });
      return;
    }
    const relative = (rank.get(i) ?? 99) <= r.topMonths && cs >= r.minClimateScore ? r.bonus : 0;
    const tour =
      signal === "listed" ? (cs >= t.listedMinClimate ? t.listedBonus : 0) : signal === "unlisted" ? -t.unlistedPenalty : 0;
    const cap = Math.min(100, ...caps[i].map((c) => c.cap));
    finals.push(round1(clamp(Math.min(cs + relative + tour, cap))));
    adjustments.push({ relative, tourism: tour, signal });
  });

  const classes = finals.map((f, i) => (f === null ? null : classify(f, climateScores[i] as number)));
  const phases = favorablePhases(classes, finals);
  const conf = confidenceFor(months, prov, tourism);

  return months.map((m, i) => {
    const s = subs[i];
    const month = i + 1;
    const cls = classes[i];
    const summary = weatherSummary(m);
    const reason = cls ? reasonText({ month: m, sub: s, caps: caps[i], signal: adjustments[i].signal, tourism, classification: cls }) : null;
    return {
      destinationId: climate.id,
      countryCode: climate.countryCode,
      latitude: climate.latitude,
      longitude: climate.longitude,
      month,
      hemisphere: climate.latitude < 0 ? "south" : "north",
      season: seasonFor(climate.latitude, month),
      climatePattern: patterns[i],
      averageHighC: m.highC,
      averageLowC: m.lowC,
      meanTemperatureC: m.meanC,
      precipitationMm: m.precipMm,
      precipitationDays: m.precipDays,
      relativeHumidity: m.relativeHumidity,
      dewPointC: m.dewPointC,
      windSpeedMs: m.windMs,
      snowCoverPct: m.snowCoverPct,
      destinationTypes: types,
      scoredAs: s?.profile ?? null,
      thermalScore: s ? round1(s.thermal) : null,
      precipitationScore: s?.precipitation != null ? round1(s.precipitation) : null,
      humidityScore: s?.humidity != null ? round1(s.humidity) : null,
      otherClimateScore: s?.other != null ? round1(s.other) : null,
      rawClimateScore: s ? round1(s.score) : null,
      climateScore: climateScores[i] === null ? null : round1(climateScores[i] as number),
      caps: caps[i],
      relativeRank: rank.get(i) ?? null,
      relativeBonus: adjustments[i].relative,
      tourismSignal: adjustments[i].signal,
      tourismAdjustment: adjustments[i].tourism,
      tourismSourceName: tourism?.sourceName ?? null,
      tourismSourceNameAr: tourism?.sourceNameAr ?? null,
      tourismSourceUrl: tourism?.sourceUrl ?? null,
      tourismOfficial: tourism ? tourism.official : null,
      tourismBroad: tourism ? tourism.broad : null,
      tourismLastVerified: tourism?.lastVerified ?? null,
      finalScore: finals[i],
      classification: cls,
      confidenceScore: conf.score,
      confidenceLevel: conf.level,
      favorablePhase: phases[i],
      weatherSummaryAr: summary?.ar ?? null,
      weatherSummaryEn: summary?.en ?? null,
      reasonAr: reason?.ar ?? null,
      reasonEn: reason?.en ?? null,
      climateSource: prov.source,
      climateDataset: prov.dataset,
      climateDatasetUrl: prov.datasetUrl,
      climatePeriod: prov.period,
      climateGridInfo: `${prov.gridNote}: ${prov.usedLat.toFixed(2)}, ${prov.usedLon.toFixed(2)} (${prov.distanceKm.toFixed(1)} km)`,
      climateStation: prov.stationName ?? null,
      climateDistanceKm: prov.distanceKm,
      climateRetrievedAt: prov.retrievedAt,
      scoringVersion: SCORING.version,
      generatedAt,
    } satisfies SeasonRecord;
  });
}
