// Live check of sfrtna.com: the searches a visitor makes, asked the way the
// pages ask them. Runs on GitHub Actions after every deploy and every six
// hours (.github/workflows/smoke.yml); a failure emails the repository owner.
//
//   node scripts/smoke.mjs [https://sfrtna.com]
//
// Written after 7 Oct 2026, when «اقترح لي وجهة» and multi-city answered
// "no results" for every visitor because the API guard refused their
// requests — a whole feature down, and nothing told anyone.

const BASE = (process.argv[2] || "https://sfrtna.com").replace(/\/$/, "");
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 SfrtnaSmoke/1";

const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const depart = day(45);
const back = day(52);

/** Headers a page of ours sends with its own fetch(). */
const fromPage = (path) => ({
  "User-Agent": UA,
  Origin: BASE,
  Referer: `${BASE}${path}`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  Accept: "application/json",
});

const failures = [];
const passes = [];

async function check(name, fn) {
  const t = Date.now();
  try {
    const note = await fn();
    passes.push(`✓ ${name} (${Date.now() - t} ms)${note ? ` — ${note}` : ""}`);
  } catch (err) {
    failures.push(`✗ ${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function api(path, { method = "GET", body, page = "/ar" } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...fromPage(page), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 120)}`);
  return json;
}

async function page(path, mustNotContain = []) {
  const res = await fetch(`${BASE}${path}`, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(60_000) });
  const html = await res.text();
  if (res.status !== 200) throw new Error(`${path} → ${res.status}`);
  for (const bad of mustNotContain) if (html.includes(bad)) throw new Error(`${path} shows «${bad}»`);
  return `${Math.round(html.length / 1024)} KB`;
}

const discoverBody = (extra) => ({
  origin: "RUH",
  tripType: "flight",
  budgetTotal: 20000,
  currency: "SAR",
  departDate: depart,
  returnDate: back,
  nights: 7,
  adults: 2,
  childrenAges: [],
  infants: 0,
  multiDestination: false,
  stops: 2,
  oneWayOnly: false,
  ...extra,
});

await check("home page", () => page("/ar"));
await check("destinations page", () => page("/ar/attractions"));
await check("country page (Türkiye)", () => page("/ar/attractions/TR"));
await check("city page (London) has its places", () => page("/ar/attractions/GB/london", ["تعذّر جلب أماكن"]));
await check("seasons page", () => page("/ar/seasons"));
await check("visa page", () => page("/ar/visa"));

await check("suggest a destination — round trip", async () => {
  const j = await api("/api/discover", { method: "POST", body: discoverBody(), page: "/ar/discover-results" });
  const n = (j?.suggestions?.length ?? 0) + (j?.unpriced?.length ?? 0);
  if (j?.mode !== "single" || n === 0) throw new Error(`no destinations at all (mode=${j?.mode})`);
  return `${j.suggestions.length} priced, ${j.unpriced.length} in season`;
});
await check("suggest a destination — one way", async () => {
  const j = await api("/api/discover", { method: "POST", body: discoverBody({ returnDate: "", oneWayOnly: true }), page: "/ar/discover-results" });
  const n = (j?.suggestions?.length ?? 0) + (j?.unpriced?.length ?? 0);
  if (n === 0) throw new Error("no destinations at all");
  return `${n} destinations`;
});
await check("suggest a destination — flight + hotel", async () => {
  const j = await api("/api/discover", { method: "POST", body: discoverBody({ tripType: "both" }), page: "/ar/discover-results" });
  const n = (j?.suggestions?.length ?? 0) + (j?.unpriced?.length ?? 0);
  if (n === 0) throw new Error("no destinations at all");
  return `${n} destinations`;
});
await check("suggest a route (several countries)", async () => {
  const j = await api("/api/discover", { method: "POST", body: discoverBody({ multiDestination: true }), page: "/ar/discover-results" });
  if (j?.mode !== "routes" || !Array.isArray(j.routes)) throw new Error("no routes answer");
  return `${j.routes.length} routes`;
});
await check("multi-city flights", async () => {
  const j = await api("/api/multicity", {
    method: "POST",
    page: "/ar/multicity-results",
    body: {
      legs: [
        { origin: "RUH", destination: "IST", date: depart },
        { origin: "IST", destination: "CDG", date: day(49) },
        { origin: "CDG", destination: "RUH", date: back },
      ],
      adults: 2,
      childrenAges: [],
      infants: 0,
      budgetTotal: 20000,
      currency: "SAR",
    },
  });
  if (!Array.isArray(j?.legs) || j.legs.length !== 3) throw new Error("legs missing");
  return "3 legs";
});
await check("calendar fares", () => api(`/api/day-fares?origin=RUH&destination=IST&month=${depart.slice(0, 7)}&currency=SAR`).then(() => ""));
await check("exchange rate", async () => {
  const j = await api("/api/rates?from=SAR&to=TRY");
  if (!(j?.rate > 0)) throw new Error("no rate");
  return `1 SAR = ${j.rate.toFixed(2)} TRY`;
});
await check("hotel name suggestions", async () => {
  const j = await api("/api/hotel-suggest?q=hilton", { page: "/ar" });
  if (!j?.items?.length) throw new Error("no hotel names");
  return `${j.items.length} names`;
});
await check("country places", async () => {
  const j = await api("/api/country-places?code=TR&locale=ar", { page: "/ar/attractions/TR" });
  if (!j?.places?.length) throw new Error("no places");
  return `${j.places.length} places`;
});

// The protection must still hold.
await check("protection: API refuses a script", async () => {
  const res = await fetch(`${BASE}/api/rates?from=SAR&to=USD`, { headers: { "User-Agent": UA } });
  if (res.status !== 403) throw new Error(`expected 403, got ${res.status}`);
});
await check("protection: stored places are not downloadable", async () => {
  const res = await fetch(`${BASE}/data/places/london.json`, { headers: { "User-Agent": UA } });
  if (res.status !== 404) throw new Error(`expected 404, got ${res.status}`);
});

console.log(passes.join("\n"));
if (failures.length) {
  console.error("\n" + failures.join("\n"));
  process.exit(1);
}
console.log(`\nAll ${passes.length} checks passed.`);
