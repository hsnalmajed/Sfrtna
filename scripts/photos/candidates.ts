// Candidate photos for every live country and city, for a person to choose
// from by eye (owner, 27 Oct: "the automatic picks are bad; the photo must
// be the place's beautiful view, or its world-famous symbol").
//
//   PEXELS_API_KEY=… npx tsx scripts/photos/candidates.ts [--max 190]
//     → photo-review/candidates.json (resumable)
//   npx tsx scripts/photos/candidates.ts --sheets
//     → photo-review/c-NN.jpg + c-index.json (numbered thumbnails per place)
//
// Run by .github/workflows/photo-candidates.yml; everything lives on the
// branch `photo-review`, never on main. The choices then go by hand into
// src/data/photoPicks.json, which the site reads before anything automatic.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { COUNTRY_CITIES } from "@/lib/cities";
import { findCountry } from "@/lib/countries";
import { COUNTRY_LANDMARKS, CITY_LANDMARKS } from "@/data/countryLandmarks";
import { UNFIT } from "@/lib/pexels";

const DIR = "photo-review";
// --redo: a second search with hand-written queries for the places whose
// first candidates were weak or empty (scripts/photos/redo.json) → its own
// file and sheets (c2-NN).
const REDO = process.argv.includes("--redo");
const FILE = REDO ? `${DIR}/candidates2.json` : `${DIR}/candidates.json`;
const SHEET = REDO ? "c2" : "c";
const ANIMALS = /\b(animal|animals|bird|birds|pelican|gorilla|monkey|monkeys|elephant|elephants|lion|lions|giraffe|zebra|dog|dogs|cat|cats|horse|horses|camel|camels|cow|cows|sheep|goat|deer|bear|fish|seagull|seagulls|pigeon|pigeons|duck|ducks|wildlife|insect|butterfly|flower close)\b/;
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

type Cand = { o: string; alt: string; n: string };
type Subject = { key: string; label: string; queries: { q: string; mention: string[] }[] };

function subjects(): Subject[] {
  if (REDO) {
    const redo = JSON.parse(readFileSync("scripts/photos/redo.json", "utf8")) as Record<string, [string, ...string[]][]>;
    return Object.entries(redo).map(([key, qs]) => ({ key, label: key, queries: qs.map(([q, ...mention]) => ({ q, mention })) }));
  }
  const out: Subject[] = [];
  for (const [code, list] of Object.entries(COUNTRY_CITIES)) {
    const country = findCountry(code)?.nameEn ?? code;
    const icon = COUNTRY_LANDMARKS[code]?.[0];
    out.push({
      key: `country:${code}`,
      label: `${code} ${country}`,
      queries: [
        ...(icon ? [{ q: icon[0], mention: [country, ...icon.slice(1)] }] : []),
        { q: `${country} landscape`, mention: [country] },
      ],
    });
    for (const c of list) {
      const city = c.nameEn.replace(/\s*\(.*?\)\s*/g, " ").trim();
      const cicon = CITY_LANDMARKS[c.slug]?.[0];
      out.push({
        key: `city:${c.slug}`,
        label: `${code} ${city}`,
        queries: [
          { q: `${city} cityscape`, mention: [city] },
          cicon ? { q: cicon[0], mention: [city, ...cicon.slice(1)] } : { q: `${city} ${country}`, mention: [city] },
        ],
      });
    }
  }
  return out;
}

async function search(q: string, mention: string[]): Promise<Cand[] | null> {
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", q);
  url.searchParams.set("per_page", "40");
  url.searchParams.set("orientation", "landscape");
  const res = await fetch(url, { headers: { Authorization: process.env.PEXELS_API_KEY || "" } });
  if (!res.ok) return null;
  const body = (await res.json()) as { photos?: { src: { original: string }; alt?: string; photographer: string; width: number; height: number }[] };
  const words = mention.map(fold).filter(Boolean);
  return (body.photos ?? [])
    .filter((p) => {
      const alt = fold(p.alt ?? "");
      return p.width >= p.height * 1.25 && p.width >= (REDO ? 1600 : 2400) && !UNFIT.test(alt) && !ANIMALS.test(alt) && words.some((w) => alt.includes(w));
    })
    .slice(0, 8)
    .map((p) => ({ o: p.src.original.split("?")[0], alt: (p.alt ?? "").slice(0, 120), n: p.photographer }));
}

async function collect() {
  mkdirSync(DIR, { recursive: true });
  const store: Record<string, Cand[]> = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};
  let budget = Number(arg("--max") ?? 190);
  const all = subjects();
  for (const s of all) {
    if (s.key in store) continue;
    if (budget < s.queries.length) break;
    const found: Cand[] = [];
    let failed = false;
    for (const q of s.queries) {
      budget--;
      const r = await search(q.q, q.mention);
      if (r === null) {
        failed = true;
        break;
      }
      for (const c of r) if (!found.some((f) => f.o === c.o)) found.push(c);
    }
    if (failed) break;
    store[s.key] = found;
  }
  writeFileSync(FILE, JSON.stringify(store));
  console.log(`subjects ${all.length} · collected ${Object.keys(store).length} · empty ${Object.values(store).filter((v) => !v.length).length}`);
}

async function sheets() {
  const sharp = (await import("sharp")).default;
  const store: Record<string, Cand[]> = JSON.parse(readFileSync(FILE, "utf8"));
  const all = subjects().filter((s) => s.key in store);
  const W = 150, H = 100, LABEL = 170, PER = 8;
  const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]!);
  const index: { sheet: number; keys: string[] }[] = [];
  for (let s = 0; s * PER < all.length; s++) {
    const part = all.slice(s * PER, (s + 1) * PER);
    const width = LABEL + 16 * (W + 4), height = part.length * (H + 8) + 8;
    const layers: { input: Buffer; left: number; top: number }[] = [];
    let svg = "";
    for (let i = 0; i < part.length; i++) {
      const y = i * (H + 8) + 8;
      const cands = store[part[i].key];
      svg += `<text x="6" y="${y + 24}" font-size="17" font-weight="bold" font-family="sans-serif">${esc(part[i].label)}</text><text x="6" y="${y + 46}" font-size="13" font-family="sans-serif" fill="#555">${esc(part[i].key)}${cands.length ? "" : " NONE"}</text>`;
      await Promise.all(
        cands.slice(0, 16).map(async (c, j) => {
          try {
            const res = await fetch(`${c.o}?auto=compress&w=320`);
            const buf = await sharp(Buffer.from(await res.arrayBuffer())).resize(W, H, { fit: "cover" }).jpeg().toBuffer();
            layers.push({ input: buf, left: LABEL + j * (W + 4), top: y });
          } catch {
            /* missing thumb */
          }
          svg += `<rect x="${LABEL + j * (W + 4)}" y="${y}" width="26" height="22" fill="#000"/><text x="${LABEL + j * (W + 4) + 4}" y="${y + 17}" font-size="16" font-weight="bold" fill="#ff0" font-family="sans-serif">${j + 1}</text>`;
        })
      );
    }
    layers.unshift({ input: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"></svg>`), left: 0, top: 0 });
    layers.push({ input: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`), left: 0, top: 0 });
    await sharp({ create: { width, height, channels: 3, background: "#fff" } }).composite(layers).jpeg({ quality: 72 }).toFile(`${DIR}/${SHEET}-${String(s + 1).padStart(2, "0")}.jpg`);
    index.push({ sheet: s + 1, keys: part.map((p) => p.key) });
  }
  writeFileSync(`${DIR}/${SHEET}-index.json`, JSON.stringify(index, null, 1));
  console.log(`sheets ${index.length}`);
}

(process.argv.includes("--sheets") ? sheets() : collect()).catch((e) => {
  console.error(e);
  process.exit(1);
});
