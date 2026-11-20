// What does the iPhone app's web view contact on the LIVE site? (Apple
// 5.1.2(i), 2nd rejection 19 Nov 2026: «the app continues to contact
// third-party tracking domains during normal in-app use».)
//
//   SMOKE_TOKEN=… node scripts/ios-prod-audit.mjs [https://sfrtna.com]
//
// Report only (never fails): WebKit with the app's user agent, every page a
// reviewer is likely to open; lists EVERY other host each page contacts
// (any type, pictures too), every cookie left behind (ours included), and
// Set-Cookie headers our own responses send.

import { webkit } from "playwright";

const BASE = (process.argv[2] || "https://sfrtna.com").replace(/\/$/, "");
const HOST = new URL(BASE).host;
const TOKEN = process.env.SMOKE_TOKEN || "";
const day = (o) => new Date(Date.now() + o * 86_400_000).toISOString().slice(0, 10);
const q = (o) => new URLSearchParams(o).toString();
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SfrtnaApp/iOS";

const PAGES = [
  "/ar",
  "/en",
  "/ar/discover",
  "/ar/attractions/TR/istanbul",
  "/ar/attractions/TR",
  "/ar/visa",
  "/ar/my-map",
  "/ar/account",
  "/ar/privacy",
  "/ar/plan",
  `/ar/results?${q({ tripType: "flight", origin: "DXB", destination: "IST", departDate: day(40), returnDate: day(47), adults: "2", currency: "SAR", budget: "0" })}`,
  `/ar/hotel-results?${q({ hmode: "discover", city: "Istanbul", label: "إسطنبول", checkIn: day(40), checkOut: day(44), adults: "2", currency: "SAR" })}`,
];

const ours = (u) => {
  try {
    const h = new URL(u).host;
    return h === HOST || h === "sfrtna.com" || h.endsWith(".sfrtna.com");
  } catch {
    return true;
  }
};

const browser = await webkit.launch();
const context = await browser.newContext({ userAgent: UA, locale: "ar-SA", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await context.route("**/*", (route) => {
  const r = route.request();
  if (new URL(r.url()).host !== HOST) return route.continue();
  return route.continue({ headers: { ...r.headers(), "x-sfrtna-smoke": TOKEN } });
});

const all = new Map(); // host -> Set(types)
const ownSetCookie = new Set();
for (const path of PAGES) {
  const page = await context.newPage();
  const hosts = new Map();
  page.on("request", (r) => {
    if (ours(r.url())) return;
    const h = new URL(r.url()).host;
    const t = r.resourceType();
    (hosts.get(h) || hosts.set(h, new Set()).get(h)).add(t);
    (all.get(h) || all.set(h, new Set()).get(h)).add(t);
  });
  page.on("response", async (res) => {
    if (!ours(res.url())) return;
    try {
      const sc = await res.headerValue("set-cookie");
      if (sc) for (const c of sc.split("\n")) ownSetCookie.add(`${c.split(";")[0].split("=")[0]} (${new URL(res.url()).pathname.slice(0, 40)})`);
    } catch {}
  });
  let err = "";
  try {
    await page.goto(BASE + path, { waitUntil: "load", timeout: 60_000 });
    await page.waitForTimeout(8_000);
    await page.mouse.wheel(0, 5000);
    await page.waitForTimeout(4_000);
  } catch (e) {
    err = ` ERROR ${String(e).split("\n")[0]}`;
  }
  const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.src).filter((s) => s && !s.includes(location.host))).catch(() => []);
  const frames = await page.evaluate(() => [...document.querySelectorAll("iframe")].map((f) => f.src)).catch(() => []);
  const links = await page.evaluate(() => [...document.querySelectorAll("link[rel=preconnect],link[rel=dns-prefetch],link[rel=preload]")].map((l) => `${l.rel} ${l.href}`).filter((s) => !s.includes(location.host))).catch(() => []);
  console.log(`\n== ${path.slice(0, 60)}${err}`);
  for (const [h, t] of hosts) console.log(`   ${h}  [${[...t].join(",")}]`);
  if (scripts.length) console.log(`   SCRIPT TAGS: ${scripts.join(" ")}`);
  if (frames.length) console.log(`   IFRAMES: ${frames.join(" ")}`);
  if (links.length) console.log(`   LINK HINTS: ${links.join(" | ")}`);
  await page.close();
}

console.log("\n== ALL OTHER HOSTS");
for (const [h, t] of [...all].sort()) console.log(`   ${h}  [${[...t].join(",")}]`);
console.log("\n== COOKIES IN THE WEB VIEW");
for (const c of await context.cookies()) console.log(`   ${c.name} @ ${c.domain}  (httpOnly=${c.httpOnly}, expires=${c.expires > 0 ? new Date(c.expires * 1000).toISOString().slice(0, 10) : "session"})`);
console.log("\n== SET-COOKIE FROM OUR OWN RESPONSES");
for (const s of ownSetCookie) console.log(`   ${s}`);
await browser.close();
