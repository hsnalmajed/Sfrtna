// The chosen photos as sheets for the owner's approval (owner, 27 Oct):
// sample.jpg (40 well-known places) and all-NN.jpg (every place).
//   npx tsx scripts/photos/sample-sheet.ts   (reads scripts/photos/picks.built.json)
import { mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";
import { COUNTRY_CITIES } from "@/lib/cities";
import { findCountry } from "@/lib/countries";

const picks = JSON.parse(readFileSync("scripts/photos/picks.built.json", "utf8")) as Record<string, string[]>;
const names: Record<string, string> = {};
for (const [code, list] of Object.entries(COUNTRY_CITIES)) {
  names[`country:${code}`] = `${findCountry(code)?.nameEn ?? code} (country)`;
  for (const c of list) names[`city:${c.slug}`] = c.nameEn;
}
const SAMPLE = ["country:SA", "city:riyadh", "city:jeddah", "city:makkah", "city:madinah", "city:alula", "city:abha", "city:taif",
  "city:istanbul", "city:cappadocia", "city:dubai", "city:abu-dhabi", "city:doha", "city:muscat", "city:salalah", "city:cairo",
  "city:luxor", "city:petra", "city:marrakesh", "city:chefchaouen", "city:paris", "city:london", "city:rome", "city:venice",
  "city:santorini", "city:barcelona", "city:interlaken", "city:prague", "city:tokyo", "city:kyoto", "city:bali", "city:male",
  "city:bangkok", "city:kuala-lumpur", "city:singapore", "city:new-york", "city:rio-de-janeiro", "city:sydney", "city:cape-town", "city:baku"];
const W = 420, H = 280, LABEL = 34, COLS = 5;
const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]!);

async function sheet(keys: string[], file: string) {
  const rows = Math.ceil(keys.length / COLS);
  const width = COLS * (W + 10) + 10, height = rows * (H + LABEL + 10) + 10;
  const layers: { input: Buffer; left: number; top: number }[] = [];
  let svg = "";
  await Promise.all(
    keys.map(async (k, i) => {
      const x = 10 + (i % COLS) * (W + 10), y = 10 + Math.floor(i / COLS) * (H + LABEL + 10);
      svg += `<text x="${x + 4}" y="${y + H + 24}" font-size="20" font-weight="bold" font-family="sans-serif">${esc(names[k] ?? k)}</text>`;
      const url = picks[k]?.[0];
      if (!url) return;
      try {
        const res = await fetch(`${url}?auto=compress&w=700`);
        layers.push({ input: await sharp(Buffer.from(await res.arrayBuffer())).resize(W, H, { fit: "cover" }).jpeg().toBuffer(), left: x, top: y });
      } catch {
        /* blank */
      }
    })
  );
  layers.push({ input: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`), left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 3, background: "#fff" } }).composite(layers).jpeg({ quality: 78 }).toFile(file);
}

async function main() {
  mkdirSync("photo-review", { recursive: true });
  await sheet(SAMPLE, "photo-review/sample.jpg");
  const all = Object.keys(names);
  for (let i = 0; i * 40 < all.length; i++) await sheet(all.slice(i * 40, (i + 1) * 40), `photo-review/all-${String(i + 1).padStart(2, "0")}.jpg`);
  console.log("done", all.length, "missing", all.filter((k) => !picks[k]).join(" "));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
