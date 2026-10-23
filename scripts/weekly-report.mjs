// «لوحة سفرتنا» — the owner's weekly numbers email (owner, 23 Oct 2026:
// "a page or email showing visitors, earnings per partner and in total, what
// visitors search most, what earns most, the top destinations and hotels…
// organised, easy to read and decide from").
//
//   node scripts/weekly-report.mjs        (.github/workflows/weekly-report.yml)
//
// Sources, all read with the site-check key (SMOKE_TOKEN) from the Worker:
//   /api/stats/summary   anonymous daily counts kept by the site itself
//                        (visits, sources, searches, destinations, hotels,
//                        partner clicks) — this week and the week before
//   /api/admin/earnings  Travelpayouts statistics (most of our partners)
//   /api/feedback/recent visitors' notes
// Google Analytics and Search Console join when the owner grants read
// access; until then their part says so.
//
// The email goes to REPORT_TO through Resend (RESEND_API_KEY). Earnings are
// private, so the full report is never pushed to the public repository: only
// a shape file (status codes and field names, no numbers) for debugging.

import { readFileSync, writeFileSync } from "node:fs";

// Airport codes → «المدينة (CODE)», read from the site's own list.
const CITY = {};
try {
  const src = readFileSync(new URL("../src/lib/airports.ts", import.meta.url), "utf8");
  for (const m of src.matchAll(/iata: "([A-Z]{3})"[^}]*?cityAr: "([^"]+)"/g)) CITY[m[1]] = `${m[2]} (${m[1]})`;
} catch {
  /* codes stay as they are */
}

const BASE = (process.env.REPORT_BASE || "https://sfrtna.almajedhsn.workers.dev").replace(/\/$/, "");
const TOKEN = process.env.SMOKE_TOKEN || "";
const DAYS = Number(process.env.REPORT_DAYS || 7);
const UA = "Mozilla/5.0 (compatible; SfrtnaWeekly/1)";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const nf = new Intl.NumberFormat("en-US");
const n = (x) => nf.format(Math.round(Number(x) || 0));
const shape = {};

async function get(path) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "x-sfrtna-smoke": TOKEN, "User-Agent": UA },
      signal: AbortSignal.timeout(60_000),
    });
    const body = await res.json().catch(() => null);
    shape[path] = { status: res.status };
    return res.ok ? body : null;
  } catch (err) {
    shape[path] = { error: err.message };
    return null;
  }
}

// ── Names the owner knows ───────────────────────────────────────────────────
const SEARCH_AR = {
  flight: "طيران", flight_hotel: "طيران + فندق", hotel: "فنادق", discover: "اقترح لي وجهة",
  discover_hotel: "اقترح لي وجهة (طيران + فندق)", multicity: "تعدد الوجهات",
};
const PAGE_AR = {
  home: "الرئيسية", results: "نتائج الطيران", "hotel-results": "نتائج الفنادق", "discover-results": "نتائج الاقتراح",
  attractions: "الوجهات", seasons: "المواسم", visa: "التأشيرات", maps: "الخرائط", services: "خدمات الرحلة",
  itinerary: "الخطة", budget: "الميزانية", account: "حسابي", about: "من نحن", privacy: "الخصوصية", terms: "الشروط",
};
const SOURCE_AR = { direct: "مباشر (كتب الرابط أو من المفضلة)", app: "التطبيق", "google.com": "جوجل", "bing.com": "بينغ", instagram: "إنستغرام", tiktok: "تيك توك", snapchat: "سناب شات", x: "X", "t.co": "X", youtube: "يوتيوب", facebook: "فيسبوك", whatsapp: "واتساب" };

function table(rows, prevMap, label, limit = 10, names = {}) {
  if (!rows.length) return `<p style="margin:0"><b>${esc(label)}:</b> <span style="color:#667085">لا توجد بيانات بعد.</span></p>`;
  const td = 'style="padding:7px 10px;border-bottom:1px solid #eaecf0;text-align:right"';
  const body = rows
    .slice(0, limit)
    .map((r) => {
      const prev = prevMap.get(r.key) || 0;
      const diff = prev ? Math.round(((r.n - prev) / prev) * 100) : null;
      const trend = diff === null ? '<span style="color:#667085">جديد</span>' : `<span style="color:${diff >= 0 ? "#067647" : "#b42318"}">${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff)}%</span>`;
      return `<tr><td ${td}>${esc(names[r.key] || r.key)}</td><td ${td}><b>${n(r.n)}</b></td><td ${td}>${trend}</td></tr>`;
    })
    .join("");
  return `<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eaecf0;font-size:13px"><tr><th style="padding:7px 10px;background:#f2f4f7;text-align:right">${esc(label)}</th><th style="padding:7px 10px;background:#f2f4f7;text-align:right">العدد</th><th style="padding:7px 10px;background:#f2f4f7;text-align:right">مقارنة بالأسبوع الماضي</th></tr>${body}</table>`;
}

function group(list) {
  const by = new Map();
  for (const r of list || []) {
    if (!by.has(r.kind)) by.set(r.kind, []);
    by.get(r.kind).push({ key: r.key, n: Number(r.n) || 0 });
  }
  for (const v of by.values()) v.sort((a, b) => b.n - a.n);
  return by;
}
const total = (rows) => (rows || []).reduce((a, r) => a + r.n, 0);
const mapOf = (rows) => new Map((rows || []).map((r) => [r.key, r.n]));
function change(now, before) {
  if (!before) return now ? "جديد" : "—";
  const d = Math.round(((now - before) / before) * 100);
  return `${d >= 0 ? "▲" : "▼"} ${Math.abs(d)}%`;
}

// ── Earnings (Travelpayouts) ────────────────────────────────────────────────
// Travelpayouts program ids we know by name (Aviasales = 100, from their
// API article); others show their number until named here.
const PROGRAMS = { 100: "Aviasales (طيران)" };
function earnings(raw) {
  if (!raw) return { ok: false, note: "تعذّرت قراءة أرقام Travelpayouts." };
  const rows = raw?.data?.results || raw?.data?.rows || (Array.isArray(raw?.data) ? raw.data : null);
  shape.earnings = { status: raw.status, fields: raw.fields, available: raw.available, listShape: raw.listShape, rowKeys: rows?.[0] ? Object.keys(rows[0]) : null, campaigns: Array.isArray(rows) ? rows.map((r) => r.campaign_id).filter(Boolean) : null, sample: typeof raw.data === "string" ? raw.data.slice(0, 200) : undefined };
  if (raw.status !== 200 || !Array.isArray(rows)) return { ok: false, note: `Travelpayouts لم يُرجع الأرقام (الحالة ${raw.status}). سأضبط الطلب.` };
  const money = (r, k) => Number(r[`${k}_usd_sum`] ?? r[`${k}_eur_sum`] ?? 0);
  const cur = rows.some((r) => "paid_profit_usd_sum" in r) ? "$" : "€";
  const list = rows
    .map((r) => ({
      name: PROGRAMS[r.campaign_id] || (r.campaign_id ? `برنامج رقم ${r.campaign_id}` : "كل البرامج"),
      clicks: Number(r.redirects_count ?? r.clicks_count ?? 0),
      paid: money(r, "paid_profit"),
      pending: money(r, "processing_profit"),
      bookings: Number(r.paid_actions_count || 0) + Number(r.processing_actions_count || 0),
    }))
    .filter((r) => r.clicks || r.paid || r.pending || r.bookings)
    .sort((a, b) => b.paid + b.pending - (a.paid + a.pending));
  return { ok: true, cur, list, from: raw.from, to: raw.to };
}

function earningsHtml(e) {
  if (!e.ok) return `<p style="margin:0;color:#b54708">${esc(e.note)}</p>`;
  const td = 'style="padding:7px 10px;border-bottom:1px solid #eaecf0;text-align:right"';
  const th = 'style="padding:7px 10px;background:#f2f4f7;text-align:right"';
  const sum = (k) => e.list.reduce((a, r) => a + r[k], 0);
  const money = (x) => `${e.cur}${x.toFixed(2)}`;
  const rows = e.list.length
    ? e.list.map((r) => `<tr><td ${td}>${esc(r.name)}</td><td ${td}>${n(r.clicks)}</td><td ${td}>${n(r.bookings)}</td><td ${td}>${money(r.pending)}</td><td ${td}><b>${money(r.paid)}</b></td></tr>`).join("")
    : `<tr><td ${td} colspan="5">لا نقرات ولا حجوزات مسجلة بعد في هذه الفترة.</td></tr>`;
  return `<p style="margin:0 0 6px;color:#667085;font-size:12px">آخر 30 يوماً (${esc(e.from)} إلى ${esc(e.to)}). «قيد المراجعة» = حجوزات لم يتأكد دفعها بعد.</p>
<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eaecf0;font-size:13px">
<tr><th ${th}>البرنامج</th><th ${th}>نقرات</th><th ${th}>حجوزات</th><th ${th}>قيد المراجعة</th><th ${th}>مؤكد</th></tr>${rows}
<tr><td ${td}><b>المجموع</b></td><td ${td}><b>${n(sum("clicks"))}</b></td><td ${td}><b>${n(sum("bookings"))}</b></td><td ${td}><b>${money(sum("pending"))}</b></td><td ${td}><b>${money(sum("paid"))}</b></td></tr></table>`;
}

// ── Build ───────────────────────────────────────────────────────────────────
const stats = await get(`/api/stats/summary?days=${DAYS}`);
const tp = await get("/api/admin/earnings?days=30");
const fb = await get(`/api/feedback/recent?hours=${DAYS * 24}`);

const cur = group(stats?.current);
const prev = group(stats?.previous);
const k = (kind) => cur.get(kind) || [];
const pk = (kind) => mapOf(prev.get(kind));

const visits = total(k("visit"));
const visitsPrev = total(prev.get("visit"));
const searches = total(k("search"));
const searchesPrev = total(prev.get("search"));
const clicks = total(k("partner"));
const clicksPrev = total(prev.get("partner"));
const e = earnings(tp);

// Daily visits, as a row of bars.
const daily = (stats?.daily || []).slice(-DAYS);
const peak = Math.max(1, ...daily.map((d) => Number(d.n) || 0));
const bars = daily
  .map((d) => {
    const h = Math.round(((Number(d.n) || 0) / peak) * 60) + 2;
    return `<td style="vertical-align:bottom;text-align:center;padding:0 3px"><div style="height:${h}px;background:#1d6fd8;border-radius:4px 4px 0 0;width:26px;margin:0 auto"></div><div style="font-size:11px;color:#667085;margin-top:3px">${esc(d.day.slice(5))}</div><div style="font-size:11px">${n(d.n)}</div></td>`;
  })
  .join("");

// Three suggestions, only from the numbers.
const tips = [];
const topDest = k("dest")[0];
if (topDest) tips.push(`أكثر وجهة بحثاً هذا الأسبوع: <b>${esc(CITY[topDest.key] || topDest.key)}</b> (${n(topDest.n)} بحث). اجعل فيديو الأسبوع عنها.`);
const topSource = k("source").find((s) => s.key !== "direct" && s.key !== "app");
if (topSource) tips.push(`أكثر قناة جلبت زواراً: <b>${esc(SOURCE_AR[topSource.key] || topSource.key)}</b> (${n(topSource.n)} زيارة). ركّز النشر فيها.`);
if (searches && clicks / searches < 0.15) tips.push(`من كل 100 بحث، ضغط ${Math.round((clicks / searches) * 100)} فقط على موقع حجز. نراجع صفحة النتائج لنقرّب زر الحجز.`);
if (!visits) tips.push("لم تُسجَّل زيارات بعد — العدّ بدأ للتو، وستظهر الأرقام في تقرير الأسبوع القادم.");
while (tips.length > 3) tips.pop();

// Reminders with real dates.
const today = new Date();
const REMINDERS = [
  ["2026-11-14", "شروط HERE الجديدة تبدأ — أراجعها قبلها."],
  ["2026-11-22", "يمكن الآن تغيير اسم تيك توك من .sfrtna إلى sfrtnaapp."],
  ["2026-11-06", "يتجدد رصيد أسعار الفنادق المجاني (إن لم نشترك)."],
];
const upcoming = REMINDERS.filter(([d]) => {
  const diff = (new Date(`${d}T00:00:00Z`) - today) / 86400e3;
  return diff >= -1 && diff <= 14;
});

const fbItems = fb?.items || [];
const fbKinds = {};
for (const it of fbItems) fbKinds[it.kind] = (fbKinds[it.kind] || 0) + 1;
const FB_AR = { problem: "مشكلة", wrong: "معلومة غير دقيقة", idea: "فكرة", opinion: "رأي", question: "سؤال" };

const card = (label, now, before) => `<td style="padding:12px;background:#fff;border:1px solid #eaecf0;border-radius:10px;text-align:center;width:25%"><div style="color:#667085;font-size:12px">${label}</div><div style="font-size:22px;font-weight:700;margin:4px 0">${n(now)}</div><div style="font-size:12px;color:${now >= before ? "#067647" : "#b42318"}">${change(now, before)}</div></td>`;
const earnedNow = e.ok ? e.list.reduce((a, r) => a + r.paid + r.pending, 0) : 0;

const h2 = (t) => `<h2 style="font-size:16px;margin:24px 0 8px">${t}</h2>`;
const html = `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f8f9fb;font-family:Tahoma,Arial,sans-serif;color:#101828">
<div style="max-width:720px;margin:0 auto;padding:20px">
<h1 style="font-size:20px;margin:0 0 4px">لوحة سفرتنا — الأسبوع</h1>
<p style="color:#667085;margin:0 0 16px">${esc(stats?.from || "")} إلى ${esc(stats?.to || "")} · مقارنة بالأسبوع الذي قبله</p>

<table style="width:100%;border-spacing:8px;margin:0 -8px"><tr>
${card("الزيارات", visits, visitsPrev)}${card("عمليات البحث", searches, searchesPrev)}${card("نقرات الحجز", clicks, clicksPrev)}
<td style="padding:12px;background:#fff;border:1px solid #eaecf0;border-radius:10px;text-align:center;width:25%"><div style="color:#667085;font-size:12px">أرباح 30 يوماً (Travelpayouts)</div><div style="font-size:22px;font-weight:700;margin:4px 0">${e.ok ? `${e.cur}${earnedNow.toFixed(2)}` : "—"}</div><div style="font-size:12px;color:#667085">مؤكد + قيد المراجعة</div></td>
</tr></table>

${h2("قرارات مقترحة")}
<ul style="margin:0;padding-inline-start:20px;line-height:1.9">${tips.map((t) => `<li>${t}</li>`).join("")}</ul>

${h2("الزوار يوماً بيوم")}
${daily.length ? `<table style="border-collapse:collapse;margin:0 auto"><tr>${bars}</tr></table>` : '<p style="color:#667085;margin:0">لا توجد بيانات بعد.</p>'}
<table style="width:100%;margin-top:12px"><tr>
<td style="vertical-align:top;width:50%;padding-inline-end:6px">${table(k("visit"), pk("visit"), "الموقع أم التطبيق", 4, { web: "الموقع", app: "التطبيق" })}</td>
<td style="vertical-align:top;width:50%;padding-inline-start:6px">${table(k("device"), pk("device"), "الجهاز", 4, { mobile: "جوال", desktop: "كمبيوتر" })}</td>
</tr></table>

${h2("من أين جاء الزوار")}
${table(k("source"), pk("source"), "المصدر", 10, SOURCE_AR)}

${h2("ماذا يبحثون")}
${table(k("search"), pk("search"), "نوع البحث", 8, SEARCH_AR)}
<div style="height:10px"></div>
${table(k("dest"), pk("dest"), "أكثر الوجهات بحثاً", 10, CITY)}
<div style="height:10px"></div>
${table(k("hotel_city"), pk("hotel_city"), "أكثر مدن الفنادق بحثاً", 10)}
<div style="height:10px"></div>
${table(k("hotel"), pk("hotel"), "أكثر الفنادق بحثاً بالاسم", 10)}
<div style="height:10px"></div>
${table(k("origin"), pk("origin"), "من أين يسافرون", 8, CITY)}

${h2("نقرات الحجز عند الشركاء")}
${table(k("partner"), pk("partner"), "الشريك", 15)}
<div style="height:10px"></div>
${table(k("partner_page"), pk("partner_page"), "من أي صفحة", 8, PAGE_AR)}

${h2("الأرباح")}
${earningsHtml(e)}
<p style="margin:8px 0 0;color:#667085;font-size:12px">الشركاء المباشرون (Stay22، Expedia، Viator، GetYourGuide، RateHawk) تُقرأ أرباحهم من لوحاتهم حتى نربطها آلياً.</p>

${h2("جوجل")}
<p style="margin:0;color:#667085">أرقام البحث في جوجل (الظهور والنقرات ومركز «سفرتنا») تظهر هنا بعد أن تعطيني صلاحية القراءة في Search Console.</p>

${h2("ملاحظات الزوار")}
<p style="margin:0">${fbItems.length ? `${n(fbItems.length)} ملاحظة — ${Object.entries(fbKinds).map(([kk, v]) => `${FB_AR[kk] || kk} ${v}`).join("، ")}` : "لم تصل ملاحظات هذا الأسبوع."}</p>

${h2("تذكيرات")}
<ul style="margin:0;padding-inline-start:20px;line-height:1.9">
<li>انشر فيديو هذا الأسبوع عن أكثر وجهة بحثاً${topDest ? ` (${esc(CITY[topDest.key] || topDest.key)})` : ""}.</li>
<li>جهّز محتوى الإجازة القادمة قبلها بـ 4 إلى 8 أسابيع — الناس يحجزون مبكراً.</li>
${upcoming.map(([d, t]) => `<li><b>${esc(d)}</b>: ${esc(t)}</li>`).join("")}
</ul>

<p style="color:#98a2b3;font-size:12px;margin-top:28px">يصلك هذا التقرير كل أحد صباحاً. الأعداد مجمّعة بلا هوية أي زائر.</p>
</div></body></html>`;

writeFileSync("weekly-report.html", html);
writeFileSync("weekly-report-shape.json", JSON.stringify(shape, null, 2));
console.log(JSON.stringify(shape));

const key = process.env.RESEND_API_KEY;
const to = process.env.REPORT_TO;
if (process.env.REPORT_SEND === "false") {
  console.log("REPORT_SEND=false — not sent.");
} else if (!key || !to) {
  console.log("RESEND_API_KEY or REPORT_TO not set — report saved to weekly-report.html only.");
} else {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "لوحة سفرتنا <no-reply@sfrtna.com>",
      to: to.split(",").map((s) => s.trim()).filter(Boolean),
      subject: `📊 لوحة سفرتنا: ${n(visits)} زيارة، ${n(searches)} بحث، ${n(clicks)} نقرة حجز`,
      html,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  console.log("Email sent.");
}
