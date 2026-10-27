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
//   npx tsx scripts/photos/gallery2.ts build <gallery2.json>
//     → public/data/gallery/<slug>.json for every reviewed city
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { COUNTRY_CITIES } from "@/lib/cities";
import { findCountry } from "@/lib/countries";
import { CITY_COORDS } from "@/data/cityCoords";
import { UNFIT } from "@/lib/pexels";
import { commonsUrl } from "@/lib/gallery";

const DIR = "photo-review";
const FILE = `${DIR}/gallery2.json`;
const DROP = "scripts/photos/gallery2-drop.txt";
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

/** One photo. `s` = source: p Pexels (o = original URL), c Commons (o = "a/ab/File.jpg"). */
export type Photo = {
  k: "v" | "l";
  s: "p" | "c";
  o: string;
  w: number;
  an: string;
  en: string;
  y: number;
  x: number;
  /** Credit for Commons photos: "author · licence". */
  c?: string;
};
type Store = Record<string, { v: Photo[]; l: Photo[] }>;
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

async function collect() {
  mkdirSync(DIR, { recursive: true });
  const store: Store = existsSync(FILE)
    ? JSON.parse(readFileSync(FILE, "utf8"))
    : {};
  let budget = Number(arg("--max") ?? 180);
  // --redo: collect the --only cities again from scratch.
  if (process.argv.includes("--redo")) for (const s of only) delete store[s];
  for (const c of cities()) {
    if (only.size && !only.has(c.slug)) continue;
    if (c.slug in store) continue;
    const city = c.nameEn.replace(/\s*\(.*?\)\s*/g, " ").trim();
    const country = findCountry(c.code)?.nameEn ?? "";
    const centre = CITY_COORDS[c.slug];
    if (!centre) continue;
    if (budget < 4) break;

    // Views: the city named in the caption, never people, animals or interiors.
    const views: Photo[] = [];
    const seen = new Set<string>();
    const cityWord = fold(
      city.split(/[\s-]/).sort((a, b) => b.length - a.length)[0],
    );
    let stopped = false;
    for (const q of [
      `${city} ${country}`,
      `${city} skyline`,
      `${city} sunset`,
      `${city} landscape`,
    ]) {
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
    const ranked = places
      .map((p, i) => ({ p, i, inf: info.get(p.im!) }))
      .filter(
        (r) =>
          r.inf && r.inf.width >= 1200 && r.inf.width >= r.inf.height * 0.9,
      )
      .sort((a, b) => b.inf!.quality - a.inf!.quality || a.i - b.i)
      .slice(0, MAX_LANDMARKS)
      .sort((a, b) => a.i - b.i);
    const landmarks: Photo[] = ranked.map(({ p, inf }) => ({
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
    store[c.slug] = { v: views, l: landmarks };
    writeFileSync(FILE, JSON.stringify(store));
    console.log(
      `${c.slug}: ${views.length} views, ${landmarks.length} landmarks (${ranked.filter((r) => r.inf!.quality).length} rated)`,
    );
  }
  writeFileSync(FILE, JSON.stringify(store));
  console.log(`collected ${Object.keys(store).length}/${cities().length}`);
}

function reviewed(): Map<string, Set<string> | "all"> {
  const drops = new Map<string, Set<string> | "all">();
  if (!existsSync(DROP)) return drops;
  for (const raw of readFileSync(DROP, "utf8").split("\n")) {
    const [slug, ...rest] = raw.trim().split(/\s+/);
    if (!slug || slug.startsWith("#")) continue;
    drops.set(
      slug,
      rest.includes("*") ? "all" : new Set(rest.map((r) => r.toLowerCase())),
    );
  }
  return drops;
}

const thumb = (p: Photo, w: number) =>
  p.s === "p" ? `${p.o}?auto=compress&w=${w}` : commonsUrl(p.o, w, p.w);

async function sheets() {
  const sharp = (await import("sharp")).default;
  const store: Store = JSON.parse(readFileSync(FILE, "utf8"));
  const done = reviewed();
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
    if (done.has(slug) || (only.size && !only.has(slug))) continue;
    const all = [
      ...row.v.map((p, i) => ({ p, tag: `v${i + 1}` })),
      ...row.l.map((p, i) => ({ p, tag: `l${i + 1}` })),
    ];
    if (!all.length) continue;
    const rows = Math.ceil(all.length / PER_ROW);
    const width = PER_ROW * (W + GAP) + GAP,
      height = 34 + rows * (H + 22);
    const layers: { input: Buffer; left: number; top: number }[] = [];
    let svg = `<text x="6" y="24" font-size="20" font-weight="bold" font-family="sans-serif">${esc(slug)} — ${row.v.length} views, ${row.l.length} landmarks</text>`;
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
      svg += `<rect x="${x}" y="${y}" width="${tag.length * 11 + 6}" height="22" fill="${p.k === "v" ? "#06c" : "#000"}"/><text x="${x + 3}" y="${y + 17}" font-size="16" font-weight="bold" fill="#ff0" font-family="sans-serif">${tag}</text><text x="${x}" y="${y + H + 15}" font-size="11" font-family="sans-serif">${esc(p.en.slice(0, 32))}</text>`;
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
      .toFile(`${DIR}/v2-${slug}.jpg`);
    index.push(slug);
  }
  writeFileSync(`${DIR}/v2-index.json`, JSON.stringify(index));
  console.log(`sheets ${index.length}`);
}

function build(file: string) {
  const store: Store = JSON.parse(readFileSync(file, "utf8"));
  const done = reviewed();
  mkdirSync("public/data/gallery", { recursive: true });
  let n = 0,
    photos = 0;
  for (const c of cities()) {
    const d = done.get(c.slug);
    const row = store[c.slug];
    if (!d || d === "all" || !row) continue;
    const keep = (list: Photo[], k: string) =>
      list.filter((_, i) => !d.has(`${k}${i + 1}`));
    const items = [...keep(row.v, "v"), ...keep(row.l, "l")];
    if (items.length < 4) continue;
    const out = items.map((p) => ({
      ...p,
      y: +p.y.toFixed(5),
      x: +p.x.toFixed(5),
    }));
    writeFileSync(`public/data/gallery/${c.slug}.json`, JSON.stringify(out));
    n++;
    photos += items.length;
  }
  console.log(`galleries ${n} · photos ${photos}`);
}

const mode = process.argv[2];
(mode === "collect"
  ? collect()
  : mode === "sheets"
    ? sheets()
    : mode === "build"
      ? Promise.resolve(build(process.argv[3]))
      : Promise.reject(new Error("collect | sheets | build"))
).catch((e) => {
  console.error(e);
  process.exit(1);
});
