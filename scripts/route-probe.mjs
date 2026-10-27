// Times "suggest a route (several countries)" on the live Worker for a fixed
// set of searches, so a change can be compared before/after.
//   SMOKE_TOKEN=… node scripts/route-probe.mjs > report.txt
const BASE = (process.argv[2] || "https://sfrtna.almajedhsn.workers.dev").replace(/\/$/, "");
const TOKEN = process.env.SMOKE_TOKEN || "";
const headers = {
  "User-Agent": "Mozilla/5.0 SfrtnaSmoke/1",
  "x-sfrtna-smoke": TOKEN,
  Origin: BASE,
  Referer: `${BASE}/ar/discover-results`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  Accept: "application/json",
  "Content-Type": "application/json",
};
const body = (extra) => ({
  origin: "RUH", tripType: "flight", budgetTotal: 80000, currency: "SAR",
  departDate: "2027-01-02", returnDate: "2027-01-15", nights: 13,
  adults: 6, childrenAges: [], infants: 0, multiDestination: true, stops: 2, oneWayOnly: false,
  ...extra,
});
const cases = [
  ["all, 2 stops", {}],
  ["all, 3 stops", { stops: 3 }],
  ["Europe, 2 stops", { continents: ["europe"] }],
  ["Europe, 3 stops", { continents: ["europe"], stops: 3 }],
  ["Asia, 2 stops", { continents: ["asia"] }],
  ["Africa, 3 stops", { continents: ["africa"], stops: 3 }],
  ["North America, 2 stops", { continents: ["northAmerica"] }],
  ["two months (Jan→Feb), 3 stops", { departDate: "2027-01-25", returnDate: "2027-02-10", nights: 16, stops: 3 }],
];
console.log(`route probe ${new Date().toISOString()} ${BASE}`);
for (const pass of ["first", "repeat"]) {
  for (const [name, extra] of cases) {
    const t = Date.now();
    try {
      const res = await fetch(`${BASE}/api/discover`, { method: "POST", headers, body: JSON.stringify(body(extra)), signal: AbortSignal.timeout(90_000) });
      const j = await res.json().catch(() => null);
      const routes = j?.routes ?? [];
      const within = routes.filter((r) => r.withinBudget).length;
      const countries = new Set(routes.flatMap((r) => r.stops.map((s) => s.code))).size;
      console.log(`${pass}\t${name}\t${res.status}\t${Date.now() - t} ms\t${routes.length} routes\t${within} within\t${countries} cities\t${j?.stats ? JSON.stringify(j.stats) : ""}`);
    } catch (e) {
      console.log(`${pass}\t${name}\tERR\t${Date.now() - t} ms\t${e.message}`);
    }
  }
}
