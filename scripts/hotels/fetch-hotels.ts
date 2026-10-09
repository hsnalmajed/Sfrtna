// Collects every hotel around each of our cities from OpenStreetMap, so the
// hotel-name search answers from our own files (src/lib/hotelIndex.ts) and
// never waits on — or runs out of — an outside service.
//
//   npx tsx scripts/hotels/fetch-hotels.ts [--missing] [--max N] [--only slug,slug]
//
// Output: scripts/hotels/cities/<slug>.json — the raw list for one city,
// [name, name:en, name:ar, stars, fame]. The files the site reads are built
// from these by scripts/hotels/build-index.mjs (run before every build), so
// a change to the Arabic dictionary never needs a new collection.
//
// Polite to a volunteer-run service: one city at a time, a pause between
// cities, each mirror tried in turn, a busy answer retried after a wait. A
// city that fails everywhere keeps its old file; the run carries on.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CITY_COORDS } from "@/data/cityCoords";
import { OVERPASS, type OverpassElement } from "@/lib/mapPins";

const DIR = join(process.cwd(), "scripts/hotels/cities");
const RADIUS = 25_000;
const PAUSE_MS = 2500;
const KINDS = ["hotel", "motel", "guest_house", "hostel", "apartment"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function query(lat: number, lon: number): string {
  return `[out:json][timeout:180];
nwr(around:${RADIUS},${lat},${lon})["tourism"~"^(${KINDS.join("|")})$"]["name"];
out tags center;`;
}

async function ask(lat: number, lon: number): Promise<OverpassElement[] | null> {
  const body = `data=${encodeURIComponent(query(lat, lon))}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const url of OVERPASS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          body,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Sfrtna hotel names refresh (https://sfrtna.com)",
          },
          signal: AbortSignal.timeout(200_000),
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

/** "5", "4S", "3.5" → 5, 4, 3; anything else → 0. */
function stars(v: string | undefined): number {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= 1 && n <= 7 ? n : 0;
}

type Raw = [string, string, string, number, number];

async function main() {
  mkdirSync(DIR, { recursive: true });
  let slugs = Object.keys(CITY_COORDS).sort();
  const only = arg("--only");
  if (only) slugs = only.split(",").map((s) => s.trim());
  if (process.argv.includes("--missing")) slugs = slugs.filter((s) => !existsSync(join(DIR, `${s}.json`)));
  slugs = slugs.slice(0, Number(arg("--max") ?? Infinity));

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
    const out: Raw[] = [];
    for (const el of elements) {
      const t = el.tags ?? {};
      const name = (t.name ?? "").trim();
      if (!name) continue;
      const en = (t["name:en"] ?? "").trim();
      const ar = (t["name:ar"] ?? "").trim();
      const key = `${name}|${en}|${ar}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const fame = Object.keys(t).filter((k) => k.startsWith("name:")).length + (t.wikidata ? 5 : 0) + (t.website ? 1 : 0);
      out.push([name, en === name ? "" : en, ar === name ? "" : ar, stars(t.stars), fame]);
    }
    out.sort((a, b) => b[3] - a[3] || b[4] - a[4] || a[0].localeCompare(b[0]));
    writeFileSync(join(DIR, `${slug}.json`), JSON.stringify(out));
    console.log(`${n + 1}/${slugs.length} ${slug}: ${out.length} hotels`);
    await sleep(PAUSE_MS);
  }
  if (failed.length) console.log(`failed (kept their old files): ${failed.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
