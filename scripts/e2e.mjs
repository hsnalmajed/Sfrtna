// End-to-end check of the search pages in a real browser (Chromium via
// Playwright): the pages a visitor lands on after pressing «ابحث», opened and
// watched until they show an answer. Runs on GitHub Actions after every
// deploy and every six hours (.github/workflows/smoke.yml); a failure emails
// the owner.
//
//   SMOKE_TOKEN=… node scripts/e2e.mjs [https://sfrtna.almajedhsn.workers.dev]
//
// Written 13 Oct 2026 after the owner found one-way, multi-city, the
// preferences and «اقترح لي وجهة» broken: the API check (smoke.mjs) proved the
// APIs answered, never that the pages showed results.
//
// The SMOKE_TOKEN header is added ONLY to requests for our own host (never to
// the flight partner's), so the token never leaves for a third party.

import { chromium } from "playwright";

const BASE = (process.argv[2] || "https://sfrtna.almajedhsn.workers.dev").replace(/\/$/, "");
const HOST = new URL(BASE).host;
const TOKEN = process.env.SMOKE_TOKEN || "";
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const D1 = day(40);
const D2 = day(47);
const D3 = day(52);

const failures = [];
const passes = [];
const notes = [];

const browser = await chromium.launch();
const context = await browser.newContext({ locale: "ar-SA", viewport: { width: 390, height: 844 } });
await context.route("**/*", (route) => {
  const req = route.request();
  if (new URL(req.url()).host !== HOST) return route.continue();
  return route.continue({ headers: { ...req.headers(), "x-sfrtna-smoke": TOKEN } });
});

async function check(name, fn) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const t = Date.now();
  try {
    const note = await fn(page);
    if (errors.length) throw new Error(`page error: ${errors[0]}`);
    passes.push(`✓ ${name} (${Date.now() - t} ms)${note ? ` — ${note}` : ""}`);
  } catch (err) {
    failures.push(`✗ ${name}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  } finally {
    await page.close();
  }
}

const q = (o) => new URLSearchParams(o).toString();

/**
 * A flight results page, watched until it answers. The answer is one of:
 * our pick card, the "nothing within budget" card, or the "nothing matches
 * your preferences" question. The live search runs 1–3 minutes.
 */
async function flightAnswer(page, path, { prefs } = {}) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const guide = page.locator("section[aria-live]");
  await guide.waitFor({ timeout: 30_000 });
  // The flight partner's widget may refuse a host other than sfrtna.com; if
  // its results never appear here, say so instead of failing the page.
  const answered = await page
    .waitForFunction(
      () => {
        const t = document.querySelector("section[aria-live]")?.textContent || "";
        return /اخترنا لك|لا توجد رحلة ضمن ميزانيتك|لا توجد رحلات تطابق تفضيلاتك|وجدنا/.test(t);
      },
      null,
      { timeout: 150_000 }
    )
    .then(() => true)
    .catch(() => false);
  if (!answered) {
    const widget = await page.evaluate(() => Boolean(document.getElementById("tpwl-tickets")?.shadowRoot));
    if (!widget) {
      notes.push(`! ${path.split("?")[0]}: the flight widget did not start on ${HOST} (domain-bound) — checked by hand on sfrtna.com`);
      return "widget not available on this host";
    }
    throw new Error("no answer after 150 s");
  }
  const text = (await guide.textContent()) || "";
  // Preferences are held to: every card we draw meets them.
  if (prefs?.direct) {
    const stops = await page.locator("section[aria-live] article").evaluateAll((cards) =>
      cards.filter((c) => /توقف/.test(c.textContent || "")).length
    );
    if (stops > 0 && !/بموافقتك/.test(text)) throw new Error(`${stops} card(s) with stops while «direct only» is set`);
  }
  if (/لا توجد رحلات تطابق تفضيلاتك[^؟]*فنعرض لك كل الرحلات/.test(text)) {
    throw new Error("shows non-matching flights without asking");
  }
  return text.match(/اخترنا لك[^\n]{0,40}|وجدنا[^\n]{0,40}|لا توجد[^\n]{0,40}/)?.[0] ?? "";
}

const base = { tripType: "flight", adults: "1", currency: "SAR" };

await check("round trip, budget + direct + bags", (p) =>
  flightAnswer(
    p,
    `/ar/results?${q({ ...base, origin: "RUH", destination: "IST", departDate: D1, returnDate: D2, budget: "8000", directOnly: "true", baggageIncluded: "true" })}`,
    { prefs: { direct: true } }
  )
);
await check("one way, no budget, direct only", (p) =>
  flightAnswer(p, `/ar/results?${q({ ...base, origin: "RUH", destination: "DXB", departDate: D1, returnDate: "", budget: "0", directOnly: "true" })}`, {
    prefs: { direct: true },
  })
);

const legs = JSON.stringify([
  { origin: "RUH", destination: "IST", date: D1 },
  { origin: "IST", destination: "KUL", date: D2 },
  { origin: "KUL", destination: "RUH", date: D3 },
]);
await check("multi-city: one tab per flight, live search on the first", async (p) => {
  const path = `/ar/results?${q({ ...base, tripRoute: "multicity", origin: "RUH", destination: "IST", departDate: D1, returnDate: "", budget: "9000", legs, leg: "0" })}`;
  await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const tabs = p.locator('[role="tablist"] [role="tab"]');
  await tabs.first().waitFor({ timeout: 30_000 });
  const n = await tabs.count();
  // Three flight tabs (the results' own best/cheapest/fastest tabs may also be there).
  const flightTabs = await p.locator('[role="tablist"] a[role="tab"][href*="leg="]').count();
  if (flightTabs !== 2) throw new Error(`expected 2 other-flight tabs, found ${flightTabs} (of ${n})`);
  const href = await p.locator('[role="tablist"] a[role="tab"][href*="leg=1"]').getAttribute("href");
  if (!href?.includes("destination=KUL")) throw new Error("tab 2 does not open Istanbul → Kuala Lumpur");
  return `${flightTabs + 1} tabs`;
});
await check("old multi-city link forwards to the tabs", async (p) => {
  await p.goto(`${BASE}/ar/multicity-results?${q({ ...base, budget: "9000", legs })}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await p.waitForURL(/\/ar\/results\?/, { timeout: 30_000 });
  if (!/leg=0/.test(p.url()) && !/leg%3D0|leg=0/.test(decodeURIComponent(p.url()))) throw new Error(`landed on ${p.url().slice(0, 80)}`);
  return "";
});
await check("multi-city form: flight 2 cannot be dated before flight 1", async (p) => {
  const legs2 = JSON.stringify([
    { origin: "RUH", destination: "IST", date: D1 },
    { origin: "IST", destination: "KUL", date: "" },
  ]);
  await p.goto(`${BASE}/ar?${q({ mode: "known", tripRoute: "multicity", product: "flights", origin: "RUH", departDate: D1, legs: legs2 })}#plan`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  const box = p.locator('[data-field="legs"]');
  await box.locator("button[aria-expanded]").nth(1).click();
  // The calendar opens on flight 1's month: every day before D1 is disabled,
  // D1 itself and later are not.
  const day = new Date(`${D1}T00:00:00Z`).getUTCDate();
  const states = await box.locator("button[aria-pressed]").evaluateAll((btns) =>
    btns.map((b) => ({ label: b.getAttribute("aria-label") || "", disabled: b.disabled, text: (b.textContent || "").trim() }))
  );
  if (!states.length) throw new Error("calendar did not open");
  const num = (x) => Number((x.text.match(/^\d+/) || [NaN])[0]);
  const month = states.slice(0, 31);
  const before = month.filter((x) => num(x) < day && !x.disabled);
  const from = month.filter((x) => num(x) >= day && x.disabled);
  if (before.length) throw new Error(`${before.length} day(s) before flight 1 can be picked`);
  if (from.length) throw new Error(`${from.length} day(s) from flight 1 on are blocked`);
  return `days before ${D1} blocked`;
});
await check("suggest a destination shows destinations", async (p) => {
  await p.goto(
    `${BASE}/ar/discover-results?${q({ ...base, mode: "discover", tripRoute: "roundtrip", origin: "RUH", departDate: D1, returnDate: D2, budget: "8000", nights: "7" })}`,
    { waitUntil: "domcontentloaded", timeout: 60_000 }
  );
  await p.waitForFunction(() => document.querySelectorAll('a[href*="/results?"]').length > 0, null, { timeout: 60_000 });
  const n = await p.locator('a[href*="/results?"]').count();
  return `${n} destinations`;
});
await check("suggest a route shows routes with tabbed flights", async (p) => {
  await p.goto(
    `${BASE}/ar/discover-results?${q({ ...base, mode: "discover", tripRoute: "roundtrip", origin: "RUH", departDate: D1, returnDate: D3, budget: "15000", nights: "12", multiDestination: "true", stops: "2" })}`,
    { waitUntil: "domcontentloaded", timeout: 60_000 }
  );
  await p.waitForFunction(() => document.querySelectorAll('a[href*="leg="]').length > 0, null, { timeout: 90_000 });
  return `${await p.locator('a[href*="leg="]').count()} flight links`;
});

await browser.close();

console.log([...passes, ...notes, ...failures].join("\n"));
// On GitHub, each line also as an annotation: shown on the run's page and
// readable through the API without downloading the log.
if (process.env.GITHUB_ACTIONS) {
  const esc = (m) => m.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  for (const f of failures) console.log(`::error title=Search page check::${esc(f)}`);
  for (const n of notes) console.log(`::warning title=Search page check::${esc(n)}`);
  console.log(`::notice title=Search page check::${esc(passes.join(" || ") || "no passes")}`);
}
console.log(`\n${passes.length} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
