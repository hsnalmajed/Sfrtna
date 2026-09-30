// Climate normals + destination types + tourism sources → the single source
// of truth for every destination × month: src/data/climate/travelSeasons.json.
// Also writes the QA table and the coverage report.
//
//   node scripts/climate/generate_seasons.mts
//
// Nothing here fetches anything or invents anything: it reads the generated
// normals, the editorial destination types and the sourced tourism months,
// and runs the versioned engine over them.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scoreDestination } from "../../src/lib/travelSeason/engine.ts";
import { SCORING } from "../../src/lib/travelSeason/config.ts";
import type { DestinationClimate, SeasonRecord, TourismSignalInput } from "../../src/lib/travelSeason/types.ts";
import { DESTINATION_TYPES, DESTINATION_TYPES_VERSION, QA_DESTINATION_TYPES } from "../../src/data/destinationTypes.ts";
import { CITY_SEASON_SOURCES, SEASON_SOURCES, TOURISM_LAST_VERIFIED } from "../../src/data/citySeasonSources.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const normalsPath = join(root, "src/data/climate/normals.json");
const outPath = join(root, "src/data/climate/travelSeasons.json");
const reportDir = join(here, "reports");

if (!existsSync(normalsPath)) {
  console.error("src/data/climate/normals.json not found — run fetch_era5land.py and build_normals.py first.");
  process.exit(1);
}

interface NormalsFile {
  meta: { generatedAt: string; period: string; dataset: string };
  destinations: Record<string, Omit<DestinationClimate, "id"> & { coordinateSource: string }>;
  missing: { id: string; why: string }[];
}
const normals: NormalsFile = JSON.parse(readFileSync(normalsPath, "utf8"));
const destList = JSON.parse(readFileSync(join(here, "destinations.json"), "utf8")).destinations as {
  id: string; countryCode: string; name: string; qa: boolean;
}[];

function tourismFor(id: string): TourismSignalInput | null {
  const e = CITY_SEASON_SOURCES[id];
  if (!e) return null;
  const src = SEASON_SOURCES[e.source];
  return {
    sourceName: src.nameEn,
    sourceNameAr: src.nameAr,
    sourceUrl: e.url,
    official: src.official,
    recommendedMonths: e.months,
    broad: Boolean(e.broad),
    lastVerified: TOURISM_LAST_VERIFIED,
  };
}

const generatedAt = new Date().toISOString();
const records: Record<string, SeasonRecord[]> = {};
const qaRecords: Record<string, SeasonRecord[]> = {};
const errors: string[] = [];

for (const d of destList) {
  const n = normals.destinations[d.id];
  if (!n) {
    errors.push(`${d.id}: no climate normals (${normals.missing.find((x) => x.id === d.id)?.why ?? "not fetched"})`);
    continue;
  }
  const types = (d.qa ? QA_DESTINATION_TYPES : DESTINATION_TYPES)[d.id];
  if (!types) {
    errors.push(`${d.id}: no destination type`);
    continue;
  }
  const climate: DestinationClimate = { id: d.id, countryCode: n.countryCode, latitude: n.latitude, longitude: n.longitude, months: n.months, provenance: n.provenance };
  const recs = scoreDestination(climate, types, d.qa ? null : tourismFor(d.id), generatedAt);
  (d.qa ? qaRecords : records)[d.id] = recs;
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  JSON.stringify(
    {
      meta: {
        scoringVersion: SCORING.version,
        destinationTypesVersion: DESTINATION_TYPES_VERSION,
        tourismLastVerified: TOURISM_LAST_VERIFIED,
        climateDataset: normals.meta.dataset,
        climatePeriod: normals.meta.period,
        normalsGeneratedAt: normals.meta.generatedAt,
        generatedAt,
      },
      records,
    },
    null,
    0
  ) + "\n"
);

// ── Reports ────────────────────────────────────────────────────────────────
mkdirSync(reportDir, { recursive: true });
const fmt = (x: number | null, nd = 0) => (x === null ? "—" : x.toFixed(nd));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const QA_IDS = ["riyadh", "jeddah", "abha", "dubai", "muscat", "trabzon", "istanbul", "antalya", "london", "paris", "zurich", "reykjavik", "bangkok", "singapore", "bali", "male", "tokyo", "sapporo", "new-york", "miami", "cape-town", "sydney", "queenstown", "cairo", "marrakesh", "coronet-peak", "zermatt"];
const all = { ...records, ...qaRecords };
const csv = ["city,month,high_c,low_c,precip_mm,rain_days,rh_pct,dew_c,climate_score,tourism_signal,final_score,classification,confidence,season,pattern,phase,caps,reason_en"];
let md = `# Quality test — scoring v${SCORING.version}\n\nClimate: ${normals.meta.dataset}, ${normals.meta.period}. Generated ${generatedAt}.\n\n`;
for (const id of QA_IDS) {
  const recs = all[id];
  if (!recs) {
    md += `## ${id}\n\nNo data: ${errors.find((e) => e.startsWith(id)) ?? "missing"}\n\n`;
    continue;
  }
  const p = recs[0];
  md += `## ${id} — ${p.destinationTypes.join(" + ")} — ${p.climateGridInfo}\n\n`;
  md += "| Month | High | Low | Rain mm | Rain days | RH % | Climate | Tourism | Final | Class | Reason |\n|---|---|---|---|---|---|---|---|---|---|---|\n";
  for (const r of recs) {
    md += `| ${MONTHS[r.month - 1]} | ${fmt(r.averageHighC)} | ${fmt(r.averageLowC)} | ${fmt(r.precipitationMm)} | ${fmt(r.precipitationDays, 1)} | ${fmt(r.relativeHumidity)} | ${fmt(r.climateScore)} | ${r.tourismSignal} | ${fmt(r.finalScore)} | ${r.classification ?? "—"}${r.favorablePhase ? ` (${r.favorablePhase})` : ""} | ${r.reasonEn ?? "—"} |\n`;
    csv.push([id, r.month, r.averageHighC, r.averageLowC, r.precipitationMm, r.precipitationDays, r.relativeHumidity, r.dewPointC, r.climateScore, r.tourismSignal, r.finalScore, r.classification, r.confidenceLevel, r.season, r.climatePattern, r.favorablePhase, r.caps.map((c) => c.id).join("+"), JSON.stringify(r.reasonEn ?? "")].join(","));
  }
  md += "\n";
}
writeFileSync(join(reportDir, "qa.md"), md);
writeFileSync(join(reportDir, "qa.csv"), csv.join("\n") + "\n");

// Coverage.
const site = destList.filter((d) => !d.qa);
const withCoords = site.filter((d) => normals.destinations[d.id] || true); // every site destination has coordinates in cityCoords.ts
const withClimate = site.filter((d) => records[d.id]);
const withTourism = site.filter((d) => CITY_SEASON_SOURCES[d.id]);
const station = site.filter((d) => normals.destinations[d.id]?.provenance.kind === "station");
const lowConf = site.filter((d) => records[d.id]?.[0].confidenceLevel === "low");
const farGrid = site.filter((d) => (normals.destinations[d.id]?.provenance.distanceKm ?? 0) > 5);
const cov = [
  `# Coverage — scoring v${SCORING.version}, ${generatedAt}`,
  "",
  `- Total destinations: ${site.length}`,
  `- With coordinates: ${withCoords.length}`,
  `- Missing coordinates: ${site.length - withCoords.length}`,
  `- With climate data: ${withClimate.length}`,
  `- With tourism source: ${withTourism.length}`,
  `- Climate-only: ${withClimate.length - withTourism.filter((d) => records[d.id]).length}`,
  `- With official station override: ${station.length}`,
  `- Low-confidence: ${lowConf.length}${lowConf.length ? ` (${lowConf.map((d) => d.id).join(", ")})` : ""}`,
  `- Grid point more than 5 km away: ${farGrid.length}${farGrid.length ? ` (${farGrid.map((d) => `${d.id} ${normals.destinations[d.id].provenance.distanceKm} km`).join(", ")})` : ""}`,
  `- Errors: ${errors.length}`,
  ...errors.map((e) => `  - ${e}`),
  "",
].join("\n");
writeFileSync(join(reportDir, "coverage.md"), cov);

console.log(cov);
console.log(`→ ${Object.keys(records).length} destinations × 12 in src/data/climate/travelSeasons.json; QA report in scripts/climate/reports/`);
