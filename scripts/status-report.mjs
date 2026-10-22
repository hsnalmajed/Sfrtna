// The owner's status email, twice a day (owner, 22 Oct 2026: "an email twice
// a day telling me whether the site and the app work, and how long each page
// takes to open").
//
//   node scripts/status-report.mjs            (.github/workflows/status-report.yml)
//
// What it checks, in this order:
//   1. The site check (scripts/smoke.mjs): every search, sign-in, SEO and
//      protection check the site has — ✓ / ✗ per line.
//   2. Each main page, timed: three loads after a warm-up, median time to the
//      first byte and to the whole page, size, and whether the edge cache
//      answered. Measured from GitHub's machine (USA/Europe) at the Worker's
//      workers.dev address, so a visitor in Saudi Arabia adds the distance;
//      what matters is the trend and any page that is slow or failing.
//   3. The app: the same pages with the app's user agent (the app is a shell
//      around the live site), and the last Android build.
//   4. Since the previous report: how many automatic site checks passed, and
//      which background jobs failed.
//   5. The site's own health page: flight search, HERE, Viator, sign-in,
//      the email sender's last error.
//
// Sends through Resend (RESEND_API_KEY, from no-reply@sfrtna.com, the domain
// already verified for sign-in codes) to REPORT_TO. Both are GitHub secrets:
// this repository is public, so no address is written here. Without them the
// report is only printed (and saved to status-report.html).

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SMOKE = fileURLToPath(new URL("./smoke.mjs", import.meta.url));

const BASE = (process.env.REPORT_BASE || "https://sfrtna.almajedhsn.workers.dev").replace(/\/$/, "");
const TOKEN = process.env.SMOKE_TOKEN || "";
const REPO = process.env.GITHUB_REPOSITORY || "hsnalmajed/Sfrtna";
const GH = process.env.GITHUB_TOKEN || "";
const HOURS = Number(process.env.REPORT_HOURS || 12);
const UA_WEB =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36 SfrtnaReport/1";
const UA_APP = `${UA_WEB} SfrtnaApp/1`;

/** Pages a visitor opens most, with the name the owner knows them by. */
const PAGES = [
  ["/ar", "الرئيسية"],
  ["/ar/attractions", "الوجهات"],
  ["/ar/attractions/TR/istanbul", "صفحة مدينة (إسطنبول)"],
  ["/ar/attractions/AE/dubai", "صفحة مدينة (دبي)"],
  ["/ar/attractions/TR", "صفحة دولة (تركيا)"],
  ["/ar/seasons", "المواسم"],
  ["/ar/visa", "التأشيرات"],
  ["/ar/visa/TR", "تأشيرة دولة (تركيا)"],
  ["/ar/maps", "الخرائط"],
  ["/ar/services", "خدمات رحلتك"],
  ["/ar/itinerary", "خطتك السياحية"],
  ["/ar/budget", "مستشار الميزانية"],
  ["/ar/account", "حسابي"],
  ["/en", "Home (English)"],
];
const APP_PAGES = ["/ar", "/ar/attractions/TR/istanbul", "/ar/account"];

const SLOW_MS = 1500; // whole page, from GitHub's machine
const VERY_SLOW_MS = 3000;

const problems = [];
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

// ── 1. Site check ──────────────────────────────────────────────────────────
function siteCheck() {
  const r = spawnSync(process.execPath, [SMOKE, BASE], {
    encoding: "utf8",
    env: { ...process.env, GITHUB_ACTIONS: "" },
    timeout: 15 * 60_000,
  });
  const lines = `${r.stdout || ""}\n${r.stderr || ""}`.split("\n").map((l) => l.trim());
  const passed = lines.filter((l) => l.startsWith("✓"));
  const failed = lines.filter((l) => l.startsWith("✗"));
  const signIn = passed.find((l) => l.includes("signed-out answer")) || "";
  for (const f of failed) problems.push(`فحص الموقع: ${f.slice(2)}`);
  if (r.error) problems.push(`فحص الموقع لم يكتمل: ${r.error.message}`);
  else if (!passed.length || (r.status !== 0 && !failed.length)) {
    problems.push(`فحص الموقع لم يعمل كما يجب (رمز الخروج ${r.status}): ${lines.filter(Boolean).slice(-2).join(" | ").slice(0, 200)}`);
  }
  return { passed, failed, signIn };
}

// ── 2/3. Page timings ──────────────────────────────────────────────────────
async function timeOnce(path, ua) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    headers: { "User-Agent": ua, Accept: "text/html", "x-sfrtna-smoke": TOKEN },
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  const ttfb = performance.now() - t0;
  const body = await res.arrayBuffer();
  const total = performance.now() - t0;
  return { status: res.status, ttfb, total, kb: body.byteLength / 1024, edge: res.headers.get("x-sfr-edge") || "—" };
}

async function timePage(path, ua) {
  try {
    await timeOnce(path, ua); // warm-up: the first visit after a deploy renders
    const runs = [];
    for (let i = 0; i < 3; i++) runs.push(await timeOnce(path, ua));
    const last = runs[runs.length - 1];
    return {
      status: last.status,
      ttfb: median(runs.map((r) => r.ttfb)),
      total: median(runs.map((r) => r.total)),
      worst: Math.max(...runs.map((r) => r.total)),
      kb: last.kb,
      edge: last.edge,
    };
  } catch (err) {
    return { status: `خطأ: ${err instanceof Error ? err.message : String(err)}`, ttfb: NaN, total: NaN, worst: NaN, kb: 0, edge: "—" };
  }
}

async function pages() {
  const web = [];
  for (const [path, name] of PAGES) {
    const t = await timePage(path, UA_WEB);
    web.push({ path, name, ...t });
    if (t.status !== 200) problems.push(`الصفحة «${name}» (${path}) ردّت ${t.status}`);
    else if (t.total >= VERY_SLOW_MS) problems.push(`الصفحة «${name}» بطيئة جداً: ${(t.total / 1000).toFixed(1)} ث`);
  }
  const app = [];
  for (const path of APP_PAGES) {
    const t = await timePage(path, UA_APP);
    app.push({ path, ...t });
    if (t.status !== 200) problems.push(`التطبيق: الصفحة ${path} ردّت ${t.status}`);
  }
  return { web, app };
}

// ── 4. GitHub: automatic checks and background jobs ────────────────────────
async function gh(path) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    headers: { Accept: "application/vnd.github+json", ...(GH ? { Authorization: `Bearer ${GH}` } : {}) },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return res.json();
}

async function github() {
  const since = Date.now() - HOURS * 3600_000;
  const out = { checks: { pass: 0, fail: 0, failTimes: [] }, jobs: [], android: null, error: null };
  try {
    const runs = (await gh("actions/runs?per_page=100")).workflow_runs || [];
    const recent = runs.filter((r) => Date.parse(r.run_started_at || r.created_at) >= since && r.status === "completed");
    for (const r of recent) {
      if (r.name === "Site check") {
        if (r.conclusion === "success") out.checks.pass++;
        else if (r.conclusion === "failure") {
          out.checks.fail++;
          out.checks.failTimes.push(r.run_started_at);
        }
      } else if (r.name !== "Status report" && r.conclusion === "failure") {
        out.jobs.push({ name: r.name, at: r.run_started_at, url: r.html_url });
      }
    }
    const running = runs.filter((r) => r.status === "in_progress" && r.name !== "Status report");
    out.running = running.map((r) => ({ name: r.name, since: r.run_started_at }));
    const android = runs.find((r) => r.name && /android/i.test(r.name) && r.status === "completed");
    if (android) out.android = { at: android.run_started_at, conclusion: android.conclusion };
  } catch (err) {
    out.error = err instanceof Error ? err.message : String(err);
  }
  if (out.checks.fail) problems.push(`فشل ${out.checks.fail} من ${out.checks.pass + out.checks.fail} فحوص تلقائية خلال آخر ${HOURS} ساعة`);
  for (const j of out.jobs) problems.push(`مهمة خلفية فشلت: ${j.name}`);
  return out;
}

// ── 6. Visitors' notes («شاركنا رأيك») ─────────────────────────────────────
// Counts only: this page is also pushed to a public branch, so no note text
// or address goes in it — each note reaches the owner's inbox in full.
const FB_KIND = { problem: "مشكلة", wrong: "معلومة غير دقيقة", idea: "فكرة", opinion: "رأي", question: "سؤال" };
const FB_AREA = {
  flights: "الطيران", hotels: "الفنادق", discover: "اقترح لي وجهة", plan: "الخطة", destinations: "الوجهات",
  visa: "التأشيرات", seasons: "المواسم", budget: "الميزانية", services: "خدمات الرحلة", account: "حسابي", app: "التطبيق", other: "أخرى",
};
async function feedback() {
  try {
    const res = await fetch(`${BASE}/api/feedback/recent?hours=${HOURS}`, {
      headers: { "x-sfrtna-smoke": TOKEN, "User-Agent": UA_WEB },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const { items = [] } = await res.json();
    const by = (key, names) => {
      const m = new Map();
      for (const it of items) m.set(names[it[key]] || it[key], (m.get(names[it[key]] || it[key]) || 0) + 1);
      return [...m].sort((a, b) => b[1] - a[1]);
    };
    const rated = items.filter((i) => i.rating);
    return {
      count: items.length,
      kinds: by("kind", FB_KIND),
      areas: by("area", FB_AREA),
      avg: rated.length ? rated.reduce((a, i) => a + i.rating, 0) / rated.length : null,
      refs: items.slice(0, 20).map((i) => i.ref),
    };
  } catch (err) {
    return { count: 0, kinds: [], areas: [], avg: null, refs: [], error: err.message };
  }
}

// ── 5. The site's own health page ──────────────────────────────────────────
async function health() {
  try {
    const res = await fetch(`${BASE}/api/health`, {
      headers: { "x-sfrtna-smoke": TOKEN, "Sec-Fetch-Site": "same-origin", "User-Agent": UA_WEB },
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const h = await res.json();
    const rows = [
      [
        "بحث الطيران (الشريك)",
        h.flightProbe?.ok ? `يعمل — ${h.flightProbe.offers} عرض في بحث تجريبي` : `لا يعمل ${h.flightProbe?.error ? `(${h.flightProbe.error})` : ""}`,
        Boolean(h.flightProbe?.ok && h.flightProbe.offers > 0),
      ],
      [
        "أسماء الفنادق (HERE)",
        `${h.here?.status === 200 ? "يعمل" : `لا يعمل (${h.here?.status ?? "—"})`}${
          h.here?.usage
            ? ` — اليوم ${h.here.usage.today} من ${h.here.usage.dailyCap}، الشهر ${h.here.usage.month} من ${h.here.usage.monthlyCap}`
            : ""
        }`,
        h.here?.status === 200,
      ],
      [
        "الأنشطة (Viator)",
        !h.viator ? "—" : !h.viator.key ? "المفتاح غير موجود" : h.viator.lastError ? `آخر خطأ: ${String(h.viator.lastError).slice(0, 120)}` : `يعمل — ${h.viator.destinations ?? 0} وجهة`,
        Boolean(h.viator?.key && !h.viator.lastError),
      ],
      // Shown, not counted: the site's photos come from a stored file, so a
      // spent Pexels allowance only slows the photo job, never a page.
      ["الصور (Pexels) — للمهام الخلفية فقط", `${h.pexels?.status ?? "—"}${h.pexels?.remaining ? ` — متبقٍ ${h.pexels.remaining}` : ""}`, h.pexels?.status === 200 || h.pexels?.status === "skipped", false],
      ["الدخول بجوجل", h.keys?.googleSignIn ? "مفعّل" : "مطفأ", Boolean(h.keys?.googleSignIn)],
      ["الدخول بالبريد", h.keys?.emailSignIn ? "مفعّل" : "مطفأ", Boolean(h.keys?.emailSignIn)],
      ["آخر خطأ في إرسال البريد", h.emailLastError ? `${h.emailLastError.at}: ${h.emailLastError.message}` : "لا يوجد", !h.emailLastError],
    ];
    for (const [name, value, ok, counts = true] of rows) if (!ok && counts) problems.push(`${name}: ${value}`);
    return { rows };
  } catch (err) {
    problems.push(`صفحة الصحة لم تُقرأ: ${err instanceof Error ? err.message : String(err)}`);
    return { rows: [] };
  }
}

// ── Email ──────────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ms = (x) => (Number.isFinite(x) ? `${(x / 1000).toFixed(2)} ث` : "—");
const riyadh = (iso) =>
  new Date(iso).toLocaleString("ar-SA-u-nu-latn", { timeZone: "Asia/Riyadh", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

function speedColor(t) {
  if (!Number.isFinite(t)) return "#b42318";
  if (t >= VERY_SLOW_MS) return "#b42318";
  if (t >= SLOW_MS) return "#b54708";
  return "#067647";
}

function render({ check, timing, hub, hl, fb, started }) {
  const ok = problems.length === 0;
  const avg = timing.web.filter((p) => Number.isFinite(p.total));
  const avgTotal = avg.length ? avg.reduce((a, p) => a + p.total, 0) / avg.length : NaN;
  const slowest = [...avg].sort((a, b) => b.total - a.total)[0];
  const td = 'style="padding:8px 10px;border-bottom:1px solid #eaecf0;text-align:right"';
  const th = 'style="padding:8px 10px;background:#f2f4f7;text-align:right;font-weight:700"';

  const pageRows = timing.web
    .map(
      (p) => `<tr><td ${td}>${esc(p.name)}<br><span style="color:#667085;font-size:12px" dir="ltr">${esc(p.path)}</span></td>
<td ${td}><b style="color:${p.status === 200 ? "#067647" : "#b42318"}">${p.status === 200 ? "يعمل" : esc(p.status)}</b></td>
<td ${td}><b style="color:${speedColor(p.total)}">${ms(p.total)}</b><br><span style="color:#667085;font-size:12px">أسوأ ${ms(p.worst)}</span></td>
<td ${td}>${ms(p.ttfb)}</td><td ${td}>${Math.round(p.kb)} KB</td><td ${td}>${p.edge === "HIT" || p.edge === "STALE" ? "من الذاكرة" : p.edge === "MISS" ? "رُسمت الآن" : "—"}</td></tr>`
    )
    .join("");

  const appRows = timing.app
    .map((p) => `<li><span dir="ltr">${esc(p.path)}</span>: ${p.status === 200 ? `يعمل — ${ms(p.total)}` : `<b style="color:#b42318">${esc(p.status)}</b>`}</li>`)
    .join("");

  const healthRows = hl.rows
    .map(([n, v, good]) => `<tr><td ${td}>${esc(n)}</td><td ${td}><span style="color:${good ? "#067647" : "#b42318"}">${good ? "✅" : "⚠️"}</span> ${esc(v)}</td></tr>`)
    .join("");

  const failedChecks = check.failed.map((f) => `<li>${esc(f.slice(2))}</li>`).join("");
  const jobs = hub.jobs.map((j) => `<li>${esc(j.name)} — ${esc(riyadh(j.at))}</li>`).join("");
  const running = (hub.running || []).map((j) => `<li>${esc(j.name)} — يعمل منذ ${esc(riyadh(j.since))}</li>`).join("");

  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f8f9fb;font-family:Tahoma,Arial,sans-serif;color:#101828">
<div style="max-width:720px;margin:0 auto;padding:20px">
<h1 style="font-size:20px;margin:0 0 4px">تقرير حالة سفرتنا</h1>
<p style="color:#667085;margin:0 0 16px">${esc(riyadh(started))} — آخر ${HOURS} ساعة</p>

<div style="padding:14px 16px;border-radius:12px;background:${ok ? "#ecfdf3" : "#fef3f2"};border:1px solid ${ok ? "#abefc6" : "#fecdca"}">
<b style="font-size:16px">${ok ? "✅ كل شيء يعمل" : `⚠️ ${countProblems(problems.length)} — تحتاج انتباه`}</b>
${ok ? "" : `<ul style="margin:8px 0 0;padding-inline-start:20px">${problems.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`}
</div>

<h2 style="font-size:16px;margin:22px 0 8px">باختصار</h2>
<ul style="margin:0;padding-inline-start:20px;line-height:1.9">
<li>فحص الموقع الآن: <b>${check.passed.length} نجح</b>${check.failed.length ? `، <b style="color:#b42318">${check.failed.length} فشل</b>` : ""}</li>
<li>الفحوص التلقائية خلال آخر ${HOURS} ساعة: <b>${hub.checks.pass} نجح</b>${hub.checks.fail ? `، <b style="color:#b42318">${hub.checks.fail} فشل</b>` : ""}</li>
<li>متوسط فتح الصفحة: <b>${ms(avgTotal)}</b>${slowest ? ` — الأبطأ: ${esc(slowest.name)} (${ms(slowest.total)})` : ""}</li>
<li>التطبيق: ${timing.app.every((p) => p.status === 200) ? "<b>يعمل</b>" : '<b style="color:#b42318">فيه مشكلة</b>'}${hub.android ? ` — آخر نسخة أندرويد: ${hub.android.conclusion === "success" ? "بُنيت بنجاح" : esc(hub.android.conclusion)} (${esc(riyadh(hub.android.at))})` : ""}</li>
</ul>
${failedChecks ? `<h3 style="font-size:14px;margin:14px 0 6px;color:#b42318">ما فشل في فحص الموقع</h3><ul style="margin:0;padding-inline-start:20px">${failedChecks}</ul>` : ""}

<h2 style="font-size:16px;margin:22px 0 8px">سرعة الصفحات</h2>
<p style="color:#667085;font-size:12px;margin:0 0 8px">متوسط ثلاث مرات فتح لكل صفحة، مقيسة من خادم GitHub في أمريكا/أوروبا، فالزائر في السعودية يضيف المسافة. الأخضر أقل من ${SLOW_MS / 1000} ث، والبرتقالي أقل من ${VERY_SLOW_MS / 1000} ث، والأحمر أبطأ.</p>
<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eaecf0;font-size:13px">
<tr><th ${th}>الصفحة</th><th ${th}>الحالة</th><th ${th}>وقت الفتح</th><th ${th}>أول رد</th><th ${th}>الحجم</th><th ${th}>المصدر</th></tr>
${pageRows}</table>

<h2 style="font-size:16px;margin:22px 0 8px">التطبيق</h2>
<ul style="margin:0;padding-inline-start:20px">${appRows}</ul>

<h2 style="font-size:16px;margin:22px 0 8px">الشركاء والخدمات</h2>
${healthRows ? `<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eaecf0;font-size:13px">${healthRows}</table>` : "<p>لم تُقرأ.</p>"}

<h2 style="font-size:16px;margin:22px 0 8px">ملاحظات الزوار</h2>
${fb.error ? `<p style="color:#b42318">تعذّرت قراءتها: ${esc(fb.error)}</p>` : fb.count === 0 ? '<p style="margin:0">لم تصل ملاحظات خلال هذه الفترة.</p>' : `<p style="margin:0 0 6px"><b>${fb.count}</b> ملاحظة — ${fb.kinds.map(([k, n]) => `${esc(k)} ${n}`).join("، ")}</p>
<p style="margin:0 0 6px">الأقسام: ${fb.areas.map(([k, n]) => `${esc(k)} ${n}`).join("، ")}</p>
${fb.avg ? `<p style="margin:0 0 6px">متوسط التقييم: <b>${fb.avg.toFixed(1)} من 5</b></p>` : ""}
<p style="margin:0;color:#667085;font-size:12px">نص كل ملاحظة وصلك في بريد مستقل. الأرقام: <span dir="ltr">${fb.refs.map(esc).join(" ")}</span></p>`}

<h2 style="font-size:16px;margin:22px 0 8px">المهام الخلفية</h2>
${jobs ? `<p style="margin:0 0 4px;color:#b42318">فشلت:</p><ul style="margin:0;padding-inline-start:20px">${jobs}</ul>` : "<p style=\"margin:0\">لم تفشل أي مهمة.</p>"}
${running ? `<p style="margin:8px 0 4px">تعمل الآن:</p><ul style="margin:0;padding-inline-start:20px">${running}</ul>` : ""}
${hub.error ? `<p style="color:#b42318">تعذّرت قراءة GitHub: ${esc(hub.error)}</p>` : ""}

<p style="color:#98a2b3;font-size:12px;margin-top:28px">يصلك هذا التقرير مرتين يومياً (نحو 8 صباحاً و8 مساءً بتوقيت السعودية) من الملف .github/workflows/status-report.yml.</p>
</div></body></html>`;
}

/** "مشكلة واحدة", "مشكلتان", "3 مشاكل", "11 مشكلة". */
function countProblems(n) {
  if (n === 1) return "مشكلة واحدة";
  if (n === 2) return "مشكلتان";
  if (n >= 3 && n <= 10) return `${n} مشاكل`;
  return `${n} مشكلة`;
}

function plain() {
  return problems.length ? `⚠️ ${countProblems(problems.length)}:\n- ${problems.join("\n- ")}` : "✅ كل شيء يعمل.";
}

async function send(subject, html) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_TO;
  if (!key || !to) {
    console.log("RESEND_API_KEY or REPORT_TO not set — report saved to status-report.html only.");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "تقارير سفرتنا <no-reply@sfrtna.com>",
      to: to.split(",").map((s) => s.trim()).filter(Boolean),
      subject,
      html,
      text: plain(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return true;
}

// ── Run ────────────────────────────────────────────────────────────────────
const started = new Date().toISOString();
const check = siteCheck();
const timing = await pages();
const hub = await github();
const hl = await health();
const fb = await feedback();

const html = render({ check, timing, hub, hl, fb, started });
writeFileSync("status-report.html", html);
const when = new Date(started).toLocaleString("ar-SA-u-nu-latn", { timeZone: "Asia/Riyadh", weekday: "long", hour: "numeric" });
const subject = problems.length
  ? `⚠️ سفرتنا: ${countProblems(problems.length)} — ${when}`
  : `✅ سفرتنا: كل شيء يعمل — ${when}`;
console.log(subject);
console.log(plain());
const sent = await send(subject, html);
console.log(sent ? "Email sent." : "Email not sent.");
