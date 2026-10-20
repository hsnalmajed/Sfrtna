// The whole site, on a phone, checked the way a careful reviewer would —
// on every page, in the phone's browser AND inside the app (the app's own
// user agent, so the app's look is the real one), with a screenshot of each
// for a person to look at.
//
//   SMOKE_TOKEN=… node scripts/ux-audit.mjs [base-url]
//
// Written 20 Oct 2026 after the owner's notes ("apply every note to the
// whole project, not one page"). What it flags, per page:
//
//   OVERFLOW     the page scrolls sideways
//   OFFSCREEN    an element sticks out past the screen edge
//   WRAPPED      a short label (button, tab, chip) breaks onto 2+ lines
//   CUT          text cut off inside its box (… or clipped)
//   BLURRY       a photo drawn larger than the file it was given
//   TINY TAP     a button or link smaller than 36 px to tap
//   DEAD END     visitor-facing words that send the traveller away
//                without a price ("no prices", "search on these sites")
//   EMPTY        a tall stretch of the screen with nothing on it
//   ERRORS       uncaught page errors
//
// Screenshots: scripts/ux-audit/<device>-<mode>-<n>.png (uploaded as a
// workflow artifact, not committed).

import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, devices } from "playwright";

const BASE = (process.argv[2] || "https://sfrtna.almajedhsn.workers.dev").replace(/\/$/, "");
const HOST = new URL(BASE).host;
const TOKEN = process.env.SMOKE_TOKEN || "";
const day = (o) => new Date(Date.now() + o * 86_400_000).toISOString().slice(0, 10);
const qs = (o) => new URLSearchParams(o).toString();

const flight = { tripType: "flight", origin: "RUH", destination: "IST", adults: "1", childrenAges: "", infants: "0", currency: "SAR", directOnly: "false", baggageIncluded: "false", mode: "known" };
const PAGES = [
  "/ar",
  "/ar?product=flights#plan",
  "/ar?product=hotels#plan",
  "/ar?product=combo#plan",
  "/ar/attractions",
  "/ar/attractions/TR",
  "/ar/attractions/TR/istanbul",
  "/ar/maps",
  "/ar/maps/TR/istanbul",
  "/ar/seasons",
  "/ar/visa",
  "/ar/visa/TR",
  "/ar/currency",
  "/ar/services",
  "/ar/services?code=TR&city=istanbul",
  "/ar/itinerary",
  "/ar/account",
  "/ar/about",
  "/ar/privacy",
  `/ar/results?${qs({ ...flight, tripRoute: "roundtrip", departDate: day(40), returnDate: day(47), budget: "6000", nights: "7" })}`,
  `/ar/results?${qs({ ...flight, tripRoute: "roundtrip", departDate: day(40), returnDate: day(44), adults: "2", budget: "6000", nights: "4", combo: "1", hb: "4000", hs: "4" })}`,
  `/ar/discover-results?${qs({ ...flight, mode: "discover", tripRoute: "roundtrip", departDate: day(50), returnDate: day(57), budget: "6000", nights: "7", multiDestination: "false", stops: "2", oneWayOnly: "false", preferenceCategory: "", continents: "" })}`,
  `/ar/hotel-results?${qs({ hmode: "discover", checkIn: day(40), checkOut: day(44), adults: "2", childrenAges: "", infants: "0", city: "Istanbul", label: "إسطنبول", budget: "4000", currency: "SAR" })}`,
  `/ar/hotel-results?${qs({ hmode: "known", hotel: "Hilton Riyadh Olaya", hotelArea: "Riyadh, Saudi Arabia", label: "هيلتون الرياض العليا", checkIn: day(40), checkOut: day(43), adults: "2", childrenAges: "", infants: "0" })}`,
  "/en",
  "/en/attractions/TR/istanbul",
];

// Words that leave the traveller without our answer (owner, 20 Oct).
const DEAD_END = [/لا تتوفر أسعار/, /ابحث عن الرحلة نفسها/, /ابحث في (Booking|Expedia|Agoda)/, /أو ابحث لدى/, /لم نرصد لها سعر/, /افتح السعر الحي/, /No live fares/i, /Search the same trip/i];

const OUT = "scripts/ux-audit";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const report = [];
let shot = 0;

for (const device of ["iPhone 13", "Pixel 7"]) {
  for (const mode of ["web", "app"]) {
    const d = devices[device];
    const context = await browser.newContext({
      ...d,
      locale: "ar-SA",
      // The app's WebView adds this to the user agent; the page then draws the app's look.
      userAgent: mode === "app" ? `${d.userAgent} SfrtnaApp/Android` : d.userAgent,
    });
    // The cookie question answered, as a returning visitor would have.
    await context.addInitScript(() => {
      try {
        localStorage.setItem("sfr-consent", "denied");
        localStorage.setItem("sfrtna-consent", "denied");
        localStorage.setItem("sfr-welcome-v1", "1");
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
      const n = ++shot;
      try {
        await page.goto(BASE + path, { waitUntil: "load", timeout: 60_000 });
        await page.waitForTimeout(path.includes("results") ? 14_000 : 3_000);
        const found = await page.evaluate((deadEnd) => {
          const W = window.innerWidth;
          const out = { overflow: document.documentElement.scrollWidth - W, offscreen: [], wrapped: [], cut: [], blurry: [], tiny: [], deadEnd: [], empty: [], imgs: [] };
          const visible = (el) => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
          };
          const label = (el) => (el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").replace(/\s+/g, " ").trim().slice(0, 50);
          // Inside a sideways-scrolling row, sticking out is by design.
          const inScroller = (el) => {
            for (let p = el.parentElement; p; p = p.parentElement) {
              const s = getComputedStyle(p);
              if (/(auto|scroll|hidden)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1) return true;
            }
            return false;
          };
          for (const el of document.querySelectorAll("body *")) {
            if (!visible(el) || el.closest("[aria-hidden=true], #tpwl-tickets, iframe, .leaflet-container")) continue;
            const r = el.getBoundingClientRect();
            if ((r.right > W + 2 || r.left < -2) && r.width < W * 3 && !inScroller(el) && el.children.length === 0 && label(el)) out.offscreen.push(`${label(el)} (${Math.round(r.left)}→${Math.round(r.right)})`);
          }
          for (const el of document.querySelectorAll("button, [role=tab], [role=radio], a")) {
            if (!visible(el)) continue;
            const text = (el.innerText || "").trim();
            const r = el.getBoundingClientRect();
            const lh = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.4;
            const lines = text.split("\n").filter(Boolean).length;
            // Icon-over-label tiles (tab bar, plan choices) are tall by design.
            const stacked = el.querySelector("img, svg") && getComputedStyle(el).flexDirection.startsWith("column");
            if (text && text.length <= 24 && lines === 1 && !stacked && el.scrollHeight > lh * 2.2 && r.height < 140 && !el.querySelector("img, svg + span + span")) out.wrapped.push(`${label(el)} (${Math.round(r.width)}×${Math.round(r.height)})`);
            if ((el.tagName === "BUTTON" || el.getAttribute("role")) && (r.width < 32 || r.height < 32) && !el.closest(".leaflet-container")) out.tiny.push(`${label(el) || el.className.slice(0, 30)} (${Math.round(r.width)}×${Math.round(r.height)})`);
          }
          for (const el of document.querySelectorAll("p, span, h1, h2, h3, a, button, input")) {
            if (!visible(el)) continue;
            const s = getComputedStyle(el);
            const clipped = el.scrollWidth > el.clientWidth + 2 && (s.overflow === "hidden" || s.textOverflow === "ellipsis" || el.tagName === "INPUT");
            const ph = el.tagName === "INPUT" && !el.value && el.placeholder;
            if (clipped && (el.children.length === 0 || ph) && !inScroller(el)) {
              if (el.tagName !== "INPUT" || ph) out.cut.push(`${label(el)} (${el.clientWidth}/${el.scrollWidth})`);
            }
          }
          out.imgs = [];
          for (const img of document.querySelectorAll("img")) {
            if (!visible(img) || !img.naturalWidth) continue;
            const r = img.getBoundingClientRect();
            if (r.width < 120 || img.closest(".leaflet-container")) continue;
            out.imgs.push({ src: img.currentSrc || img.src, w: r.width, h: r.height, cover: getComputedStyle(img).objectFit === "cover" });
          }
          const text = document.body.innerText;
          for (const src of deadEnd) {
            const re = new RegExp(src.source, src.flags);
            const m = text.match(re);
            if (m) out.deadEnd.push(m[0]);
          }
          // Tall bands of nothing between the header and the tab bar / footer.
          const H = document.documentElement.scrollHeight;
          const step = 40;
          let run = 0;
          for (let y = 80; y < Math.min(H, 6000); y += step) {
            const els = [W * 0.25, W * 0.5, W * 0.75].map((x) => {
              window.scrollTo(0, Math.max(0, y - window.innerHeight / 2));
              const yy = y - window.scrollY;
              return document.elementFromPoint(x, yy);
            });
            const blank = els.every((e) => !e || e === document.body || e === document.documentElement || e.tagName === "MAIN" || (e.children.length > 3 && !(e.innerText || "").trim()));
            run = blank ? run + step : 0;
            if (run === 280) out.empty.push(`around y=${y - 240}`);
          }
          window.scrollTo(0, 0);
          return out;
        }, DEAD_END.map((r) => ({ source: r.source, flags: r.flags })));
        // A photo's real pixels (naturalWidth of an <img> with srcset is
        // divided by its density, so the file is opened on its own).
        found.blurry = await page.evaluate(async (imgs) => {
          const dpr = window.devicePixelRatio;
          const out = [];
          for (const i of imgs) {
            const im = new Image();
            im.src = i.src;
            try {
              await im.decode();
            } catch {
              continue;
            }
            const scale = i.cover ? Math.max((i.w * dpr) / im.naturalWidth, (i.h * dpr) / im.naturalHeight) : (i.w * dpr) / im.naturalWidth;
            if (scale > 1.6) out.push(`${i.src.replace(/^https?:\/\/[^/]+/, "").slice(0, 70)} ×${scale.toFixed(1)}`);
          }
          return out;
        }, found.imgs || []);
        delete found.imgs;
        const file = `${OUT}/${String(n).padStart(3, "0")}-${device.replace(/\s+/g, "")}-${mode}.jpg`;
        await page.screenshot({ path: file, fullPage: true, type: "jpeg", quality: 55 }).catch(() => {});
        report.push({ device, mode, path, file, ...found, errors: [...new Set(errors)].slice(0, 5) });
      } catch (e) {
        report.push({ device, mode, path, failed: String(e?.message || e).split("\n")[0] });
      } finally {
        await page.close();
      }
    }
    await context.close();
  }
}
await browser.close();

const lines = [];
for (const r of report) {
  lines.push(`\n## ${r.device} · ${r.mode} · ${decodeURIComponent(r.path).slice(0, 110)}${r.file ? `  [${r.file.split("/").pop()}]` : ""}`);
  if (r.failed) {
    lines.push(`  FAILED: ${r.failed}`);
    continue;
  }
  const add = (k, v) => v && v.length && lines.push(`  ${k}: ${[...new Set(v)].slice(0, 12).join(" | ")}`);
  if (r.overflow > 2) lines.push(`  OVERFLOW: ${r.overflow}px sideways`);
  add("OFFSCREEN", r.offscreen);
  add("WRAPPED", r.wrapped);
  add("CUT", r.cut);
  add("BLURRY", r.blurry);
  add("TINY TAP", r.tiny);
  add("DEAD END", r.deadEnd);
  add("EMPTY", r.empty);
  add("ERRORS", r.errors);
}
const text = lines.join("\n");
writeFileSync("scripts/ux-audit-report.txt", text + "\n");
console.log(text);
