// Does Google's answer for ONE hotel carry room types? (owner, 7 Nov 2026:
// "check before any promise"). Two searches on the given Worker: a city
// list for a hotel id, then that hotel afresh with `probe=1` — the answer
// lists the field names that mention rooms (no values, no key).
//   BASE=https://sfrtna-staging.almajedhsn.workers.dev SMOKE_TOKEN=… node scripts/hotel-probe.mjs
const BASE = process.env.BASE || "https://sfrtna-staging.almajedhsn.workers.dev";
// The guard lets only our own pages call the API: send what a page sends (as smoke.mjs does).
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 sfrtna-site-check";
const pageHeaders = (base, path) => ({
  "User-Agent": UA,
  "x-sfrtna-smoke": process.env.SMOKE_TOKEN || "",
  Origin: base,
  Referer: `${base}${path}`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  Accept: "application/json",
});
const headers = pageHeaders(BASE, "/ar/hotel-results");
const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const dates = { checkIn: day(30), checkOut: day(33), adults: "2" };
for (const city of (process.env.CITIES || "Dubai, United Arab Emirates|Istanbul, Turkey").split("|")) {
  const list = await fetch(`${BASE}/api/hotel-prices?${new URLSearchParams({ q: city, ...dates })}`, { headers }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
  const hotels = list?.result?.hotels ?? [];
  const h = hotels.find((x) => x.token);
  if (list?.error) console.log(`PROBE ${city}: error ${JSON.stringify(list).slice(0, 200)}`);
  console.log(`PROBE ${city}: list ${hotels.length} hotels; ids ${hotels.filter((x) => x.token).length}; offers on first ${h?.offers?.length ?? 0}`);
  if (!h) continue;
  const one = await fetch(`${BASE}/api/hotel-prices?${new URLSearchParams({ q: `${h.name} ${city}`, token: h.token, probe: "1", ...dates })}`, { headers }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
  const r = one?.result;
  const x = r?.hotels?.[0];
  console.log(`PROBE ${h.name}: kind ${r?.kind}; offers ${x?.offers?.length ?? 0}; images ${x?.images?.length ?? 0}; rooms ${x?.rooms?.length ?? 0}`);
  for (const line of r?.shape ?? ["no shape (token not accepted?)"]) console.log(`PROBE   ${line}`);
  for (const room of (x?.rooms ?? []).slice(0, 6)) console.log(`PROBE   room: ${room.source} | ${room.name} | guests ${room.guests} | photo ${room.image ? "yes" : "no"} | total ${room.total}`);
}

// The allowance and how much hotels/flights used it (production): for the
// owner's SerpApi plan decision.
const PROD = process.env.PROD || "https://sfrtna.almajedhsn.workers.dev";
const ph = pageHeaders(PROD, "/ar");
const status = await fetch(`${PROD}/api/serp-status`, { headers: ph }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
console.log(`PLAN serp-status ${JSON.stringify(status)}`);
for (const days of [7, 30]) {
  const sum = await fetch(`${PROD}/api/stats/summary?days=${days}`, { headers: ph }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
  const flat = [];
  const walk = (v, p) => {
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, p ? `${p}.${k}` : k);
    else if (/serp|hotel|search|visit|view|session|ext|users/i.test(p)) flat.push(`${p}=${v}`);
  };
  walk(sum.current ?? sum, "");
  console.log(`PLAN summary ${days}d: ${flat.slice(0, 80).join(" | ")}`);
}
