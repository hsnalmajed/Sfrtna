// Our place guide, step 1: which places in a city deserve a traveller's time.
//
//   npx tsx scripts/guide/build-facts.ts [--only slug,slug] [--max N] [--staged]
//
// Owner, 21 Oct 2026: "our places are very bad — places with 6 reviews rated
// 2 of 4". The stored places list (scripts/places/) is every mapped place;
// this keeps only the ones the world knows:
//   - OpenStreetMap: every named sight, museum, park, beach, market, mall,
//     mosque/church… around the city that is linked to Wikidata, with the
//     facts OSM holds (opening hours, fee, website, wheelchair);
//   - Wikidata (CC0 facts, no Wikipedia text): how many language
//     encyclopaedias have an article on it (the fame measure), World Heritage
//     status, visitors a year, Arabic and English names, official website.
// A place is kept when it is known (articles in ≥ MIN_LINKS languages), a
// World Heritage site, or has ≥ 100,000 visitors a year. Ranked by fame.
// Write-ups already in the file (scripts/guide/write.ts) are kept.
//
// Output: public/data/guide/<slug>.json (read through ASSETS, like places).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cityPoint, liveSlugs, stagedSlugs } from "../lib/cityPoints";
import { OVERPASS } from "@/lib/mapPins";
import { GROUPS, groupOf, type GuideFile, type GuidePlace } from "@/lib/guideTypes";

const DIR = join(process.cwd(), "public/data/guide");
const RADIUS = 20_000;
const MIN_LINKS = 4;
const KEEP = 150;
const UA = "SfrtnaGuide/1.0 (https://sfrtna.com; info@sfrtna.com)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface El {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function query(lat: number, lon: number): string {
  const a = `(around:${RADIUS},${lat},${lon})`;
  const w = `["wikidata"]["name"]`;
  return `[out:json][timeout:120];(
nwr${a}["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|aquarium|theme_park|artwork)$"]${w};
nwr${a}["historic"]${w};
nwr${a}["leisure"~"^(park|garden|nature_reserve|water_park|marina|stadium)$"]${w};
nwr${a}["natural"~"^(beach|peak|waterfall|cave_entrance|bay|cape|volcano|spring)$"]${w};
nwr${a}["amenity"~"^(place_of_worship|theatre|arts_centre|marketplace|planetarium|fountain|library)$"]${w};
nwr${a}["shop"~"^(mall|department_store)$"]${w};
nwr${a}["man_made"~"^(tower|lighthouse)$"]${w};
nwr${a}["building"~"^(mosque|church|cathedral|temple|palace|castle)$"]${w};
nwr${a}["place"="square"]${w};
);out center tags;`;
}

async function overpass(lat: number, lon: number): Promise<El[] | null> {
  const body = `data=${encodeURIComponent(query(lat, lon))}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const url of OVERPASS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          body,
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
          signal: AbortSignal.timeout(150_000),
        });
        if (res.status === 429 || res.status === 504) {
          await sleep(20_000);
          continue;
        }
        if (!res.ok) continue;
        return ((await res.json()) as { elements?: El[] }).elements ?? [];
      } catch {
        // next mirror
      }
    }
    await sleep(30_000);
  }
  return null;
}

interface WdEntity {
  id: string;
  labels?: Record<string, { value: string }>;
  sitelinks?: Record<string, unknown>;
  claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } }; qualifiers?: Record<string, { datavalue?: { value?: { time?: string } } }[]> }[]>;
}

async function wikidata(ids: string[]): Promise<Map<string, WdEntity>> {
  const out = new Map<string, WdEntity>();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels|sitelinks|claims&languages=ar|en&ids=${chunk.join("|")}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60_000) });
        if (res.status === 429 || res.status >= 500) {
          await sleep(10_000);
          continue;
        }
        const j = (await res.json()) as { entities?: Record<string, WdEntity> };
        for (const [k, v] of Object.entries(j.entities ?? {})) out.set(k, v);
        break;
      } catch {
        await sleep(5_000);
      }
    }
    await sleep(300);
  }
  return out;
}

/** Language encyclopaedias with an article (not Commons, Wikivoyage, Wikiquote…). */
function links(e: WdEntity): number {
  return Object.keys(e.sitelinks ?? {}).filter((k) => /wiki$/.test(k) && !/^(commons|species|meta|mediawiki|wikidata|sources|incubator|outreach|wikimania)wiki$/.test(k)).length;
}

function visitors(e: WdEntity): number | null {
  const c = e.claims?.P1174;
  if (!c?.length) return null;
  // Latest year's figure.
  let best: { year: string; n: number } | null = null;
  for (const s of c) {
    const v = s.mainsnak?.datavalue?.value as { amount?: string } | undefined;
    const n = Number(v?.amount);
    if (!Number.isFinite(n) || n <= 0) continue;
    const year = s.qualifiers?.P585?.[0]?.datavalue?.value?.time ?? "";
    if (!best || year > best.year) best = { year, n };
  }
  return best ? Math.round(best.n) : null;
}

function website(e: WdEntity, tags: Record<string, string>): string | undefined {
  const t = tags.website || tags["contact:website"];
  const w = t || (e.claims?.P856?.[0]?.mainsnak?.datavalue?.value as string | undefined);
  return w && /^https?:\/\//.test(w) ? w.slice(0, 200) : undefined;
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  let slugs = process.argv.includes("--staged") ? stagedSlugs() : liveSlugs();
  const only = arg("--only");
  if (only) slugs = only.split(",").map((s) => s.trim()).filter(Boolean);
  slugs = slugs.slice(0, Number(arg("--max") ?? Infinity));
  // Monthly refresh: cities checked in the last 25 days are skipped (a daily
  // run finishes the rest), unless named with --only.
  const fresh = (slug: string) => {
    if (only) return false;
    const f = join(DIR, `${slug}.json`);
    if (!existsSync(f)) return false;
    const g = JSON.parse(readFileSync(f, "utf8")) as GuideFile;
    return Date.now() - Date.parse(g.factsAt) < 25 * 86_400_000;
  };
  const started = Date.now();
  const stopAfter = Number(process.env.STOP_AFTER_MIN ?? 150) * 60_000;
  let done = 0;
  for (const slug of slugs) {
    if (Date.now() - started > stopAfter) {
      console.log(`time budget reached after ${done} cities`);
      break;
    }
    if (fresh(slug)) continue;
    const pt = cityPoint(slug);
    if (!pt) continue;
    const els = await overpass(pt.lat, pt.lon);
    if (!els) {
      console.log(`${slug}: Overpass failed`);
      continue;
    }
    // One record per Wikidata item (a mosque and its courtyard share one).
    const byQ = new Map<string, El>();
    for (const el of els) {
      const q = el.tags?.wikidata?.split(";")[0]?.trim();
      if (!q || !/^Q\d+$/.test(q)) continue;
      const prev = byQ.get(q);
      // Prefer the outline (way/relation) over a lone node.
      if (!prev || (prev.type === "node" && el.type !== "node")) byQ.set(q, el);
    }
    const ents = await wikidata([...byQ.keys()]);
    const path = join(DIR, `${slug}.json`);
    const old: GuideFile | null = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
    const oldByQ = new Map((old?.places ?? []).map((p) => [p.q, p]));
    const places: GuidePlace[] = [];
    for (const [q, el] of byQ) {
      const e = ents.get(q);
      const tags = el.tags ?? {};
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (!e || lat === undefined || lon === undefined) continue;
      const g = groupOf(tags);
      if (!g) continue;
      const sl = links(e);
      const wh = Boolean(e.claims?.P757?.length);
      const vis = visitors(e);
      if (sl < MIN_LINKS && !wh && !(vis && vis >= 100_000)) continue;
      const prev = oldByQ.get(q);
      const p: GuidePlace = {
        ...(prev ?? {}),
        i: `${el.type}/${el.id}`,
        q,
        n: tags.name,
        e: e.labels?.en?.value || tags["name:en"] || undefined,
        a: e.labels?.ar?.value || tags["name:ar"] || undefined,
        g,
        y: Math.round(lat * 1e5) / 1e5,
        x: Math.round(lon * 1e5) / 1e5,
        sl,
        wh: wh || undefined,
        vis: vis ?? undefined,
        web: website(e, tags),
        oh: tags.opening_hours?.slice(0, 160) || undefined,
        fee: tags.fee === "yes" || tags.fee === "no" ? tags.fee : undefined,
        wc: tags.wheelchair === "yes" ? true : undefined,
      };
      places.push(p);
    }
    const score = (p: GuidePlace) => p.sl + (p.wh ? 40 : 0) + (p.vis ? Math.min(30, Math.log10(p.vis) * 4) : 0);
    places.sort((a, b) => score(b) - score(a));
    const kept = places.slice(0, KEEP);
    const file: GuideFile = { v: 1, city: slug, factsAt: new Date().toISOString(), places: kept };
    writeFileSync(path, JSON.stringify(file));
    done++;
    const byGroup = Object.fromEntries(GROUPS.map((gr) => [gr, kept.filter((p) => p.g === gr).length]).filter(([, n]) => n));
    console.log(`${slug}: ${byQ.size} linked → ${kept.length} kept ${JSON.stringify(byGroup)} top: ${kept.slice(0, 3).map((p) => p.e || p.n).join(" | ")}`);
    await sleep(2_000);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
