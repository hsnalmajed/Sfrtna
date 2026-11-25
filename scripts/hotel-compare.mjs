// Before / after for the owner (25 Nov 2026): the same city and dates asked
// at the same moment from the old source (SerpApi, forced by probe=1) and
// the new one (DataForSEO). Prints hotel counts, then hotels found by BOTH
// with each source's price and number of sites, list and hotel page.
// Spends on purpose: ~2 SerpApi searches + a few DataForSEO calls per city.
//   BASE=… SMOKE_TOKEN=… CITIES=Madinah node scripts/hotel-compare.mjs
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
const cities = (process.env.CITIES || "Madinah").split(",");
const checkIn = process.env.CHECK_IN || "2026-12-17";
const checkOut = process.env.CHECK_OUT || "2026-12-20";
const ask = (p) =>
  fetch(`${BASE}/api/hotel-prices?${new URLSearchParams({ checkIn, checkOut, adults: "2", ...p })}`, { headers })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))
    .catch((e) => ({ status: 0, body: { error: String(e) } }));
const key = (n) => (n || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const priced = (h) => (h?.offers ?? []).filter((o) => o.perNight || o.total);

for (const city of cities) {
  console.log(`CHECK ===== ${city} ${checkIn}→${checkOut}, 2 adults =====`);
  const neu = await ask({ q: city });
  const old = await ask({ q: city, probe: "1" });
  const nl = neu.body?.result?.hotels ?? [];
  const ol = old.body?.result?.hotels ?? [];
  console.log(`CHECK NEW list: via=${neu.body?.check?.via} hotels=${nl.length} more=${neu.body?.result?.nextPage ? "yes" : "no"} total=${neu.body?.result?.total ?? "-"}`);
  console.log(`CHECK OLD list: via=${old.body?.check?.via} hotels=${ol.length} more=${old.body?.result?.nextPage ? "yes" : "no"} total=${old.body?.result?.total ?? "-"}`);
  const both = nl.filter((h) => ol.some((o) => key(o.name) === key(h.name)));
  console.log(`CHECK in both lists: ${both.length}`);
  for (const h of both.slice(0, 8)) {
    const o = ol.find((x) => key(x.name) === key(h.name));
    console.log(`CHECK   ${h.name} | NEW ${h.perNight ?? "-"} /night, ${priced(h).length} sites | OLD ${o.perNight ?? "-"} /night, ${priced(o).length} sites`);
  }
  // One hotel page from each source (the first hotel found by both).
  const pick = both.find((h) => h.token);
  if (!pick) continue;
  const oPick = ol.find((x) => key(x.name) === key(pick.name));
  const n1 = await ask({ q: `${pick.name} ${city}`, token: pick.token });
  const o1 = await ask({ q: `${pick.name} ${city}`, probe: "1", ...(oPick?.token ? { token: oPick.token } : { one: "1" }) });
  for (const [tag, r] of [["NEW", n1], ["OLD", o1]]) {
    const h = r.body?.result?.hotels?.[0];
    const offers = priced(h).sort((a, b) => (a.perNight ?? 1e9) - (b.perNight ?? 1e9));
    console.log(`CHECK ${tag} hotel page: via=${r.body?.check?.via} name=${h?.name ?? "-"} sites=${offers.length} rooms=${h?.rooms?.length ?? 0} cheapest=${offers[0]?.perNight ?? "-"} ${offers[0]?.source ?? ""}`);
    for (const o of offers.slice(0, 20)) console.log(`CHECK   ${tag} site ${o.source} ${o.perNight ?? "-"} /night${o.official ? " official" : ""}`);
  }
}
