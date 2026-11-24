import { NextResponse } from "next/server";
import { googleClientId } from "@/lib/accounts";
import { GOOGLE_APP_COOKIE, GOOGLE_NONCE_COOKIE, googleRedirectUri } from "@/lib/googleRedirect";

export const dynamic = "force-dynamic";

/**
 * «المتابعة بحساب Google» (owner, 24 Nov 2026): Google's own page, with the
 * list of the visitor's Google accounts every time («prompt=select_account»)
 * — the button Google draws itself signed in at once as the last account,
 * with no list. One page for the site, the phone's browser and the apps.
 * A nonce, kept in a short cookie, ties Google's answer to this visit.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lang = url.searchParams.get("lang") === "en" ? "en" : "ar";
  const clientId = googleClientId();
  if (!clientId) return NextResponse.redirect(new URL(`/${lang}/account?google=failed`, url.origin), 303);
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const nonce = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(url.origin),
    response_type: "id_token",
    response_mode: "form_post",
    scope: "openid email profile",
    prompt: "select_account",
    nonce,
    state: lang,
    hl: lang,
  }).toString();
  const headers = new Headers({ Location: google.toString(), "Cache-Control": "no-store" });
  // SameSite=None: Google sends its answer back as a cross-site POST.
  const cookie = (name: string, value: string) =>
    `${name}=${value}; Path=/api/auth/google; Max-Age=${value ? 600 : 0}; HttpOnly; Secure; SameSite=None`;
  headers.append("Set-Cookie", cookie(GOOGLE_NONCE_COOKIE, nonce));
  // Signing in for the app (src/lib/appAuth.ts): its PKCE challenge, so the
  // answer can go straight back into the app.
  const app = url.searchParams.get("app") || "";
  headers.append("Set-Cookie", cookie(GOOGLE_APP_COOKIE, /^[A-Za-z0-9_-]{43}$/.test(app) ? app : ""));
  return new NextResponse(null, { status: 303, headers });
}
