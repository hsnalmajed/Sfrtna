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
// Upright crops for phone screens (9 : 19.5), cut around the photo's subject
// (sharp's "attention" strategy) — a wide photo blown up to a tall screen
// was soft and lost its subject (owner, 20 Oct). public/hero/<id>-p<w>.webp
const PORTRAIT = [720, 1080, 1440];
const portraitH = (w) => Math.round((w * 19.5) / 9);
const OUT_DIR = "public/hero";
const LIST = "src/data/heroLocal.json";
const PORTRAIT_LIST = "src/data/heroPortrait.json";

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
  if (
    done.has(p.id) &&
    WIDTHS.every((w) => existsSync(`${OUT_DIR}/${p.id}-${w}.webp`)) &&
    PORTRAIT.every((w) => existsSync(`${OUT_DIR}/${p.id}-p${w}.webp`))
  )
    continue;
  try {
    // The 1920w JPEG Pexels already serves to the site, re-encoded smaller.
    const res = await fetch(`${p.url}?auto=compress&cs=tinysrgb&w=1920`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const input = Buffer.from(await res.arrayBuffer());
    for (const w of WIDTHS) {
      await sharp(input).resize({ width: w, withoutEnlargement: true }).webp({ quality: 72 }).toFile(`${OUT_DIR}/${p.id}-${w}.webp`);
    }
    // The tall crops need the full height: asked again at 3,200 px high.
    const tall = await fetch(`${p.url}?auto=compress&cs=tinysrgb&h=3200`);
    if (!tall.ok) throw new Error(`HTTP ${tall.status} (tall)`);
    const tallInput = Buffer.from(await tall.arrayBuffer());
    for (const w of PORTRAIT) {
      await sharp(tallInput)
        .resize({ width: w, height: portraitH(w), fit: "cover", position: sharp.strategy.attention })
        .webp({ quality: 74 })
        .toFile(`${OUT_DIR}/${p.id}-p${w}.webp`);
    }
    done.add(p.id);
    console.log(`ok   ${p.id}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${p.id} ${e.message}`);
  }
}

writeFileSync(LIST, JSON.stringify([...done].sort(), null, 2) + "\n");
const portraitDone = unique.filter((p) => PORTRAIT.every((w) => existsSync(`${OUT_DIR}/${p.id}-p${w}.webp`))).map((p) => p.id);
writeFileSync(PORTRAIT_LIST, JSON.stringify(portraitDone.sort(), null, 2) + "\n");
console.log(`${done.size}/${unique.length} hero photos on our domain${failed ? `, ${failed} failed` : ""}`);
if (failed) process.exitCode = 1;
