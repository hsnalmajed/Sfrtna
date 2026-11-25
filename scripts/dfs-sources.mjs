// Which booking sites already give us a LIVE price (25 Nov 2026)? For each
// city: the list, then the hotel page of the first HOTELS_PER_CITY hotels;
// tallies every site that priced at least one hotel. DataForSEO only
// (~$0.013 a list + $0.004 a hotel page). No SerpApi.
//   BASE=… SMOKE_TOKEN=… CITIES=Riyadh,Dubai node scripts/dfs-sources.mjs
const BASE = process.env.BASE || "https://sfrtna.almajedhsn.workers.dev";
const headers = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 sfrtna-site-check",
  "x-sfrtna-smoke": process.env.SMOKE_TOKEN || "",
  "x-sfrtna-spend": "1",
  Origin: BASE,
  Referer: `${BASE}/ar/hotel-results`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  Accept: "application/json",
};
const cities = (process.env.CITIES || "Riyadh").split(",");
const per = Number(process.env.HOTELS_PER_CITY || 6);
const checkIn = process.env.CHECK_IN || "2026-12-17";
const checkOut = process.env.CHECK_OUT || "2026-12-20";
const ask = (p) =>
  fetch(`${BASE}/api/hotel-prices?${new URLSearchParams({ checkIn, checkOut, adults: "2", ...p })}`, { headers })
    .then((r) => r.json())
    .catch(() => null);
const all = new Map();
for (const city of cities) {
  const list = (await ask({ q: city }))?.result?.hotels ?? [];
  const seen = new Map();
  for (const h of list.filter((x) => x.token).slice(0, per)) {
    const page = (await ask({ q: `${h.name} ${city}`, token: h.token }))?.result?.hotels?.[0];
    for (const o of page?.offers ?? []) {
      if (!(o.perNight || o.total)) continue;
      seen.set(o.source, (seen.get(o.source) ?? 0) + 1);
      all.set(o.source, (all.get(o.source) ?? new Set()).add(city));
    }
  }
  console.log(`CHECK ${city}: list ${list.length} hotels, ${per} pages, ${seen.size} sites: ${[...seen].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}(${n})`).join(", ")}`);
}
console.log(`CHECK ALL ${all.size} sites: ${[...all].sort((a, b) => b[1].size - a[1].size).map(([s, c]) => `${s}[${c.size}]`).join(", ")}`);
