// Writes scripts/climate/destinations.json: every Sfrtna destination with the
// coordinates the site already uses (src/data/cityCoords.ts, OpenStreetMap),
// plus the quality-test places that are not on the site, which the fetch
// script geocodes itself.
//
//   node scripts/climate/export_destinations.ts

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

const coordsSrc = readFileSync(join(root, "src/data/cityCoords.ts"), "utf8");
const citiesSrc = readFileSync(join(root, "src/lib/cities.ts"), "utf8");

const names = new Map<string, string>();
for (const m of citiesSrc.matchAll(/slug: "([a-z-]+)", nameAr: "[^"]+", nameEn: "([^"]+)"/g)) names.set(m[1], m[2]);

const destinations = [...coordsSrc.matchAll(/^ {2}"([a-z-]+)": \{ lat: (-?[\d.]+), lon: (-?[\d.]+), code: "([A-Z]{2})" \}/gm)].map(
  (m) => ({
    id: m[1],
    countryCode: m[4],
    name: names.get(m[1]) ?? m[1],
    latitude: Number(m[2]),
    longitude: Number(m[3]),
    coordinateSource: "OpenStreetMap Nominatim, via src/data/cityCoords.ts",
    qa: false,
  })
);

// Quality-test places not on the site. No coordinates are written here:
// fetch_era5land.py resolves each query with OpenStreetMap Nominatim and
// records the result it used.
const qa = [
  { id: "sapporo", countryCode: "JP", name: "Sapporo", geocode: "Sapporo, Hokkaido, Japan" },
  { id: "queenstown", countryCode: "NZ", name: "Queenstown", geocode: "Queenstown, Otago, New Zealand" },
  { id: "coronet-peak", countryCode: "NZ", name: "Coronet Peak ski area", geocode: "Coronet Peak, Otago, New Zealand" },
  { id: "zermatt", countryCode: "CH", name: "Zermatt", geocode: "Zermatt, Valais, Switzerland" },
].map((q) => ({ ...q, latitude: null, longitude: null, coordinateSource: null, qa: true }));

// Cities being added (scripts/geo/out/*.staged.json) — fetched now so they
// can go live complete — and the station points that calibrate cities with
// no official station of their own (scripts/climate/data/station_plan.json).
import { readdirSync, existsSync } from "node:fs";
const known = new Set(destinations.map((d) => d.id));
const staged: typeof destinations = [];
const geoOut = join(root, "scripts/geo/out");
for (const f of readdirSync(geoOut).filter((f) => f.endsWith(".staged.json"))) {
  const cities = JSON.parse(readFileSync(join(geoOut, f), "utf8")).cities as Record<string, { country: string; nameEn: string; lat?: number; lon?: number }>;
  for (const [id, c] of Object.entries(cities)) {
    if (known.has(id) || c.lat == null || c.lon == null) continue;
    known.add(id);
    staged.push({ id, countryCode: c.country, name: c.nameEn, latitude: c.lat, longitude: c.lon, coordinateSource: `OpenStreetMap Nominatim, via scripts/geo/out/${f}`, qa: false });
  }
}
const planPath = join(here, "data/station_plan.json");
const stationPoints = existsSync(planPath)
  ? Object.entries(JSON.parse(readFileSync(planPath, "utf8")).stationPoints as Record<string, { lat: number; lon: number; name: string; source: string }>).map(([id, p]) => ({
      id,
      countryCode: "",
      name: p.name,
      latitude: p.lat,
      longitude: p.lon,
      coordinateSource: `${p.source === "wmo" ? "WMO 1991–2020 normals" : "NOAA GHCN-Daily"} station position (calibration point)`,
      qa: false,
      station: true,
    }))
  : [];

const out = { generatedAt: new Date().toISOString(), destinations: [...destinations, ...staged, ...qa.filter((q) => !known.has(q.id)), ...stationPoints] };
writeFileSync(join(here, "destinations.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`${destinations.length} site destinations + ${staged.length} staged + ${stationPoints.length} station points → scripts/climate/destinations.json`);
