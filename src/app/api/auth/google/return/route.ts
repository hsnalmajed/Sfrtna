import { NextResponse } from "next/server";
import { accounts, sessionCookie, verifyGoogleToken } from "@/lib/accounts";
import { GOOGLE_APP_COOKIE, GOOGLE_NONCE_COOKIE, appReturnUrl } from "@/lib/googleRedirect";

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
  const cookies = request.headers.get("cookie") || "";
  const challenge = /(?:^|;\s*)sfr_gapp=([A-Za-z0-9_-]{43})/.exec(cookies)?.[1];
  const send = (location: string, cookie?: string) => {
    const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
    for (const name of [GOOGLE_NONCE_COOKIE, GOOGLE_APP_COOKIE])
      headers.append("Set-Cookie", `${name}=; Path=/api/auth/google; Max-Age=0; HttpOnly; Secure; SameSite=None`);
    if (cookie) headers.append("Set-Cookie", cookie);
    return new NextResponse(null, { status: 303, headers });
  };
  const back = (q: string, cookie?: string) =>
    // For the app, a failure lands on the app's sign-in page in its fallback
    // form (no new trip to Google), which says what went wrong.
    send(new URL(challenge && q === "failed" ? `/${lang}/account/app?c=${challenge}&f=1` : `/${lang}/account?google=${q}`, origin).toString(), cookie);
  const nonce = /(?:^|;\s*)sfr_gnonce=([a-f0-9]{48})/.exec(cookies)?.[1];
  const token = form?.get("id_token");
  if (!nonce || typeof token !== "string") return back("failed");
  const who = await verifyGoogleToken(token, nonce);
  if (!who) return back("failed");
  const store = await accounts();
  if (!store) return back("failed");
  const r = await store.googleSignIn(who.sub, who.email, who.name);
  const session = sessionCookie(r.token, r.maxAge);
  if (challenge) {
    // Straight back into the app with a one-time code bound to its challenge
    // (useless without the verifier only the app holds). iPhone: Apple's
    // sign-in sheet catches sfrtna://; Android: Chrome opens the app.
    const code = await store.appCodeStart(r.token, challenge);
    if (code.ok) return send(appReturnUrl(code.code, lang, request.headers.get("user-agent") || "", `${origin}/${lang}/account/app?c=${challenge}&f=1`), session);
    return send(new URL(`/${lang}/account/app?c=${challenge}&f=1`, origin).toString(), session);
  }
  return back("ok", session);
}
