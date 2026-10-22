/**
 * Server side of accounts (owner, 13 Oct 2026: Google + email now, Apple
 * later). The data lives in the Accounts Durable Object (accounts.js); this
 * file is the only way the route handlers reach it.
 *
 * Sign-in:
 *   - email: a 6-digit code sent by email (no passwords to leak or reset);
 *   - Google: the Google Identity Services button gives the page an ID token,
 *     checked here against Google's published keys (signature, audience,
 *     issuer, expiry, verified email).
 * The session is a random token in an HttpOnly, Secure, SameSite=Lax cookie;
 * only its SHA-256 is stored. Pages never read the cookie (they are cached
 * at the edge for everyone), so who is signed in is asked by the page from
 * /api/auth/me.
 *
 * Settings (Cloudflare → Workers → sfrtna → Variables and Secrets, Runtime):
 *   GOOGLE_CLIENT_ID   the OAuth web client id (public, not a secret)
 *   RESEND_API_KEY     Secret — the email sender's key
 *   EMAIL_FROM         optional, default «سفرتنا <no-reply@sfrtna.com>»
 * A method whose setting is missing is simply not offered.
 */

import { writeJson } from "@/lib/edgeCache";

export const SESSION_COOKIE = "sfr_s";

export interface AccountUser {
  id: string;
  email: string | null;
  name: string | null;
  google: boolean;
}

/** A saved plan: the places by key, so the page rebuilds it from its own data. */
export interface SavedPlanData {
  v: 1;
  code: string;
  slug: string;
  city: string;
  locale: string;
  source: "pick" | "auto";
  from: string;
  to: string;
  days: string[][];
  short?: boolean;
}

export interface SavedPlan {
  id: string;
  title: string;
  created: number;
  plan: SavedPlanData;
}

type Fail = { ok: false; reason: string };
type SignedIn = { ok: true; user: AccountUser; token: string; maxAge: number };

interface AccountsStub {
  codeStart(email: string): Promise<{ ok: true; code: string } | Fail>;
  codeVerify(email: string, code: string): Promise<SignedIn | Fail>;
  googleSignIn(sub: string, email: string | null, name: string | null): Promise<SignedIn>;
  userFor(token: string): Promise<AccountUser | null>;
  signOut(token: string): Promise<{ ok: true }>;
  deleteAccount(token: string): Promise<{ ok: boolean }>;
  plansList(token: string): Promise<SavedPlan[] | null>;
  planSave(token: string, title: string, data: SavedPlanData): Promise<{ ok: true; id: string } | Fail>;
  planDelete(token: string, id: string): Promise<{ ok: true } | Fail>;
  appCodeStart(token: string, challenge: string): Promise<{ ok: true; code: string } | Fail>;
  appCodeExchange(code: string, verifier: string): Promise<SignedIn | Fail>;
  itemsList(token: string): Promise<StoredItem[] | null>;
  itemPut(token: string, kind: string, key: string, data: unknown): Promise<{ ok: true } | Fail>;
  itemDelete(token: string, kind: string, key: string): Promise<{ ok: true } | Fail>;
  sessionMaxAge(): Promise<number>;
  feedbackAdd(token: string, f: FeedbackInput): Promise<{ ok: true; id: number; ref: string; email: string | null; signedIn: boolean } | Fail>;
  feedbackRecent(since: number): Promise<FeedbackRow[]>;
}

export interface FeedbackInput {
  kind: string;
  area: string;
  rating: number | null;
  text: string;
  email: string | null;
  contact: boolean;
  ctx: Record<string, string>;
  ip: string;
}

export interface FeedbackRow {
  id: number;
  ref: string;
  created: number;
  kind: string;
  area: string;
  rating: number | null;
  text: string;
  email: string | null;
  contact: number;
  ctx: Record<string, string>;
}

export interface StoredItem {
  kind: string;
  key: string;
  created: number;
  data: unknown;
}

interface AccountsNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): AccountsStub;
}

/** The store, or null outside Cloudflare (`next dev`). */
export async function accounts(): Promise<AccountsStub | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ns = (getCloudflareContext().env as unknown as { ACCOUNTS?: AccountsNamespace }).ACCOUNTS;
    return ns ? ns.get(ns.idFromName("accounts")) : null;
  } catch {
    return null;
  }
}

export const googleClientId = (): string => process.env.GOOGLE_CLIENT_ID || "";
export const resendKey = (): string => process.env.RESEND_API_KEY || "";

/** Which ways to sign in are switched on. */
export function signInMethods(): { google: string | null; email: boolean } {
  return { google: googleClientId() || null, email: Boolean(resendKey()) };
}

export function sessionToken(request: Request): string {
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([a-f0-9]{64})`));
  return m ? m[1] : "";
}

export function sessionCookie(token: string, maxAge: number): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export const clearedCookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export function validEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e) ? e : null;
}

// ---- Email -------------------------------------------------------------

/** Sends the sign-in code. True when the sender accepted it. */
export async function sendCodeEmail(to: string, code: string, locale: "ar" | "en"): Promise<boolean> {
  const key = resendKey();
  if (!key) return false;
  const ar = locale === "ar";
  const subject = ar ? `رمز الدخول إلى سفرتنا: ${code}` : `Your Sfrtna sign-in code: ${code}`;
  const text = ar
    ? `رمز الدخول إلى حسابك في سفرتنا:\n\n${code}\n\nصالح لمدة 10 دقائق. إن لم تطلبه فتجاهل هذه الرسالة.\n\nsfrtna.com`
    : `Your Sfrtna sign-in code:\n\n${code}\n\nIt is valid for 10 minutes. If you did not ask for it, ignore this email.\n\nsfrtna.com`;
  const html = `<div dir="${ar ? "rtl" : "ltr"}" style="font-family:Tahoma,Arial,sans-serif;font-size:16px;color:#0b1f3a">
<p>${ar ? "رمز الدخول إلى حسابك في سفرتنا:" : "Your Sfrtna sign-in code:"}</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:16px 0">${code}</p>
<p style="color:#555">${ar ? "صالح لمدة 10 دقائق. إن لم تطلبه فتجاهل هذه الرسالة." : "Valid for 10 minutes. If you did not ask for it, ignore this email."}</p>
<p style="color:#999">sfrtna.com</p></div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || "سفرتنا <no-reply@sfrtna.com>", to: [to], subject, text, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // Why the sender refused (unverified domain, key without permission…),
      // kept a day for /api/health and the Workers logs — never the key.
      const body = (await res.json().catch(() => ({}))) as { name?: string; message?: string };
      const why = { at: new Date().toISOString(), status: res.status, name: String(body.name ?? ""), message: String(body.message ?? "").slice(0, 200) };
      console.error("email send refused", JSON.stringify(why));
      await writeJson("email-last-error", why, 86_400);
    }
    return res.ok;
  } catch {
    return false;
  }
}

// ---- Google ID token ---------------------------------------------------

interface Jwk {
  kid: string;
  n: string;
  e: string;
  kty: string;
  alg?: string;
}

let jwksCache: { keys: Jwk[]; until: number } | null = null;

async function googleKeys(): Promise<Jwk[]> {
  if (jwksCache && jwksCache.until > Date.now()) return jwksCache.keys;
  const res = await fetch("https://www.googleapis.com/oauth2/v3/certs", { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`google certs ${res.status}`);
  const json = (await res.json()) as { keys: Jwk[] };
  const age = Number(res.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] ?? 3600);
  jwksCache = { keys: json.keys, until: Date.now() + Math.min(age, 6 * 3600) * 1000 };
  return json.keys;
}

const b64urlBytes = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "="));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/** The verified person behind a Google ID token, or null. */
export async function verifyGoogleToken(
  idToken: string
): Promise<{ sub: string; email: string | null; name: string | null } | null> {
  const clientId = googleClientId();
  if (!clientId || typeof idToken !== "string") return null;
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(b64urlBytes(parts[0]))) as { kid?: string; alg?: string };
    if (header.alg !== "RS256" || !header.kid) return null;
    const jwk = (await googleKeys()).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(b64urlBytes(parts[1]))) as {
      aud?: string;
      iss?: string;
      exp?: number;
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    if (p.aud !== clientId) return null;
    if (p.iss !== "accounts.google.com" && p.iss !== "https://accounts.google.com") return null;
    if (!p.exp || p.exp * 1000 < Date.now() || !p.sub) return null;
    const email = p.email && p.email_verified ? p.email.toLowerCase() : null;
    return { sub: p.sub, email, name: p.name ? p.name.slice(0, 80) : null };
  } catch {
    return null;
  }
}
