import { NextResponse } from "next/server";
import { accounts, resendKey } from "@/lib/accounts";
import { countUse } from "@/lib/usage";
import { SITE_URL } from "@/lib/seo";
import { dueKind, renderMail, riyadhClock, tripOf, type MailKind } from "@/lib/tripMails";

export const dynamic = "force-dynamic";

/**
 * Sends the trip emails that are due (src/lib/tripMails.ts says which).
 * Called every hour by the Worker's cron (edge-worker.js `scheduled`), and
 * by hand or a check with the site-check key; anyone else gets "not found".
 * `?dry=1` lists what would go out now, sending nothing (no addresses in it).
 *
 * Limits (Resend's free plan: 100 a day per UTC day, 3,000 a month, counting
 * the sign-in codes too): stop when the day's Resend count reaches
 * RESEND_DAILY_BUDGET (default 80, so sign-in codes always have room), and
 * at TRIP_MAIL_DAILY_CAP trip mails in 24 h (default 60). At most one mail per
 * traveller per run, a few per second.
 */

const MAX_PER_RUN = 30;
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);

async function send(to: string, subject: string, html: string, text: string, unsubUrl: string, kind: MailKind): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "سفرتنا <no-reply@sfrtna.com>",
        to: [to],
        subject,
        html,
        text,
        // One-click unsubscribe from the mail app's own button (RFC 8058).
        headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        tags: [{ name: "kind", value: `trip_${kind}` }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    countUse("resend");
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { name?: string; message?: string };
      console.error("trip mail refused", JSON.stringify({ status: res.status, name: String(body.name ?? ""), message: String(body.message ?? "").slice(0, 200) }));
    }
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const token = process.env.SMOKE_TOKEN;
  if (!token || request.headers.get("x-sfrtna-smoke") !== token) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const dry = new URL(request.url).searchParams.get("dry") === "1";
  const store = await accounts();
  if (!store) return NextResponse.json({ ok: false, reason: "no_store" }, { status: 503 });
  if (!resendKey() && !dry) return NextResponse.json({ ok: false, reason: "no_mail_key" }, { status: 503 });

  const now = Date.now();
  const utcDay = new Date(now).toISOString().slice(0, 10);
  const nextDay = new Date(now + 86_400_000).toISOString().slice(0, 10);
  const resendToday = (await store.statsRange(utcDay, nextDay)).find((r) => r.kind === "ext" && r.key === "resend")?.n ?? 0;
  const tripMails24h = await store.mailCount(now - 86_400_000);
  const budget = num(process.env.RESEND_DAILY_BUDGET, 80);
  const cap = num(process.env.TRIP_MAIL_DAILY_CAP, 60);
  let room = Math.min(MAX_PER_RUN, Math.max(0, budget - resendToday), Math.max(0, cap - tripMails24h));

  // Trips that ended more than 4 days ago are done with.
  const { day } = riyadhClock(now);
  const endFrom = new Date(Date.parse(`${day}T00:00:00Z`) - 4 * 86_400_000).toISOString().slice(0, 10);
  const candidates = await store.mailCandidates(endFrom);

  const byKind: Record<string, number> = {};
  const due: { kind: MailKind; route: string }[] = [];
  let sent = 0;
  let failed = 0;
  let held = 0;
  const mailedUser = new Set<string>();
  for (const c of candidates) {
    const kind = dueKind(c, now);
    if (!kind) continue;
    const trip = tripOf(c);
    const locale = c.locale === "en" ? "en" : "ar";
    const mail = trip ? renderMail(kind, trip, locale, c.unsub, SITE_URL) : null;
    if (!trip || !mail) continue;
    if (dry) {
      due.push({ kind, route: `${trip.origin}-${trip.destination}` });
      continue;
    }
    if (mailedUser.has(c.user) || room <= 0) {
      held++;
      continue;
    }
    if (!(await store.mailClaim(c.user, c.key, kind))) continue;
    mailedUser.add(c.user);
    room--;
    if (await send(c.email, mail.subject, mail.html, mail.text, mail.unsubUrl, kind)) {
      sent++;
      byKind[kind] = (byKind[kind] ?? 0) + 1;
    } else {
      failed++;
      // Tried again next hour.
      await store.mailRelease(c.user, c.key, kind);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  const summary = { ok: true, dry, candidates: candidates.length, sent, failed, held, byKind, resendToday, tripMails24h, ...(dry ? { due } : {}) };
  if (!dry && (sent || failed || held)) console.log("trip mail run", JSON.stringify(summary));
  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}
