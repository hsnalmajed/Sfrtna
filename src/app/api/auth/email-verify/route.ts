import { NextResponse } from "next/server";
import { accounts, sessionCookie, validEmail } from "@/lib/accounts";

export const dynamic = "force-dynamic";

/** Checks the emailed code and signs in (the account is made on first use). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; code?: unknown };
  const email = validEmail(body.email);
  const code = typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";
  if (!email || code.length !== 6) return NextResponse.json({ ok: false, reason: "wrong" }, { status: 400 });
  const store = await accounts();
  if (!store) return NextResponse.json({ ok: false, reason: "off" }, { status: 503 });
  const r = await store.codeVerify(email, code);
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json({ ok: true, user: r.user }, { headers: { "Set-Cookie": sessionCookie(r.token, r.maxAge), "Cache-Control": "no-store" } });
}
