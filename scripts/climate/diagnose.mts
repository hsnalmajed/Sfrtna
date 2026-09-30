// Why did a destination get its result in a month?
//
//   node scripts/climate/diagnose.mts riyadh 7
//   node scripts/climate/diagnose.mts reykjavik 1      (QA places too)
//
// Prints the raw climate inputs, the grid point and source, every profile's
// sub-scores, the caps that fired, the relative and tourism adjustments, the
// final score, the class and the reason — recomputed live from the normals
// and the current scoring config, and compared with the stored record.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { bestProfileScore, capsFor, scoreDestination } from "../../src/lib/travelSeason/engine.ts";
import { SCORING, type DestinationType } from "../../src/lib/travelSeason/config.ts";
import { DESTINATION_TYPES, QA_DESTINATION_TYPES } from "../../src/data/destinationTypes.ts";
import { CITY_SEASON_SOURCES, SEASON_SOURCES, TOURISM_LAST_VERIFIED } from "../../src/data/citySeasonSources.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const [id, monthArg] = process.argv.slice(2);
const month = Number(monthArg);
if (!id || !(month >= 1 && month <= 12)) {
  console.error("usage: node scripts/climate/diagnose.mts <destination-id> <month 1-12>");
  process.exit(1);
}
const normals = JSON.parse(readFileSync(join(root, "src/data/climate/normals.json"), "utf8"));
const n = normals.destinations[id];
if (!n) {
  console.error(`${id}: no climate normals`);
  process.exit(1);
}
const types: DestinationType[] = DESTINATION_TYPES[id] ?? QA_DESTINATION_TYPES[id] ?? [];
const e = CITY_SEASON_SOURCES[id];
const tourism = e
  ? { sourceName: SEASON_SOURCES[e.source].nameEn, sourceNameAr: SEASON_SOURCES[e.source].nameAr, sourceUrl: e.url, official: SEASON_SOURCES[e.source].official, recommendedMonths: e.months, broad: Boolean(e.broad), lastVerified: TOURISM_LAST_VERIFIED }
  : null;
const m = n.months[month - 1];

console.log(`\n${id} — month ${month} — scoring v${SCORING.version}`);
console.log("\nClimate inputs (1991–2020 normals):", m);
console.log("Source:", n.provenance);
console.log("Destination types:", types.join(" + ") || "(none → city)");
console.log("\nSub-scores per profile:");
for (const t of types.length ? types : (["city"] as DestinationType[])) {
  const s = bestProfileScore(m, [t]);
  console.log(`  ${t.padEnd(9)}`, s ? { high: s.high, low: s.low, humidity: s.humidity, precipitation: s.precipitation, wind: s.wind, snow: s.snow, score: +s.score.toFixed(1) } : "not scorable");
}
console.log("Caps:", capsFor(m, types));
const recs = scoreDestination({ id, countryCode: n.countryCode, latitude: n.latitude, longitude: n.longitude, months: n.months, provenance: n.provenance }, types, tourism, "diagnose");
const r = recs[month - 1];
console.log("\nResult:", {
  scoredAs: r.scoredAs, rawClimateScore: r.rawClimateScore, climateScore: r.climateScore, relativeRank: r.relativeRank, relativeBonus: r.relativeBonus,
  tourismSignal: r.tourismSignal, tourismAdjustment: r.tourismAdjustment, finalScore: r.finalScore, classification: r.classification,
  favorablePhase: r.favorablePhase, confidence: `${r.confidenceScore} (${r.confidenceLevel})`, season: r.season, climatePattern: r.climatePattern,
  weatherSummary: r.weatherSummaryEn, reasonAr: r.reasonAr, reasonEn: r.reasonEn,
});
console.log("Tourism source:", tourism ? { name: tourism.sourceName, url: tourism.sourceUrl, months: tourism.recommendedMonths, broad: tourism.broad, lastVerified: tourism.lastVerified } : "unavailable");

const storedPath = join(root, "src/data/climate/travelSeasons.json");
if (existsSync(storedPath)) {
  const stored = JSON.parse(readFileSync(storedPath, "utf8")).records[id]?.[month - 1];
  if (stored) {
    const same = stored.finalScore === r.finalScore && stored.classification === r.classification;
    console.log(`\nStored record: ${stored.classification} (${stored.finalScore}) — ${same ? "matches" : "DIFFERS from"} a live recompute.`);
  }
}
