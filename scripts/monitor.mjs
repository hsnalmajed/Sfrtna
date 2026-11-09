// Hourly watch on what a traveller depends on, so a fault reaches the owner
// before a traveller finds it (.github/workflows/monitor.yml).
//
//   SMOKE_TOKEN=… node scripts/monitor.mjs
//
// Every hour, spending nothing from any allowance: the search pages open, the
// flight partner's widget script loads, fares come back, SerpApi's allowance,
// the Worker's error rate over the last hour.
// Once a day, ONE real hotel search (about 30 of SerpApi's 250 a month),
// alternating a city list and a single hotel, and only while the allowance
// is healthy: prices must be there.
//
// Limit: the flight widget only answers on sfrtna.com, and GitHub's machines
// cannot open sfrtna.com, so a full flight search is not exercised here.
//
// Mail: a check must fail two runs in a row (a deploy or a blip is not a
// fault), then one mail, a reminder every 24 h, and one mail when it clears.
// State lives in monitor-state.json (branch `monitor-state`).

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const BASE = (process.argv[2] || "https://sfrtna.almajedhsn.workers.dev").replace(/\/$/, "");
const TOKEN = process.env.SMOKE_TOKEN || "";
const STATE_FILE = "monitor-state.json";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 SfrtnaMonitor/1";
const HOUR = 3_600_000;
const REMIND_MS = 24 * HOUR;
const MIN_LEFT_FOR_REAL_SEARCH = 60; // stays above the 40 kept for flights
const LOW_ALLOWANCE = 45;
const ERROR_RATE = 0.02;
const MIN_ERRORS = 10;

const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const headers = (path) => ({
  "User-Agent": UA,
  "x-sfrtna-smoke": TOKEN,
  Origin: BASE,
  Referer: `${BASE}${path}`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  Accept: "application/json, text/html",
});

const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {};
state.checks ??= {};

const results = []; // { id, name, ok, detail }
const notes = [];

async function check(id, name, fn) {
  try {
    const detail = await fn();
    results.push({ id, name, ok: true, detail: detail || "" });
  } catch (err) {
    results.push({ id, name, ok: false, detail: err instanceof Error ? err.message : String(err) });
  }
}

async function get(path, page = "/ar", extra = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: { ...headers(page), ...extra }, signal: AbortSignal.timeout(60_000) });
  return { status: res.status, text: await res.text() };
}

async function getJson(path, page, extra) {
  const { status, text } = await get(path, page, extra);
  if (status !== 200) throw new Error(`رد الخادم ${status}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("الرد ليس بيانات صالحة");
  }
}

async function openPage(path) {
  const { status, text } = await get(path);
  if (status !== 200) throw new Error(`رد الخادم ${status}`);
  if (text.length < 2000) throw new Error("الصفحة شبه فارغة");
}

const stay = { checkIn: day(45), checkOut: day(48), adults: "2", childrenAges: "", infants: "0" };
const qs = (o) => new URLSearchParams(o).toString();

await check("home", "الصفحة الرئيسية", () => openPage("/ar"));
await check("flight-page", "صفحة نتائج الطيران", () =>
  openPage(`/ar/results?${qs({ tripType: "flight", adults: "1", currency: "SAR", origin: "DXB", destination: "IST", departDate: day(45), returnDate: day(52), budget: "0" })}`)
);
await check("hotel-list-page", "صفحة قائمة الفنادق", () =>
  openPage(`/ar/hotel-results?${qs({ hmode: "discover", city: "Istanbul", ...stay })}`)
);
await check("hotel-page", "صفحة الفندق", () =>
  openPage(`/ar/hotel-results?${qs({ hmode: "known", hotel: "Hilton Riyadh Olaya", hotelArea: "Riyadh, Saudi Arabia", label: "هيلتون الرياض العليا", ...stay })}`)
);

await check("flight-widget", "أداة بحث الطيران لدى الشريك", async () => {
  const res = await fetch("https://tpwgt.com/wl_web/main.js?wl_id=22604", {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.text();
  if (res.status !== 200 || body.length < 1000) throw new Error(`رد الشريك ${res.status}`);
});

await check("flight-fares", "أسعار الطيران من الشريك", async () => {
  const j = await getJson("/api/health?monitor=1");
  if (!j.flightProbe?.ok) throw new Error("تعذر الوصول إلى الشريك");
  if (!j.flightProbe.offers) throw new Error("الشريك أعاد صفر رحلات على مسار دبي ← إسطنبول");
  return `${j.flightProbe.offers} رحلة`;
});

let serp = null;
await check("serpapi", "رصيد أسعار الفنادق (SerpApi)", async () => {
  serp = await getJson("/api/serp-status");
  if (!serp.connected) throw new Error("الاتصال بالخدمة مقطوع");
  if (serp.mayUse === false) throw new Error(`قائمة الفنادق متوقفة عن البحث الآن (المتبقي ${serp.left} من ${serp.perMonth})`);
  if (serp.left <= LOW_ALLOWANCE) throw new Error(`الرصيد قارب النفاد: المتبقي ${serp.left} من ${serp.perMonth}`);
  return `المتبقي ${serp.left} من ${serp.perMonth}`;
});

// Worker errors, last hour. A token without analytics access is a note, not
// a fault of the site.
await (async () => {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account) return notes.push("أخطاء Worker: مفتاح Cloudflare غير متاح لهذا الفحص");
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query($a:String!,$s:Time!,$e:Time!){viewer{accounts(filter:{accountTag:$a}){workersInvocationsAdaptive(limit:100,filter:{scriptName:"sfrtna",datetime_geq:$s,datetime_leq:$e}){sum{requests errors}}}}}`,
        variables: { a: account, s: new Date(Date.now() - HOUR).toISOString(), e: new Date().toISOString() },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const j = await res.json();
    if (j.errors?.length || !j.data) return notes.push(`أخطاء Worker: لا صلاحية للقراءة (${String(j.errors?.[0]?.message ?? res.status).slice(0, 100)})`);
    const rows = j.data.viewer.accounts[0]?.workersInvocationsAdaptive ?? [];
    const requests = rows.reduce((n, r) => n + (r.sum.requests || 0), 0);
    const errors = rows.reduce((n, r) => n + (r.sum.errors || 0), 0);
    await check("worker-errors", "أخطاء Worker في آخر ساعة", async () => {
      if (errors >= MIN_ERRORS && errors / Math.max(1, requests) > ERROR_RATE) throw new Error(`${errors} خطأ من ${requests} طلب`);
      return `${errors} خطأ من ${requests} طلب`;
    });
  } catch (err) {
    notes.push(`أخطاء Worker: تعذرت القراءة (${String(err).slice(0, 100)})`);
  }
})();

// The one real search of the day.
const realDue = Date.now() - (state.lastRealAt ?? 0) > 23 * HOUR;
if (realDue && serp?.connected && serp.mayUse && serp.left > MIN_LEFT_FOR_REAL_SEARCH) {
  const single = state.lastRealKind !== "hotel";
  const kind = single ? "hotel" : "list";
  const q = single ? "Hilton Riyadh Olaya" : "hotels in Istanbul";
  await check("hotel-prices", single ? "أسعار صفحة الفندق (بحث حقيقي)" : "أسعار قائمة الفنادق (بحث حقيقي)", async () => {
    const j = await getJson(`/api/hotel-prices?${qs({ q, checkIn: stay.checkIn, checkOut: stay.checkOut, adults: "2", currency: "SAR" })}`, "/ar/hotel-results", {
      // Our checks never spend searches unless they ask to (serpapi.ts isOwnCheck).
      "x-sfrtna-spend": "1",
    });
    const hotels = j.result?.hotels ?? [];
    if (!hotels.length) throw new Error("لا فنادق في الرد");
    const priced = single ? hotels[0].offers?.filter((o) => o.perNight || o.total).length ?? 0 : hotels.filter((h) => h.perNight).length;
    if (!priced) throw new Error("فنادق بلا أي سعر");
    return single ? `${priced} موقع حجز بسعر` : `${priced} من ${hotels.length} فندقًا بسعر`;
  });
  state.lastRealAt = Date.now();
  state.lastRealKind = kind;
} else if (realDue) {
  notes.push("البحث الحقيقي عن الفنادق أُجّل حفاظًا على الرصيد");
} else if (state.checks["hotel-prices"]?.fails) {
  // Keep an unresolved price fault open between its daily runs.
  results.push({ id: "hotel-prices", name: state.checks["hotel-prices"].name, ok: false, detail: state.checks["hotel-prices"].detail, carried: true });
}

// ── What to tell the owner ──
const now = Date.now();
const newly = [];
const reminders = [];
const cleared = [];
for (const r of results) {
  const prev = state.checks[r.id] ?? { fails: 0 };
  if (r.ok) {
    if (prev.alertedAt) cleared.push(r);
    state.checks[r.id] = { fails: 0, name: r.name };
    continue;
  }
  // A daily check has no second run within the hour: one failure is enough.
  const fails = r.carried ? prev.fails : prev.fails + 1;
  const next = { ...prev, fails, name: r.name, detail: r.detail };
  if (fails >= 2 || r.id === "hotel-prices") {
    if (!prev.alertedAt) {
      next.alertedAt = now;
      next.remindedAt = now;
      newly.push(r);
    } else if (now - (prev.remindedAt ?? prev.alertedAt) >= REMIND_MS) {
      next.remindedAt = now;
      reminders.push(r);
    }
  }
  state.checks[r.id] = next;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const list = (rows) => `<ul>${rows.map((r) => `<li><b>${esc(r.name)}</b>: ${esc(r.detail)}</li>`).join("")}</ul>`;
const testing = process.env.MONITOR_TEST === "true";
let subject = "";
let html = "";
if (testing) {
  subject = "🔔 سفرتنا: رسالة تجربة من المراقبة";
  html = `<p>هذه تجربة لنظام المراقبة، ولا يوجد خلل بسببها.</p>${list(results)}`;
} else if (newly.length || reminders.length) {
  const all = [...newly, ...reminders];
  subject = `🚨 سفرتنا: ${all[0].name}${all.length > 1 ? ` و${all.length - 1} غيرها` : ""}`;
  html = `${newly.length ? `<h3>خلل جديد</h3>${list(newly)}` : ""}${reminders.length ? `<h3>ما زال قائمًا</h3>${list(reminders)}` : ""}`;
  if (cleared.length) html += `<h3>عاد للعمل</h3>${list(cleared)}`;
} else if (cleared.length) {
  subject = `✅ سفرتنا: عاد للعمل — ${cleared[0].name}`;
  html = list(cleared);
}

async function mail() {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_TO;
  if (!key || !to) return console.log("Mail secrets missing: alert not sent.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "مراقبة سفرتنا <no-reply@sfrtna.com>",
      to: to.split(",").map((s) => s.trim()).filter(Boolean),
      subject,
      html: `<div dir="rtl" style="font-family:sans-serif">${html}</div>`,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  console.log("Alert sent.");
}

state.lastRunAt = new Date(now).toISOString();
state.last = results.map(({ id, ok, detail }) => ({ id, ok, detail }));
state.notes = notes;
writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 1)}\n`);

for (const r of results) console.log(`${r.ok ? "OK  " : "FAIL"} ${r.id}: ${r.detail}`);
for (const n of notes) console.log(`NOTE ${n}`);
if (subject) await mail();
