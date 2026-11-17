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
import { CITY_NAMES_EN } from "./cityNames";
import { isTheAreaItself } from "./selfPlace";
import { GROUPS, type Group, type GuideFile, type GuidePlace } from "@/lib/guideTypes";

const DIR = join(process.cwd(), "public/data/guide");
const RADIUS_KM = 20;
const MIN_LINKS = 4;
const KEEP = 150;
/**
 * Round «عمق الخطة» (owner, 17 Nov): no city under 15 guide places and none
 * without a plan. Below THIN kept places a city asks Wikidata again for
 * lesser-known items (1 article), then fills from our own map's places
 * (public/data/places, OpenStreetMap) up to THIN.
 */
const THIN = 30;
/**
 * A region or an island, not a town: the centre and radius of the area a
 * visitor tours (Bali's island centre missed Kuta, Uluwatu and Tanah Lot;
 * Göreme, not the valley's edge, is Cappadocia's base; Perito Moreno is 78 km
 * from El Calafate). The centre also decides which city a place belongs to.
 */
const AREA: Record<string, { lat?: number; lon?: number; km: number }> = {
  bali: { lat: -8.65, lon: 115.17, km: 45 },
  cappadocia: { lat: 38.643, lon: 34.829, km: 35 },
  ella: { km: 30 },
  langkawi: { lat: 6.35, lon: 99.75, km: 30 },
  "phu-quoc": { lat: 10.23, lon: 103.96, km: 35 },
  galapagos: { km: 60 },
  "punta-cana": { km: 30 },
  "los-cabos": { lat: 22.98, lon: -109.8, km: 30 },
  varadero: { km: 25 },
  "labuan-bajo": { km: 50 },
  lombok: { km: 40 },
  nadi: { km: 30 },
  "koh-samui": { km: 25 },
  phuket: { km: 30 },
  jeju: { km: 45 },
  goa: { km: 40 },
  krabi: { km: 30 },
  queenstown: { km: 40 },
  bariloche: { km: 40 },
  "el-calafate": { km: 85 },
  "foz-do-iguacu": { km: 30 },
  arusha: { km: 40 },
  mendoza: { km: 40 },
  kazbegi: { km: 25 },
  gabala: { km: 25 },
  maafushi: { km: 25 },
  boracay: { km: 25 },
  "puerto-princesa": { km: 40 },
  alula: { km: 35 },
  abha: { km: 30 },
  taif: { km: 30 },
  salalah: { km: 35 },
  nizwa: { km: 30 },
  "sharm-el-sheikh": { km: 30 },
  hurghada: { km: 30 },
};
/**
 * Wikidata puts Hong Kong's and Macau's landmarks in China (P17 = CN), so the
 * country check threw nearly all of them out (Hong Kong had 4 places). Here
 * the territory's own box decides instead (north edge below Shenzhen).
 */
const BOX: Record<string, [number, number, number, number]> = {
  HK: [22.15, 22.52, 113.83, 114.45],
  MO: [22.1, 22.22, 113.52, 113.6],
};
/** Our visit area: the city's centre, or its AREA. */
function centreOf(slug: string) {
  const c = cityPoint(slug);
  const a = AREA[slug];
  if (!c) return undefined;
  return { ...c, lat: a?.lat ?? c.lat, lon: a?.lon ?? c.lon, km: a?.km ?? RADIUS_KM };
}
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

/**
 * The kind of place, from the root a class reaches — what lets a traveller
 * ask for "mosques and Islamic heritage" or "zoos and aquariums" rather than
 * a whole group. Listed most specific first: an item takes the first kind
 * any of its classes reaches.
 */
const KIND_OF_ROOT: [string, string[]][] = [
  ["mosque", ["Q32815"]],
  ["church", ["Q16970", "Q2977", "Q160742", "Q44613"]],
  ["temple", ["Q44539", "Q845945"]],
  ["synagogue", ["Q34627"]],
  ["zoo", ["Q43501"]],
  ["aquarium", ["Q2281788"]],
  ["themepark", ["Q194195", "Q2416723"]],
  ["gallery", ["Q1007870", "Q207694"]],
  ["museum", ["Q33506"]],
  ["palace", ["Q16560"]],
  ["castle", ["Q23413", "Q1785071", "Q16748868", "Q82117"]],
  ["ancient", ["Q839954", "Q109607"]],
  ["monument", ["Q4989906", "Q162875", "Q381885"]],
  ["oldtown", ["Q676050", "Q15243209"]],
  ["square", ["Q174782"]],
  ["bridge", ["Q12280"]],
  ["street", ["Q79007"]],
  ["beach", ["Q40080"]],
  ["garden", ["Q1107656", "Q167346"]],
  ["park", ["Q22698"]],
  ["reserve", ["Q179049", "Q46169"]],
  ["waterfall", ["Q34038"]],
  ["mountain", ["Q8502", "Q39816", "Q150784"]],
  ["lake", ["Q23397"]],
  ["cave", ["Q35509"]],
  ["island", ["Q23442", "Q33837"]],
  ["water", ["Q37901"]],
  ["observation", ["Q1440300", "Q39715"]],
  ["tower", ["Q11303", "Q12518"]],
  ["mall", ["Q11315", "Q216107"]],
  ["market", ["Q37654", "Q132510"]],
  ["theatre", ["Q24354", "Q153562", "Q1060829"]],
  ["culture", ["Q1329623", "Q7075"]],
  ["landmark", ["Q2319498", "Q570116", "Q2065736", "Q9259", "Q483453", "Q184949"]],
];
const classKinds = new Map<string, Set<string>>();

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

/** ISO codes of states that no longer exist (Wikidata keeps them on P17). */
const FORMER_STATES = new Set(["DD", "YU", "SU", "CS", "ZR", "BU", "TP", "YD", "AN"]);

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
      if (rs) classKinds.set(c, new Set(KIND_OF_ROOT.filter(([, ids]) => ids.some((id) => rs.has(id))).map(([k]) => k)));
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

/** The most specific kind any of the item's classes reaches. */
function kindOf(classes: Set<string>): string | undefined {
  const all = new Set([...classes].flatMap((c) => [...(classKinds.get(c) ?? [])]));
  return KIND_OF_ROOT.find(([k]) => all.has(k))?.[0];
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
  /** ISO codes of the countries Wikidata puts it in. */
  iso: Set<string>;
  /** Its photograph on Wikimedia Commons (P18), file name. */
  img?: string;
}

async function cityItems(lat: number, lon: number, radiusKm = RADIUS_KM, minLinks = MIN_LINKS): Promise<Row[] | null> {
  const rows = await sparql<B>(`SELECT ?item ?sl ?coord ?class ?ar ?en ?whs ?vis ?web ?iso ?img WHERE {
    SERVICE wikibase:around {
      ?item wdt:P625 ?coord .
      bd:serviceParam wikibase:center "Point(${lon} ${lat})"^^geo:wktLiteral ;
                      wikibase:radius "${radiusKm}" .
    }
    ?item wikibase:sitelinks ?sl . FILTER(?sl >= ${minLinks})
    ?item wdt:P31 ?class .
    OPTIONAL { ?item rdfs:label ?ar . FILTER(LANG(?ar) = "ar") }
    OPTIONAL { ?item rdfs:label ?en . FILTER(LANG(?en) = "en") }
    OPTIONAL { ?item wdt:P757 ?whs }
    OPTIONAL { ?item wdt:P1174 ?vis }
    OPTIONAL { ?item wdt:P856 ?web }
    OPTIONAL { ?item wdt:P17 ?cty . ?cty wdt:P297 ?iso }
    OPTIONAL { ?item wdt:P18 ?img }
  }`);
  if (!rows) return null;
  const by = new Map<string, Row>();
  for (const r of rows) {
    const q = r.item?.value.split("/").pop();
    const m = r.coord?.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
    if (!q || !m) continue;
    let row = by.get(q);
    if (!row) {
      row = { q, sl: Number(r.sl?.value ?? 0), lon: Number(m[1]), lat: Number(m[2]), classes: new Set(), wh: false, iso: new Set() };
      by.set(q, row);
    }
    if (r.class) row.classes.add(r.class.value.split("/").pop() as string);
    if (r.ar && !row.ar) row.ar = r.ar.value;
    if (r.en && !row.en) row.en = r.en.value;
    if (r.whs) row.wh = true;
    if (r.iso) row.iso.add(r.iso.value.toUpperCase());
    if (r.img && !row.img) row.img = decodeURIComponent(r.img.value.split("/Special:FilePath/").pop() ?? "").replace(/ /g, "_");
    const v = Number(r.vis?.value);
    if (Number.isFinite(v) && v > 0) row.vis = Math.max(row.vis ?? 0, Math.round(v));
    if (r.web && !row.web && /^https?:\/\//.test(r.web.value)) row.web = r.web.value.slice(0, 200);
  }
  return [...by.values()];
}

const LIVE = liveSlugs();
/** The live city whose centre is nearest — a place belongs to that one only. */
function nearestCity(lat: number, lon: number): string | undefined {
  let best: string | undefined;
  let d = Infinity;
  for (const s of LIVE) {
    const c = centreOf(s);
    if (!c) continue;
    const x = (c.lon - lon) * Math.cos(((c.lat + lat) / 2) * (Math.PI / 180));
    const y = c.lat - lat;
    const k = x * x + y * y;
    if (k < d) {
      d = k;
      best = s;
    }
  }
  return best;
}

/**
 * Each kept place's Commons photo, with its author and licence (shown on the
 * card, as the licence requires). Only free licences are kept; a file with
 * none we can name is dropped. `im` becomes the file's path on
 * upload.wikimedia.org ("a/ab/Name.jpg") so the page needs no hashing.
 */
async function commonsCredits(places: GuidePlace[]) {
  const { createHash } = await import("node:crypto");
  const files = places.filter((p) => p.im && !p.im.includes("/"));
  for (let i = 0; i < files.length; i += 40) {
    const part = files.slice(i, i + 40);
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.search = new URLSearchParams({
      action: "query",
      format: "json",
      prop: "imageinfo",
      iiprop: "extmetadata|size",
      titles: part.map((p) => `File:${p.im}`).join("|"),
    }).toString();
    let pages: Record<string, { title?: string; imageinfo?: { width?: number; extmetadata?: Record<string, { value?: string }> }[] }> = {};
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      const body = (await res.json()) as { query?: { pages?: typeof pages; normalized?: { from: string; to: string }[] } };
      pages = body.query?.pages ?? {};
    } catch {
      continue;
    }
    const byTitle = new Map(Object.values(pages).map((pg) => [(pg.title ?? "").replace(/^File:/, "").replace(/ /g, "_"), pg]));
    for (const p of part) {
      const pg = byTitle.get(p.im!);
      const meta = pg?.imageinfo?.[0]?.extmetadata;
      const lic = meta?.LicenseShortName?.value ?? "";
      const width = pg?.imageinfo?.[0]?.width ?? 0;
      if (!/^(CC BY|CC0|Public domain|PD)/i.test(lic) || width < 800 || !/\.(jpe?g|png|webp)$/i.test(p.im!)) {
        delete p.im;
        continue;
      }
      const artist = (meta?.Artist?.value ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 50);
      const md5 = createHash("md5").update(p.im!).digest("hex");
      p.im = `${md5[0]}/${md5.slice(0, 2)}/${p.im}`;
      p.ia = artist || undefined;
      p.il = lic.slice(0, 20);
    }
    await sleep(300);
  }
}

/** Our map's categories (public/data/places) as guide group + kind; the fame a place needs to count. */
const OSM_KIND: Record<string, [Group, string | undefined, number]> = {
  museum: ["museums", "museum", 1],
  gallery: ["museums", "gallery", 2],
  palace: ["history", "palace", 1],
  castle: ["history", "castle", 1],
  fort: ["history", "castle", 1],
  archaeological_site: ["history", "ancient", 1],
  ruins: ["history", "ancient", 1],
  monument: ["history", "monument", 2],
  city_gate: ["history", "monument", 1],
  tomb: ["history", "monument", 2],
  memorial: ["history", "monument", 3],
  place_of_worship: ["religion", undefined, 2],
  viewpoint: ["views", "observation", 2],
  attraction: ["views", "landmark", 2],
  beach: ["beach", "beach", 1],
  garden: ["nature", "garden", 2],
  park: ["nature", "park", 2],
  zoo: ["family", "zoo", 1],
  aquarium: ["family", "aquarium", 1],
  theme_park: ["family", "themepark", 1],
  water_park: ["family", "themepark", 1],
  marketplace: ["markets", "market", 1],
  mall: ["shopping", "mall", 2],
};
const GENERIC = /^(bridge|cave|park|beach|mosque|church|museum|garden|viewpoint|view|monument|memorial|temple|statue|fountain|playground|market|mall|tomb|ruins|fort|castle|tower|gate|square|lake|waterfall|island|pier|harbour|harbor|attraction|gallery|shrine|cemetery|plaza)$/;
const MOSQUE = /mosque|masjid|cami|camii|jami|مسجد|جامع/i;
const CHURCH = /church|cathedral|basilica|chapel|kilise|كنيسة|كاتدرائية/i;
const TEMPLE = /temple|pagoda|wat |shrine|vihara|kovil|معبد/i;

/**
 * A thin city's guide filled from the places on our own map (OpenStreetMap,
 * already collected for the city): the best-known first, one per spot and
 * name, until THIN. Their write-ups come from write.ts like any other.
 * Returns how many were added.
 */
export function fromOurMap(slug: string, kept: GuidePlace[], oldByQ: Map<string, GuidePlace>): number {
  const f = join(process.cwd(), "public/data/places", `${slug}.json`);
  if (!existsSync(f)) return 0;
  const map = JSON.parse(readFileSync(f, "utf8")) as { i: string; n: string; e?: string; a?: string; k: string; y: number; x: number; f?: number }[];
  if (!Array.isArray(map)) return 0;
  const cityWords = new Set([slug.replace(/-/g, " "), (CITY_NAMES_EN[slug] ?? "").split(",")[0]].map((s) => s.toLowerCase()));
  const norm = (s?: string) => (s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const names = new Set(kept.flatMap((p) => [norm(p.n), norm(p.e), norm(p.a)]).filter(Boolean));
  const km = (a: { y: number; x: number }, b: { y: number; x: number }) =>
    Math.hypot((a.x - b.x) * 111.32 * Math.cos((a.y * Math.PI) / 180), (a.y - b.y) * 110.57);
  let added = 0;
  const usable = map.filter((p) => OSM_KIND[p.k] && p.n && typeof p.y === "number").sort((a, b) => (b.f ?? 0) - (a.f ?? 0));
  // The better-known first; a city still under 15 then takes any named one
  // (write.ts drops a map place the writer does not know).
  const pool = [...usable.filter((p) => (p.f ?? 0) >= OSM_KIND[p.k][2]), ...usable.filter((p) => (p.f ?? 0) < OSM_KIND[p.k][2])];
  const strong = pool.length - usable.filter((p) => (p.f ?? 0) < OSM_KIND[p.k][2]).length;
  for (const [idx, p] of pool.entries()) {
    if (kept.length >= THIN || (idx >= strong && kept.length >= 15)) break;
    const n = norm(p.e || p.n);
    // «Bridge», «Cave»: a map label, not a place a guide can name.
    if (!n.includes(" ") && GENERIC.test(n)) continue;
    if (!n || cityWords.has(n) || cityWords.has(norm(p.n)) || names.has(n) || names.has(norm(p.n))) continue;
    if (kept.some((k) => km(k, p) < 0.15)) continue;
    const [g, kd0] = OSM_KIND[p.k];
    const label = `${p.n} ${p.e ?? ""}`;
    const kd = kd0 ?? (MOSQUE.test(label) ? "mosque" : CHURCH.test(label) ? "church" : TEMPLE.test(label) ? "temple" : undefined);
    const prev = oldByQ.get(p.i);
    kept.push({
      ...(prev ?? {}),
      i: p.i,
      q: p.i,
      n: p.n,
      e: p.e ?? (/[؀-ۿ]/.test(p.n) ? undefined : p.n),
      a: p.a ?? (/[؀-ۿ]/.test(p.n) ? p.n : undefined),
      g,
      kd,
      y: p.y,
      x: p.x,
      sl: 0,
    });
    names.add(n);
    names.add(norm(p.n));
    added++;
  }
  return added;
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  let slugs = process.argv.includes("--staged") ? stagedSlugs() : liveSlugs();
  const only = arg("--only");
  // --only all: every city again now (after a change to the sorting).
  if (only && only !== "all") slugs = only.split(",").map((s) => s.trim()).filter(Boolean);
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
    const pt = centreOf(slug);
    if (!pt) continue;
    const t0 = Date.now();
    let items = await cityItems(pt.lat, pt.lon, pt.km);
    if (!items) {
      report.push(`${slug}: query failed`);
      continue;
    }
    await classify([...new Set(items.flatMap((r) => [...r.classes]))]);
    const path = join(DIR, `${slug}.json`);
    const old: GuideFile | null = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
    const oldByQ = new Map((old?.places ?? []).map((p) => [p.q, p]));
    let places: GuidePlace[] = [];
    let dropped: string[] = [];
    let wrongPlace: string[] = [];
    const sift = (rows: Row[]) => {
    places = [];
    dropped = [];
    wrongPlace = [];
    for (const r of rows) {
      // An item with neither an English nor an Arabic label would show as «Q123».
      if (!r.en && !r.ar) continue;
      // Owner, 27 Oct: "a place shown in one city that belongs to another —
      // avoid at all costs". Not in this city's country (Kos for Bodrum), or
      // nearer another city we cover (Dubai's museum for Sharjah): not ours.
      // Former states (East Germany, Yugoslavia, USSR…) still carry their old
      // code on landmarks like the Berlin Wall: they say nothing about today.
      const nowIso = [...r.iso].filter((c) => !FORMER_STATES.has(c));
      const box = pt.code ? BOX[pt.code] : undefined;
      if (box ? !(r.lat >= box[0] && r.lat <= box[1] && r.lon >= box[2] && r.lon <= box[3]) : pt.code && nowIso.length && !nowIso.includes(pt.code)) {
        if (r.sl >= 15) wrongPlace.push(`${r.en ?? r.q} (${[...r.iso].join(",")})`);
        continue;
      }
      const home = nearestCity(r.lat, r.lon);
      if (home && home !== slug) {
        if (r.sl >= 15) wrongPlace.push(`${r.en ?? r.q} (→ ${home})`);
        continue;
      }
      // A World Heritage old town or medina stays even though it is a "settlement".
      // An icon is kept even when it is a hotel or an office (Burj Al Arab,
      // Tokyo's government building with its free observatories).
      const iconic = r.sl >= BIG_LINKS;
      const soft = (c: string) => ["Q27686", "Q1021645"].includes(neverClass.get(c) ?? (NEVER.has(c) ? c : ""));
      // A mosque, museum or palace that is also listed as a teaching body
      // (Al-Masjid al-Haram, Al-Azhar) is still the mosque.
      const placeGroup = [...r.classes].some((c) => ["religion", "museums", "history"].includes(classGroup.get(c) ?? ""));
      const school = (c: string) => (neverClass.get(c) ?? "") === "Q2385804";
      const why = [...r.classes].find((c) => (NEVER.has(c) || (neverClass.has(c) && !r.wh)) && !(iconic && soft(c)) && !(placeGroup && school(c)));
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
        kd: kindOf(r.classes),
        wh: r.wh || undefined,
        vis: r.vis,
        web: r.web ?? prev?.web,
        im: r.img,
      });
    }
    };
    sift(items);
    let thin = "";
    if (places.length < THIN) {
      // A thin city: ask again for items with a single article.
      const more = await cityItems(pt.lat, pt.lon, pt.km, 1);
      if (more) {
        await classify([...new Set(more.flatMap((r) => [...r.classes]))]);
        const have = new Set(items.map((r) => r.q));
        items = [...items, ...more.filter((r) => !have.has(r.q))];
        const before = places.length;
        sift(items);
        // A lesser-known hill, islet, lake or wadi (GeoNames imports: «Jabal
        // Khayl», «Golo Weri») is a map name, not a sight to plan.
        places = places.filter((p) => p.sl >= MIN_LINKS || !["mountain", "island", "lake", "water"].includes(p.kd ?? ""));
        thin = ` thin: +${places.length - before} lesser-known`;
      }
    }
    places = places.filter((p) => !isTheAreaItself(p, slug));
    const score = (p: GuidePlace) => p.sl + (p.wh ? 40 : 0) + (p.vis ? Math.min(30, Math.log10(p.vis) * 4) : 0);
    places.sort((a, b) => score(b) - score(a));
    const kept = places.slice(0, KEEP);
    if (kept.length < THIN) {
      const added = fromOurMap(slug, kept, oldByQ);
      if (added) thin += ` +${added} from our map`;
    }
    await commonsCredits(kept);
    const file: GuideFile = { v: 1, src: "wd", city: slug, factsAt: new Date().toISOString(), places: kept };
    writeFileSync(path, JSON.stringify(file));
    const by = Object.fromEntries(GROUPS.map((gr) => [gr, kept.filter((p) => p.g === gr).length]).filter(([, n]) => n));
    report.push(`${slug}: ${Math.round((Date.now() - t0) / 1000)}s, ${items.length} known → ${kept.length} kept${thin} ${JSON.stringify(by)}; top: ${kept.slice(0, 6).map((p) => p.e || p.n).join(" | ")}`);
    if (wrongPlace.length) report.push(`   other city/country: ${wrongPlace.slice(0, 30).join("; ")}`);
    if (dropped.length) report.push(`   dropped (famous): ${dropped.sort((a, b) => Number(b.split("|")[0]) - Number(a.split("|")[0])).slice(0, 30).map((d) => d.split("|")[1]).join("; ")}`);
    console.log(report[report.length - 1]);
    await sleep(1500);
  }
  mkdirSync("scripts/guide/reports", { recursive: true });
  writeFileSync("scripts/guide/reports/facts.txt", `${new Date().toISOString()}\n${report.join("\n")}\n`);
}

// GUIDE_NO_MAIN=1: import the helpers without running (local checks).
if (!process.env.GUIDE_NO_MAIN) main().catch((e) => {
  console.error(e);
  process.exit(1);
});
