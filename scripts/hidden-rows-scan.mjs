// Phone-width scan for content hidden off the side of a row (owner, 22 Oct).
// Opens each page (site + app UA) and every tab on it, and lists any row
// whose items run past its edge without a visible ScrollRow arrow.
// Run against a local build: npx wrangler dev --port 8787, then
//   node scripts/hidden-rows-scan.mjs   (needs Playwright; prints "done" when clean)

import { chromium, devices } from "playwright";
const B = "http://localhost:8787";
const pages = ["/ar","/ar/attractions","/ar/attractions/TR","/ar/attractions/TR/istanbul","/ar/maps","/ar/maps/TR","/ar/seasons","/ar/visa","/ar/visa/TR","/ar/currency","/ar/services","/ar/budget","/ar/itinerary","/ar/account","/ar/about",
 "/ar/results?origin=RUH&destination=IST&departDate=2026-12-10&returnDate=2026-12-17&adults=2&tripType=flight",
 "/ar/hotel-results?city=istanbul&checkIn=2026-12-10&checkOut=2026-12-17&adults=2",
 "/ar/discover-results?origin=RUH&departDate=2026-12-10&returnDate=2026-12-17&adults=2&budgetTotal=20000&tripType=flight",
 "/en","/en/attractions/TR/istanbul"];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
for (const app of [false, true]) for (const path of pages) {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], userAgent: devices["Pixel 7"].userAgent + (app ? " SfrtnaApp/Android" : "") });
  await ctx.addInitScript(() => { try { localStorage.setItem("sfr-welcome-v1","1"); localStorage.setItem("sfrtna-consent-v1","denied"); } catch {} });
  const page = await ctx.newPage();
  try { await page.goto(B + path, { waitUntil: "load", timeout: 90000 }); } catch { console.log("LOADFAIL", path); await ctx.close(); continue; }
  await page.waitForTimeout(2500);
  const scanOnce = () => page.evaluate(() => {
    const out = [];
    const vw = document.documentElement.clientWidth;
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest("iframe,svg,canvas,.leaflet-container,[data-marquee],.marquee")) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 16) continue;
      const ox = cs.overflowX;
      const hidden = el.scrollWidth - el.clientWidth > 8;
      if (!hidden) continue;
      if (!["auto","scroll","hidden","clip"].includes(ox)) continue;
      // text truncation with ellipsis on a single line is fine
      if (cs.textOverflow === "ellipsis") continue;
      // only rows with several interactive children
      const kids = el.querySelectorAll("a,button,[role=tab],label,input").length;
      if (kids < 2) continue;
      const isRow = el.classList.contains("rail");
      const hint = isRow && [...el.parentElement.querySelectorAll(":scope > button")].some((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && getComputedStyle(b).display !== "none"; });
      out.push({ ox, hint: !!hint, rail: isRow, sw: el.scrollWidth, cw: el.clientWidth, kids, text: (el.innerText || "").replace(/\s+/g, " ").slice(0, 70), cls: String(el.className).slice(0, 90) });
    }
    // whole page wider than screen
    if (document.documentElement.scrollWidth > vw + 2) out.push({ page: "WIDE", sw: document.documentElement.scrollWidth, vw });
    return out;
  });
  const seen = new Set();
  const report = (found, where) => { for (const f of found) { const k = where + f.text + f.cls; if (!f.hint && !seen.has(k)) { seen.add(k); console.log(app ? "APP" : "WEB", path.split("?")[0], where, JSON.stringify(f)); } } };
  report(await scanOnce(), "");
  // open every tab / toggle on the page and scan again
  const tabs = page.locator('[role=tab], .rail > button, .rail button[aria-pressed]');
  const n = Math.min(await tabs.count(), 12);
  for (let i = 0; i < n; i++) {
    const t = tabs.nth(i);
    const label = ((await t.innerText().catch(() => "")) || "").replace(/\s+/g, " ").slice(0, 25);
    try { await t.click({ timeout: 4000 }); await page.waitForTimeout(1500); report(await scanOnce(), "[tab " + label + "]"); } catch {}
  }
  await ctx.close();
}
await browser.close();
console.log("done");
