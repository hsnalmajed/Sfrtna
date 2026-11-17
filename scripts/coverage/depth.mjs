// Depth of each live city's data, for the product audit (17 Nov 2026) and
// to re-measure after each round:  node scripts/coverage/depth.mjs [CC,CC]
// Reads only public/data/* and src/lib/cities.ts (no network).
import fs from "node:fs";

const src = fs.readFileSync("src/lib/cities.ts", "utf8");
const start = src.indexOf("COUNTRY_CITIES");
const body = src.slice(start, src.indexOf("\n};", start));
const parts = body.split(/\n  ([A-Z]{2}): \[/).slice(1);
const rows = [];
for (let i = 0; i < parts.length; i += 2) rows.push([parts[i], [...parts[i + 1].matchAll(/slug: "([^"]+)"/g)].map((x) => x[1])]);

const read = (dir, slug) => {
  const f = `public/data/${dir}/${slug}.json`;
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
};
const st = [];
for (const [c, slugs] of rows)
  for (const s of slugs) {
    const g = read("guide", s)?.places ?? [];
    const pl = read("places", s) ?? [];
    const r = read("restaurants", s) ?? [];
    const gal = read("gallery", s) ?? [];
    const pos = g.filter((p) => typeof p.y === "number");
    st.push({
      c,
      s,
      guide: g.length,
      planReady: pos.filter((p) => p.d).length >= 6, // guidePlanReady()
      guideArName: g.filter((p) => p.a).length,
      places: pl.length,
      famous: pl.filter((p) => (p.f || 0) >= 3).length,
      placeArName: pl.filter((p) => p.a || /[؀-ۿ]/.test(p.n)).length,
      restaurants: r.length,
      halal: r.filter((x) => x.h || /halal/.test(x.u || "")).length,
      photos: gal.length,
    });
  }

const only = process.argv[2]?.split(",");
const q = (f) => {
  const v = st.map(f).sort((a, b) => a - b);
  return `min ${v[0]} · median ${v[v.length >> 1]} · max ${v.at(-1)}`;
};
const perCountry = {};
rows.forEach(([, s]) => (perCountry[s.length] = (perCountry[s.length] || 0) + 1));
console.log(`countries ${rows.length} · cities ${st.length} · cities per country ${JSON.stringify(perCountry)}`);
console.log(`no smart plan (guide < 6): ${st.filter((x) => !x.planReady).length}`);
for (const k of ["guide", "places", "famous", "placeArName", "restaurants", "halal", "photos"]) console.log(`${k}: ${q((x) => x[k])}`);
const tot = (k) => st.reduce((a, x) => a + x[k], 0);
console.log(`places with an Arabic name: ${tot("placeArName")} of ${tot("places")}`);
console.log(`no gallery: ${st.filter((x) => !x.photos).map((x) => x.s).join(",")}`);
console.log(`no smart plan: ${st.filter((x) => !x.planReady).map((x) => x.s).join(",")}`);
if (only) for (const x of st.filter((x) => only.includes(x.c))) console.log(JSON.stringify(x));
