import { NextResponse } from "next/server";
import { accounts, sessionCookie, verifyAppleToken } from "@/lib/accounts";

export const dynamic = "force-dynamic";

/**
 * Signs in with the identity token of the iPhone app's «Sign in with Apple»
 * button (src/lib/nativeApp.ts appleSignInInApp). Apple gives the name only
 * the first time, so the app passes it along.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { idToken?: unknown; nonce?: unknown; name?: unknown };
  const who =
    typeof body.idToken === "string" && typeof body.nonce === "string" ? await verifyAppleToken(body.idToken, body.nonce) : null;
  if (!who) return NextResponse.json({ ok: false, reason: "apple_rejected" }, { status: 400 });
  const store = await accounts();
  if (!store) return NextResponse.json({ ok: false, reason: "off" }, { status: 503 });
  const name = typeof body.name === "string" ? body.name.replace(/[<>]/g, "").trim().slice(0, 80) || null : null;
  const r = await store.googleSignIn(`apple:${who.sub}`, who.email, name);
  return NextResponse.json({ ok: true, user: r.user }, { headers: { "Set-Cookie": sessionCookie(r.token, r.maxAge), "Cache-Control": "no-store" } });
}
