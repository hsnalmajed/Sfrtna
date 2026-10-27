// Contact sheets of every country's and city's stored photos, for a person
// (or Claude) to look at before the owner does: is each one the place's
// landmark or nature, with no people, no view from above, no plane?
//
//   npx tsx scripts/photos/contact-sheet.ts   → photo-review/sheet-NN.jpg + index.json
//
// Run by .github/workflows/photo-review.yml (the workspace cannot reach
// Pexels); the sheets are pushed to the branch `photo-review`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { COUNTRY_CITIES } from "@/lib/cities";
import { findCountry } from "@/lib/countries";
import { cityPhotoQueries, countryPhotoQueries } from "@/lib/photoSubjects";
import { subjectKey, type StoredPhoto } from "@/lib/pexels";

const stored = JSON.parse(readFileSync("public/data/photos.json", "utf8")) as Record<string, StoredPhoto>;
type Row = { label: string; urls: string[] };
const rows: Row[] = [];
for (const [code, list] of Object.entries(COUNTRY_CITIES)) {
  const cq = countryPhotoQueries(code);
  const rec = stored[subjectKey(cq)];
  rows.push({ label: `${code} ${findCountry(code)?.nameEn}`, urls: (Array.isArray(rec) ? rec : rec ? [rec] : []).map((r) => r.o) });
  for (const c of list) {
    const r2 = stored[subjectKey(cityPhotoQueries(code, c.slug, c.nameEn))];
    rows.push({ label: `  ${c.slug}`, urls: (Array.isArray(r2) ? r2 : r2 ? [r2] : []).map((r) => r.o) });
  }
}

const W = 150, H = 100, LABEL = 150, PER_SHEET = 30, COLS = 2;
const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]!);
async function thumb(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(`${url}?auto=compress&w=300`);
    if (!res.ok) return null;
    return await sharp(Buffer.from(await res.arrayBuffer())).resize(W, H, { fit: "cover" }).jpeg().toBuffer();
  } catch {
    return null;
  }
}
mkdirSync("photo-review", { recursive: true });
const index: { sheet: number; labels: string[] }[] = [];
for (let s = 0; s * PER_SHEET < rows.length; s++) {
  const part = rows.slice(s * PER_SHEET, (s + 1) * PER_SHEET);
  const rowsPerCol = Math.ceil(part.length / COLS);
  const cellW = LABEL + 3 * W + 20;
  const width = COLS * cellW, height = rowsPerCol * (H + 6) + 6;
  const layers: { input: Buffer; left: number; top: number }[] = [];
  let svg = "";
  for (let i = 0; i < part.length; i++) {
    const col = Math.floor(i / rowsPerCol), row = i % rowsPerCol;
    const x = col * cellW, y = row * (H + 6) + 6;
    svg += `<text x="${x + 4}" y="${y + 20}" font-size="15" font-family="sans-serif" fill="${part[i].urls.length ? "#000" : "#c00"}">${esc(part[i].label)}${part[i].urls.length ? "" : " (NONE)"}</text>`;
    for (let j = 0; j < Math.min(3, part[i].urls.length); j++) {
      const t = await thumb(part[i].urls[j]);
      if (t) layers.push({ input: t, left: x + LABEL + j * (W + 4), top: y });
    }
  }
  layers.unshift({ input: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`), left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 3, background: "#fff" } }).composite(layers).jpeg({ quality: 70 }).toFile(`photo-review/sheet-${String(s + 1).padStart(2, "0")}.jpg`);
  index.push({ sheet: s + 1, labels: part.map((p) => p.label.trim()) });
}
writeFileSync("photo-review/index.json", JSON.stringify(index, null, 1));
console.log(`rows ${rows.length}, none ${rows.filter((r) => !r.urls.length).length}, sheets ${index.length}`);
