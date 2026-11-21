// iOS clean-mode guard (owner, 18 Nov 2026: «حل جذري» after Apple's 5.1.2(i)
// rejection — see src/lib/iosClean.ts).
//
//   SMOKE_TOKEN=… node scripts/ios-clean-check.mjs [https://sfrtna-staging.almajedhsn.workers.dev]
//
// Opens our main pages exactly as the iPhone app does (user agent ending in
// «SfrtnaApp/iOS») and FAILS if the page, as the app sees it:
//   - loads any script or frame from another site,
//   - talks to a known tracker (analytics, ads, partner widgets),
//   - leaves any cookie from another site, or a Google Analytics cookie,
//   - shows the cookie banner,
//   - shows the partner's flight widget or Stay22's frame instead of the
//     «open outside» panels.
// Pictures (Pexels, map tiles) and our own JSON calls are allowed: they set
// no cookie and run no code.
//
// Run by release.yml on staging, before production: a failure holds the gate.
// Staging measures nothing, so the check switches measuring on
// («sfr-measure-check», lib/analytics.ts) to prove the app still gets no
// Google Analytics and no cookie banner.

import { chromium } from "playwright";

const BASE = (process.argv[2] || "https://sfrtna-staging.almajedhsn.workers.dev").replace(/\/$/, "");
const HOST = new URL(BASE).host;
const TOKEN = process.env.SMOKE_TOKEN || "";
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

// What WKWebView sends on an iPhone, plus what the app appends (capacitor.config.json).
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SfrtnaApp/iOS";

const TRACKERS =
  /(cloudflareinsights|accounts\.google|play\.google|googletagmanager|google-analytics|doubleclick|googlesyndication|facebook|fbcdn|clarity\.ms|hotjar|segment\.(io|com)|mixpanel|amplitude|stay22|tpwgt|apistp|travelpayouts|aviasales|tp\.media|emrld|tiktok|snap|criteo|taboola|outbrain)/i;

const q = (o) => new URLSearchParams(o).toString();
const PAGES = [
  ["home", "/ar"],
  ["home (en)", "/en"],
  ["city guide", "/ar/attractions/TR/istanbul"],
  ["privacy", "/ar/privacy"],
  // Sign-in pages: Google's button (accounts.google.com, play.google.com
  // logging) must never load in the app (2nd Apple note, 19 Nov 2026).
  ["account", "/ar/account"],
  ["my map", "/ar/my-map"],
  [
    "flight results",
    `/ar/results?${q({ tripType: "flight", origin: "DXB", destination: "IST", departDate: day(40), returnDate: day(47), adults: "2", currency: "SAR", budget: "0" })}`,
    { flights: true },
  ],
  [
    "hotel results",
    `/ar/hotel-results?${q({ hmode: "discover", city: "Istanbul", label: "إسطنبول", checkIn: day(40), checkOut: day(44), adults: "2", currency: "SAR" })}`,
    { hotels: true },
  ],
];

const failures = [];
const passes = [];
// Other sites the app's pages called for something other than a picture.
// Pictures (Pexels, Wikimedia, map tiles) may answer with a cookie of their
// own (__cf_bm, WMF-Uniq): Chromium keeps it, the app does not — WebKit
// drops every third-party cookie, and the app's no-tracking rules
// (AppDelegate.swift) block them again. So only cookies from hosts that ran
// code or answered calls are counted below.
const calledHosts = new Set();

const browser = await chromium.launch();
const context = await browser.newContext({
  userAgent: UA,
  locale: "ar-SA",
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
await context.addInitScript(() => {
  try {
    localStorage.setItem("sfr-tips-v1", JSON.stringify(["home", "results", "hotels", "city", "discover", "trip"]));
    localStorage.setItem("sfr-welcome-v1", "1");
    // Measure as on sfrtna.com (lib/analytics.ts isMeasuredHost): the app must
    // still get no Google Analytics and no cookie banner.
    localStorage.setItem("sfr-measure-check", "1");
  } catch {}
});
await context.route("**/*", (route) => {
  const req = route.request();
  if (new URL(req.url()).host !== HOST) return route.continue();
  return route.continue({ headers: { ...req.headers(), "x-sfrtna-smoke": TOKEN } });
});

const ours = (url) => {
  try {
    const h = new URL(url).host;
    return h === HOST || h.endsWith(".sfrtna.com") || h === "sfrtna.com";
  } catch {
    return true; // data:, blob: — nothing leaves the phone
  }
};

for (const [name, path, opts = {}] of PAGES) {
  const page = await context.newPage();
  const bad = [];
  page.on("request", (req) => {
    const url = req.url();
    if (ours(url)) return;
    const type = req.resourceType();
    const host = new URL(url).host;
    if (!["image", "font", "media"].includes(type)) calledHosts.add(host);
    if (type === "script") bad.push(`script from ${host}`);
    else if (type === "document" && req.frame() !== page.mainFrame()) bad.push(`frame from ${host}`);
    else if (TRACKERS.test(host)) bad.push(`${type} to ${host}`);
  });
  try {
    await page.goto(BASE + path, { waitUntil: "load", timeout: 60_000 });
    // Late scripts (lazyOnload, widgets) come after the load event.
    await page.waitForTimeout(8_000);
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(3_000);

    if (await page.locator("[data-consent-banner]").count()) bad.push("cookie banner shown");
    if (await page.locator("#tpwl-tickets, #tpwl-main").count()) bad.push("partner flight widget in the page");
    // Frames with another site's address. Cloudflare's own bot check on
    // sfrtna.com adds a hidden blank frame of ours (no address, runs
    // /cdn-cgi/challenge-platform on our domain): no other site, no tracking.
    const frames = await page.evaluate(() =>
      [...document.querySelectorAll("iframe")].map((f) => f.getAttribute("src") || "").filter((s) => {
        if (!s || s === "about:blank") return false;
        try {
          return new URL(s, location.href).host !== location.host;
        } catch {
          return true;
        }
      }),
    );
    if (frames.length) bad.push(`frame(s) from another site: ${frames.slice(0, 3).join(" ")}`);
    if (opts.flights && !(await page.locator("[data-flights-outside]").count())) bad.push("no «open outside» flights panel");
    if (opts.hotels && !(await page.locator("[data-hotels-outside]").count())) bad.push("no «open outside» hotels panel");

    if (bad.length) failures.push(`✗ ${name}: ${[...new Set(bad)].slice(0, 6).join(" · ")}`);
    else passes.push(`✓ ${name}`);
  } catch (err) {
    failures.push(`✗ ${name}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  } finally {
    await page.close();
  }
}

// Control: the same pages in a phone browser (not the app) DO show the
// banner and the partner's widget. If not, this check could not see them
// either, and a green result above would mean nothing.
{
  const web = await browser.newContext({
    userAgent: UA.replace(" SfrtnaApp/iOS", " Version/18.0 Safari/604.1"),
    locale: "ar-SA",
    viewport: { width: 390, height: 844 },
  });
  await web.addInitScript(() => {
    try {
      localStorage.setItem("sfr-tips-v1", JSON.stringify(["home", "results", "hotels", "city", "discover", "trip"]));
      localStorage.setItem("sfr-measure-check", "1");
    } catch {}
  });
  await web.route("**/*", (route) => {
    const req = route.request();
    if (new URL(req.url()).host !== HOST) return route.continue();
    return route.continue({ headers: { ...req.headers(), "x-sfrtna-smoke": TOKEN } });
  });
  const page = await web.newPage();
  const seen = [];
  try {
    await page.goto(BASE + "/ar", { waitUntil: "load", timeout: 60_000 });
    await page.waitForTimeout(6_000);
    if (await page.locator("[data-consent-banner]").count()) seen.push("banner");
    await page.goto(BASE + PAGES.find(([n]) => n === "flight results")[1], { waitUntil: "load", timeout: 60_000 });
    await page.waitForTimeout(6_000);
    if (await page.locator("#tpwl-tickets").count()) seen.push("widget");
  } catch (err) {
    seen.push(`error: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  } finally {
    await web.close();
  }
  if (seen.includes("banner") && seen.includes("widget")) passes.push("✓ control: a phone browser does see the banner and the widget");
  else failures.push(`✗ control: a phone browser should see the banner and the widget, saw ${seen.join(", ") || "neither"} — the guard is blind`);
}

const cookies = await context.cookies();
const foreign = cookies.filter((c) => {
  const d = c.domain.replace(/^\./, "");
  if (/^_ga|^_gid|^_gcl|^_fbp/.test(c.name)) return true;
  if (ours(`https://${d}`)) return false;
  return TRACKERS.test(d) || [...calledHosts].some((h) => h === d || h.endsWith(`.${d}`));
});
if (foreign.length) failures.push(`✗ cookies from other sites / analytics: ${foreign.map((c) => `${c.name}@${c.domain}`).slice(0, 8).join(", ")}`);
else passes.push(`✓ no tracking cookie (${cookies.length} cookies in all; picture hosts' own are dropped by WebKit in the app)`);

await browser.close();

for (const l of passes) console.log(l);
for (const l of failures) {
  console.log(l);
  console.log(`::error title=iOS clean mode (Apple 5.1.2)::${l}`);
}
console.log(`\niOS clean mode on ${HOST}: ${passes.length} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
