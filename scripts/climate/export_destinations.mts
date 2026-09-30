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
  { id: "reykjavik", countryCode: "IS", name: "Reykjavík", geocode: "Reykjavík, Iceland" },
  { id: "sapporo", countryCode: "JP", name: "Sapporo", geocode: "Sapporo, Hokkaido, Japan" },
  { id: "queenstown", countryCode: "NZ", name: "Queenstown", geocode: "Queenstown, Otago, New Zealand" },
  { id: "coronet-peak", countryCode: "NZ", name: "Coronet Peak ski area", geocode: "Coronet Peak, Otago, New Zealand" },
  { id: "zermatt", countryCode: "CH", name: "Zermatt", geocode: "Zermatt, Valais, Switzerland" },
].map((q) => ({ ...q, latitude: null, longitude: null, coordinateSource: null, qa: true }));

const out = { generatedAt: new Date().toISOString(), destinations: [...destinations, ...qa] };
writeFileSync(join(here, "destinations.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`${destinations.length} site destinations + ${qa.length} QA places → scripts/climate/destinations.json`);
