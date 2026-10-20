/**
 * Signing in to the app through the phone's browser (Custom Tab) — RFC 8252
 * style, with PKCE:
 *
 *   1. the app page makes a secret verifier, keeps it in the app's own
 *      storage, and opens /{locale}/account/app?c=<SHA-256 of it> in the
 *      phone's browser (where Google sign-in is allowed);
 *   2. signed in there, the browser asks /api/auth/app-code for a one-time
 *      code bound to that challenge and opens sfrtna://auth?code=…;
 *   3. the app loads /{locale}/account?app_code=…, which trades the code and
 *      the verifier at /api/auth/app-exchange for the app's own session.
 *
 * A code caught on its way back is useless without the verifier, which
 * never left the app.
 */

const KEY = "sfr-app-pkce";
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Step 1: a new verifier kept in the app; returns its challenge. */
export async function newAppChallenge(): Promise<string> {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const verifier = b64url(raw);
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ v: verifier, at: Date.now() }));
  } catch {
    /* storage off: the exchange will fail and say so */
  }
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return b64url(digest);
}

/** Step 3: the verifier (once), if made in the last 15 minutes. */
export function takeVerifier(): string {
  try {
    const raw = window.localStorage.getItem(KEY);
    window.localStorage.removeItem(KEY);
    const o = raw ? (JSON.parse(raw) as { v?: string; at?: number }) : null;
    return o?.v && o.at && Date.now() - o.at < 15 * 60_000 ? o.v : "";
  } catch {
    return "";
  }
}

/** Step 3: the code the app brought back in the address, removed from it. */
export function takeAppCode(): string {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("app_code") || "";
  if (!code) return "";
  url.searchParams.delete("app_code");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  return /^[a-f0-9]{64}$/.test(code) ? code : "";
}
