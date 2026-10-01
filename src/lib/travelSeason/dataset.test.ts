// Checks on the real generated data. Skipped until
// src/data/climate/travelSeasons.json exists.
//
//   node --test src/lib/travelSeason/*.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scoreDestination } from "./engine.ts";
import { SCORING } from "./config.ts";
import type { SeasonRecord } from "./types.ts";
import { DESTINATION_TYPES } from "../../data/destinationTypes.ts";
import { CITY_SEASON_SOURCES, SEASON_SOURCES, TOURISM_LAST_VERIFIED } from "../../data/citySeasonSources.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const seasonsPath = join(root, "src/data/climate/travelSeasons.json");
const normalsPath = join(root, "src/data/climate/normals.json");
const have = existsSync(seasonsPath) && existsSync(normalsPath);

const load = () => ({
  seasons: JSON.parse(readFileSync(seasonsPath, "utf8")) as {
    meta: { scoringVersion: string; withheld: Record<string, string>; missing: string[] };
    records: Record<string, SeasonRecord[]>;
  },
  normals: JSON.parse(readFileSync(normalsPath, "utf8")),
});

test("every Sfrtna destination has 12 classified months, or is listed as withheld/missing with a reason", { skip: !have }, () => {
  const { seasons } = load();
  for (const id of Object.keys(DESTINATION_TYPES)) {
    const recs = seasons.records[id];
    if (!recs) {
      const why = seasons.meta.withheld[id] ?? seasons.meta.missing.find((m) => m.startsWith(`${id}:`));
      assert.ok(why, `${id} missing without a reason`);
      continue;
    }
    assert.equal(recs.length, 12, id);
    for (const r of recs) assert.ok(r.classification !== null || r.averageHighC === null, `${id} ${r.month}`);
  }
});

test("stored records match the current scoring version (no drift)", { skip: !have }, () => {
  const { seasons, normals } = load();
  assert.equal(seasons.meta.scoringVersion, SCORING.version);
  for (const [id, recs] of Object.entries(seasons.records)) {
    const n = normals.destinations[id];
    const e = CITY_SEASON_SOURCES[id];
    const tourism = e
      ? { sourceName: SEASON_SOURCES[e.source].nameEn, sourceNameAr: SEASON_SOURCES[e.source].nameAr, sourceUrl: e.url, official: SEASON_SOURCES[e.source].official, recommendedMonths: e.months, broad: Boolean(e.broad), lastVerified: TOURISM_LAST_VERIFIED }
      : null;
    const again = scoreDestination({ id, countryCode: n.countryCode, latitude: n.latitude, longitude: n.longitude, months: n.months, provenance: n.provenance, station: n.station ?? null, parameterSources: n.parameterSources }, DESTINATION_TYPES[id], tourism, "x");
    again.forEach((r, i) => {
      assert.equal(recs[i].finalScore, r.finalScore, `${id} ${i + 1}`);
      assert.equal(recs[i].classification, r.classification, `${id} ${i + 1}`);
    });
  }
});

test("every figure is traceable to a dataset and a point", { skip: !have }, () => {
  const { seasons } = load();
  for (const recs of Object.values(seasons.records)) {
    for (const r of recs) {
      assert.ok(r.climateDataset && r.climatePeriod && r.climateGridInfo && r.climateRetrievedAt, r.destinationId);
      if (r.tourismSignal !== "unavailable") assert.ok(r.tourismSourceUrl?.startsWith("https://"), r.destinationId);
      else assert.equal(r.tourismSourceUrl, null);
    }
  }
});

test("desert summers are never the best time", { skip: !have }, () => {
  const { seasons } = load();
  for (const id of ["riyadh", "kuwait-city", "doha"]) {
    const jul = seasons.records[id]?.[6];
    if (jul) assert.ok(jul.classification === "NOT_RECOMMENDED" || jul.classification === "ACCEPTABLE", `${id} July: ${jul.classification}`);
  }
});

test("average high is above the mean and the mean above the low", { skip: !have }, () => {
  const { seasons } = load();
  for (const recs of Object.values(seasons.records)) {
    for (const r of recs) {
      if (r.averageHighC === null || r.meanTemperatureC === null || r.averageLowC === null) continue;
      assert.ok(r.averageHighC > r.meanTemperatureC && r.meanTemperatureC > r.averageLowC, `${r.destinationId} ${r.month}`);
    }
  }
});

test("coastal destinations use a point within 25 km", { skip: !have }, () => {
  const { seasons } = load();
  for (const recs of Object.values(seasons.records)) assert.ok(recs[0].climateDistanceKm <= 25, recs[0].destinationId);
});
