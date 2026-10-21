// Our place guide, step 1 (fast version): which places in a city deserve a
// traveller's time, straight from Wikidata (CC0 facts — no Wikipedia text).
//
//   npx tsx scripts/guide/build-facts-wd.ts [--only slug,slug] [--max N] [--staged]
//
// The OpenStreetMap route (build-facts.ts) took 5–10 minutes a city on the
// busy public Overpass servers; Wikidata's query service answers a city in
// seconds:
//   1. every item within RADIUS km of the centre with articles in ≥ MIN_LINKS
//      languages, its classes, names, World Heritage id, visitors, website;
//   2. the classes are sorted into our groups (museum, mosque, park, beach…)
//      through their parent classes — a station, university, hospital or
//      neighbourhood belongs to none and is left out;
//   3. ranked by fame (+ World Heritage, + visitors).
// Write-ups already in the file are kept (matched by Wikidata id).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cityPoint, liveSlugs, stagedSlugs } from "../lib/cityPoints";
import { GROUPS, type Group, type GuideFile, type GuidePlace } from "@/lib/guideTypes";

const DIR = join(process.cwd(), "public/data/guide");
const RADIUS_KM = 20;
const MIN_LINKS = 4;
const KEEP = 150;
const UA = "SfrtnaGuide/1.0 (https://sfrtna.com; info@sfrtna.com)";
const WDQS = "https://query.wikidata.org/sparql";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * Root classes of each group. An item counts when one of its classes is one
 * of these or a subclass of one. Order matters: the first group that claims
 * a class wins (a mosque is "religion" before it is a "building").
 */
const ROOTS: [Group, string[]][] = [
  ["family", ["Q43501" /* zoo */, "Q2281788" /* public aquarium */, "Q194195" /* amusement park */, "Q2416723" /* theme park */]],
  ["museums", ["Q33506" /* museum */, "Q1007870" /* art gallery */, "Q207694" /* art museum */]],
  ["religion", ["Q32815" /* mosque */, "Q16970" /* church building */, "Q2977" /* cathedral */, "Q44539" /* temple */, "Q845945" /* Shinto shrine */, "Q34627" /* synagogue */, "Q160742" /* abbey */, "Q44613" /* monastery */, "Q1370598" /* place of worship */]],
  ["beach", ["Q40080" /* beach */]],
  ["nature", ["Q22698" /* park */, "Q1107656" /* garden */, "Q167346" /* botanical garden */, "Q179049" /* nature reserve */, "Q46169" /* national park */, "Q34038" /* waterfall */, "Q8502" /* mountain */, "Q23397" /* lake */, "Q35509" /* cave */, "Q23442" /* island */, "Q39816" /* valley */, "Q150784" /* canyon */]],
  ["views", ["Q1440300" /* observation tower */, "Q39715" /* lighthouse */, "Q2319498" /* landmark */, "Q11303" /* skyscraper — famous ones only, see BIG */, "Q12518" /* tower — famous ones only */]],
  ["shopping", ["Q11315" /* shopping center */, "Q216107" /* department store */]],
  ["markets", ["Q37654" /* market */, "Q132510" /* marketplace */]],
  ["culture", ["Q24354" /* theatre building */, "Q153562" /* opera house */, "Q1060829" /* concert hall */, "Q1329623" /* cultural center */]],
  ["history", ["Q16560" /* palace */, "Q23413" /* castle */, "Q1785071" /* fort */, "Q839954" /* archaeological site */, "Q109607" /* ruins */, "Q4989906" /* monument */, "Q162875" /* mausoleum */, "Q381885" /* tomb */, "Q174782" /* town square */, "Q12280" /* bridge */, "Q82117" /* city gate */, "Q16748868" /* city walls */, "Q676050" /* old town */, "Q15243209" /* historic district */, "Q2065736" /* cultural property */, "Q570116" /* tourist attraction */, "Q9259" /* World Heritage Site */, "Q483453" /* fountain */]],
];

/** Never a visit, even when a parent class matches (stations, schools…). */
const NEVER = new Set(["Q55488" /* railway station */, "Q928830" /* metro station */, "Q3918" /* university */, "Q16917" /* hospital */, "Q123705" /* neighbourhood */, "Q483110" /* stadium */, "Q1248784" /* airport */, "Q27686" /* hotel */, "Q515" /* city */, "Q15284" /* municipality */]);

/** Classes that count only for the famous (an office tower is not a sight; Burj Khalifa is). */
const BIG_GROUP: Record<string, Group> = {
  Q11303: "views", // skyscraper
  Q12518: "views", // tower
  Q79007: "history", // street (Champs-Élysées, Istiklal)
  Q7075: "culture", // library (British Library)
  Q37901: "nature", // strait (Bosporus)
  Q33837: "nature", // archipelago (Princes' Islands)
  Q184949: "history", // hippodrome
};
const BIG_ONLY = new Set(Object.keys(BIG_GROUP));
const BIG_LINKS = 45;

/**
 * Parent classes that rule an item out whatever else it is: a town or an
 * ancient city (Cairo, Byzantium), an administrative area, a school, a
 * hospital, an office block, a hotel, a station.
 */
const NEVER_ROOTS = ["Q486972" /* human settlement */, "Q2385804" /* educational institution */, "Q16917" /* hospital */, "Q1021645" /* office building */, "Q27686" /* hotel */, "Q55488" /* railway station */, "Q928830" /* metro station */, "Q483110" /* stadium */, "Q1248784" /* airport */];

async function sparql<T>(q: string): Promise<T[] | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(WDQS, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json", "User-Agent": UA },
        body: `query=${encodeURIComponent(q)}`,
        signal: AbortSignal.timeout(90_000),
      });
      if (res.status === 429 || res.status >= 500) {
        await sleep(Number(res.headers.get("retry-after") ?? 10) * 1000 + 2000);
        continue;
      }
      if (!res.ok) return null;
      const j = (await res.json()) as { results: { bindings: T[] } };
      return j.results.bindings;
    } catch {
      await sleep(8000);
    }
  }
  return null;
}

type B = Record<string, { value: string } | undefined>;

/** Our group for each class id, learned once per run (parent classes asked in bulk). */
const classGroup = new Map<string, Group | null>();
const bigClass = new Map<string, Group>();
const neverClass = new Map<string, string>();
async function classify(classes: string[]): Promise<void> {
  const todo = classes.filter((c) => !classGroup.has(c));
  for (const c of todo) if (NEVER.has(c)) classGroup.set(c, null);
  const ask = todo.filter((c) => !classGroup.has(c));
  const roots = [...ROOTS.flatMap(([, ids]) => ids), ...NEVER_ROOTS, ...BIG_ONLY];
  for (let i = 0; i < ask.length; i += 150) {
    const chunk = ask.slice(i, i + 150);
    const rows = await sparql<B>(`SELECT ?c ?root WHERE {
      VALUES ?c { ${chunk.map((c) => `wd:${c}`).join(" ")} }
      VALUES ?root { ${roots.map((r) => `wd:${r}`).join(" ")} }
      ?c wdt:P279* ?root .
    }`);
    const found = new Map<string, Set<string>>();
    for (const r of rows ?? []) {
      const c = r.c?.value.split("/").pop() as string;
      const root = r.root?.value.split("/").pop() as string;
      if (!found.has(c)) found.set(c, new Set());
      found.get(c)?.add(root);
    }
    for (const c of chunk) {
      const rs = found.get(c);
      const never = rs ? NEVER_ROOTS.find((n) => rs.has(n)) : undefined;
      if (never) {
        classGroup.set(c, null);
        neverClass.set(c, never);
        continue;
      }
      // A class reached only through a famous-only root is marked with "!".
      const plain = rs ? [...rs].filter((id) => !BIG_ONLY.has(id)) : [];
      const g = plain.length ? (ROOTS.find(([, ids]) => ids.some((id) => plain.includes(id)))?.[0] ?? null) : null;
      classGroup.set(c, g);
      const big = rs ? [...rs].find((id) => BIG_ONLY.has(id)) : undefined;
      if (!g && big) bigClass.set(c, BIG_GROUP[big]);
    }
    await sleep(1000);
  }
}

interface Row {
  q: string;
  sl: number;
  lat: number;
  lon: number;
  classes: Set<string>;
  ar?: string;
  en?: string;
  wh: boolean;
  vis?: number;
  web?: string;
}

async function cityItems(lat: number, lon: number): Promise<Row[] | null> {
  const rows = await sparql<B>(`SELECT ?item ?sl ?coord ?class ?ar ?en ?whs ?vis ?web WHERE {
    SERVICE wikibase:around {
      ?item wdt:P625 ?coord .
      bd:serviceParam wikibase:center "Point(${lon} ${lat})"^^geo:wktLiteral ;
                      wikibase:radius "${RADIUS_KM}" .
    }
    ?item wikibase:sitelinks ?sl . FILTER(?sl >= ${MIN_LINKS})
    ?item wdt:P31 ?class .
    OPTIONAL { ?item rdfs:label ?ar . FILTER(LANG(?ar) = "ar") }
    OPTIONAL { ?item rdfs:label ?en . FILTER(LANG(?en) = "en") }
    OPTIONAL { ?item wdt:P757 ?whs }
    OPTIONAL { ?item wdt:P1174 ?vis }
    OPTIONAL { ?item wdt:P856 ?web }
  }`);
  if (!rows) return null;
  const by = new Map<string, Row>();
  for (const r of rows) {
    const q = r.item?.value.split("/").pop();
    const m = r.coord?.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
    if (!q || !m) continue;
    let row = by.get(q);
    if (!row) {
      row = { q, sl: Number(r.sl?.value ?? 0), lon: Number(m[1]), lat: Number(m[2]), classes: new Set(), wh: false };
      by.set(q, row);
    }
    if (r.class) row.classes.add(r.class.value.split("/").pop() as string);
    if (r.ar && !row.ar) row.ar = r.ar.value;
    if (r.en && !row.en) row.en = r.en.value;
    if (r.whs) row.wh = true;
    const v = Number(r.vis?.value);
    if (Number.isFinite(v) && v > 0) row.vis = Math.max(row.vis ?? 0, Math.round(v));
    if (r.web && !row.web && /^https?:\/\//.test(r.web.value)) row.web = r.web.value.slice(0, 200);
  }
  return [...by.values()];
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  let slugs = process.argv.includes("--staged") ? stagedSlugs() : liveSlugs();
  const only = arg("--only");
  if (only) slugs = only.split(",").map((s) => s.trim()).filter(Boolean);
  slugs = slugs.slice(0, Number(arg("--max") ?? Infinity));
  const fresh = (slug: string) => {
    if (only) return false;
    const f = join(DIR, `${slug}.json`);
    if (!existsSync(f)) return false;
    const g = JSON.parse(readFileSync(f, "utf8")) as GuideFile;
    return g.src === "wd" && Date.now() - Date.parse(g.factsAt) < 25 * 86_400_000;
  };
  const report: string[] = [];
  const started = Date.now();
  const stopAfter = Number(process.env.STOP_AFTER_MIN ?? 150) * 60_000;
  for (const slug of slugs) {
    if (Date.now() - started > stopAfter) {
      report.push("time budget reached");
      break;
    }
    if (fresh(slug)) continue;
    const pt = cityPoint(slug);
    if (!pt) continue;
    const t0 = Date.now();
    const items = await cityItems(pt.lat, pt.lon);
    if (!items) {
      report.push(`${slug}: query failed`);
      continue;
    }
    await classify([...new Set(items.flatMap((r) => [...r.classes]))]);
    const path = join(DIR, `${slug}.json`);
    const old: GuideFile | null = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
    const oldByQ = new Map((old?.places ?? []).map((p) => [p.q, p]));
    const places: GuidePlace[] = [];
    const dropped: string[] = [];
    for (const r of items) {
      // A World Heritage old town or medina stays even though it is a "settlement".
      // An icon is kept even when it is a hotel or an office (Burj Al Arab,
      // Tokyo's government building with its free observatories).
      const iconic = r.sl >= BIG_LINKS;
      const soft = (c: string) => ["Q27686", "Q1021645"].includes(neverClass.get(c) ?? (NEVER.has(c) ? c : ""));
      const why = [...r.classes].find((c) => (NEVER.has(c) || (neverClass.has(c) && !r.wh)) && !(iconic && soft(c)));
      if (why) {
        if (r.sl >= 25) dropped.push(`${r.sl}|${r.en ?? r.q} ${r.sl} (${why}→${neverClass.get(why) ?? "never"})`);
        continue;
      }
      // The first group (in ROOTS order) any of its classes belongs to.
      const groups = new Set([...r.classes].map((c) => classGroup.get(c)).filter((g): g is Group => Boolean(g)));
      let g = ROOTS.map(([gr]) => gr).find((gr) => groups.has(gr));
      if (!g && iconic && [...r.classes].some((c) => soft(c))) g = "views";
      if (!g && r.sl >= BIG_LINKS) g = [...r.classes].map((c) => bigClass.get(c)).find(Boolean);
      if (!g) {
        if (r.sl >= 25) dropped.push(`${r.sl}|${r.en ?? r.q} ${r.sl} (no group: ${[...r.classes].slice(0, 4).join(",")})`);
        continue;
      }
      const prev = oldByQ.get(r.q);
      places.push({
        ...(prev ?? {}),
        i: prev?.i ?? `wd/${r.q}`,
        q: r.q,
        n: r.en ?? r.ar ?? r.q,
        e: r.en,
        a: r.ar,
        g,
        y: Math.round(r.lat * 1e5) / 1e5,
        x: Math.round(r.lon * 1e5) / 1e5,
        sl: r.sl,
        wh: r.wh || undefined,
        vis: r.vis,
        web: r.web ?? prev?.web,
      });
    }
    const score = (p: GuidePlace) => p.sl + (p.wh ? 40 : 0) + (p.vis ? Math.min(30, Math.log10(p.vis) * 4) : 0);
    places.sort((a, b) => score(b) - score(a));
    const kept = places.slice(0, KEEP);
    const file: GuideFile = { v: 1, src: "wd", city: slug, factsAt: new Date().toISOString(), places: kept };
    writeFileSync(path, JSON.stringify(file));
    const by = Object.fromEntries(GROUPS.map((gr) => [gr, kept.filter((p) => p.g === gr).length]).filter(([, n]) => n));
    report.push(`${slug}: ${Math.round((Date.now() - t0) / 1000)}s, ${items.length} known → ${kept.length} kept ${JSON.stringify(by)}; top: ${kept.slice(0, 6).map((p) => p.e || p.n).join(" | ")}`);
    if (dropped.length) report.push(`   dropped (famous): ${dropped.sort((a, b) => Number(b.split("|")[0]) - Number(a.split("|")[0])).slice(0, 30).map((d) => d.split("|")[1]).join("; ")}`);
    console.log(report[report.length - 1]);
    await sleep(1500);
  }
  mkdirSync("scripts/guide/reports", { recursive: true });
  writeFileSync("scripts/guide/reports/facts.txt", `${new Date().toISOString()}\n${report.join("\n")}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
