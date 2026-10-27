// Each city's best-known landmarks, for its photo (owner, 27 Oct: "the
// photo must be the most famous landmark or the city's own nature").
// Read from our city guide (public/data/guide/<slug>.json, places ranked
// by fame) → src/data/cityLandmarks.json { slug: [name, name, name] }.
//
//   npx tsx scripts/photos/city-landmarks.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { COUNTRY_CITIES } from "@/lib/cities";
import { CITY_COORDS } from "@/data/cityCoords";

const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
};
/** The covered city nearest to a point: a landmark belongs to that city only (Sharjah must not get Dubai's). */
function nearestCity(lat: number, lon: number): string | undefined {
  let best: string | undefined;
  let d = Infinity;
  for (const [slug, c] of Object.entries(CITY_COORDS)) {
    const k = km({ lat, lon }, c);
    if (k < d) { d = k; best = slug; }
  }
  return best;
}

// Places whose photos are rarely the view a traveller pictures.
const SKIP = /\b(university|college|school|hospital|station|airport|stadium|arena|library|archive|cemetery|ministry|embassy|parliament building|headquarters|metro|bank|prison|district|neighbourhood|neighborhood|province|county|municipality)\b/i;

const out: Record<string, string[]> = {};
for (const list of Object.values(COUNTRY_CITIES)) {
  for (const c of list) {
    const file = `public/data/guide/${c.slug}.json`;
    if (!existsSync(file)) continue;
    const g = JSON.parse(readFileSync(file, "utf8")) as { places?: { e?: string; n?: string; out?: boolean; y?: number; x?: number }[] };
    const names: string[] = [];
    for (const p of g.places ?? []) {
      const name = (p.e || p.n || "").replace(/\s*\(.*?\)\s*/g, " ").trim();
      if (typeof p.y === "number" && typeof p.x === "number" && nearestCity(p.y, p.x) !== c.slug) continue;
      if (!name || name.length > 48 || SKIP.test(name) || /[^\p{Script=Latin}\d\s'’.,&-]/u.test(name)) continue;
      if (!names.includes(name)) names.push(name);
      if (names.length >= 3) break;
    }
    if (names.length) out[c.slug] = names;
  }
}
writeFileSync("src/data/cityLandmarks.json", JSON.stringify(out, null, 0).replace(/\],"/g, '],\n"') + "\n");
const all = Object.values(COUNTRY_CITIES).flat();
console.log(`cities ${all.length} · with landmarks ${Object.keys(out).length}`);
console.log("none:", all.filter((c) => !out[c.slug]).map((c) => c.slug).join(" "));
console.log("one:", all.filter((c) => out[c.slug]?.length === 1).map((c) => `${c.slug}=${out[c.slug][0]}`).join(" | "));
