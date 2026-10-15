// The site's one door into the travel-season data.
//
// Every page that says anything about when to go — the home page's "best in
// <month>", the "When to travel?" page, the discover and route cards — reads
// src/data/climate/travelSeasons.site.json (the slim copy of
// travelSeasons.json, fields in siteFields.ts) through these functions and nothing
// else. The file is generated offline (scripts/climate/) from 1991–2020
// ERA5-Land normals and the versioned engine, so no page computes a season of
// its own and no page calls a climate service at request time.

import data from "@/data/climate/travelSeasons.site.json";
import { COUNTRY_CITIES } from "@/lib/cities";
import { SCORING } from "@/lib/travelSeason/config";
import type { SeasonRecord as FullSeasonRecord } from "@/lib/travelSeason/types";
import type { SiteField } from "@/lib/travelSeason/siteFields";

/** A month as the site sees it: only the fields in SITE_FIELDS. */
export type SeasonRecord = Pick<FullSeasonRecord, SiteField>;

/** A value in the packed file: number / null as is, a string as [tableIndex]. */
type PackedCell = number | null | [number];

interface PackedSeasonsFile {
  meta: {
    scoringVersion: string;
    tourismLastVerified: string;
    climateDataset: string;
    climatePeriod: string;
    generatedAt: string;
  };
  fields: SiteField[];
  table: string[];
  records: Record<string, PackedCell[][]>;
}

const PACKED = data as unknown as PackedSeasonsFile;

// Rebuilt per city on first use (scripts/climate/generate_seasons.mts packs
// it; see there for why), so a request touching one city unpacks one city.
const unpacked = new Map<string, SeasonRecord[]>();
function cityRecords(slug: string): SeasonRecord[] | undefined {
  const done = unpacked.get(slug);
  if (done) return done;
  if (!Object.prototype.hasOwnProperty.call(PACKED.records, slug)) return undefined;
  const recs = PACKED.records[slug].map((row) => {
    const o: Record<string, unknown> = {};
    PACKED.fields.forEach((f, i) => {
      const v = row[i];
      o[f] = Array.isArray(v) ? PACKED.table[v[0]] : v;
    });
    return o as unknown as SeasonRecord;
  });
  unpacked.set(slug, recs);
  return recs;
}

export { CLASS_DOT } from "@/lib/travelSeason/labels";

/** The 12 records for a destination, January first; undefined if none. */
export function seasonRecords(slug: string): SeasonRecord[] | undefined {
  return cityRecords(slug);
}

export function seasonRecord(slug: string, month: number): SeasonRecord | undefined {
  return cityRecords(slug)?.[month - 1];
}

/** Months (1–12) the destination is EXCELLENT or VERY_GOOD. */
export function bestMonths(slug: string): number[] {
  return (cityRecords(slug) ?? [])
    .filter((r) => r.classification === "EXCELLENT" || r.classification === "VERY_GOOD")
    .map((r) => r.month);
}

export interface MonthPick {
  code: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  record: SeasonRecord;
}

const CONFIDENCE_RANK = { high: 2, medium: 1, low: 0 } as const;

/**
 * The home page's "best in <month>": EXCELLENT and VERY_GOOD destinations,
 * low-confidence ones left out; GOOD added only if fewer than the minimum,
 * keeping its own label. Ranked by final score, then confidence and a
 * verified tourism signal, then one per country before the rest.
 */
export function bestForMonth(month: number): MonthPick[] {
  const h = SCORING.home;
  const minConf = CONFIDENCE_RANK[h.minConfidence];
  const all: MonthPick[] = [];
  for (const [code, cities] of Object.entries(COUNTRY_CITIES)) {
    for (const c of cities) {
      const r = seasonRecord(c.slug, month);
      if (!r || !r.classification || CONFIDENCE_RANK[r.confidenceLevel] < minConf) continue;
      all.push({ code, slug: c.slug, nameAr: c.nameAr, nameEn: c.nameEn, record: r });
    }
  }
  const rank = (p: MonthPick) =>
    (p.record.finalScore ?? 0) + CONFIDENCE_RANK[p.record.confidenceLevel] + (p.record.tourismSignal === "listed" ? 1 : 0);
  const byRank = (a: MonthPick, b: MonthPick) => rank(b) - rank(a);
  const top = all.filter((p) => (h.classes as readonly string[]).includes(p.record.classification as string)).sort(byRank);
  const fallback = top.length >= h.minCount ? [] : all.filter((p) => p.record.classification === h.fallbackClass).sort(byRank);
  // Within each tier: one per country first, then the rest, in rank order —
  // so the strip is not ten cities from one country, and a GOOD month never
  // jumps ahead of an EXCELLENT or VERY_GOOD one.
  const variety = (list: MonthPick[]) => {
    const seen = new Set<string>();
    const first: MonthPick[] = [];
    const rest: MonthPick[] = [];
    for (const p of list) {
      if (seen.has(p.code)) rest.push(p);
      else {
        seen.add(p.code);
        first.push(p);
      }
    }
    return [...first, ...rest];
  };
  return [...variety(top), ...variety(fallback)];
}
