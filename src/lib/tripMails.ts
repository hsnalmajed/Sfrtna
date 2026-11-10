/**
 * Trip emails (owner, 6 Nov 2026, growth doc item 5 «رحلة المسافر معنا»).
 *
 * Who gets them: a signed-in traveller who ticked the box himself (consent
 * table, accounts.js) and pressed «احجز» on a flight (trip item `pickedAt`).
 * What, and when (Riyadh time; the timed ones only between 09:00 and 21:00):
 *
 *   ready    1–24 h after «احجز»       «N أشياء جهّزها الآن»: visa, hotel,
 *                                      eSIM, airport transfer, activities
 *   week     5–7 days before leaving    what is still not ticked in «رحلتي»
 *   esim     1–3 days before leaving    the eSIM, so it works on landing
 *   arrival  the day of arrival (or +1) day one of the plan + tickets
 *   after    1–3 days after return      compensation for a late flight, and
 *                                      «وين وجهتك القادمة؟»
 *
 * Rules (doc): at most 5 per trip (one of each kind); a step ticked in
 * «رحلتي» is never mentioned again and a mail left with nothing in it is not
 * sent; no prices in any mail — every button opens the live prices on our
 * site; an unsubscribe link in every mail (Saudi PDPL) plus the one-click
 * List-Unsubscribe header; at most one mail a day per trip.
 *
 * This file only decides and writes; src/app/api/trip-mail/run/route.ts
 * sends (hourly, from the Worker's cron in edge-worker.js).
 */

import { cleanItem, type Trip, type TripStep } from "@/lib/memberItems";
import { stepHref, tripCityName, tripSteps } from "@/components/member/tripLinks";
import { findCountry } from "@/lib/countries";

export type MailKind = "ready" | "week" | "esim" | "arrival" | "after";
export const MAIL_KINDS: MailKind[] = ["ready", "week", "esim", "arrival", "after"];
export const MAX_PER_TRIP = 5;

const HOUR = 3_600_000;
const DAY = 86_400_000;
/** Riyadh is UTC+3 all year (no summer time). */
const RIYADH_MS = 3 * HOUR;

export interface Candidate {
  locale: string;
  key: string;
  trip: unknown;
  sent: { kind: string; at: number }[];
}

/** Today in Riyadh (YYYY-MM-DD) and the hour there. */
export function riyadhClock(now: number): { day: string; hour: number } {
  const d = new Date(now + RIYADH_MS);
  return { day: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
}

const dayDiff = (iso: string, today: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);

/** The stored trip, checked again (the mail never trusts a row blindly). */
export function tripOf(c: Candidate): Trip | null {
  const clean = cleanItem("trip", c.key, c.trip);
  return clean ? (clean.data as Trip) : null;
}

/** The kind this trip should get now, or null. One per trip per run. */
export function dueKind(c: Candidate, now: number): MailKind | null {
  const t = tripOf(c);
  if (!t || !t.pickedAt) return null;
  const sent = new Set(c.sent.map((s) => s.kind));
  if (sent.size >= MAX_PER_TRIP) return null;
  // At most one a day for a trip, whatever is due.
  if (c.sent.some((s) => now - s.at < 20 * HOUR)) return null;
  const { day, hour } = riyadhClock(now);
  const toDepart = dayDiff(t.depart, day);
  const daytime = hour >= 9 && hour < 21;
  const open = (k: MailKind) => !sent.has(k) && linesFor(k, t, c.locale === "en" ? "en" : "ar").length > 0;

  if (now >= t.pickedAt + HOUR && now <= t.pickedAt + DAY && toDepart >= 1 && open("ready")) return "ready";
  if (!daytime) return null;
  if (toDepart >= 5 && toDepart <= 7 && open("week")) return "week";
  if (toDepart >= 1 && toDepart <= 3 && open("esim")) return "esim";
  if (toDepart >= -1 && toDepart <= 0 && open("arrival")) return "arrival";
  if (t.back) {
    const sinceBack = -dayDiff(t.back, day);
    if (sinceBack >= 1 && sinceBack <= 3 && open("after")) return "after";
  }
  return null;
}

// ---- What each mail says ------------------------------------------------

type Line = "visa" | "hotel" | "esim" | "transfer" | "activities" | "plan" | "compensation" | "next";

export interface MailLine {
  id: Line;
  title: string;
  body: string;
  cta: string;
  /** Path on our site (or our /api/go redirect), without the host. */
  href: string;
}

const T = {
  ar: {
    visa: ["التأشيرة", (c: string) => `تحقق من متطلبات الدخول إلى ${c} بالجواز السعودي ومدة إصدارها.`, "متطلبات التأشيرة"],
    hotel: ["الفندق", () => "قارن أسعار الفنادق الحية لتواريخ رحلتك وعدد المسافرين.", "اعرض الفنادق"],
    esim: ["شريحة الاتصال", () => "شريحة إلكترونية تعمل لحظة هبوطك، بلا بحث عن محل اتصالات في المطار.", "قارن الشرائح"],
    transfer: ["التوصيل من المطار", () => "احجز سيارة تنتظرك عند الوصول بسعر معروف مسبقاً.", "قارن التوصيل"],
    activities: ["الأنشطة والتذاكر", () => "تذاكر المعالم والجولات مسبقاً، بلا طوابير.", "اعرض الأنشطة"],
    plan: ["خطة أيامك", (c: string) => `برنامج يومي لمعالم ${c} حسب تواريخ رحلتك.`, "افتح الخطة"],
    compensation: ["تأخرت رحلتك أو أُلغيت؟", () => "قد يحق لك تعويض عن الرحلة المتأخرة أو الملغاة. تحقق في دقيقتين.", "تحقق من التعويض"],
    next: ["وين وجهتك القادمة؟", () => "اكتب ميزانيتك ونقترح عليك وجهات بأسعار طيران حية.", "اقترح لي وجهة"],
  },
  en: {
    visa: ["Visa", (c: string) => `Check what you need to enter ${c} and how long it takes.`, "Visa requirements"],
    hotel: ["Hotel", () => "Compare live hotel prices for your dates and party.", "See hotels"],
    esim: ["eSIM", () => "A data eSIM that works the moment you land.", "Compare eSIMs"],
    transfer: ["Airport transfer", () => "A car waiting at arrivals, at a price known in advance.", "Compare transfers"],
    activities: ["Activities and tickets", () => "Skip-the-line tickets and tours, booked ahead.", "See activities"],
    plan: ["Your day plan", (c: string) => `A day-by-day plan for ${c} on your dates.`, "Open the plan"],
    compensation: ["Flight late or cancelled?", () => "You may be owed compensation. Check in two minutes.", "Check compensation"],
    next: ["Where to next?", () => "Enter your budget and we suggest places with live flight fares.", "Suggest a destination"],
  },
} as const;

function line(id: Line, locale: "ar" | "en", place: string, href: string | null): MailLine | null {
  if (!href) return null;
  const [title, body, cta] = T[locale][id];
  return { id, title, body: body(place), cta, href };
}

/** The lines of a mail for this trip; steps ticked in «رحلتي» are left out. */
export function linesFor(kind: MailKind, t: Trip, locale: "ar" | "en"): MailLine[] {
  const isAr = locale === "ar";
  const city = tripCityName(t, isAr);
  const country = t.code ? findCountry(t.code) : undefined;
  const countryName = country ? (isAr ? country.nameAr : country.nameEn) : city;
  const open = (s: TripStep) => tripSteps(t).includes(s) && !t.done.includes(s);
  const services = open("services") ? `${stepHref(locale, t, "services")}#trip-services` : null;
  const step = (s: TripStep) => (open(s) ? stepHref(locale, t, s) : null);
  const picks: (MailLine | null)[] = [];
  if (kind === "ready" || kind === "week") {
    picks.push(
      line("visa", locale, countryName, step("visa")),
      line("hotel", locale, city, step("hotel")),
      line("esim", locale, city, services),
      line("transfer", locale, city, services),
      line("activities", locale, city, services)
    );
    if (kind === "week") picks.push(line("plan", locale, city, step("plan")));
  } else if (kind === "esim") {
    picks.push(line("esim", locale, city, services));
  } else if (kind === "arrival") {
    // The plan is opened on arrival even when it was ticked: it is the day's guide.
    const plan = tripSteps(t).includes("plan") ? stepHref(locale, t, "plan") : null;
    picks.push(line("plan", locale, city, plan), line("activities", locale, city, services));
  } else if (kind === "after") {
    picks.push(line("compensation", locale, city, "/api/go/tp?b=airhelp"), line("next", locale, city, `/${locale}`));
  }
  return picks.filter((l): l is MailLine => l !== null);
}

// ---- Writing the mail ---------------------------------------------------

const AR_COUNT = ["", "شيء واحد", "شيئان", "3 أشياء", "4 أشياء", "5 أشياء", "6 أشياء"];

function subjectFor(kind: MailKind, locale: "ar" | "en", city: string, n: number): string {
  if (locale === "ar") {
    if (kind === "ready") return n >= 3 ? `رحلتك إلى ${city}: ${AR_COUNT[n]} جهّزها الآن` : `رحلتك إلى ${city}: ما بقي لتجهيزها`;
    if (kind === "week") return `باقي أسبوع على رحلتك إلى ${city}`;
    if (kind === "esim") return `جهّز شريحتك لتعمل لحظة هبوطك في ${city}`;
    if (kind === "arrival") return `أهلاً بك في ${city}!`;
    return `أهلاً بعودتك من ${city}`;
  }
  if (kind === "ready") return n >= 3 ? `Your trip to ${city}: ${n} things to sort out now` : `Your trip to ${city}: what is left to get ready`;
  if (kind === "week") return `One week to go: your trip to ${city}`;
  if (kind === "esim") return `Get your eSIM ready before you land in ${city}`;
  if (kind === "arrival") return `Welcome to ${city}!`;
  return `Welcome back from ${city}`;
}

function introFor(kind: MailKind, locale: "ar" | "en", city: string): string {
  if (locale === "ar") {
    if (kind === "ready") return `اخترت رحلتك إلى ${city}. هذه الأشياء تُحجز الآن قبل أن ترتفع أسعارها أو تنفد:`;
    if (kind === "week") return `بقي أسبوع على سفرك إلى ${city}. هذا ما لم تضع عليه علامة بعد في «رحلتي»:`;
    if (kind === "esim") return `سفرك إلى ${city} بعد أيام. جهّز شريحتك الآن لتصلك وتعمل فور هبوطك:`;
    if (kind === "arrival") return `نتمنى لك وصولاً سعيداً إلى ${city}. هذا ما يفيدك اليوم:`;
    return `نتمنى أن رحلتك إلى ${city} كانت ممتعة.`;
  }
  if (kind === "ready") return `You picked your trip to ${city}. These are best booked now, before prices rise or they sell out:`;
  if (kind === "week") return `One week until ${city}. Here is what is not ticked yet in «My trip»:`;
  if (kind === "esim") return `${city} is only days away. Set up your eSIM now so it works when you land:`;
  if (kind === "arrival") return `We hope you landed well in ${city}. Useful for today:`;
  return `We hope you enjoyed ${city}.`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Our address with the mail's tags (which mail, which line), for the counts. */
export function trackedUrl(site: string, path: string, kind: MailKind, id: string): string {
  const u = new URL(path, site);
  u.searchParams.set("utm_source", "trip_mail");
  u.searchParams.set("utm_medium", "email");
  u.searchParams.set("utm_campaign", kind);
  u.searchParams.set("utm_content", id);
  return u.toString();
}

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
  unsubUrl: string;
}

/** The mail, or null when nothing is left to say. */
export function renderMail(kind: MailKind, t: Trip, locale: "ar" | "en", unsub: string, site: string): RenderedMail | null {
  const lines = linesFor(kind, t, locale);
  if (!lines.length) return null;
  const ar = locale === "ar";
  const city = tripCityName(t, ar);
  const subject = subjectFor(kind, locale, city, lines.length);
  const intro = introFor(kind, locale, city);
  const unsubUrl = `${site}/api/unsub?t=${unsub}`;
  const manage = trackedUrl(site, `/${locale}/account#trip-mail`, kind, "manage");
  const myTrip = trackedUrl(site, `/${locale}/account#trips`, kind, "my_trip");
  const dates = t.back ? `${t.depart} → ${t.back}` : t.depart;
  const foot = ar
    ? "وصلتك هذه الرسالة لأنك طلبت تذكيرات رحلتك في سفرتنا. لا نكتب أسعاراً في البريد: كل زر يفتح الأسعار الحية."
    : "You get this because you asked for trip reminders on Sfrtna. No prices in email: every button opens live prices.";
  const unsubWord = ar ? "إلغاء الاشتراك" : "Unsubscribe";
  const manageWord = ar ? "إعدادات الرسائل" : "Email settings";
  const myTripWord = ar ? "افتح «رحلتي»" : "Open «My trip»";
  const dir = ar ? "rtl" : "ltr";
  const align = ar ? "right" : "left";
  const font = "Tahoma,Arial,sans-serif";

  const cards = lines
    .map((l) => {
      const href = esc(trackedUrl(site, l.href, kind, l.id));
      return `<tr><td style="padding:0 0 12px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #dbe8f7;border-radius:12px"><tr><td style="padding:16px;text-align:${align}">
<div style="font-family:${font};font-size:17px;font-weight:bold;color:#0b2d5b">${esc(l.title)}</div>
<div style="font-family:${font};font-size:14px;line-height:1.7;color:#3d4f66;margin:6px 0 12px">${esc(l.body)}</div>
<a href="${href}" style="display:inline-block;background:#f9880b;color:#ffffff;font-family:${font};font-size:15px;font-weight:bold;text-decoration:none;padding:10px 20px;border-radius:999px">${esc(l.cta)}</a>
</td></tr></table></td></tr>`;
    })
    .join("\n");

  const html = `<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#eff5fc">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eff5fc"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px" dir="${dir}">
<tr><td style="background:#0b2d5b;border-radius:14px 14px 0 0;padding:18px 20px;text-align:${align}">
<div style="font-family:${font};font-size:22px;font-weight:bold;color:#ffffff">${ar ? "سفرتنا" : "Sfrtna"}</div>
<div style="font-family:${font};font-size:13px;color:#dbe8f7;margin-top:4px" dir="ltr">${esc(t.origin)} ✈ ${esc(t.destination)} · ${esc(dates)}</div>
</td></tr>
<tr><td style="background:#ffeed4;padding:16px 20px;text-align:${align}">
<div style="font-family:${font};font-size:19px;font-weight:bold;color:#0b2d5b">${esc(subject)}</div>
<div style="font-family:${font};font-size:15px;line-height:1.7;color:#17427a;margin-top:6px">${esc(intro)}</div>
</td></tr>
<tr><td style="padding:16px 0 4px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${cards}
</table></td></tr>
<tr><td style="text-align:center;padding:4px 0 16px"><a href="${esc(myTrip)}" style="font-family:${font};font-size:14px;color:#17427a;font-weight:bold">${myTripWord}</a></td></tr>
<tr><td style="border-top:1px solid #dbe8f7;padding:14px 4px;text-align:${align}">
<div style="font-family:${font};font-size:12px;line-height:1.7;color:#6b7a8f">${esc(foot)}</div>
<div style="font-family:${font};font-size:12px;margin-top:8px"><a href="${esc(manage)}" style="color:#6b7a8f">${manageWord}</a> · <a href="${esc(unsubUrl)}" style="color:#6b7a8f">${unsubWord}</a></div>
<div style="font-family:${font};font-size:12px;color:#9aa6b5;margin-top:6px">sfrtna.com</div>
</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    subject,
    "",
    intro,
    "",
    ...lines.flatMap((l) => [`• ${l.title}: ${l.body}`, `  ${trackedUrl(site, l.href, kind, l.id)}`, ""]),
    `${myTripWord}: ${myTrip}`,
    "",
    foot,
    `${unsubWord}: ${unsubUrl}`,
    "sfrtna.com",
  ].join("\n");

  return { subject, html, text, unsubUrl };
}
