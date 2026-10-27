// «استعرض صور المدينة» (owner, 27 Oct): for every city, photos of its
// best-known landmarks and views, each with the place's name and position.
//
//   PEXELS_API_KEY=… npx tsx scripts/photos/gallery-candidates.ts [--max 190]
//     → photo-review/gallery.json (resumable): { slug: [{ o, n, an, en, y, x }] }
//   npx tsx scripts/photos/gallery-candidates.ts --sheets
//     → photo-review/g-NN.jpg + g-index.json: one row per city, numbered
//
// Places come from our city guide (public/data/guide/<slug>.json, ranked by
// fame), up to 10 a city; a photo is kept only when its caption names the
// place, and never one of people, animals, aircraft or interiors. The rows
// are then checked by eye and the misses listed in scripts/photos/gallery-drop.txt;
// scripts/photos/build-gallery.ts writes public/data/gallery/<slug>.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { COUNTRY_CITIES } from "@/lib/cities";
import { findCountry } from "@/lib/countries";
import { UNFIT } from "@/lib/pexels";

const DIR = "photo-review";
const FILE = `${DIR}/gallery.json`;
const PER_CITY = 10;
const ANIMALS = /\b(animal|animals|bird|birds|pelican|gorilla|monkey|monkeys|elephant|elephants|lion|lions|giraffe|zebra|dog|dogs|cat|cats|horse|horses|camel|camels|cow|cows|sheep|goat|deer|bear|fish|seagull|seagulls|pigeon|pigeons|duck|ducks|wildlife|insect|butterfly)\b/;
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

export type GalleryItem = { o: string; n: string; an: string; en: string; y: number; x: number };
type GuidePlace = { e?: string; n?: string; a?: string; an?: string; y?: number; x?: number; g?: string };

function places(slug: string): GuidePlace[] {
  const f = `public/data/guide/${slug}.json`;
  if (!existsSync(f)) return [];
  const g = JSON.parse(readFileSync(f, "utf8")) as { places?: GuidePlace[] };
  return (g.places ?? []).filter((p) => (p.e || p.n) && typeof p.y === "number" && typeof p.x === "number" && !/^(food|shopping)$/.test(p.g ?? ""));
}

/** The words a caption must contain: the name without "(…)" and city suffixes. */
function mention(name: string, city: string): string[] {
  const clean = name.replace(/\s*\(.*?\)\s*/g, " ").replace(new RegExp(`,?\\s*${city}$`, "i"), "").trim();
  const words = clean.split(/\s+/).filter((w) => w.length > 3 && !/^(the|of|and|mosque|museum|palace|park|church|tower|bridge|square|national|great|old)$/i.test(w));
  return [clean, ...(words.length ? [words.sort((a, b) => b.length - a.length)[0]] : [])];
}

async function search(q: string, words: string[]) {
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", q);
  url.searchParams.set("per_page", "15");
  url.searchParams.set("orientation", "landscape");
  const res = await fetch(url, { headers: { Authorization: process.env.PEXELS_API_KEY || "" } });
  if (!res.ok) return null;
  const body = (await res.json()) as { photos?: { src: { original: string }; alt?: string; photographer: string; width: number }[] };
  const w = words.map(fold).filter(Boolean);
  return (body.photos ?? []).find((p) => {
    const alt = fold(p.alt ?? "");
    return p.width >= 1800 && !UNFIT.test(alt) && !ANIMALS.test(alt) && w.some((x) => alt.includes(x));
  });
}

async function collect() {
  mkdirSync(DIR, { recursive: true });
  const store: Record<string, GalleryItem[]> = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};
  let budget = Number(arg("--max") ?? 190);
  outer: for (const [code, list] of Object.entries(COUNTRY_CITIES)) {
    for (const c of list) {
      if (c.slug in store) continue;
      const city = c.nameEn.replace(/\s*\(.*?\)\s*/g, " ").trim();
      const country = findCountry(code)?.nameEn ?? "";
      const items: GalleryItem[] = [];
      const seen = new Set<string>();
      for (const p of places(c.slug).slice(0, 18)) {
        if (items.length >= PER_CITY) break;
        if (budget <= 0) break outer;
        budget--;
        const name = (p.e || p.n)!;
        const hit = await search(`${name.replace(/\s*\(.*?\)\s*/g, " ")} ${city === name ? country : city}`, mention(name, city));
        if (hit === null) break outer;
        if (!hit) continue;
        const o = hit.src.original.split("?")[0];
        if (seen.has(o)) continue;
        seen.add(o);
        items.push({ o, n: hit.photographer, an: p.a || p.an || name, en: name, y: p.y!, x: p.x! });
      }
      store[c.slug] = items;
    }
  }
  writeFileSync(FILE, JSON.stringify(store));
  const all = Object.values(COUNTRY_CITIES).flat().length;
  console.log(`cities ${all} · collected ${Object.keys(store).length} · photos ${Object.values(store).reduce((a, v) => a + v.length, 0)}`);
}

async function sheets() {
  const sharp = (await import("sharp")).default;
  const store: Record<string, GalleryItem[]> = JSON.parse(readFileSync(FILE, "utf8"));
  const slugs = Object.keys(store);
  const W = 180, H = 120, LABEL = 150, PER = 8;
  const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]!);
  const index: { sheet: number; slugs: string[] }[] = [];
  for (let s = 0; s * PER < slugs.length; s++) {
    const part = slugs.slice(s * PER, (s + 1) * PER);
    const width = LABEL + PER_CITY * (W + 4), height = part.length * (H + 26) + 8;
    const layers: { input: Buffer; left: number; top: number }[] = [];
    let svg = "";
    for (let i = 0; i < part.length; i++) {
      const y = i * (H + 26) + 8;
      svg += `<text x="6" y="${y + 24}" font-size="17" font-weight="bold" font-family="sans-serif">${esc(part[i])}</text>`;
      await Promise.all(
        store[part[i]].map(async (it, j) => {
          const x = LABEL + j * (W + 4);
          try {
            const res = await fetch(`${it.o}?auto=compress&w=360`);
            layers.push({ input: await sharp(Buffer.from(await res.arrayBuffer())).resize(W, H, { fit: "cover" }).jpeg().toBuffer(), left: x, top: y });
          } catch {
            /* blank */
          }
          svg += `<rect x="${x}" y="${y}" width="24" height="20" fill="#000"/><text x="${x + 4}" y="${y + 16}" font-size="15" font-weight="bold" fill="#ff0" font-family="sans-serif">${j + 1}</text><text x="${x}" y="${y + H + 15}" font-size="11" font-family="sans-serif">${esc(it.en.slice(0, 30))}</text>`;
        })
      );
    }
    layers.push({ input: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`), left: 0, top: 0 });
    await sharp({ create: { width, height, channels: 3, background: "#fff" } }).composite(layers).jpeg({ quality: 72 }).toFile(`${DIR}/g-${String(s + 1).padStart(2, "0")}.jpg`);
    index.push({ sheet: s + 1, slugs: part });
  }
  writeFileSync(`${DIR}/g-index.json`, JSON.stringify(index, null, 1));
  console.log(`sheets ${index.length}`);
}

(process.argv.includes("--sheets") ? sheets() : collect()).catch((e) => {
  console.error(e);
  process.exit(1);
});
