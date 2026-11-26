// City photo tour, v2 (owner, 27 Oct night: "more photos, beautiful ones,
// everything about the city so the visitor can picture it").
//
// Two kinds of photo per city:
//   views      — up to 15 professional photos of the city itself (skyline,
//                streets, coast, nature), Pexels, the city named in the caption;
//   landmarks  — up to 25 of the guide's places (public/data/guide/<slug>.json,
//                ranked by fame), each with its own Wikimedia Commons photo;
//                pictures Commons rates Featured / Quality / Valued first.
// Nothing goes live unchecked: every city gets a contact sheet, is looked at
// by eye, and its misses are listed in scripts/photos/gallery2-drop.txt:
//
//   istanbul v3 v9 l4 l17     drop view 3 and 9, landmark 4 and 17
//   jeddah *                  not good enough: no gallery yet
//   istanbul                  all good
//
//   PEXELS_API_KEY=… npx tsx scripts/photos/gallery2.ts collect [--max 180] [--only a,b]
//     → photo-review/gallery2.json (resumable)
//   npx tsx scripts/photos/gallery2.ts sheets [--only a,b]
//     → photo-review/v2-<slug>.jpg + v2-index.json (cities collected, not yet reviewed)
//   UNSPLASH_ACCESS_KEY=… npx tsx scripts/photos/gallery2.ts unsplash [--max 40] [--only a,b] [--redo]
//     → row.u (Unsplash views; one search per city; stops before the hourly limit)
//   npx tsx scripts/photos/gallery2.ts usheets [--only a,b]
//     → photo-review/u-<slug>.jpg (Unsplash photos not yet in unsplash-drop.txt)
//   UNSPLASH_ACCESS_KEY=… npx tsx scripts/photos/gallery2.ts uping
//     → tells Unsplash once about every published photo (its API terms)
//   npx tsx scripts/photos/gallery2.ts build <gallery2.json>
//     → public/data/gallery/<slug>.json for every reviewed city
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { COUNTRY_CITIES } from "@/lib/cities";
import { COUNTRIES, findCountry } from "@/lib/countries";
import { CITY_COORDS } from "@/data/cityCoords";
import { UNFIT } from "@/lib/pexels";
import { galleryUrl } from "@/lib/gallery";

const DIR = "photo-review";
const FILE = `${DIR}/gallery2.json`;
const DROP = "scripts/photos/gallery2-drop.txt";
/** Unsplash eye check, same format (tags u#): «tabuk u3 u9», «jazan *», «istanbul». */
const UDROP = "scripts/photos/unsplash-drop.txt";
/** Unsplash photo ids already reported as used (download_location ping). */
const UPINGED = "scripts/photos/unsplash-pinged.txt";
const UTM = "utm_source=sfrtna&utm_medium=referral";
/** View candidates kept for the eye check; about half survive it. */
const MAX_VIEWS = 30;
const MAX_LANDMARKS = 25;
const UA = "SfrtnaBot/1.0 (https://sfrtna.com; info@sfrtna.com)";
const ANIMALS =
  /\b(animal|animals|bird|birds|pelican|gorilla|monkey|monkeys|elephant|elephants|lion|lions|giraffe|zebra|dog|dogs|cat|cats|horse|horses|camel|camels|cow|cows|sheep|goat|deer|bear|fish|seagull|seagulls|pigeon|pigeons|duck|ducks|wildlife|insect|butterfly)\b/;
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const only = new Set((arg("--only") ?? "").split(",").filter(Boolean));

/** One photo. `s` = source: p Pexels (o = original URL), c Commons (o = "a/ab/File.jpg"), u Unsplash (o = urls.raw, hotlinked). */
export type Photo = {
  /** v = Pexels view of the city, n = Commons nature near it, l = a famous sight (guide place). */
  k: "v" | "l" | "n";
  /** For sights: the place's rank in the guide (0 = most famous), so the gallery follows fame. */
  f?: number;
  s: "p" | "c" | "u";
  o: string;
  w: number;
  an: string;
  en: string;
  y: number;
  x: number;
  /** Credit for Commons photos: "author · licence"; Unsplash: the photographer. */
  c?: string;
  /** Unsplash: photographer's profile (credit link). */
  cu?: string;
  /** Unsplash: the photo's page. */
  pg?: string;
  /** Unsplash: download_location, pinged once the photo is published (never published itself). */
  dl?: string;
  /** Unsplash: its description, for the eye-check sheet only. */
  t?: string;
};
type Store = Record<string, { v: Photo[]; l: Photo[]; n?: Photo[]; s?: Photo[]; u?: Photo[]; uv?: number }>;
/** Unsplash filter version: rows searched with an older filter are searched again. */
const UVER = 2;
type GuidePlace = {
  n?: string;
  e?: string;
  a?: string;
  an?: string;
  y?: number;
  x?: number;
  g?: string;
  im?: string;
  ia?: string;
  il?: string;
  out?: boolean;
};

const cities = () =>
  Object.entries(COUNTRY_CITIES).flatMap(([code, list]) =>
    list.map((c) => ({ ...c, code })),
  );

function guide(slug: string): GuidePlace[] {
  const f = `public/data/guide/${slug}.json`;
  if (!existsSync(f)) return [];
  return (
    (JSON.parse(readFileSync(f, "utf8")) as { places?: GuidePlace[] }).places ??
    []
  ).filter(
    (p) =>
      p.im &&
      typeof p.y === "number" &&
      typeof p.x === "number" &&
      p.g !== "food",
  );
}

/** Commons file page title from the stored "a/ab/File.jpg" path. */
const fileTitle = (im: string) =>
  `File:${decodeURIComponent(im.split("/").slice(2).join("/")).replace(/_/g, " ")}`;

type Info = { width: number; height: number; quality: number };
/** Size and Commons' own quality marks for up to 50 files at a time. */
async function commonsInfo(ims: string[]): Promise<Map<string, Info>> {
  const out = new Map<string, Info>();
  for (let i = 0; i < ims.length; i += 50) {
    const part = ims.slice(i, i + 50);
    const titles = part.map(fileTitle);
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.search = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "imageinfo|categories",
      iiprop: "size",
      cllimit: "max",
      clcategories:
        "Category:Featured pictures on Wikimedia Commons|Category:Quality images|Category:Valued images sorted by promotion date",
      titles: titles.join("|"),
    }).toString();
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) continue;
      const body = (await res.json()) as {
        query?: {
          normalized?: { from: string; to: string }[];
          pages?: {
            title: string;
            imageinfo?: { width: number; height: number }[];
            categories?: { title: string }[];
          }[];
        };
      };
      const norm = new Map(
        (body.query?.normalized ?? []).map((n) => [n.to, n.from]),
      );
      for (const p of body.query?.pages ?? []) {
        const asked = norm.get(p.title) ?? p.title;
        const im = part[titles.indexOf(asked)];
        const ii = p.imageinfo?.[0];
        if (!im || !ii) continue;
        const cats = (p.categories ?? []).map((c) => c.title);
        const quality = cats.some((c) => c.includes("Featured"))
          ? 3
          : cats.some((c) => c.includes("Quality"))
            ? 2
            : cats.some((c) => c.includes("Valued"))
              ? 1
              : 0;
        out.set(im, { width: ii.width, height: ii.height, quality });
      }
    } catch {
      /* this batch is skipped */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return out;
}

async function pexels(
  q: string,
): Promise<
  | { src: { original: string }; alt?: string; width: number; height: number }[]
  | null
> {
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", q);
  url.searchParams.set("per_page", "40");
  url.searchParams.set("orientation", "landscape");
  const res = await fetch(url, {
    headers: { Authorization: process.env.PEXELS_API_KEY || "" },
  });
  if (res.status === 429) return null;
  if (!res.ok) return [];
  return (
    (
      (await res.json()) as {
        photos?: {
          src: { original: string };
          alt?: string;
          width: number;
          height: number;
        }[];
      }
    ).photos ?? []
  );
}

/** File names that are not a view: insides, worship, statues, flags, transport, people. */
const BAD_TITLE =
  /(interior|inside|innen|indoor|altar|nave|ceiling|dome interior|mihrab|minbar|church|cathedral|chapel|mosque|masjid|cami|synagogue|museum|exhibit|statue|sculpture|bust|plaque|inscription|grave|tomb|cemetery|flag|metro|station|bus|train|tram|car |cars|airport|aircraft|portrait|people|crowd|map|logo|sign|night|iss\d|view of earth|space station|astronaut|bird|dove|insect|butterfly|moth|dragonfly|frog|lizard|gecko|snake|beetle|spider|fish|coral|flower|orchid|fungi|mushroom|specimen|fauna|flora|animalia|plantae|shark|elephant|loxodonta|giraffe|monkey|baboon|fruit|prickly pear|fig at|pomegranate|apple at|food|dish|road,|street sign|traffic)/;
/** Sights searched by name per city (one Pexels search each). */
const SIGHTS = 12;
/** Guide kinds that are not what a city is known for. */
const NOT_A_SIGHT = new Set(["shopping", "family"]);
/** Words that name a kind, not the sight (an alt saying «mosque» is not «Sultan Ahmed Mosque»). */
const GENERIC = new Set(["mosque", "palace", "museum", "tower", "bridge", "square", "park", "beach", "lake", "mountain", "national", "street", "market", "church", "cathedral", "great", "grand", "old", "city", "town", "garden", "gardens", "island", "fort", "fortress", "castle", "temple", "river", "valley", "falls", "center", "centre", "district", "historic", "mount", "jabal", "masjid", "souq", "souk"]);
/** Not a view of the place: screens, charts, traffic (Bangkok's «Stock Exchange» = phone charts). */
const SCREEN = /(phone|smartphone|screen|monitor|chart|graph|trading|stock market|laptop|traffic|crowded street)/;
/** Inside shots: never in a gallery. */
const INSIDE = /(interior|inside|innen|indoor|altar|nave|ceiling|mihrab|minbar|exhibit|showcase|vitrine)/;
const NATURE_CATS =
  /(landscape|mountain|beach|coast|sea|lake|river|waterfall|valley|desert|dune|island|bay|forest|park|garden|canyon|cliff|wadi|oasis|tea plantation|rice terrace|sunset|sunrise|panorama|view|skyline|old town|harbour|harbor|port)/;
const MAX_NATURE = 25;

/**
 * Round 3: Commons' own best photos (Featured / Quality / Valued) taken near
 * the city and near its nature places — mountains, coast, old streets — the
 * scenes Pexels rarely has for small places. Never insides, worship, statues.
 */
async function commonsNear(
  city: { an: string; en: string },
  centre: { lat: number; lon: number },
  places: GuidePlace[],
): Promise<Photo[]> {
  const points = [
    { y: centre.lat, x: centre.lon },
    ...places
      .filter((p) => p.g === "nature" || p.g === "views" || p.g === "beach")
      .slice(0, 4)
      .map((p) => ({ y: p.y!, x: p.x! })),
  ];
  const files = new Map<string, { y: number; x: number }>();
  for (const pt of points) {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.search = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      list: "geosearch",
      gscoord: `${pt.y}|${pt.x}`,
      gsradius: "10000",
      gsnamespace: "6",
      gslimit: "500",
    }).toString();
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      const body = (await res.json()) as { query?: { geosearch?: { title: string; lat: number; lon: number }[] } };
      for (const g of body.query?.geosearch ?? []) {
        if (/\.(jpe?g)$/i.test(g.title) && !BAD_TITLE.test(fold(g.title))) files.set(g.title, { y: g.lat, x: g.lon });
      }
    } catch {
      /* this point is skipped */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  type Hit = Photo & { q: number; nat: boolean };
  const hits: Hit[] = [];
  const titles = [...files.keys()];
  for (let i = 0; i < titles.length; i += 50) {
    const part = titles.slice(i, i + 50);
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.search = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      // Categories come from extmetadata: prop=categories stops at 500 per call (cut lists).
      prop: "imageinfo",
      iiprop: "size|url|extmetadata",
      iiextmetadatafilter: "Artist|LicenseShortName|Categories",
      titles: part.join("|"),
    }).toString();
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      const body = (await res.json()) as {
        query?: {
          pages?: {
            title: string;
            imageinfo?: { width: number; height: number; url: string; extmetadata?: Record<string, { value: string }> }[];
          }[];
        };
      };
      for (const p of body.query?.pages ?? []) {
        const ii = p.imageinfo?.[0];
        if (!ii || ii.width < 1600 || ii.width < ii.height * 1.2) continue;
        const cats = fold(ii.extmetadata?.Categories?.value ?? "");
        const q = cats.includes("featured pictures") ? 3 : cats.includes("quality images") ? 2 : cats.includes("valued images") ? 1 : 0;
        if (BAD_TITLE.test(cats.replace(/quality images[^|]*|featured pictures[^|]*|valued images[^|]*/g, ""))) continue;
        const nat = NATURE_CATS.test(cats + " " + fold(p.title));
        // Unrated files only when they are clearly a view; the eye check removes the rest.
        if (!q && (!nat || ii.width < 2400)) continue;
        // Same shape as the guide's paths: no tracking query, not percent-encoded.
        const o = decodeURIComponent((ii.url.split("/wikipedia/commons/")[1] ?? "").split("?")[0]);
        if (!o) continue;
        const md = ii.extmetadata ?? {};
        const artist = (md.Artist?.value ?? "").replace(/<[^>]+>/g, "").trim().slice(0, 60);
        const pos = files.get(p.title)!;
        hits.push({
          k: "n",
          s: "c",
          o,
          w: ii.width,
          an: city.an,
          en: city.en,
          y: pos.y,
          x: pos.x,
          c: [artist, md.LicenseShortName?.value].filter(Boolean).join(" · ") || undefined,
          q,
          nat,
        });
      }
    } catch {
      /* this batch is skipped */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  // One photo per series («X (1)», «X (2)», «…P1086456»): the same scene again is not another view.
  const series = new Set<string>();
  const once = hits.filter((h) => {
    const key = fold(decodeURIComponent(h.o.split("/").pop() ?? ""))
      .replace(/\.[a-z]+$/, "")
      .replace(/[\s_-]*(\(\d+\)|\d{2,})[\s_)-]*$/g, "")
      .replace(/\d+$/, "");
    if (series.has(key)) return false;
    series.add(key);
    return true;
  });
  return once
    .sort((a, b) => Number(b.nat) - Number(a.nat) || b.q - a.q)
    .slice(0, MAX_NATURE)
    .map((h) => {
      const p: Photo & { q?: number; nat?: boolean } = { ...h };
      delete p.q;
      delete p.nat;
      return p as Photo;
    });
}

async function collect() {
  mkdirSync(DIR, { recursive: true });
  const store: Store = existsSync(FILE)
    ? JSON.parse(readFileSync(FILE, "utf8"))
    : {};
  let budget = Number(arg("--max") ?? 180);
  // --redo: collect the --only cities again from scratch.
  if (process.argv.includes("--redo")) for (const s of only) delete store[s];
  // Cities never collected first, then those collected before the sights-by-name (19 Nov).
  const order = [...cities()].sort((a, b) => Number(a.slug in store) - Number(b.slug in store));
  for (const c of order) {
    if (only.size && !only.has(c.slug)) continue;
    if (store[c.slug]?.s) continue;
    const city = c.nameEn.replace(/\s*\(.*?\)\s*/g, " ").trim();
    const country = findCountry(c.code)?.nameEn ?? "";
    const centre = CITY_COORDS[c.slug];
    if (!centre) continue;
    if (budget < SIGHTS + 3) break;

    // Views: the city named in the caption, never people, animals or interiors.
    const views: Photo[] = [];
    const seen = new Set<string>();
    const cityWord = fold(
      city.split(/[\s-]/).sort((a, b) => b.length - a.length)[0],
    );
    let stopped = false;
    // Owner 19 Nov: the gallery is the city's famous sights and nature, not
    // untitled streets — two general searches only; the sights come below.
    for (const q of [`${city} skyline`, `${city} ${country}`]) {
      budget--;
      const res = await pexels(q);
      if (res === null) {
        stopped = true;
        break;
      }
      for (const p of res) {
        if (views.length >= MAX_VIEWS) break;
        const alt = fold(p.alt ?? "");
        const o = p.src.original.split("?")[0];
        if (seen.has(o) || p.width < 2000 || p.width < p.height * 1.2) continue;
        if (!alt.includes(cityWord) || UNFIT.test(alt) || ANIMALS.test(alt))
          continue;
        seen.add(o);
        views.push({
          k: "v",
          s: "p",
          o,
          w: p.width,
          an: c.nameAr,
          en: city,
          y: centre.lat,
          x: centre.lon,
        });
      }
    }
    if (stopped) break;

    // Landmarks: the guide's places with a Commons photo; Commons' own best first, then fame.
    const places = guide(c.slug).slice(0, 60);
    const info = await commonsInfo(places.map((p) => p.im!));
    // In the guide's order of fame (Hagia Sophia before a side street); never an inside shot.
    const ranked = places
      .map((p, i) => ({ p, i, inf: info.get(p.im!) }))
      .filter(
        (r) =>
          r.inf &&
          r.inf.width >= 1200 &&
          r.inf.width >= r.inf.height * 0.9 &&
          !INSIDE.test(fold(r.p.im!)) &&
          !NOT_A_SIGHT.has(r.p.g ?? ""),
      )
      .slice(0, MAX_LANDMARKS);
    const landmarks: Photo[] = ranked.map(({ p, i, inf }) => ({
      f: i,
      k: "l",
      s: "c",
      o: p.im!,
      w: inf!.width,
      an: p.a || p.an || (p.e || p.n)!,
      en: (p.e || p.n)!,
      y: p.y!,
      x: p.x!,
      c: [p.ia, p.il].filter(Boolean).join(" · ") || undefined,
    }));
    // Each famous sight by its own name: professional photos captioned with the sight.
    const sights: Photo[] = [];
    const famous = places.map((p, i) => ({ p, i })).filter(({ p }) => !NOT_A_SIGHT.has(p.g ?? "")).slice(0, SIGHTS);
    for (const { p, i } of famous) {
      const name = (p.e || p.n)!;
      const words = fold(name).split(/[^a-z\u00c0-\u024f]+/).filter((w) => w.length >= 4 && !GENERIC.has(w));
      // «Grand Palace»: no distinctive word, so the whole name must be in the photo's description.
      const phrase = fold(name).replace(/\s*\(.*?\)\s*/g, " ").trim();
      // A whole-phrase match («Grand Mosque») must also name the city or country (Dubai got Abu Dhabi's).
      const place = [cityWord, fold(country)].filter((w) => w.length >= 3);
      const matches = (alt: string) =>
        words.length ? words.some((w) => alt.includes(w)) : alt.includes(phrase) && place.some((w) => alt.includes(w));
      budget--;
      const res = await pexels(`${name} ${city}`);
      if (res === null) break;
      let got = 0;
      for (const r of res) {
        if (got >= 3) break;
        const alt = fold(r.alt ?? "");
        const o = r.src.original.split("?")[0];
        if (seen.has(o) || r.width < 2000 || r.width < r.height * 1.2) continue;
        if (!matches(alt) || SCREEN.test(alt) || UNFIT.test(alt) || ANIMALS.test(alt) || INSIDE.test(alt)) continue;
        seen.add(o);
        got++;
        sights.push({ k: "l", s: "p", f: i, o, w: r.width, an: p.a || p.an || name, en: name, y: p.y!, x: p.x! });
      }
    }
    // Commons nature near the city only where sights are few — it needs an eye check before it shows.
    const nature = landmarks.length + sights.length < 8 ? await commonsNear({ an: c.nameAr, en: city }, centre, places) : [];
    store[c.slug] = { ...store[c.slug], v: views, l: landmarks, n: nature, s: sights };
    writeFileSync(FILE, JSON.stringify(store));
    console.log(
      `${c.slug}: ${sights.length} sights, ${views.length} views, ${nature.length} nature, ${landmarks.length} landmarks (${ranked.filter((r) => r.inf!.quality).length} rated)`,
    );
  }
  writeFileSync(FILE, JSON.stringify(store));
  console.log(`collected ${Object.keys(store).length}/${cities().length}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Not a city view on Unsplash (food, insides, screens…); people/animals via UNFIT/ANIMALS. */
const U_NOT_VIEW = /\b(interior|inside|indoor|portrait|selfie|food|dish|coffee|car|cars|traffic|logo|map|flag|statue|sculpture|museum|exhibit|screen|phone|laptop)\b/;

type UResult = {
  id: string;
  width: number;
  height: number;
  description?: string | null;
  alt_description?: string | null;
  premium?: boolean;
  sponsorship?: unknown;
  tags?: { title?: string }[];
  urls: { raw: string };
  links: { html: string; download_location: string };
  user: { name: string; links?: { html?: string } };
};

/**
 * Unsplash views (owner 26 Nov: «connect ANY site with city photos»; trial:
 * Unsplash best by far). One search per city, «City Country»; the city must be
 * named as a whole word and no other country named (Jazan → Jazan, Iran).
 * Demo key = 50 requests an hour: stops on --max or when Unsplash says ≤ 2 left.
 */
async function unsplashCollect() {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) throw new Error("UNSPLASH_ACCESS_KEY missing");
  mkdirSync(DIR, { recursive: true });
  const store: Store = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};
  const redo = process.argv.includes("--redo");
  let budget = Number(arg("--max") ?? 40);
  const fresh: string[] = [];
  for (const c of cities()) {
    if (only.size && !only.has(c.slug)) continue;
    if (store[c.slug]?.uv === UVER && !redo) continue;
    const centre = CITY_COORDS[c.slug];
    if (!centre) continue;
    if (budget <= 0) break;
    const city = c.nameEn.replace(/\s*\(.*?\)\s*/g, " ").trim();
    const country = findCountry(c.code)?.nameEn ?? "";
    // «AlUla» = «Al Ula» = «Al-Ula»: compare with «al» joined to the word after it and no hyphens.
    const join = (t: string) => t.replace(/\bal[\s-]+/g, "al").replace(/-/g, " ");
    const word = new RegExp(`\\b${escRe(join(fold(city)))}\\b`);
    // Another country named as a whole word («Jazan, Iran»; not «woman» for Oman).
    const otherNames = COUNTRIES.filter((k) => k.code !== c.code)
      .map((k) => fold(k.nameEn))
      .filter((n) => n.length >= 4 && !fold(city).includes(n) && !fold(country).includes(n));
    const other = new RegExp(`\\b(${otherNames.map(escRe).join("|")})\\b`);
    const why: Record<string, number> = {};
    const no = (r: string) => {
      why[r] = (why[r] ?? 0) + 1;
    };
    const url = new URL("https://api.unsplash.com/search/photos");
    url.search = new URLSearchParams({ query: `${city} ${country}`, per_page: "30", orientation: "landscape", content_filter: "high" }).toString();
    budget--;
    const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" } });
    const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? "99");
    if (!res.ok) {
      console.log(`${c.slug}: ${res.status} ${(await res.text()).slice(0, 120)}`);
      break;
    }
    const body = (await res.json()) as { results?: UResult[] };
    const u: Photo[] = [];
    for (const r of body.results ?? []) {
      if (u.length >= 20) break;
      if (r.premium || r.sponsorship) {
        no("plus");
        continue;
      }
      if (r.width < 2000 || r.width < r.height * 1.2) {
        no("size");
        continue;
      }
      const text = join(fold([r.description, r.alt_description, ...(r.tags ?? []).map((t) => t.title)].filter(Boolean).join(" ")));
      if (!word.test(text)) {
        no("no-city");
        continue;
      }
      const o = text.match(other)?.[1];
      if (o) {
        no(`other:${o}`);
        continue;
      }
      const bad = text.match(U_NOT_VIEW)?.[1] ?? text.match(UNFIT)?.[1] ?? text.match(ANIMALS)?.[1];
      if (bad) {
        no(`unfit:${bad}`);
        continue;
      }
      u.push({
        k: "v",
        s: "u",
        o: r.urls.raw,
        w: r.width,
        an: c.nameAr,
        en: city,
        y: centre.lat,
        x: centre.lon,
        c: r.user.name,
        cu: r.user.links?.html,
        pg: r.links.html,
        dl: r.links.download_location,
        t: (r.description || r.alt_description || "").slice(0, 80),
      });
    }
    store[c.slug] = { ...(store[c.slug] ?? { v: [], l: [] }), u, uv: UVER };
    fresh.push(c.slug);
    writeFileSync(FILE, JSON.stringify(store));
    const reasons = Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}`).join(", ");
    console.log(`${c.slug}: unsplash ${u.length} (of ${body.results?.length ?? 0}; ${reasons}) · left this hour ${remaining}`);
    if (remaining <= 2) break;
    await sleep(1200);
  }
  writeFileSync(`${DIR}/u-new.txt`, fresh.join(","));
  console.log(`unsplash: ${fresh.length} cities this run, ${cities().filter((c) => CITY_COORDS[c.slug] && store[c.slug]?.uv !== UVER).length} left`);
}

/** Unsplash's terms: report each published photo once (its download_location). */
async function unsplashPing() {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) throw new Error("UNSPLASH_ACCESS_KEY missing");
  const store: Store = JSON.parse(readFileSync(FILE, "utf8"));
  const done = new Set(existsSync(UPINGED) ? readFileSync(UPINGED, "utf8").split("\n").filter(Boolean) : []);
  const dlByRaw = new Map<string, string>();
  for (const row of Object.values(store)) for (const p of row.u ?? []) if (p.dl) dlByRaw.set(p.o, p.dl);
  const idOf = (dl: string) => dl.match(/photos\/([^/?]+)\/download/)?.[1] ?? "";
  let budget = Number(arg("--max") ?? 20);
  let sent = 0;
  outer: for (const c of cities()) {
    const f = `public/data/gallery/${c.slug}.json`;
    if (!existsSync(f)) continue;
    for (const p of JSON.parse(readFileSync(f, "utf8")) as Photo[]) {
      if (p.s !== "u") continue;
      const dl = dlByRaw.get(p.o);
      const id = dl ? idOf(dl) : "";
      if (!dl || !id || done.has(id)) continue;
      if (budget-- <= 0) break outer;
      const res = await fetch(dl, { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" } });
      if (!res.ok) {
        console.log(`ping ${id}: ${res.status}`);
        break outer;
      }
      done.add(id);
      sent++;
      await sleep(600);
    }
  }
  writeFileSync(UPINGED, [...done].sort().join("\n") + (done.size ? "\n" : ""));
  console.log(`unsplash pings ${sent} · total ${done.size}`);
}

function reviewed(file = DROP): Map<string, Set<string> | "all"> {
  const drops = new Map<string, Set<string> | "all">();
  if (!existsSync(file)) return drops;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const [slug, ...rest] = raw.trim().split(/\s+/);
    if (!slug || slug.startsWith("#")) continue;
    drops.set(
      slug,
      rest.includes("*") ? "all" : new Set(rest.map((r) => r.toLowerCase())),
    );
  }
  return drops;
}

const thumb = (p: Photo, w: number) => galleryUrl(p, w);

async function sheets(unsplash = false) {
  const sharp = (await import("sharp")).default;
  const store: Store = JSON.parse(readFileSync(FILE, "utf8"));
  const done = reviewed(unsplash ? UDROP : DROP);
  const W = 200,
    H = 133,
    PER_ROW = 8,
    GAP = 4;
  const esc = (s: string) =>
    s.replace(
      /[&<>]/g,
      (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]!,
    );
  const index: string[] = [];
  for (const [slug, row] of Object.entries(store)) {
    if (only.size ? !only.has(slug) : done.has(slug)) continue;
    const all = unsplash ? (row.u ?? []).map((p, i) => ({ p, tag: `u${i + 1}` })) : [
      ...(row.s ?? []).map((p, i) => ({ p, tag: `s${i + 1}` })),
      ...(row.n ?? []).map((p, i) => ({ p, tag: `n${i + 1}` })),
      ...row.v.map((p, i) => ({ p, tag: `v${i + 1}` })),
      ...row.l.map((p, i) => ({ p, tag: `l${i + 1}` })),
    ];
    if (!all.length) continue;
    const rows = Math.ceil(all.length / PER_ROW);
    const width = PER_ROW * (W + GAP) + GAP,
      height = 34 + rows * (H + 22);
    const layers: { input: Buffer; left: number; top: number }[] = [];
    let svg = unsplash
      ? `<text x="6" y="24" font-size="20" font-weight="bold" font-family="sans-serif">${esc(slug)} — ${all.length} Unsplash</text>`
      : `<text x="6" y="24" font-size="20" font-weight="bold" font-family="sans-serif">${esc(slug)} — ${(row.n ?? []).length} nature, ${row.v.length} views, ${row.l.length} landmarks</text>`;
    // One at a time with a pause: Wikimedia refuses bursts (blank tiles).
    for (const [j, { p, tag }] of all.entries()) {
      const x = GAP + (j % PER_ROW) * (W + GAP),
        y = 34 + Math.floor(j / PER_ROW) * (H + 22);
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(thumb(p, 330), {
            headers: { "User-Agent": UA },
          });
          if (!res.ok) throw new Error(String(res.status));
          layers.push({
            input: await sharp(Buffer.from(await res.arrayBuffer()))
              .resize(W, H, { fit: "cover" })
              .jpeg()
              .toBuffer(),
            left: x,
            top: y,
          });
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
      if (p.s === "c") await new Promise((r) => setTimeout(r, 250));
      svg += `<rect x="${x}" y="${y}" width="${tag.length * 11 + 6}" height="22" fill="${p.k === "v" ? "#06c" : p.k === "n" ? "#070" : "#000"}"/><text x="${x + 3}" y="${y + 17}" font-size="16" font-weight="bold" fill="#ff0" font-family="sans-serif">${tag}</text><text x="${x}" y="${y + H + 15}" font-size="11" font-family="sans-serif">${esc((unsplash ? p.t ?? "" : p.en).slice(0, 32))}</text>`;
    }
    layers.push({
      input: Buffer.from(
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`,
      ),
      left: 0,
      top: 0,
    });
    await sharp({ create: { width, height, channels: 3, background: "#fff" } })
      .composite(layers)
      .jpeg({ quality: 70 })
      .toFile(`${DIR}/${unsplash ? "u" : "v2"}-${slug}.jpg`);
    index.push(slug);
  }
  writeFileSync(`${DIR}/${unsplash ? "u" : "v2"}-index.json`, JSON.stringify(index));
  console.log(`sheets ${index.length}`);
}

function build(file: string) {
  const store: Store = JSON.parse(readFileSync(file, "utf8"));
  const done = reviewed();
  const udone = reviewed(UDROP);
  mkdirSync("public/data/gallery", { recursive: true });
  let n = 0,
    photos = 0;
  for (const c of cities()) {
    const d = done.get(c.slug);
    const row = store[c.slug];
    if (!row) continue;
    // Unsplash: only after its own eye check (Jazan's search gave Jazan in Iran).
    const ud = udone.get(c.slug);
    const uKept = ud instanceof Set ? (row.u ?? []).filter((_, i) => !ud.has(`u${i + 1}`)).slice(0, 15) : [];
    if (d === "all") {
      // Commons/Pexels refused for this city: Unsplash alone, if the eye kept enough.
      if (uKept.length >= 4) {
        writeFileSync(`public/data/gallery/${c.slug}.json`, JSON.stringify(uKept.map(publicPhoto)));
        n++;
        photos += uKept.length;
      }
      continue;
    }
    // Not looked at yet: only the sights by name (their own photos), no general views or Commons nature.
    const seenByEye = d instanceof Set;
    const keep = (list: Photo[], k: string) => list.filter((_, i) => !(seenByEye && d.has(`${k}${i + 1}`)));
    // Owner 19 Nov: the city's famous sights in order of fame — each sight's own
    // photos (by name), then its guide photo — then nature checked by eye, then
    // at most four general views.
    const rank = new Map(guide(c.slug).map((p, i) => [p.im!, i]));
    const kindOf = new Map(guide(c.slug).map((p) => [p.im!, p.g]));
    const fame = (p: Photo) => p.f ?? rank.get(p.o) ?? 999;
    // Owner 19 Nov (Bangkok): «المناظر» = the city's famous scenes in professional
    // photos (each sight by name, by fame), then nature and city views checked
    // by eye; «المعالم» = each sight's own guide photo, by fame. No malls.
    const byFame = (list: Photo[]) =>
      list
        .map((p, i) => ({ p, i }))
        .sort((a, b) => fame(a.p) - fame(b.p) || a.i - b.i)
        .map((r) => r.p);
    // Round-robin over sights so one sight never fills the first screen.
    const own = byFame(keep(row.s ?? [], "s"));
    const rounds: Photo[] = [];
    for (let r = 0; r < 3; r++) {
      const once = new Set<number>();
      for (const p of own) {
        const f = fame(p);
        if (once.has(f)) continue;
        if (own.filter((q) => fame(q) === f).indexOf(p) === r) {
          rounds.push(p);
          once.add(f);
        }
      }
    }
    const nat = seenByEye ? keep(row.n ?? [], "n") : [];
    const general = seenByEye ? keep(row.v, "v").slice(0, 6) : [];
    // Owner 26 Nov: Unsplash = the best city scenes, right after each sight's own photos.
    const views = [...rounds, ...uKept, ...nat, ...general].slice(0, 40).map((p) => ({ ...p, k: "v" as const }));
    const sights = byFame(keep(row.l, "l"))
      .filter((p) => !NOT_A_SIGHT.has(kindOf.get(p.o) ?? ""))
      .slice(0, 25);
    const items = [...views, ...sights];
    if (items.length < 4) continue;
    const out = items.map(publicPhoto);
    writeFileSync(`public/data/gallery/${c.slug}.json`, JSON.stringify(out));
    n++;
    photos += items.length;
  }
  console.log(`galleries ${n} · photos ${photos}`);
  writeImageSitemap();
}

/** What a published gallery keeps of a photo (no fame rank, no ping URL, no photo page). */
function publicPhoto(p: Photo) {
  return { ...p, t: undefined, f: undefined, dl: undefined, pg: undefined, cu: p.cu ? `${p.cu}?${UTM}` : undefined, y: +p.y.toFixed(5), x: +p.x.toFixed(5) };
}

/** Every published gallery as Google image-sitemap entries, on both language pages. */
function writeImageSitemap() {
  const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch]!);
  let body = "";
  for (const c of cities()) {
    const f = `public/data/gallery/${c.slug}.json`;
    if (!existsSync(f)) continue;
    const items = JSON.parse(readFileSync(f, "utf8")) as Photo[];
    const urls = items.map((p) => galleryUrl(p, 1280));
    for (const lang of ["ar", "en"]) {
      body += `<url><loc>https://sfrtna.com/${lang}/attractions/${c.code}/${c.slug}</loc>${urls.map((u) => `<image:image><image:loc>${esc(u)}</image:loc></image:image>`).join("")}</url>\n`;
    }
  }
  writeFileSync(
    "public/sitemap-images.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${body}</urlset>\n`
  );
}

/** How many cities still lack their sights-by-name (the workflow chains until 0). */
function left() {
  const store: Store = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};
  console.log(cities().filter((c) => CITY_COORDS[c.slug] && !store[c.slug]?.s).length);
}

const mode = process.argv[2];
const modes: Record<string, () => Promise<void> | void> = {
  collect,
  sheets: () => sheets(),
  build: () => build(process.argv[3]),
  left,
  unsplash: unsplashCollect,
  usheets: () => sheets(true),
  uping: unsplashPing,
};
Promise.resolve()
  .then(() => {
    const run = modes[mode];
    if (!run) throw new Error(Object.keys(modes).join(" | "));
    return run();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
