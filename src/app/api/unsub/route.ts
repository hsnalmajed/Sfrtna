import { accounts } from "@/lib/accounts";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * «إلغاء الاشتراك» in every trip email (Saudi PDPL: withdrawing must be as
 * easy as agreeing). The link carries the traveller's unsubscribe token, so
 * no sign-in is needed.
 *
 *   GET   a small page with one button. Opening the link alone changes
 *         nothing: mail scanners open every link in a mail before the reader
 *         does, and must not unsubscribe anyone.
 *   POST  records «no» (consent_log src "unsub_link", or "unsub_oneclick"
 *         for the mail app's own button, RFC 8058), and confirms.
 */

const TEXT = {
  ar: {
    title: "إلغاء رسائل الرحلة",
    ask: "لن تصلك بعد اليوم رسائل التذكير بتجهيز رحلاتك من سفرتنا. حسابك ورحلاتك المحفوظة تبقى كما هي.",
    button: "ألغِ الاشتراك",
    done: "تم إلغاء الاشتراك. لن تصلك رسائل الرحلة بعد الآن.",
    already: "اشتراكك ملغى من قبل، ولا تصلك رسائل الرحلة.",
    again: "تستطيع إعادتها متى شئت من «حسابي».",
    bad: "الرابط غير صالح أو انتهى. تستطيع إيقاف الرسائل من «حسابي».",
    account: "افتح حسابي",
  },
  en: {
    title: "Stop trip emails",
    ask: "You will no longer get reminders to get your trips ready from Sfrtna. Your account and saved trips stay as they are.",
    button: "Unsubscribe",
    done: "You are unsubscribed. No more trip emails.",
    already: "You were already unsubscribed: no trip emails are sent to you.",
    again: "You can turn them back on any time in «My account».",
    bad: "This link is not valid any more. You can stop the emails in «My account».",
    account: "Open my account",
  },
} as const;

const TOKEN = /^[a-f0-9]{64}$/;

function page(locale: "ar" | "en", body: string, status = 200): Response {
  const t = TEXT[locale];
  const ar = locale === "ar";
  const html = `<!doctype html><html lang="${locale}" dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${t.title} · ${ar ? "سفرتنا" : "Sfrtna"}</title>
<style>body{margin:0;background:#eff5fc;font-family:Tahoma,Arial,sans-serif;color:#0b2d5b}main{max-width:480px;margin:40px auto;padding:0 16px}.card{background:#fff;border:1px solid #dbe8f7;border-radius:16px;padding:24px}h1{font-size:20px;margin:0 0 12px}p{line-height:1.8;color:#3d4f66;margin:0 0 16px}button,.btn{display:inline-block;background:#f9880b;color:#fff;border:0;border-radius:999px;padding:12px 24px;font:bold 16px Tahoma,Arial,sans-serif;text-decoration:none;cursor:pointer}a.link{color:#17427a;font-weight:bold}.brand{font-weight:bold;font-size:22px;margin-bottom:16px}</style></head>
<body><main><div class="brand">${ar ? "سفرتنا" : "Sfrtna"}</div><div class="card"><h1>${t.title}</h1>${body}</div></main></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" } });
}

const accountLink = (locale: "ar" | "en") => `<a class="link" href="${SITE_URL}/${locale}/account#trip-mail">${TEXT[locale].account}</a>`;

export async function GET(request: Request) {
  const t = new URL(request.url).searchParams.get("t") || "";
  const store = await accounts();
  const info = store && TOKEN.test(t) ? await store.unsubInfo(t) : { ok: false as const };
  if (!info.ok) return page("ar", `<p>${TEXT.ar.bad}</p><p>${accountLink("ar")}</p>`, 404);
  const locale = info.locale === "en" ? "en" : "ar";
  const s = TEXT[locale];
  if (!info.on) return page(locale, `<p>${s.already}</p><p>${s.again}</p><p>${accountLink(locale)}</p>`);
  return page(locale, `<p>${s.ask}</p><form method="post" action="/api/unsub?t=${t}"><button type="submit">${s.button}</button></form>`);
}

export async function POST(request: Request) {
  const t = new URL(request.url).searchParams.get("t") || "";
  const body = await request.text().catch(() => "");
  const oneClick = body.includes("List-Unsubscribe=One-Click");
  const store = await accounts();
  const r = store && TOKEN.test(t) ? await store.unsubByToken(t, oneClick ? "unsub_oneclick" : "unsub_link") : { ok: false as const };
  if (oneClick) return new Response(r.ok ? "ok" : "not found", { status: r.ok ? 200 : 404, headers: { "cache-control": "no-store" } });
  if (!r.ok) return page("ar", `<p>${TEXT.ar.bad}</p><p>${accountLink("ar")}</p>`, 404);
  const locale = r.locale === "en" ? "en" : "ar";
  return page(locale, `<p>${TEXT[locale].done}</p><p>${TEXT[locale].again}</p><p>${accountLink(locale)}</p>`);
}
