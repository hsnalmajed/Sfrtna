// Logic tests for the travel-season engine.
//
//   node --test src/lib/travelSeason/
//
// The inputs in this file are made-up test fixtures shaped like real climates
// (a desert summer, a monsoon, an alpine winter…). They exist only to check
// the rules and are never published. The same checks run against the real
// generated data in dataset.test.ts once src/data/climate/ exists.

import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreDestination, seasonFor, favorablePhases, climatePatterns, heatIndexC, classify, confidenceFor } from "./engine.ts";
import type { DestinationClimate, MonthClimate, TourismSignalInput } from "./types.ts";
import type { DestinationType } from "./config.ts";
import { SCORING } from "./config.ts";

const m = (highC: number | null, lowC: number | null, precipMm: number | null, precipDays: number | null, dewPointC: number | null, extra: Partial<MonthClimate> = {}): MonthClimate => ({
  highC, lowC, meanC: highC !== null && lowC !== null ? (highC + lowC) / 2 : null, precipMm, precipDays, dewPointC,
  relativeHumidity: null, windMs: 3, snowCoverPct: 0, ...extra,
});

const dest = (id: string, lat: number, months: MonthClimate[]): DestinationClimate => ({
  id, countryCode: "XX", latitude: lat, longitude: 0, months,
  provenance: {
    kind: "era5-land", source: "test", dataset: "test fixture", datasetUrl: "", period: "1991–2020",
    usedLat: lat, usedLon: 0, distanceKm: 0, gridNote: "destination's own grid cell", timezone: "UTC",
    retrievedAt: "2026-01-01", generatedAt: "2026-01-01", pipelineVersion: "1.0",
  },
});

const run = (d: DestinationClimate, types: DestinationType[], tourism: TourismSignalInput | null = null) =>
  scoreDestination(d, types, tourism, "2026-01-01");

// A desert city: mild dry winters, 43 °C summers with no rain at all.
const desert = dest("desert", 24.6, [
  m(22, 9, 12, 2, 2), m(25, 11, 8, 1.5, 2), m(29, 15, 20, 3, 3), m(34, 20, 20, 3, 5), m(40, 25, 5, 1, 4), m(43, 28, 0, 0, 3),
  m(44, 29, 0, 0, 4), m(44, 29, 0, 0, 5), m(41, 25, 0, 0, 5), m(36, 20, 2, 0.5, 4), m(29, 15, 10, 2, 5), m(23, 10, 12, 2, 4),
]);

// A monsoon island: hot and humid all year, the wettest months far wetter.
const monsoonIsland = dest("island", 4.2, [
  m(29, 25, 90, 7, 23), m(29.5, 25, 50, 4, 23), m(30, 26, 70, 5, 23.5), m(31, 26, 130, 9, 24), m(31, 26, 260, 16, 24.5), m(30, 26, 470, 23, 24.5),
  m(30, 26, 330, 21, 24), m(30, 25, 280, 19, 24), m(30, 25, 230, 17, 24), m(30, 25, 220, 17, 24), m(29.5, 25, 250, 18, 24), m(29, 25, 180, 12, 23.5),
]);

// An alpine ski field: deep snow in the northern winter.
const alpine = dest("alpine", 46.0, [
  m(-4, -12, 90, 11, -10, { snowCoverPct: 98 }), m(-3, -12, 80, 10, -10, { snowCoverPct: 98 }), m(0, -9, 90, 11, -8, { snowCoverPct: 95 }),
  m(4, -5, 90, 12, -5, { snowCoverPct: 80 }), m(9, 0, 110, 14, -1, { snowCoverPct: 40 }), m(13, 3, 120, 14, 3, { snowCoverPct: 5 }),
  m(16, 5, 120, 13, 5, { snowCoverPct: 0 }), m(15, 5, 120, 13, 5, { snowCoverPct: 0 }), m(12, 3, 100, 11, 2, { snowCoverPct: 5 }),
  m(7, -1, 90, 10, -2, { snowCoverPct: 30 }), m(1, -6, 100, 11, -6, { snowCoverPct: 80 }), m(-3, -10, 100, 11, -9, { snowCoverPct: 95 }),
]);

// A Bali-like southern-tropics beach with a marked wet season (Dec–Mar).
const baliLike = dest("bali", -8.6, [
  m(30, 24, 330, 20, 23), m(30, 24, 280, 18, 23), m(31, 24, 220, 16, 23), m(31, 24, 90, 8, 22), m(31, 23, 70, 6, 21), m(30, 23, 50, 4, 20),
  m(29, 22, 40, 3, 19), m(29, 22, 30, 2, 19), m(30, 22, 40, 3, 20), m(31, 23, 80, 6, 21), m(31, 24, 170, 12, 22), m(30, 24, 290, 18, 23),
]);

test("Riyadh-like July is not the best time because it is dry", () => {
  const recs = run(desert, ["city", "desert"]);
  const jul = recs[6];
  assert.equal(jul.classification, "NOT_RECOMMENDED");
  assert.ok(jul.caps.some((c) => c.id === "extremeHeat"));
  // Even a tourism source naming July cannot lift it.
  const withSource = run(desert, ["city", "desert"], {
    sourceName: "Test", sourceNameAr: "اختبار", sourceUrl: "https://example.org", official: true,
    recommendedMonths: [6, 7, 8], broad: false, lastVerified: "2026-01-01",
  });
  assert.equal(withSource[6].classification, "NOT_RECOMMENDED");
  const extremeCap = SCORING.caps.find((c) => c.id === "extremeHeat")!.cap;
  assert.ok((withSource[6].finalScore ?? 100) <= extremeCap);
});

test("the wettest monsoon month is not the best time just because it is warm", () => {
  const recs = run(monsoonIsland, ["beach", "tropical"]);
  const june = recs[5];
  assert.notEqual(june.classification, "EXCELLENT");
  assert.notEqual(june.classification, "VERY_GOOD");
  assert.ok(june.caps.length > 0);
});

test("a ski destination in winter is not rejected for being below 10 °C", () => {
  const recs = run(alpine, ["ski"]);
  const jan = recs[0];
  assert.ok(jan.classification === "EXCELLENT" || jan.classification === "VERY_GOOD", `got ${jan.classification}`);
  // The same place scored as a city is poor in January.
  const asCity = run(alpine, ["city"]);
  assert.equal(asCity[0].classification, "NOT_RECOMMENDED");
});

test("rainy season is scored below dry season", () => {
  const recs = run(baliLike, ["beach", "tropical"]);
  const jan = recs[0];
  const aug = recs[7];
  assert.ok((jan.climateScore ?? 0) < (aug.climateScore ?? 0) - 20, `${jan.climateScore} vs ${aug.climateScore}`);
  assert.equal(jan.climatePattern, "rainy_season");
  assert.equal(aug.climatePattern, "dry_season");
});

test("southern-hemisphere seasons are flipped; pattern is separate from season", () => {
  assert.equal(seasonFor(-8.6, 1), "summer");
  assert.equal(seasonFor(-33.9, 7), "winter");
  assert.equal(seasonFor(41, 1), "winter");
  const recs = run(baliLike, ["beach", "tropical"]);
  assert.equal(recs[0].season, "summer");
  assert.equal(recs[0].climatePattern, "rainy_season");
});

test("missing data stays null — never 0 — and is not scored", () => {
  const months = desert.months.map((x, i) => (i === 3 ? m(null, null, null, null, null) : x));
  const recs = run(dest("gap", 24.6, months), ["city"]);
  assert.equal(recs[3].averageHighC, null);
  assert.equal(recs[3].climateScore, null);
  assert.equal(recs[3].classification, null);
  assert.equal(recs[3].finalScore, null);
  // Missing humidity alone does not zero the month: remaining weights re-normalise.
  const noDew = desert.months.map((x) => ({ ...x, dewPointC: null }));
  const r2 = run(dest("nodew", 24.6, noDew), ["city"]);
  assert.ok((r2[0].climateScore ?? 0) > 50);
  assert.equal(r2[0].humidityScore, null);
});

test("no tourism source means none is invented", () => {
  const recs = run(desert, ["city"]);
  for (const r of recs) {
    assert.equal(r.tourismSignal, "unavailable");
    assert.equal(r.tourismSourceName, null);
    assert.equal(r.tourismSourceUrl, null);
    assert.equal(r.tourismAdjustment, 0);
  }
});

test("the least-bad month of a bad year is not called the best time", () => {
  // Hot and humid every month, nothing comfortable.
  const allBad = dest("bad", 10, Array.from({ length: 12 }, (_, i) => m(38 + (i % 3), 29, 10, 1, 25)));
  const recs = run(allBad, ["city"]);
  assert.ok(recs.every((r) => r.classification !== "EXCELLENT" && r.classification !== "VERY_GOOD"));
  assert.ok(recs.every((r) => r.relativeBonus === 0));
});

test("the average high is not the monthly mean temperature", () => {
  const recs = run(desert, ["city"]);
  assert.equal(recs[0].averageHighC, 22);
  assert.equal(recs[0].meanTemperatureC, 15.5);
  assert.notEqual(recs[0].averageHighC, recs[0].meanTemperatureC);
});

test("GOOD is not assumed to be the end of a season", () => {
  const classes = ["NOT_RECOMMENDED", "ACCEPTABLE", "GOOD", "VERY_GOOD", "EXCELLENT", "EXCELLENT", "VERY_GOOD", "GOOD", "GOOD", "ACCEPTABLE", "NOT_RECOMMENDED", "NOT_RECOMMENDED"] as const;
  const finals = [30, 45, 60, 75, 90, 92, 76, 62, 60, 45, 30, 30];
  const phases = favorablePhases([...classes], finals);
  assert.equal(phases[2], null); // GOOD before the run: not "start"
  assert.equal(phases[3], "start");
  assert.equal(phases[5], "peak");
  assert.equal(phases[6], "end");
  assert.equal(phases[7], null); // GOOD after the run: not "end"
});

test("wet/dry patterns need a real contrast", () => {
  const flat = Array.from({ length: 12 }, () => m(20, 10, 60, 8, 8));
  assert.ok(climatePatterns(flat).every((p) => p === null));
});

test("scoring config is versioned", () => {
  assert.match(SCORING.version, /^\d+\.\d+$/);
  const w = SCORING.weights;
  assert.ok(Math.abs(w.high + w.low + w.humidity + w.precipitation + w.wind - 1) < 1e-9);
});

test("hot and humid is capped even when the thermometer alone looks fine", () => {
  // 36 °C with a 23 °C dew point — a Red Sea / Gulf coast summer.
  const hot = m(36, 29, 0, 0, 23);
  const hi = heatIndexC(hot) ?? 0;
  assert.ok(hi >= 40, `heat index ${hi}`);
  const coast = dest("coast", 21.5, Array.from({ length: 12 }, (_, i) => (i === 6 ? hot : m(28, 20, 5, 1, 12))));
  const jul = run(coast, ["city", "beach"])[6];
  assert.ok(jul.caps.some((c) => c.id === "hotHumid"));
  assert.ok(["ACCEPTABLE", "NOT_RECOMMENDED"].includes(jul.classification as string));
  // Dry heat of the same temperature is not called humid.
  assert.equal((heatIndexC(m(36, 22, 0, 0, 2)) ?? 0) < 36, true);
});

test("one poor essential factor pulls the whole month down", () => {
  // Ideal temperatures but rain on 19 days out of 30.
  const wetMild = m(24, 15, 180, 19, 12);
  const dryMild = m(24, 15, 20, 2, 12);
  const d = dest("wet", 45, Array.from({ length: 12 }, (_, i) => (i === 0 ? wetMild : dryMild)));
  const recs = run(d, ["city"]);
  assert.ok((recs[0].climateScore ?? 100) < 70, `wet month ${recs[0].climateScore}`);
  assert.ok((recs[1].climateScore ?? 0) >= 90);
});

test("a cold city month is not a good time", () => {
  // Istanbul/Trabzon-like February: 8 °C high, frequent rain.
  const d = dest("cold", 41, Array.from({ length: 12 }, (_, i) => (i === 1 ? m(8, 3, 90, 13, 3) : m(24, 16, 30, 4, 12))));
  const feb = run(d, ["city"])[1];
  assert.ok(["ACCEPTABLE", "NOT_RECOMMENDED"].includes(feb.classification as string), `${feb.classification} ${feb.finalScore}`);
});

test("best time means close to the destination's own best month", () => {
  assert.equal(classify(88, 86, 90), "EXCELLENT");
  assert.equal(classify(88, 86, 99), "VERY_GOOD");
});

test("a cell far higher than the town lowers confidence", () => {
  const months = desert.months;
  const base = { ...desert.provenance, townElevationM: 1600, cellElevationM: 1650, elevationDifferenceM: 50 };
  const far = { ...base, cellElevationM: 2500, elevationDifferenceM: 900 };
  const accepted = { ...far, elevationAccepted: "reviewed" };
  const a = confidenceFor(months, base, null).score;
  const b = confidenceFor(months, far, null).score;
  assert.ok(b < a);
  assert.equal(confidenceFor(months, accepted, null).score, a);
});

test("not recommended needs an extreme condition", () => {
  assert.equal(classify(30, 30, 90, false), "ACCEPTABLE");
  assert.equal(classify(30, 30, 90, true), "NOT_RECOMMENDED");
});
