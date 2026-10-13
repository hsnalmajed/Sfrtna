// Copies the hand-picked hero photographs (src/lib/heroPhotos.ts) to our own
// domain: public/hero/<id>-<width>.webp, listed in src/data/heroLocal.json.
//
// Why: a hero is the page's largest paint. Served from images.pexels.com the
// phone first opens a second connection (DNS, TCP, TLS: ~3 round trips on
// mobile) before the picture can start; from our own domain it rides the
// connection the page already has. Pexels' licence allows this (free use,
// modification; no attribution required).
//
// Run by .github/workflows/hero-photos.yml (this workspace cannot reach
// Pexels). Resumable: a photo already copied at every width is skipped.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const WIDTHS = [828, 1280, 1920];
const OUT_DIR = "public/hero";
const LIST = "src/data/heroLocal.json";

const source = readFileSync("src/lib/heroPhotos.ts", "utf8");
const photos = [...source.matchAll(/P\("(\d+)",\s*"([^"]+)"\)/g)].map((m) => ({
  id: m[1],
  url: `https://images.pexels.com/photos/${m[1]}/${m[2]}`,
}));
const unique = [...new Map(photos.map((p) => [p.id, p])).values()];

mkdirSync(OUT_DIR, { recursive: true });
const done = new Set(existsSync(LIST) ? JSON.parse(readFileSync(LIST, "utf8")) : []);
let failed = 0;

for (const p of unique) {
  if (done.has(p.id) && WIDTHS.every((w) => existsSync(`${OUT_DIR}/${p.id}-${w}.webp`))) continue;
  try {
    // The 1920w JPEG Pexels already serves to the site, re-encoded smaller.
    const res = await fetch(`${p.url}?auto=compress&cs=tinysrgb&w=1920`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const input = Buffer.from(await res.arrayBuffer());
    for (const w of WIDTHS) {
      await sharp(input).resize({ width: w, withoutEnlargement: true }).webp({ quality: 72 }).toFile(`${OUT_DIR}/${p.id}-${w}.webp`);
    }
    done.add(p.id);
    console.log(`ok   ${p.id}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${p.id} ${e.message}`);
  }
}

writeFileSync(LIST, JSON.stringify([...done].sort(), null, 2) + "\n");
console.log(`${done.size}/${unique.length} hero photos on our domain${failed ? `, ${failed} failed` : ""}`);
if (failed) process.exitCode = 1;
