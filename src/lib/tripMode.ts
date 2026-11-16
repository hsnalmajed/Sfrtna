/**
 * «وضع الرحلة» (16 Nov 2026): what the iPhone app keeps of a trip plan.
 *
 * The app shows sfrtna.com live, so with no internet it shows nothing. A
 * plan kept on the phone is therefore drawn here as ONE self-contained page
 * (no scripts, no fonts or pictures from the network) that the app stores
 * and opens offline, plus the list of reminders the app schedules as local
 * notifications (mobile/ios/App/App/AppDelegate.swift → TripAlerts):
 * a week and three days before, the morning of departure, each day's first
 * stop, and — only when switched on — the five prayers in the city's own
 * time. Each reminder carries the city's time zone, so it fires at the right
 * moment wherever the phone is when it is set.
 *
 * Only what the plan already holds goes in: no prices, nothing invented.
 * Loaded on demand (dynamic import), so the time-zone table never reaches
 * pages that do not keep a plan.
 */

import TIMEZONES from "@/data/cityTimezones.json";
import type { PlanDay, PlanItem, SmartPlan } from "@/lib/ai/plan";

const TZ = TIMEZONES as Record<string, string>;
const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

export interface TripNotice {
  kind: "remind" | "prayer";
  /** YYYY-MM-DD and HH:MM in `tz` (the phone's own zone when absent). */
  date: string;
  time: string;
  tz?: string;
  title: string;
  body: string;
}

/** The words (dict.tripMode + a few of dict.smart), in the plan's language. */
export interface TripWords {
  day: string; // «اليوم {n}»
  prayersTitle: string;
  prayers: Record<(typeof PRAYERS)[number], string>;
  weather: string;
  wear: string;
  onMap: string;
  dayRoute: string;
  before: string;
  packing: string;
  etiquette: string;
  transport: string;
  money: string;
  phrases: string;
  safety: string;
  emergency: string;
  offlineBadge: string;
  keptOn: string; // «حُفظت على جوالك {date}»
  nWeekTitle: string;
  nWeekBody: string;
  nThreeTitle: string;
  nThreeBody: string;
  nDepartTitle: string;
  nDepartBody: string;
  nDayTitle: string;
  nDayBody: string;
  nPrayerTitle: string;
  nPrayerBody: string;
}

export interface OfflinePlanInput {
  locale: "ar" | "en";
  id: string;
  title: string;
  subtitle: string;
  summary?: string;
  /** The trip's name for reminders (a city, or a country on a route). */
  place: string;
  city: SmartPlan["city"];
  from: string;
  to: string;
  days: PlanDay[];
  essentials?: SmartPlan["essentials"];
  words: TripWords;
}

export interface OfflinePlan {
  id: string;
  title: string;
  subtitle: string;
  from: string;
  to: string;
  lang: "ar" | "en";
  html: string;
  notices: TripNotice[];
  /** The days in short for the app's «اليوم» screen. */
  days: { date: string; city: string; stops: { time: string; name: string }[] }[];
  /** Every stop with its time, for «أضف إلى تقويم جوالي» (iPhone, feature «calendar»). */
  events: CalendarStop[];
}

/** One stop as a phone-calendar event, in the city's own time zone. */
export interface CalendarStop {
  date: string;
  time: string;
  minutes: number;
  tz?: string;
  title: string;
  place: string;
  notes: string;
  lat?: number;
  lon?: number;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** HH:MM minus `min` minutes, on the same day (null before midnight). */
function earlier(hm: string, min: number): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm);
  if (!m) return null;
  const t = Number(m[1]) * 60 + Number(m[2]) - min;
  if (t < 0) return null;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

const isStop = (it: PlanItem) => it.kind === "place" || it.kind === "meal";

function mapHref(it: PlanItem): string | null {
  if (typeof it.lat === "number" && typeof it.lon === "number") return `https://www.google.com/maps/search/?api=1&query=${it.lat},${it.lon}`;
  if (it.mapQuery) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(it.mapQuery)}`;
  return null;
}

function routeHref(items: PlanItem[]): string | null {
  const pts = items.filter((i) => i.kind !== "move" && typeof i.lat === "number").map((i) => `${i.lat},${i.lon}`);
  if (pts.length < 2) return null;
  const list = pts.slice(0, 10);
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  u.searchParams.set("origin", list[0]);
  u.searchParams.set("destination", list[list.length - 1]);
  if (list.length > 2) u.searchParams.set("waypoints", list.slice(1, -1).join("|"));
  return u.toString();
}

/** The reminders of a plan (the app keeps the next 60 of all plans). */
export function planNotices(input: OfflinePlanInput): TripNotice[] {
  const w = input.words;
  const out: TripNotice[] = [];
  const place = input.place;
  out.push({ kind: "remind", date: addDays(input.from, -7), time: "20:00", title: fill(w.nWeekTitle, { place }), body: w.nWeekBody });
  const pack = (input.essentials?.packing ?? []).slice(0, 3).join(input.locale === "ar" ? "، " : ", ");
  out.push({
    kind: "remind",
    date: addDays(input.from, -3),
    time: "20:00",
    title: fill(w.nThreeTitle, { place }),
    body: pack ? fill(w.nThreeBody, { list: pack }) : w.nDepartBody,
  });
  out.push({ kind: "remind", date: input.from, time: "07:00", title: fill(w.nDepartTitle, { place }), body: w.nDepartBody });
  input.days.forEach((d, i) => {
    const city = d.city?.name ?? input.city.name;
    const tz = TZ[d.city?.slug ?? input.city.slug];
    if (!tz) return;
    const first = d.items.find((it) => isStop(it) && it.time);
    const at = first ? earlier(first.time, 30) : null;
    if (first && at) {
      out.push({
        kind: "remind",
        date: d.date,
        time: at,
        tz,
        title: fill(w.nDayTitle, { n: i + 1, city }),
        body: fill(w.nDayBody, { time: first.time, name: first.name }),
      });
    }
    if (d.prayers) {
      for (const k of PRAYERS) {
        const time = d.prayers[k];
        if (!/^\d{1,2}:\d{2}$/.test(time ?? "")) continue;
        const prayer = w.prayers[k];
        out.push({ kind: "prayer", date: d.date, time, tz, title: fill(w.nPrayerTitle, { prayer, city }), body: fill(w.nPrayerBody, { prayer, time, city }) });
      }
    }
  });
  return out;
}

const CSS = `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font:16px/1.6 -apple-system,"SF Arabic","Geeza Pro",system-ui,sans-serif;color:#0b1f3a;background:#f3f6fa}
a{color:#0b2d5b}
header.top{background:#0b2d5b;color:#fff;padding:22px 18px 18px}
header.top h1{margin:0;font-size:22px;line-height:1.35}
header.top p{margin:6px 0 0;color:rgba(255,255,255,.8);font-size:14px}
.badge{display:inline-block;margin-top:10px;background:#f8b840;color:#0b1f3a;border-radius:999px;padding:3px 12px;font-size:13px;font-weight:800}
.summary{margin:12px 14px 0;font-size:14px;color:#3b4b63}
nav.days{position:sticky;top:0;z-index:2;display:flex;gap:6px;overflow-x:auto;padding:10px 14px;background:rgba(243,246,250,.96);-webkit-backdrop-filter:blur(8px)}
nav.days a{flex:none;text-decoration:none;background:#fff;border:1px solid #d6dee8;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:800;color:#0b2d5b}
section.day{scroll-margin-top:60px;margin:12px 12px 0;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(11,45,91,.08)}
section.day>h2{margin:0;padding:12px 16px;background:#e8f1fb;font-size:17px;line-height:1.4}
section.day>h2 small{display:block;font-size:13px;color:#4a5d78;font-weight:600}
.inner{padding:12px 16px 16px}
.note{margin:0 0 8px;border-radius:12px;padding:8px 12px;font-size:14px}
.wx{background:#eef7ff}.wear{background:#f4efff}.info{background:#fff7e6}
.pr{margin:0 0 10px;background:#ecfaf3;border-radius:12px;padding:8px 10px}
.pr b{font-size:14px}
.pr ul{display:flex;gap:4px;margin:6px 0 0;padding:0;list-style:none}
.pr li{flex:1;text-align:center;background:rgba(255,255,255,.75);border-radius:10px;padding:4px 0;font-size:12px}
.pr li span{display:block;font-size:14px;font-weight:800;direction:ltr}
ol.stops{margin:0;padding:0;list-style:none}
ol.stops li{display:flex;gap:10px;padding:10px 0;border-top:1px dashed #d6dee8}
ol.stops li:first-child{border-top:0}
.t{flex:none;width:52px;font-weight:900;color:#0b2d5b;direction:ltr;text-align:center;font-size:14px}
.ic{flex:none;font-size:20px;line-height:1.3}
.b{min-width:0;flex:1}
.b strong{display:block;font-size:16px}
.b em{display:block;font-style:normal;color:#5a6b83;font-size:13px}
.b p{margin:4px 0 0;font-size:14px;color:#2e3f57}
.go{display:inline-block;margin-top:6px;font-size:13px;font-weight:800;text-decoration:none;background:#f3f6fa;border:1px solid #d6dee8;border-radius:999px;padding:4px 12px}
.move .b strong{color:#0d6a7a}
.route{display:block;margin-top:10px;text-align:center}
section.ess{scroll-margin-top:60px;margin:12px 12px 0;background:#fff;border-radius:18px;padding:14px 16px}
section.ess h2{margin:0 0 6px;font-size:17px}
section.ess h3{margin:12px 0 4px;font-size:15px}
section.ess ul{margin:0;padding-inline-start:20px;font-size:14px}
.sos{margin-top:12px;background:#fdecec;border-radius:12px;padding:8px 12px;font-weight:800;font-size:14px}
footer{margin:18px 12px 28px;text-align:center;color:#6b7a90;font-size:12px}
`;

/** The plan as one page the app opens with no internet. */
export function offlinePlanHtml(input: OfflinePlanInput, keptAt = new Date()): string {
  const w = input.words;
  const isAr = input.locale === "ar";
  const fmtDay = (iso: string) =>
    new Intl.DateTimeFormat(isAr ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
      new Date(`${iso}T00:00:00Z`),
    );
  const kept = new Intl.DateTimeFormat(isAr ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(keptAt);

  const stop = (it: PlanItem) => {
    if (it.kind === "break") return "";
    const href =
      it.kind === "move" && it.from && typeof it.lat === "number"
        ? `https://www.google.com/maps/dir/?api=1&origin=${it.from.lat},${it.from.lon}&destination=${it.lat},${it.lon}&travelmode=driving`
        : mapHref(it);
    const icon = it.kind === "move" ? "🚗" : it.kind === "meal" ? "🍽️" : it.icon || "📍";
    const lines = [it.why, it.tip && `💡 ${it.tip}`, it.hours && `🕘 ${it.hours}`, it.kind === "meal" && it.dish && `🍲 ${it.dish}`].filter(Boolean) as string[];
    return `<li class="${it.kind}"><span class="t">${esc(it.time)}</span><span class="ic">${esc(icon)}</span><div class="b"><strong>${esc(it.name)}</strong>${
      it.area ? `<em>${esc(it.area)}</em>` : ""
    }${lines.map((l) => `<p>${esc(l)}</p>`).join("")}${href ? `<a class="go" href="${esc(href)}">🗺️ ${esc(w.onMap)}</a>` : ""}</div></li>`;
  };

  const days = input.days
    .map((d, i) => {
      const route = routeHref(d.items);
      const head = `${fill(w.day, { n: i + 1 })} · ${fmtDay(d.date)}`;
      const sub = [d.city?.name, d.title].filter(Boolean).join(" · ");
      const prayers = d.prayers
        ? `<div class="pr"><b>🕌 ${esc(w.prayersTitle)}</b><ul>${PRAYERS.map((k) => `<li>${esc(w.prayers[k])}<span>${esc(d.prayers?.[k])}</span></li>`).join("")}</ul></div>`
        : "";
      return `<section class="day" id="d${i + 1}"><h2>${esc(head)}${sub ? `<small>${esc(sub)}</small>` : ""}</h2><div class="inner">${
        d.weather ? `<p class="note wx">🌤 <b>${esc(w.weather)}:</b> ${esc(d.weather)}</p>` : ""
      }${d.wear ? `<p class="note wear">👕 <b>${esc(w.wear)}:</b> ${esc(d.wear)}</p>` : ""}${prayers}${(d.notes ?? [])
        .map((n) => `<p class="note info">ℹ️ ${esc(n)}</p>`)
        .join("")}<ol class="stops">${d.items.map(stop).join("")}</ol>${route ? `<a class="go route" href="${esc(route)}">🧭 ${esc(w.dayRoute)}</a>` : ""}</div></section>`;
    })
    .join("");

  const ess = input.essentials;
  const blocks = ess
    ? (
        [
          ["🎒", w.packing, ess.packing],
          ["🤝", w.etiquette, ess.etiquette],
          ["🚇", w.transport, ess.transport],
          ["💳", w.money, ess.money],
          ["🗣️", w.phrases, ess.phrases],
          ["🛡️", w.safety, ess.safety],
        ] as [string, string, string[]][]
      ).filter(([, , list]) => list && list.length > 0)
    : [];
  const essHtml =
    blocks.length || ess?.emergency
      ? `<section class="ess" id="before"><h2>🧳 ${esc(w.before)}</h2>${blocks
          .map(([icon, head, list]) => `<h3>${icon} ${esc(head)}</h3><ul>${list.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`)
          .join("")}${ess?.emergency ? `<p class="sos">🚨 ${esc(w.emergency)}: ${esc(ess.emergency)}</p>` : ""}</section>`
      : "";

  const nav = input.days.map((_, i) => `<a href="#d${i + 1}">${esc(fill(w.day, { n: i + 1 }))}</a>`).join("") + (essHtml ? `<a href="#before">🧳 ${esc(w.before)}</a>` : "");

  return `<!DOCTYPE html><html lang="${input.locale}" dir="${isAr ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${esc(
    input.title,
  )}</title><style>${CSS}</style></head><body><header class="top"><h1>${esc(input.title)}</h1><p>${esc(input.subtitle)}</p><span class="badge">📲 ${esc(
    w.offlineBadge,
  )}</span></header>${input.summary ? `<p class="summary">${esc(input.summary)}</p>` : ""}<nav class="days">${nav}</nav>${days}${essHtml}<footer>${esc(
    fill(w.keptOn, { date: kept }),
  )} · sfrtna.com</footer></body></html>`;
}

export function buildOfflinePlan(input: OfflinePlanInput): OfflinePlan {
  return {
    id: input.id,
    title: input.title,
    subtitle: input.subtitle,
    from: input.from,
    to: input.to,
    lang: input.locale,
    html: offlinePlanHtml(input),
    notices: planNotices(input),
    days: input.days.map((d) => ({
      date: d.date,
      city: d.city?.name ?? input.city.name,
      stops: d.items.filter((it) => isStop(it) && it.time).map((it) => ({ time: it.time, name: it.name })),
    })),
    events: input.days.flatMap((d) => {
      const city = d.city?.name ?? input.city.name;
      const tz = TZ[d.city?.slug ?? input.city.slug];
      return d.items
        .filter((it) => isStop(it) && /^\d{1,2}:\d{2}$/.test(it.time ?? ""))
        .map((it) => ({
          date: d.date,
          time: it.time,
          minutes: Math.min(Math.max(it.durationMin || 60, 15), 360),
          tz,
          title: `${it.kind === "meal" ? "🍽️" : it.icon ?? "📍"} ${it.name}`,
          place: [it.localName && it.localName !== it.name ? it.localName : "", it.area, city].filter(Boolean).join("، "),
          notes: [it.why, it.tip, mapHref(it) ? `${input.words.onMap}: ${mapHref(it)}` : ""].filter(Boolean).join("\n"),
          lat: it.lat,
          lon: it.lon,
        }));
    }),
  };
}
