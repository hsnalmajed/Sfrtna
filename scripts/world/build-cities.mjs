// Builds public/geo/cities/<CC>.json — the cities a traveller can tick in
// «خريطتي», beyond our own 365 guide cities (owner 18 Nov: «been» needs
// every big city). Runs on GitHub (world-cities.yml): the workspace can't
// reach Wikidata.
//
// Source: Wikidata (CC0). Per country: places that are a city (Q515 or a
// subclass) or a town, with coordinates and a population; the biggest 120,
// 20 000+ people (a small country falls back to 2 000+ so it isn't empty),
// plus the capital. Row: [qid, nameAr, nameEn, lat, lon, population].
// The page merges them with our own cities (ours first, near-duplicates
// dropped) — src/lib/visitedCities.ts.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const OUT = path.join(ROOT, "public/geo/cities");
const UA = "SfrtnaGuide/1.0 (https://sfrtna.com; info@sfrtna.com)";
const codes = [...fs.readFileSync(path.join(ROOT, "src/lib/countries.ts"), "utf8").matchAll(/\{ code: "([A-Z]{2})"/g)].map((m) => m[1]);
const only = (process.env.ONLY || "").split(",").filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });

// Written order, no optimiser (it otherwise starts from every item with a
// population and times out): the city classes first (a few hundred
// thousand items), then the country, then the population. The capital
// comes in separately.
const qidOf = (cc) => `SELECT ?k WHERE { ?k wdt:P297 "${cc}" . }`;
const query = (qid, min) => `
SELECT ?c (SAMPLE(?ar0) AS ?ar) (SAMPLE(?en0) AS ?en) (SAMPLE(?co) AS ?coord) (MAX(?p) AS ?pop) WHERE {
  hint:Query hint:optimizer "None" .
  {
    { VALUES ?t { wd:Q515 wd:Q1549591 wd:Q5119 wd:Q1637706 wd:Q200250 wd:Q3957 wd:Q7930989 wd:Q494721 wd:Q1093829 } }
    UNION { ?t wdt:P279 wd:Q515 . } UNION { ?t wdt:P279 wd:Q3957 . }
    ?c wdt:P31 ?t .
    ?c wdt:P17 wd:${qid} .
    ?c wdt:P1082 ?p .
    FILTER(?p >= ${min})
  } UNION { wd:${qid} wdt:P36 ?c . OPTIONAL { ?c wdt:P1082 ?p . } }
  ?c wdt:P625 ?co .
  OPTIONAL { ?c rdfs:label ?ar0 . FILTER(LANG(?ar0) = "ar") }
  OPTIONAL { ?c rdfs:label ?en0 . FILTER(LANG(?en0) = "en") }
} GROUP BY ?c ORDER BY DESC(?pop) LIMIT 120`;

async function sparql(q) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch("https://query.wikidata.org/sparql", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json", "User-Agent": UA },
        body: `query=${encodeURIComponent(q)}`,
        signal: AbortSignal.timeout(90_000),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(String(res.status));
      if (!res.ok) return null;
      return (await res.json()).results.bindings;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
      if (i === 2) console.warn("  failed:", e.message);
    }
  }
  return null;
}

const r3 = (n) => Math.round(n * 1000) / 1000;
let total = 0;
for (const cc of only.length ? only : codes) {
  const k = await sparql(qidOf(cc));
  const qid = (k?.[0]?.k?.value.match(/Q\d+$/) ?? [])[0];
  if (!qid) { console.log(cc, "— no country item"); continue; }
  let rows = await sparql(query(qid, 20000));
  if (rows && rows.length < 8) rows = (await sparql(query(qid, 2000))) ?? rows;
  if (!rows) { console.log(cc, "— no answer, kept old file"); continue; }
  const out = [];
  const seen = new Set();
  for (const b of rows) {
    const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord?.value ?? "");
    const q = Number((b.c.value.match(/Q(\d+)$/) ?? [])[1]);
    const en = b.en?.value ?? "";
    if (!m || !q || !en || seen.has(q)) continue;
    seen.add(q);
    out.push([q, b.ar?.value ?? "", en, r3(Number(m[2])), r3(Number(m[1])), Number(b.pop?.value ?? 0)]);
  }
  fs.writeFileSync(path.join(OUT, `${cc}.json`), JSON.stringify(out));
  total += out.length;
  console.log(cc, out.length, `ar ${out.filter((r) => r[1]).length}`);
  await new Promise((r) => setTimeout(r, 700));
}
console.log("total", total);
