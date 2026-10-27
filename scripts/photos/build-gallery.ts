// The city galleries, checked by eye → public/data/gallery/<slug>.json
// (read by src/lib/gallery.ts). Each city: its chosen views first
// (src/data/photoPicks.json, at the city centre), then its landmarks from
// photo-review/gallery.json minus the misses in scripts/photos/gallery-drop.txt:
//
//   istanbul 3 7      drop the 3rd and 7th landmark photos of Istanbul
//   jeddah *          the row was not good enough: no gallery yet
//
//   npx tsx scripts/photos/build-gallery.ts <gallery.json> [--only reviewed]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { COUNTRY_CITIES } from "@/lib/cities";
import { CITY_COORDS } from "@/data/cityCoords";
import PICKS from "@/data/photoPicks.json";

type Item = { o: string; n: string; an: string; en: string; y: number; x: number };
const store = JSON.parse(readFileSync(process.argv[2], "utf8")) as Record<string, Item[]>;
const drops = new Map<string, Set<number> | "all">();
if (existsSync("scripts/photos/gallery-drop.txt")) {
  for (const raw of readFileSync("scripts/photos/gallery-drop.txt", "utf8").split("\n")) {
    const [slug, ...rest] = raw.trim().split(/\s+/);
    if (!slug || slug.startsWith("#")) continue;
    drops.set(slug, rest.includes("*") ? "all" : new Set(rest.map(Number)));
  }
}
const picks = PICKS as Record<string, string[]>;
const v2 = new Set(
  existsSync("scripts/photos/gallery2-drop.txt")
    ? readFileSync("scripts/photos/gallery2-drop.txt", "utf8").split("\n").map((l) => l.trim().split(/\s+/)[0]).filter((s) => s && !s.startsWith("#"))
    : []
);
mkdirSync("public/data/gallery", { recursive: true });
let cities = 0, photos = 0;
for (const list of Object.values(COUNTRY_CITIES)) {
  for (const c of list) {
    // Only rows that were looked at go live (every reviewed slug is in the drop file, even with nothing to drop).
    if (!drops.has(c.slug) || !(c.slug in store)) continue;
    // Cities reviewed in v2 (scripts/photos/gallery2.ts) are written there.
    if (v2.has(c.slug)) continue;
    const d = drops.get(c.slug)!;
    if (d === "all") continue;
    const centre = CITY_COORDS[c.slug];
    const views: Item[] = (picks[`city:${c.slug}`] ?? []).slice(0, 2).map((o) => ({ o, n: "", an: c.nameAr, en: c.nameEn, y: centre?.lat ?? 0, x: centre?.lon ?? 0 }));
    const landmarks = store[c.slug].filter((_, i) => !d.has(i + 1)).filter((it) => !views.some((v) => v.o === it.o));
    const items = [...views, ...landmarks];
    if (items.length < 3) continue;
    writeFileSync(`public/data/gallery/${c.slug}.json`, JSON.stringify(items.map(({ o, an, en, y, x }) => ({ o, an, en, y: +y.toFixed(5), x: +x.toFixed(5) }))));
    cities++;
    photos += items.length;
  }
}
console.log(`galleries ${cities} · photos ${photos}`);
