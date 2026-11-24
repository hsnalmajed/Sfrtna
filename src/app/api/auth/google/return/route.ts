import { NextResponse } from "next/server";
import { accounts, sessionCookie, verifyGoogleToken } from "@/lib/accounts";
import { GOOGLE_NONCE_COOKIE } from "@/lib/googleRedirect";

export const dynamic = "force-dynamic";

/**
 * Google's answer to «/api/auth/google/start»: a form POST with the ID
 * token. The token must be ours (verifyGoogleToken) and carry the nonce of
 * this visit; then the same account and session as the old button, and back
 * to «حسابي», which finishes the sign-in (a waiting plan is saved, the
 * visitor returns to the page they came from).
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const lang = form?.get("state") === "en" ? "en" : "ar";
  const origin = new URL(request.url).origin;
  const back = (q: string, cookie?: string) => {
    const headers = new Headers({ Location: new URL(`/${lang}/account?google=${q}`, origin).toString(), "Cache-Control": "no-store" });
    headers.append("Set-Cookie", `${GOOGLE_NONCE_COOKIE}=; Path=/api/auth/google; Max-Age=0; HttpOnly; Secure; SameSite=None`);
    if (cookie) headers.append("Set-Cookie", cookie);
    return new NextResponse(null, { status: 303, headers });
  };
  const nonce = /(?:^|;\s*)sfr_gnonce=([a-f0-9]{48})/.exec(request.headers.get("cookie") || "")?.[1];
  const token = form?.get("id_token");
  if (!nonce || typeof token !== "string") return back("failed");
  const who = await verifyGoogleToken(token, nonce);
  if (!who) return back("failed");
  const store = await accounts();
  if (!store) return back("failed");
  const r = await store.googleSignIn(who.sub, who.email, who.name);
  return back("ok", sessionCookie(r.token, r.maxAge));
}
