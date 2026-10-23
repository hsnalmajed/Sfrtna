// Every button on the main pages, tapped on an emulated phone (touch, phone
// size, phone browser) — and whether the tap did anything.
//
//   SMOKE_TOKEN=… node scripts/mobile-taps.mjs [https://sfrtna.almajedhsn.workers.dev]
//
// Written 13 Oct 2026: the owner found "many buttons don't work" on his
// phone's browser. A button counts as working when the tap changes the page
// (anything in the DOM), the address, opens a tab or starts a download.
// "Covered" = something else sits on top of it (the tap would hit that).
// Page errors (uncaught exceptions) are listed per page.

import { chromium, devices } from "playwright";

const BASE = (process.argv[2] || "https://sfrtna.almajedhsn.workers.dev").replace(/\/$/, "");
const HOST = new URL(BASE).host;
const TOKEN = process.env.SMOKE_TOKEN || "";
const day = (o) => new Date(Date.now() + o * 86_400_000).toISOString().slice(0, 10);

const PAGES = [
  "/ar",
  "/ar/attractions",
  "/ar/attractions/TR",
  "/ar/attractions/TR/istanbul",
  "/ar/seasons",
  "/ar/visa",
  "/ar/visa/TR",
  "/ar/currency",
  "/ar/services",
  "/ar/services?code=TR&city=istanbul",
  "/ar/itinerary",
  "/ar/account",
  `/ar/results?${new URLSearchParams({ tripType: "flight", tripRoute: "oneway", origin: "RUH", destination: "IST", departDate: day(40), returnDate: "", adults: "1", childrenAges: "", infants: "0", budget: "0", currency: "SAR", directOnly: "false", baggageIncluded: "false", nights: "0" })}`,
  `/ar/hotel-results?${new URLSearchParams({ hmode: "discover", checkIn: day(40), checkOut: day(44), adults: "2", childrenAges: "", infants: "0", city: "Istanbul", label: "إسطنبول", budget: "0", currency: "SAR" })}`,
];

const browser = await chromium.launch();
const report = [];

for (const device of ["Pixel 7", "iPhone 13"]) {
  const context = await browser.newContext({ ...devices[device], locale: "ar-SA" });
  // First-visit tips (FirstTips.tsx) sit over the bottom of the page: seen.
  await context.addInitScript(() => {
    try {
      localStorage.setItem("sfr-tips-v1", JSON.stringify(["home", "results", "hotels", "city", "discover", "trip"]));
    } catch {}
  });
  await context.route("**/*", (route) => {
    const req = route.request();
    if (new URL(req.url()).host !== HOST) return route.continue();
    return route.continue({ headers: { ...req.headers(), "x-sfrtna-smoke": TOKEN } });
  });
  for (const path of PAGES) {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));
    const dead = [];
    const covered = [];
    let tapped = 0;
    try {
      await page.goto(BASE + path, { waitUntil: "load", timeout: 60_000 });
      await page.waitForTimeout(2500);
      // Buttons only (links navigate by themselves; their hrefs are checked below).
      const count = await page.locator("button:visible, [role=tab]:visible").count();
      const emptyLinks = await page.$$eval("a", (as) =>
        as.filter((a) => a.offsetParent && (!a.getAttribute("href") || a.getAttribute("href") === "#")).map((a) => (a.innerText || a.getAttribute("aria-label") || "").trim().slice(0, 40))
      );
      for (let i = 0; i < Math.min(count, 30); i++) {
        const loc = page.locator("button:visible, [role=tab]:visible").nth(i);
        let label = "";
        try {
          label = ((await loc.innerText({ timeout: 2000 })) || (await loc.getAttribute("aria-label")) || "").trim().replace(/\s+/g, " ").slice(0, 40);
          if (await loc.isDisabled()) continue;
          await loc.scrollIntoViewIfNeeded({ timeout: 3000 });
          const before = page.url();
          await page.evaluate(() => {
            window.__sfrMut = 0;
            window.__sfrObs?.disconnect();
            window.__sfrObs = new MutationObserver((m) => (window.__sfrMut += m.length));
            window.__sfrObs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
          });
          const popup = page.waitForEvent("popup", { timeout: 1500 }).catch(() => null);
          const download = page.waitForEvent("download", { timeout: 1500 }).catch(() => null);
          await loc.tap({ timeout: 4000 });
          tapped++;
          const [pop, dl] = await Promise.all([popup, download]);
          await page.waitForTimeout(600);
          const mut = await page.evaluate(() => window.__sfrMut || 0).catch(() => 1);
          const moved = page.url() !== before;
          if (pop) await pop.close().catch(() => {});
          if (!moved && !pop && !dl && mut === 0) dead.push(label || `#${i}`);
          // Start every tap from a fresh page: a menu or list the last tap
          // opened would otherwise sit over the next button.
          await page.goto(BASE + path, { waitUntil: "load", timeout: 60_000 });
          await page.waitForTimeout(1500);
        } catch (e) {
          const msg = String(e?.message || e);
          if (/intercepts pointer events/.test(msg)) {
            const line = msg.split("\n").find((l) => /intercepts pointer events/.test(l)) || "";
            covered.push(`${label || `#${i}`} ← ${line.replace(/\s+/g, " ").trim().slice(0, 160)}`);
            await page.goto(BASE + path, { waitUntil: "load", timeout: 60_000 }).catch(() => {});
            await page.waitForTimeout(1500);
          }
        }
      }
      report.push({ device, path, buttons: count, tapped, dead, covered, emptyLinks: emptyLinks.slice(0, 10), errors: [...new Set(errors)].slice(0, 5) });
    } catch (e) {
      report.push({ device, path, failed: String(e?.message || e).split("\n")[0] });
    } finally {
      await page.close();
    }
  }
  await context.close();
}
await browser.close();

for (const r of report) {
  console.log(`\n## ${r.device} ${r.path}`);
  if (r.failed) {
    console.log(`  FAILED: ${r.failed}`);
    continue;
  }
  console.log(`  buttons ${r.buttons}, tapped ${r.tapped}`);
  if (r.dead.length) console.log(`  NO EFFECT: ${r.dead.join(" | ")}`);
  if (r.covered.length) console.log(`  COVERED: ${r.covered.join(" | ")}`);
  if (r.emptyLinks.length) console.log(`  LINKS WITHOUT HREF: ${r.emptyLinks.join(" | ")}`);
  if (r.errors.length) console.log(`  PAGE ERRORS: ${r.errors.join(" | ")}`);
}
