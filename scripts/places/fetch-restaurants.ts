// Stores every city's restaurants from OpenStreetMap, for the trip plan's
// meals (owner's decision 13 Oct 2026: OpenStreetMap, stored monthly — name,
// location, cuisine; no ratings, since there is no honest source for them).
//
//   npx tsx scripts/places/fetch-restaurants.ts [--missing] [--staged] [--only slug,slug]
//
// Output: public/data/restaurants/<slug>.json — up to PER_CITY restaurants
// within RADIUS of the centre, the best documented first (names in several
// languages, a cuisine, a website, a Wikidata entry). Read by
// /api/restaurants through ASSETS; /data/* is not public.
//
// Same manners as fetch-places.ts: one city at a time, a pause between
// cities, each Overpass mirror in turn; a city that fails keeps its old file.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cityPoint, jobSlugs } from "../lib/cityPoints";
import { OVERPASS } from "@/lib/mapPins";

const DIR = join(process.cwd(), "public/data/restaurants");
const RADIUS = 6000;
const PER_CITY = 300;
const PAUSE_MS = 2500;

interface El {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** One restaurant as stored. */
export interface StoredRestaurant {
  i: string;
  n: string;
  e?: string;
  a?: string;
  /** Cuisine, as tagged ("turkish;kebab"). */
  u?: string;
  /** 1 when tagged halal. */
  h?: 1;
  y: number;
  x: number;
  f: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function query(lat: number, lon: number): string {
  return `[out:json][timeout:90];(nwr(around:${RADIUS},${lat},${lon})["amenity"~"^(restaurant|cafe)$"]["name"];);out center;`;
}

async function ask(lat: number, lon: number): Promise<El[] | null> {
  const body = `data=${encodeURIComponent(query(lat, lon))}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const url of OVERPASS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          body,
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Sfrtna restaurants refresh (https://sfrtna.com)" },
          signal: AbortSignal.timeout(150_000),
        });
        if (res.status === 429 || res.status === 504) {
          await sleep(20_000);
          continue;
        }
        if (!res.ok) continue;
        const json = (await res.json()) as { elements?: El[] };
        return json.elements ?? [];
      } catch {
        // next mirror
      }
    }
    await sleep(30_000);
  }
  return null;
}

function toStored(el: El): StoredRestaurant | null {
  const t = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat === undefined || lon === undefined || !t.name) return null;
  const rec: StoredRestaurant = {
    i: `${el.type}/${el.id}`,
    n: t.name,
    y: Math.round(lat * 1e5) / 1e5,
    x: Math.round(lon * 1e5) / 1e5,
    f:
      Object.keys(t).filter((k) => k.startsWith("name:")).length +
      (t.cuisine ? 2 : 0) +
      (t.website || t["contact:website"] ? 2 : 0) +
      (t.wikidata ? 5 : 0) +
      (t.opening_hours ? 1 : 0) +
      (t.amenity === "restaurant" ? 1 : 0),
  };
  if (t["name:en"] && t["name:en"] !== t.name) rec.e = t["name:en"];
  if (t["name:ar"]) rec.a = t["name:ar"];
  if (t.cuisine) rec.u = t.cuisine.slice(0, 60);
  if (t["diet:halal"] === "yes" || t["diet:halal"] === "only") rec.h = 1;
  return rec;
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  const onlyArg = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : "";
  const only = new Set(onlyArg ? onlyArg.split(",") : []);
  const missing = process.argv.includes("--missing");
  const slugs = jobSlugs(process.argv).filter((s) => (!only.size || only.has(s)) && (!missing || !existsSync(join(DIR, `${s}.json`))));
  let ok = 0;
  const failed: string[] = [];
  for (const slug of slugs) {
    const c = cityPoint(slug);
    if (!c) continue;
    const els = await ask(c.lat, c.lon);
    if (!els) {
      failed.push(slug);
      continue;
    }
    const seen = new Set<string>();
    const list = els
      .map(toStored)
      .filter((r): r is StoredRestaurant => Boolean(r))
      .filter((r) => (seen.has(r.i) ? false : (seen.add(r.i), true)))
      .sort((a, b) => b.f - a.f)
      .slice(0, PER_CITY);
    writeFileSync(join(DIR, `${slug}.json`), JSON.stringify(list));
    ok++;
    console.log(`${slug}: ${list.length} restaurants`);
    await sleep(PAUSE_MS);
  }
  console.log(`${ok} cities written; failed: ${failed.join(", ") || "none"}`);
}

main();
