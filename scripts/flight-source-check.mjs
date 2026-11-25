// Live check of the flight price sources (25 Nov 2026): a few routes on
// production, spending on purpose (x-sfrtna-spend: 1). Prints which source
// answered, counts, cheapest fares and airlines only — never a key.
//   BASE=https://sfrtna.almajedhsn.workers.dev SMOKE_TOKEN=… node scripts/flight-source-check.mjs
// ROUTES = "RUH-IST,DMM-CMB" ; DEPART / RETURN = YYYY-MM-DD (RETURN "" = one way).
const BASE = process.env.BASE || "https://sfrtna.almajedhsn.workers.dev";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 sfrtna-site-check";
const headers = {
  "User-Agent": UA,
  "x-sfrtna-smoke": process.env.SMOKE_TOKEN || "",
  "x-sfrtna-spend": "1",
  Origin: BASE,
  Referer: `${BASE}/ar/flights`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  Accept: "application/json",
};
const routes = (process.env.ROUTES || "RUH-IST,DMM-CMB").split(",").map((s) => s.trim()).filter(Boolean);
const departDate = process.env.DEPART || "2026-12-17";
const returnDate = process.env.RETURN ?? "2026-12-24";
for (const r of routes) {
  const [origin, destination] = r.split("-");
  const p = { origin, destination, departDate, adults: "2", children: "1", currency: "SAR", locale: "ar" };
  if (returnDate) p.returnDate = returnDate;
  if (process.env.PROBE) p.probe = process.env.PROBE;
  const res = await fetch(`${BASE}/api/flight-fallback?${new URLSearchParams(p)}`, { headers })
    .then(async (x) => ({ status: x.status, body: x.status === 204 ? null : await x.json().catch(() => null) }))
    .catch((e) => ({ status: 0, body: { error: String(e) } }));
  const b = res.body;
  if (process.env.PROBE) {
    console.log(`CHECK ${r} probe=${process.env.PROBE}: http ${res.status} form=${b?.form} keys=${(b?.keys ?? []).join(",")}`);
    for (const e of b?.errors ?? []) console.log(`CHECK   error ${e}`);
    console.log(`CHECK   outline ${b?.outline ?? ""}`);
    continue;
  }
  const flights = b?.flights ?? [];
  const airlines = [...new Set(flights.flatMap((f) => f.legs.map((l) => l.airline)))];
  const cheapest = flights.slice().sort((a, c) => a.price - c.price)[0];
  console.log(`CHECK ${r} ${departDate}→${returnDate || "one-way"} 2ad+1ch: http ${res.status} via=${b?.check?.via ?? "-"} sdOn=${b?.check?.sdOn ?? "-"} err=${b?.check?.sdError || "-"} options=${flights.length} cheapest=${cheapest?.price ?? "-"} ${b?.currency ?? ""}`);
  console.log(`CHECK   airlines (${airlines.length}): ${airlines.join(", ")}`);
  for (const f of flights.slice(0, 6)) console.log(`CHECK   ${f.price} | stops ${f.stops} | ${Math.round(f.minutes / 60)} h | ${f.legs.map((l) => `${l.airline} ${l.flightNumber} ${l.depCode}-${l.arrCode} ${l.depTime}`).join(" / ")}${f.best ? " | best" : ""}`);
}
