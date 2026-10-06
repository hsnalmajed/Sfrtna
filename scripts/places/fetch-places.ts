// Stores every city's places from OpenStreetMap, so pages never wait on
// Overpass (see "Stored places" in src/lib/mapPins.ts).
//
//   npx tsx scripts/places/fetch-places.ts [--missing] [--max N] [--only slug,slug]
//
// --missing  only cities that have no file yet (new cities).
// --max N    at most N cities this run (default: all).
// --only     just these cities.
//
// Output:
//   public/data/places/<slug>.json   up to STORED_PER_CITY places, most famous first
//   src/data/placeCounts.json        how many places each city has (for the cards)
//
// Polite to a volunteer-run service: one city at a time, a pause between
// cities, each mirror tried in turn, a busy answer retried after a wait. A
// city that fails on every mirror keeps its old file and is reported; the
// run carries on.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { CITY_COORDS } from "@/data/cityCoords";
import {
  OVERPASS,
  STORED_PER_CITY,
  STORED_RADIUS,
  overpassQuery,
  toStoredPlace,
  type OverpassElement,
  type StoredPlace,
} from "@/lib/mapPins";

const DIR = join(process.cwd(), "public/data/places");
const COUNTS = join(process.cwd(), "src/data/placeCounts.json");
const PAUSE_MS = 4000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function ask(lat: number, lon: number): Promise<OverpassElement[] | null> {
  const body = `data=${encodeURIComponent(overpassQuery(lat, lon, STORED_RADIUS))}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const url of OVERPASS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          body,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Sfrtna places refresh (https://sfrtna.com)",
          },
          signal: AbortSignal.timeout(120_000),
        });
        if (res.status === 429 || res.status === 504) {
          await sleep(20_000);
          continue;
        }
        if (!res.ok) continue;
        const json = (await res.json()) as { elements?: OverpassElement[] };
        return json.elements ?? [];
      } catch {
        // Next mirror.
      }
    }
    await sleep(30_000);
  }
  return null;
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  const counts: Record<string, number> = JSON.parse(readFileSync(COUNTS, "utf8"));

  let slugs = Object.keys(CITY_COORDS).sort();
  const only = arg("--only");
  if (only) slugs = only.split(",").map((s) => s.trim());
  if (process.argv.includes("--missing")) slugs = slugs.filter((s) => !existsSync(join(DIR, `${s}.json`)));
  const max = Number(arg("--max") ?? Infinity);
  slugs = slugs.slice(0, max);

  console.log(`cities to fetch: ${slugs.length}`);
  const failed: string[] = [];

  for (const [n, slug] of slugs.entries()) {
    const point = CITY_COORDS[slug];
    if (!point) continue;
    const elements = await ask(point.lat, point.lon);
    if (elements === null) {
      failed.push(slug);
      console.log(`${n + 1}/${slugs.length} ${slug}: FAILED`);
      continue;
    }
    const seen = new Set<string>();
    const places: StoredPlace[] = [];
    for (const el of elements) {
      const p = toStoredPlace(el);
      if (!p || seen.has(p.i)) continue;
      seen.add(p.i);
      places.push(p);
    }
    places.sort((a, b) => b.f - a.f || a.n.localeCompare(b.n));
    const kept = places.slice(0, STORED_PER_CITY);
    writeFileSync(join(DIR, `${slug}.json`), JSON.stringify(kept));
    counts[slug] = kept.length;
    console.log(`${n + 1}/${slugs.length} ${slug}: ${places.length} found, ${kept.length} kept`);
    // Counts saved as we go, so a cancelled run keeps what it finished.
    const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(COUNTS, JSON.stringify(sorted, null, 1) + "\n");
    await sleep(PAUSE_MS);
  }

  if (failed.length) console.log(`failed (kept their old files): ${failed.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
