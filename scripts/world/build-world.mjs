// Builds public/data/world-map.json — the countries of «خريطتي» (the
// visited-places map), already projected, so the page draws plain SVG paths
// and the site needs no map library for it.
//
// Run once (output is committed; re-run only to change the look):
//   mkdir -p /tmp/worldbuild && cd /tmp/worldbuild && npm init -y &&
//   npm i world-atlas@2 d3-geo@3 topojson-client@3 topojson-simplify@3 i18n-iso-countries@7
//   NODE_PATH=/tmp/worldbuild/node_modules node scripts/world/build-world.mjs /tmp/worldbuild
//
// Shapes: Natural Earth 1:50m (public domain) via world-atlas, simplified,
// islands under ~1 px dropped unless they are the country's main land.
// Projection: Equal Earth (areas true to size). Its constants are written
// to the file so the page places city dots with the same formula
// (src/lib/visitedMap.ts → project).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const base = process.argv[2] || "/tmp/worldbuild";
const req = createRequire(path.join(base, "node_modules", "x.js"));
const topo = req("topojson-client");
const simp = req("topojson-simplify");
const { geoEqualEarth, geoPath, geoArea, geoCentroid } = req("d3-geo");
const iso = req("i18n-iso-countries");
iso.registerLocale(req("i18n-iso-countries/langs/ar.json"));
iso.registerLocale(req("i18n-iso-countries/langs/en.json"));

const W = 1000, H = 520;
const t = JSON.parse(fs.readFileSync(path.join(base, "node_modules/world-atlas/countries-50m.json"), "utf8"));
const s = simp.simplify(simp.presimplify(t), 0.08);
const fc = topo.feature(s, s.objects.countries);
const proj = geoEqualEarth().fitExtent([[4, 4], [W - 4, H - 4]], { type: "Sphere" });
const draw = geoPath(proj).digits(1);

// Places with no ISO code in Natural Earth, joined to the UN member they belong to.
const JOIN = { Somaliland: "SO", "N. Cyprus": "CY", Kosovo: "XK" };
const DROP = new Set(["Siachen Glacier", "Indian Ocean Ter.", "Antarctica", "Fr. S. Antarctic Lands"]);

const byCode = new Map();
for (const f of fc.features) {
  const name = f.properties.name;
  if (DROP.has(name)) continue;
  const code = JOIN[name] || (f.id ? iso.numericToAlpha2(String(f.id).padStart(3, "0")) : null);
  if (!code) { console.warn("no code:", name); continue; }
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const list = byCode.get(code) || [];
  for (const p of polys) list.push(p);
  byCode.set(code, list);
}

const projArea = (poly) => draw.area({ type: "Polygon", coordinates: poly });
const out = [];
for (const [code, polys] of byCode) {
  const sized = polys.map((p) => ({ p, a: projArea(p) })).sort((x, y) => y.a - x.a);
  const keep = sized.filter((x, i) => i === 0 || x.a >= 0.6).map((x) => x.p);
  const geo = { type: "MultiPolygon", coordinates: keep };
  const d = draw(geo);
  if (!d) continue;
  const [[x0, y0], [x1, y1]] = draw.bounds(geo);
  const main = { type: "Polygon", coordinates: sized[0].p };
  const [cx, cy] = proj(geoCentroid(main));
  const r = (n) => Math.round(n * 10) / 10;
  const row = { c: code, d, b: [r(x0), r(y0), r(x1), r(y1)], p: [r(cx), r(cy)] };
  row.ar = iso.getName(code, "ar") || undefined;
  row.en = iso.getName(code, "en") || undefined;
  if (code === "XK") { row.ar = "كوسوفو"; row.en = "Kosovo"; }
  out.push(row);
}
// Countries too small for the 1:50m shapes: a dot at the capital.
const POINTS = { TV: [179.19, -8.52] };
for (const [code, ll] of Object.entries(POINTS)) {
  if (out.some((o) => o.c === code)) continue;
  const [x, y] = proj(ll).map((n) => Math.round(n * 10) / 10);
  out.push({ c: code, d: "", b: [x, y, x, y], p: [x, y], ar: iso.getName(code, "ar"), en: iso.getName(code, "en") });
}
out.sort((a, b) => a.c.localeCompare(b.c));
const k = proj.scale(), [tx, ty] = proj.translate();
const file = { w: W, h: H, proj: { k, tx, ty }, sphere: draw({ type: "Sphere" }), countries: out };
const dest = path.join(path.dirname(new URL(import.meta.url).pathname), "../../public/data/world-map.json");
fs.writeFileSync(dest, JSON.stringify(file));
console.log(out.length, "countries", Math.round(fs.statSync(dest).size / 1024) + " KB");
