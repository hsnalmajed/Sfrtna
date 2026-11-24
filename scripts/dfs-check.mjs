// Live check of the hotel price source (24 Nov 2026): one city list and that
// list's first hotel with every site's price, on production, spending on
// purpose (x-sfrtna-spend: 1). Prints counts, names and prices only — never
// a key. CITIES / DATES can be overridden by env.
//   BASE=https://sfrtna.almajedhsn.workers.dev SMOKE_TOKEN=… node scripts/dfs-check.mjs
const BASE = process.env.BASE || "https://sfrtna.almajedhsn.workers.dev";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 sfrtna-site-check";
const headers = {
  "User-Agent": UA,
  "x-sfrtna-smoke": process.env.SMOKE_TOKEN || "",
  "x-sfrtna-spend": "1",
  Origin: BASE,
  Referer: `${BASE}/ar/hotel-results`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  Accept: "application/json",
};
const cities = (process.env.CITIES || "Istanbul,Riyadh").split(",");
const checkIn = process.env.CHECK_IN || "2026-12-17";
const checkOut = process.env.CHECK_OUT || "2026-12-20";
const ask = (p) =>
  fetch(`${BASE}/api/hotel-prices?${new URLSearchParams({ checkIn, checkOut, adults: "2", ...p })}`, { headers })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))
    .catch((e) => ({ status: 0, body: { error: String(e) } }));
for (const city of cities) {
  const list = await ask({ q: city });
  const r = list.body?.result;
  console.log(`CHECK ${city} list: http ${list.status} via=${list.body?.check?.via} dfsOn=${list.body?.check?.dfsOn} err=${list.body?.check?.dfsError || "-"} hotels=${r?.hotels?.length ?? 0} more=${r?.nextPage ?? "-"} currency=${r?.currency ?? "-"}`);
  for (const h of (r?.hotels ?? []).slice(0, 5)) console.log(`CHECK   ${h.name} | ${h.stars ?? "-"}★ | ${h.rating ?? "-"} (${h.reviews ?? 0}) | ${h.perNight ?? "-"} /night | photos ${h.images?.length ?? 0} | sites ${h.offers?.length ?? 0}`);
  const first = (r?.hotels ?? []).find((h) => h.token);
  if (!first) continue;
  const one = await ask({ q: `${first.name} ${city}`, token: first.token });
  const h = one.body?.result?.hotels?.[0];
  console.log(`CHECK ${city} hotel: http ${one.status} via=${one.body?.check?.via} err=${one.body?.check?.dfsError || "-"} name=${h?.name ?? "-"} sites=${h?.offers?.length ?? 0} rooms=${h?.rooms?.length ?? 0} photos=${h?.images?.length ?? 0} topics=${h?.topics?.length ?? 0} address=${h?.address ? "yes" : "no"}`);
  for (const o of (h?.offers ?? []).slice(0, 12)) console.log(`CHECK   site ${o.source} ${o.perNight} /night link=${o.link ? "yes" : "no"}${o.official ? " official" : ""}`);
}
