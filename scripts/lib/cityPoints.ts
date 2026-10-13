// The centre of every city a data job may collect for: the live cities
// (src/data/cityCoords.ts) and the staged ones waiting to go live
// (scripts/geo/out/batch2.staged.json, see the coverage section in
// docs/PROJECT_NOTES.md). Staged cities are collected ahead of time so they
// can go live complete; no page links to their files until they are added to
// cityCoords.ts.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CITY_COORDS } from "@/data/cityCoords";

interface Point {
  lat: number;
  lon: number;
}

const STAGED_FILE = join(process.cwd(), "scripts/geo/out/batch2.staged.json");

function loadStaged(): Record<string, Point> {
  if (!existsSync(STAGED_FILE)) return {};
  const json = JSON.parse(readFileSync(STAGED_FILE, "utf8")) as { cities: Record<string, Point> };
  const out: Record<string, Point> = {};
  for (const [slug, c] of Object.entries(json.cities)) {
    if (!(slug in CITY_COORDS) && typeof c.lat === "number" && typeof c.lon === "number") out[slug] = { lat: c.lat, lon: c.lon };
  }
  return out;
}

const STAGED = loadStaged();

/** Staged city slugs (not live yet), sorted. */
export const stagedSlugs = (): string[] => Object.keys(STAGED).sort();

/** Live city slugs, sorted. */
export const liveSlugs = (): string[] => Object.keys(CITY_COORDS).sort();

/** Centre of a live or staged city. */
export function cityPoint(slug: string): Point | undefined {
  return CITY_COORDS[slug] ?? STAGED[slug];
}

/** The slugs a job works on: `--staged` = the staged cities, else the live ones. */
export function jobSlugs(argv: string[]): string[] {
  return argv.includes("--staged") ? stagedSlugs() : liveSlugs();
}
