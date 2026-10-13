import { NextResponse } from "next/server";
import { accounts, sendCodeEmail, signInMethods, validEmail } from "@/lib/accounts";

export const dynamic = "force-dynamic";

/** Sends a 6-digit sign-in code to the email (5 an hour per address at most). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; locale?: unknown };
  const email = validEmail(body.email);
  if (!email) return NextResponse.json({ ok: false, reason: "bad_email" }, { status: 400 });
  const store = await accounts();
  if (!store || !signInMethods().email) return NextResponse.json({ ok: false, reason: "off" }, { status: 503 });
  const started = await store.codeStart(email);
  if (!started.ok) return NextResponse.json(started, { status: 429 });
  const sent = await sendCodeEmail(email, started.code, body.locale === "en" ? "en" : "ar");
  return NextResponse.json(sent ? { ok: true } : { ok: false, reason: "send_failed" }, { status: sent ? 200 : 502 });
}
