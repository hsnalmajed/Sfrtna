// Phones: does any page slide sideways? (owner, 24 Nov 2026: hotel page
// «moves, not steady» in the iPhone app). Opens every main page in the
// iPhone's own engine (WebKit) and a Pixel (Chromium), scrolls it, and lists
// each element that sticks out past the screen's left or right edge and is
// not cut by a box of its own (a sideways scroll row is fine). The hotel
// price API is answered with sample hotels so the hotel screens show.
//   SMOKE_TOKEN=… node scripts/overflow-scan.mjs [base-url]
import { chromium, devices, webkit } from "playwright";

const BASE = (process.argv[2] || "https://sfrtna.almajedhsn.workers.dev").replace(/\/$/, "");
const HOST = new URL(BASE).host;
const TOKEN = process.env.SMOKE_TOKEN || "";
const C = "checkIn=2027-01-13&checkOut=2027-01-19&adults=2&rooms=1";
const PAGES = [
  "/ar", "/en",
  `/ar/hotel-results?hmode=discover&city=Madinah&label=%D8%A7%D9%84%D9%85%D8%AF%D9%8A%D9%86%D8%A9&${C}`,
  `/ar/hotel-results?hmode=known&hotel=Sample%20Hotel%200&hotelArea=Madinah&hcity=madinah&token=tok00000000&${C}`,
  `/ar/hotel-results?hmode=known&open=1&hotel=Sample%20Hotel%200&hotelArea=Madinah&hcity=madinah&token=tok00000000&${C}`,
  "/ar/results?from=DMM&to=IST&depart=2027-01-13&return=2027-01-19&adults=2",
  "/ar/attractions", "/ar/attractions/istanbul", "/ar/attractions/madinah", "/ar/visa", "/ar/seasons", "/ar/budget",
  "/ar/currency", "/ar/discover-results", "/ar/my-trip", "/ar/my-map", "/ar/services", "/ar/maps",
  "/ar/account", "/ar/about", "/ar/itinerary", "/ar/privacy", "/ar/terms", "/ar/contact", "/ar/methodology",
];
const img = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='400' height='300' fill='%23869bb8'/></svg>";
function hotel(i, rooms) {
  const offers = ["Agoda", "Booking.com", "Expedia", "Hotels.com", "Trip.com"].map((s, k) => ({ source: s, perNight: 700 + i * 40 + k * 15, total: (700 + i * 40 + k * 15) * 6, perNightBeforeTax: null, official: false, link: "https://example.com/", logo: "" }));
  return {
    name: `Sample Hotel ${i}`, nameAr: null, token: `tok0000000${i}`, stars: 4, rating: 4.5, reviews: 2044, perNight: 700, total: 4200, offers,
    images: Array(9).fill({ thumb: img, full: img }), address: "2779 Musab Ibn Umair Street, Al Madinah Al Munawwarah 42311, Saudi Arabia",
    amenities: ["Free Wi-Fi", "Free parking", "Restaurant", "Fitness centre", "Room service", "Breakfast ($)"], description: "A long hotel description ".repeat(20),
    locationRating: 4.8, checkInTime: "3:00 PM", checkOutTime: "12:00 PM", lat: 24.47 + i * 0.004, lng: 39.61 + i * 0.003, dealPct: i === 0 ? 46 : null,
    nearby: [{ name: "Al-Masjid an-Nabawi Very Long Name Of A Place", how: [{ type: "Walking", duration: "7 min" }] }],
    topics: [{ name: "Location", total: 500, positive: 480, negative: 20 }],
    ...(rooms ? { rooms: [{ name: "Deluxe King Room With A Very Long Room Name City View", source: "Agoda", image: img, guests: 2, perNight: 770, total: 4620, link: "https://example.com/" }] } : {}),
  };
}
const JS = () => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  const cut = (el) => {
    for (let a = el.parentElement; a && a.tagName !== "MAIN" && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.overflowX !== "visible") return true;
      if (s.position === "fixed") return false;
    }
    return false;
  };
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if ((r.right > vw + 1 || r.left < -1) && !cut(el)) {
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "none") continue;
      if (out.some((o) => o.el.contains(el))) continue;
      out.push({ el, d: `${s.position === "fixed" ? "[fixed] " : ""}${el.tagName.toLowerCase()}.${String(el.className).slice(0, 120)} «${(el.textContent || "").trim().slice(0, 40)}» L${Math.round(r.left)} R${Math.round(r.right)} vw${vw}` });
    }
  }
  return { vw, scrollW: document.documentElement.scrollWidth, items: out.slice(0, 10).map((o) => o.d) };
};
let bad = 0;
for (const [engine, device] of [[webkit, "iPhone 13"], [chromium, "Pixel 7"]]) {
  const browser = await engine.launch();
  const ctx = await browser.newContext({ ...devices[device], userAgent: devices[device].userAgent + " SfrtnaApp/1.0" });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("sfr-tips-v1", JSON.stringify(["home", "results", "hotels", "city", "discover", "trip"]));
      localStorage.setItem("sfr-welcome-v1", "1");
    } catch {}
  });
  await ctx.route("**/api/hotel-prices**", (route) => {
    const u = route.request().url();
    const list = /q=hotels/.test(u);
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: { kind: list ? "list" : "hotel", currency: "SAR", hotels: list ? [0, 1, 2, 3].map((i) => hotel(i)) : [hotel(0, true)], checkedAt: new Date().toISOString(), total: 601 } }) });
  });
  await ctx.route("**/*", (route) => {
    const req = route.request();
    if (new URL(req.url()).host === HOST && TOKEN) return route.continue({ headers: { ...req.headers(), "x-sfrtna-smoke": TOKEN } });
    return route.continue();
  });
  for (const path of PAGES) {
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + path, { waitUntil: "load", timeout: 60_000 });
      await page.waitForTimeout(3000);
      for (let y = 0; y < 6; y++) {
        await page.evaluate(() => window.scrollBy(0, 900));
        await page.waitForTimeout(250);
      }
      const r = await page.evaluate(JS);
      const line = `${device} ${path.slice(0, 80)}`;
      if (r.items.length || r.scrollW > r.vw + 1) {
        bad++;
        console.log(`::error title=Sideways ${device}::${line} scrollWidth=${r.scrollW} :: ${r.items.join(" || ")}`);
      } else console.log(`OK ${line}`);
    } catch (e) {
      console.log(`::warning title=Page failed::${device} ${path} ${String(e).slice(0, 120)}`);
    }
    await page.close();
  }
  await browser.close();
}
console.log(`pages with something sticking out: ${bad}`);
