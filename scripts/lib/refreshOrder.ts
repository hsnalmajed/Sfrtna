// Which cities a monthly collector should fetch first (6 Nov 2026).
//
// The hotels / places / restaurants collectors stop at a time budget (the
// job has a 6-hour ceiling) and cover only ~130–160 of 365 cities per run.
// They used to walk the cities in the same fixed order every month, so the
// same first cities were refreshed again and again and the rest never were.
// Now: cities with no file first, then the city fetched longest ago. The
// date of each fetch is kept in a small JSON file next to the collector.
// Cities with no recorded date (everything collected before 6 Nov) count as
// oldest, last-in-the-list first: the old fixed order refreshed the head of
// the list, so its tail is the stalest.

import { existsSync, readFileSync, writeFileSync } from "node:fs";

type State = Record<string, string>;

function read(file: string): State {
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8")) as State;
  } catch {
    return {};
  }
}

/** Missing cities first, then never-dated (tail first), then oldest date. */
export function oldestFirst(slugs: string[], file: string, hasData: (slug: string) => boolean): string[] {
  const at = read(file);
  const rank = (slug: string, i: number): [number, number] => {
    if (!hasData(slug)) return [0, i];
    const t = at[slug] ? Date.parse(at[slug]) : Number.NaN;
    if (Number.isNaN(t)) return [1, -i];
    return [2, t];
  };
  return slugs
    .map((slug, i) => ({ slug, r: rank(slug, i) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1])
    .map((x) => x.slug);
}

/** Record that `slug` was fetched now (keys kept sorted for small diffs). */
export function markFetched(file: string, slug: string): void {
  const at = read(file);
  at[slug] = new Date().toISOString();
  const sorted = Object.fromEntries(Object.entries(at).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(file, JSON.stringify(sorted, null, 1) + "\n");
}
