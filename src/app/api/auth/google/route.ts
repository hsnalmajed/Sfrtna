import { NextResponse } from "next/server";
import { accounts, sessionCookie, verifyGoogleToken } from "@/lib/accounts";

export const dynamic = "force-dynamic";

/** Signs in with the ID token the Google button gave the page. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { credential?: unknown };
  const who = typeof body.credential === "string" ? await verifyGoogleToken(body.credential) : null;
  if (!who) return NextResponse.json({ ok: false, reason: "google_rejected" }, { status: 400 });
  const store = await accounts();
  if (!store) return NextResponse.json({ ok: false, reason: "off" }, { status: 503 });
  const r = await store.googleSignIn(who.sub, who.email, who.name);
  return NextResponse.json({ ok: true, user: r.user }, { headers: { "Set-Cookie": sessionCookie(r.token, r.maxAge), "Cache-Control": "no-store" } });
}
