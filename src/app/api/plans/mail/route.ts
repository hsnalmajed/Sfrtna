import { NextResponse } from "next/server";
import { accounts, resendKey, sessionToken } from "@/lib/accounts";
import { countUse } from "@/lib/usage";
import { SITE_URL } from "@/lib/seo";
import { cleanPlanMail, renderPlanMail } from "@/lib/planMail";

export const dynamic = "force-dynamic";

/** A traveller may send himself his plan this many times a day (UTC day). */
const PER_DAY = 3;
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);

/**
 * «أرسل الخطة إلى بريدي»: the plan on the page, mailed to the signed-in
 * traveller's own address (never to an address typed in the request).
 * Each send is claimed first in the `mails` table (trip = `plan:<day>`,
 * kind = plan1..plan3), so the daily limit holds across tabs and devices and
 * the mails count in the same daily cap as the trip mails. The shared Resend
 * budget (RESEND_DAILY_BUDGET) is checked too, so sign-in codes keep room.
 */
export async function POST(request: Request) {
  const store = await accounts();
  const token = sessionToken(request);
  const user = store && token ? await store.userFor(token) : null;
  if (!store || !user) return NextResponse.json({ ok: false, reason: "signed_out" }, { status: 401 });
  if (!user.email) return NextResponse.json({ ok: false, reason: "no_email" }, { status: 400 });
  if (!resendKey()) return NextResponse.json({ ok: false, reason: "no_mail_key" }, { status: 503 });

  const plan = cleanPlanMail(await request.json().catch(() => null));
  if (!plan) return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });

  const now = Date.now();
  const utcDay = new Date(now).toISOString().slice(0, 10);
  const nextDay = new Date(now + 86_400_000).toISOString().slice(0, 10);
  const resendToday = (await store.statsRange(utcDay, nextDay)).find((r) => r.kind === "ext" && r.key === "resend")?.n ?? 0;
  if (resendToday >= num(process.env.RESEND_DAILY_BUDGET, 80)) {
    return NextResponse.json({ ok: false, reason: "busy" }, { status: 503 });
  }

  const slot = `plan:${utcDay}`;
  let kind: string | null = null;
  for (let i = 1; i <= PER_DAY && !kind; i++) {
    if (await store.mailClaim(user.id, slot, `plan${i}`)) kind = `plan${i}`;
  }
  if (!kind) return NextResponse.json({ ok: false, reason: "limit" }, { status: 429 });

  const mail = renderPlanMail(plan, SITE_URL);
  let ok = false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "سفرتنا <no-reply@sfrtna.com>",
        to: [user.email],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        tags: [{ name: "kind", value: "plan_mail" }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    countUse("resend");
    ok = res.ok;
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { name?: string; message?: string };
      console.error("plan mail refused", JSON.stringify({ status: res.status, name: String(body.name ?? ""), message: String(body.message ?? "").slice(0, 200) }));
    }
  } catch {
    ok = false;
  }
  if (!ok) {
    // Not sent: the try is given back.
    await store.mailRelease(user.id, slot, kind);
    return NextResponse.json({ ok: false, reason: "send_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
