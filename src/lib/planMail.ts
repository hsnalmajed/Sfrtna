/**
 * «أرسل الخطة إلى بريدي» (growth doc item 5, step 2): the day plan the
 * traveller built on a city page, sent to the email of his own account —
 * so it is on his phone during the trip. Asked for by him, one mail each
 * time he presses the button (at most 3 a day, /api/plans/mail).
 *
 * What it carries: each day's places, each opening Google Maps on that
 * place, and the day's walking route. No prices (the plan has none), nothing
 * else added; the footer says why the mail came.
 */

export interface PlanMailPlace {
  name: string;
  lat?: number;
  lon?: number;
}

export interface PlanMailInput {
  locale: "ar" | "en";
  code: string;
  slug: string;
  city: string;
  from: string;
  to: string;
  days: PlanMailPlace[][];
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_DAYS = 30;
export const MAX_PER_DAY = 12;

/** Plain text only: no tags, no control characters, a sane length. */
function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim();
  return s.length > 0 && s.length <= max ? s : null;
}

const coord = (v: unknown, lim: number) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= lim ? Math.round(v * 1e6) / 1e6 : undefined);

/** The request body, checked; null when anything is off. */
export function cleanPlanMail(body: unknown): PlanMailInput | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const code = typeof o.code === "string" && /^[A-Z]{2}$/.test(o.code) ? o.code : null;
  const slug = typeof o.slug === "string" && /^[a-z0-9-]{1,60}$/.test(o.slug) ? o.slug : null;
  const city = text(o.city, 80);
  const from = typeof o.from === "string" && ISO.test(o.from) ? o.from : null;
  const to = typeof o.to === "string" && ISO.test(o.to) ? o.to : null;
  if (!code || !slug || !city || !from || !to || to < from) return null;
  if (!Array.isArray(o.days) || o.days.length < 1 || o.days.length > MAX_DAYS) return null;
  const days: PlanMailPlace[][] = [];
  for (const d of o.days) {
    if (!Array.isArray(d) || d.length > MAX_PER_DAY) return null;
    const day: PlanMailPlace[] = [];
    for (const p of d) {
      if (!p || typeof p !== "object") return null;
      const q = p as Record<string, unknown>;
      const name = text(q.name, 120);
      if (!name) return null;
      const lat = coord(q.lat, 90);
      const lon = coord(q.lon, 180);
      day.push(lat !== undefined && lon !== undefined ? { name, lat, lon } : { name });
    }
    days.push(day);
  }
  if (!days.some((d) => d.length)) return null;
  return { locale: o.locale === "en" ? "en" : "ar", code, slug, city, from, to, days };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function addDays(iso: string, n: number): Date {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000);
}

const placeUrl = (p: PlanMailPlace) =>
  p.lat !== undefined && p.lon !== undefined ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}` : null;

/** The day's walking route on Google Maps (the same as the plan page's button). */
function routeUrl(day: PlanMailPlace[]): string | null {
  const pts = day.filter((p) => p.lat !== undefined && p.lon !== undefined).slice(0, 10).map((p) => `${p.lat},${p.lon}`);
  if (pts.length < 2) return null;
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  u.searchParams.set("origin", pts[0]);
  u.searchParams.set("destination", pts[pts.length - 1]);
  if (pts.length > 2) u.searchParams.set("waypoints", pts.slice(1, -1).join("|"));
  u.searchParams.set("travelmode", "walking");
  return u.toString();
}

function tagged(site: string, path: string, content: string): string {
  const u = new URL(path, site);
  u.searchParams.set("utm_source", "plan_mail");
  u.searchParams.set("utm_medium", "email");
  u.searchParams.set("utm_campaign", "plan");
  u.searchParams.set("utm_content", content);
  return u.toString();
}

export function renderPlanMail(p: PlanMailInput, site: string): { subject: string; html: string; text: string } {
  const ar = p.locale === "ar";
  const fmt = (d: Date, withDay: boolean) =>
    new Intl.DateTimeFormat(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
      ...(withDay ? { weekday: "long" } : { year: "numeric" }),
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(d);
  const subject = ar ? `خطة رحلتك إلى ${p.city}` : `Your plan for ${p.city}`;
  const dates = `${fmt(addDays(p.from, 0), false)} – ${fmt(addDays(p.to, 0), false)}`;
  const q = new URLSearchParams({ from: p.from, to: p.to });
  const page = tagged(site, `/${p.locale}/attractions/${p.code}/${p.slug}?${q}#trip-plan`, "city_page");
  const myTrip = tagged(site, `/${p.locale}/my-trip`, "my_trip");
  const dir = ar ? "rtl" : "ltr";
  const align = ar ? "right" : "left";
  const font = "Tahoma,Arial,sans-serif";
  const W = ar
    ? {
        day: (n: number) => `اليوم ${n}`,
        free: "يوم حر، لا أماكن مجدولة فيه.",
        route: "مسار اليوم على قوقل ماب",
        intro: "خطتك يوماً بيوم. اضغط اسم أي مكان ليفتح على الخريطة في جوالك.",
        hours: "لا نعرف مواعيد عمل كل مكان، فتأكد منها قبل زيارته.",
        page: "افتح المدينة في سفرتنا",
        myTrip: "جهّز بقية رحلتك في «رحلتي»",
        foot: "وصلتك هذه الرسالة لأنك طلبتها من صفحة الخطة في سفرتنا. لا نرسل لك غيرها إلا إن فعّلت تذكيرات الرحلات بنفسك.",
      }
    : {
        day: (n: number) => `Day ${n}`,
        free: "A free day, nothing planned.",
        route: "The day's route on Google Maps",
        intro: "Your plan, day by day. Tap a place to open it on the map on your phone.",
        hours: "We do not know every place's opening hours, so check them before you go.",
        page: "Open the city on Sfrtna",
        myTrip: "Get the rest of your trip ready in «My trip»",
        foot: "You get this because you asked for it on Sfrtna's plan page. We send nothing else unless you turn trip reminders on yourself.",
      };

  const dayBlocks = p.days
    .map((day, i) => {
      const date = fmt(addDays(p.from, i), true);
      const items = day.length
        ? day
            .map((pl, j) => {
              const url = placeUrl(pl);
              const name = url
                ? `<a href="${esc(url)}" style="color:#0b2d5b;font-weight:bold;text-decoration:none">${esc(pl.name)}</a>`
                : `<span style="color:#0b2d5b;font-weight:bold">${esc(pl.name)}</span>`;
              return `<div style="font-family:${font};font-size:15px;line-height:1.8;padding:4px 0;border-top:${j ? "1px solid #eef3f9" : "0"}"><span style="color:#9aa6b5">${j + 1}.</span> ${name}</div>`;
            })
            .join("")
        : `<div style="font-family:${font};font-size:14px;color:#6b7a8f">${W.free}</div>`;
      const route = routeUrl(day);
      const routeBtn = route
        ? `<div style="margin-top:10px"><a href="${esc(route)}" style="display:inline-block;background:#f9880b;color:#ffffff;font-family:${font};font-size:14px;font-weight:bold;text-decoration:none;padding:8px 18px;border-radius:999px">${W.route}</a></div>`
        : "";
      return `<tr><td style="padding:0 0 12px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #dbe8f7;border-radius:12px"><tr><td style="padding:14px 16px;text-align:${align}">
<div style="font-family:${font};font-size:16px;font-weight:bold;color:#0b2d5b">${W.day(i + 1)} <span style="font-weight:normal;color:#6b7a8f;font-size:13px">· ${esc(date)}</span></div>
<div style="margin-top:6px">${items}</div>${routeBtn}
</td></tr></table></td></tr>`;
    })
    .join("\n");

  const html = `<!doctype html><html lang="${p.locale}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#eff5fc">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eff5fc"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px" dir="${dir}">
<tr><td style="background:#0b2d5b;border-radius:14px 14px 0 0;padding:18px 20px;text-align:${align}">
<div style="font-family:${font};font-size:22px;font-weight:bold;color:#ffffff">${ar ? "سفرتنا" : "Sfrtna"}</div>
</td></tr>
<tr><td style="background:#ffeed4;padding:16px 20px;text-align:${align}">
<div style="font-family:${font};font-size:19px;font-weight:bold;color:#0b2d5b">${esc(subject)}</div>
<div style="font-family:${font};font-size:14px;color:#17427a;margin-top:4px">${esc(dates)}</div>
<div style="font-family:${font};font-size:14px;line-height:1.7;color:#17427a;margin-top:6px">${W.intro}</div>
</td></tr>
<tr><td style="padding:16px 0 4px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${dayBlocks}
</table></td></tr>
<tr><td style="font-family:${font};font-size:12px;line-height:1.7;color:#6b7a8f;padding:0 4px 12px;text-align:${align}">${W.hours}</td></tr>
<tr><td style="text-align:center;padding:4px 0 8px"><a href="${esc(myTrip)}" style="display:inline-block;background:#0b2d5b;color:#ffffff;font-family:${font};font-size:14px;font-weight:bold;text-decoration:none;padding:10px 20px;border-radius:999px">${W.myTrip}</a></td></tr>
<tr><td style="text-align:center;padding:4px 0 16px"><a href="${esc(page)}" style="font-family:${font};font-size:14px;color:#17427a;font-weight:bold">${W.page}</a></td></tr>
<tr><td style="border-top:1px solid #dbe8f7;padding:14px 4px;text-align:${align}">
<div style="font-family:${font};font-size:12px;line-height:1.7;color:#6b7a8f">${W.foot}</div>
<div style="font-family:${font};font-size:12px;color:#9aa6b5;margin-top:6px">sfrtna.com</div>
</td></tr>
</table></td></tr></table></body></html>`;

  const textBody = [
    subject,
    dates,
    "",
    W.intro,
    "",
    ...p.days.flatMap((day, i) => {
      const route = routeUrl(day);
      return [
        `${W.day(i + 1)} · ${fmt(addDays(p.from, i), true)}`,
        ...(day.length ? day.map((pl, j) => `  ${j + 1}. ${pl.name}${placeUrl(pl) ? ` — ${placeUrl(pl)}` : ""}`) : [`  ${W.free}`]),
        ...(route ? [`  ${W.route}: ${route}`] : []),
        "",
      ];
    }),
    W.hours,
    "",
    `${W.myTrip}: ${myTrip}`,
    `${W.page}: ${page}`,
    "",
    W.foot,
    "sfrtna.com",
  ].join("\n");

  return { subject, html, text: textBody };
}
