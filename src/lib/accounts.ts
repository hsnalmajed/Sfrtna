import type { PlanAnswers } from "@/lib/ai/plan";
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
  /** «smart»: the smart plan (its answers; days = each stop's key, so swaps come back). */
  source: "pick" | "auto" | "smart";
  from: string;
  to: string;
  days: string[][];
  short?: boolean;
  smart?: { answers: PlanAnswers };
}

/** The traveller's answer about trip emails (item 5), with when and where it was given. */
export interface TripMailConsent {
  tripMail: boolean;
  at: number;
  src: string;
  locale: string;
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
  deleteAccount(token: string): Promise<{ ok: boolean; appleRefresh?: string }>;
  appleTokenSet(token: string, refresh: string): Promise<{ ok: boolean }>;
  plansList(token: string): Promise<SavedPlan[] | null>;
  planSave(token: string, title: string, data: SavedPlanData): Promise<{ ok: true; id: string } | Fail>;
  planDelete(token: string, id: string): Promise<{ ok: true } | Fail>;
  appCodeStart(token: string, challenge: string): Promise<{ ok: true; code: string } | Fail>;
  appCodeExchange(code: string, verifier: string): Promise<SignedIn | Fail>;
  itemsList(token: string): Promise<StoredItem[] | null>;
  itemPut(token: string, kind: string, key: string, data: unknown): Promise<{ ok: true } | Fail>;
  itemDelete(token: string, kind: string, key: string): Promise<{ ok: true } | Fail>;
  consentGet(token: string): Promise<{ ok: true; consent: TripMailConsent | null } | Fail>;
  consentSet(token: string, tripMail: boolean, src: string, locale: string): Promise<{ ok: true; consent: TripMailConsent } | Fail>;
  sessionMaxAge(): Promise<number>;
  mailCandidates(endFrom: string): Promise<MailCandidate[]>;
  mailClaim(user: string, trip: string, kind: string): Promise<boolean>;
  mailRelease(user: string, trip: string, kind: string): Promise<{ ok: true }>;
  mailCount(since: number): Promise<number>;
  unsubInfo(unsub: string): Promise<{ ok: true; on: boolean; locale: string } | { ok: false }>;
  unsubByToken(unsub: string, src: string): Promise<{ ok: true; locale: string } | { ok: false }>;
  feedbackAdd(token: string, f: FeedbackInput): Promise<{ ok: true; id: number; ref: string; email: string | null; signedIn: boolean } | Fail>;
  feedbackRecent(since: number): Promise<FeedbackRow[]>;
  statsAdd(pairs: [string, string][]): Promise<{ ok: boolean }>;
  statsRange(from: string, to: string): Promise<{ kind: string; key: string; n: number }[]>;
  statsDaily(kind: string, from: string, to: string): Promise<{ day: string; n: number }[]>;
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

/** A trip that may get a trip email (accounts.js mailCandidates). */
export interface MailCandidate {
  user: string;
  email: string;
  locale: string;
  unsub: string;
  consentAt: number;
  key: string;
  trip: unknown;
  sent: { kind: string; at: number }[];
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
    void import("@/lib/usage").then((m) => m.countUse("resend"));
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
  idToken: string,
  /** The redirect sign-in sends a nonce; the token must carry the same one. */
  nonce?: string
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
      nonce?: string;
    };
    if (p.aud !== clientId) return null;
    if (nonce !== undefined && p.nonce !== nonce) return null;
    if (p.iss !== "accounts.google.com" && p.iss !== "https://accounts.google.com") return null;
    if (!p.exp || p.exp * 1000 < Date.now() || !p.sub) return null;
    const email = p.email && p.email_verified ? p.email.toLowerCase() : null;
    return { sub: p.sub, email, name: p.name ? p.name.slice(0, 80) : null };
  } catch {
    return null;
  }
}

// ── Sign in with Apple (iPhone app, 16 Nov 2026) ───────────────────────────
// The app's native button returns an identity token signed by Apple for our
// bundle id; the nonce the page made is checked against the token's hash of
// it. The person is kept in the same `google` column with an «apple:» prefix
// (one sign-in id per user row; an e-mail already known links the account).

let appleJwks: { keys: Jwk[]; until: number } | null = null;

async function appleKeys(): Promise<Jwk[]> {
  if (appleJwks && appleJwks.until > Date.now()) return appleJwks.keys;
  const res = await fetch("https://appleid.apple.com/auth/keys", { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error("apple_keys");
  const json = (await res.json()) as { keys: Jwk[] };
  appleJwks = { keys: json.keys, until: Date.now() + 6 * 3600 * 1000 };
  return json.keys;
}

export const APPLE_BUNDLE_ID = "com.sfrtna.app";

async function sha256Hex(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The verified person behind an Apple identity token, or null. */
export async function verifyAppleToken(
  idToken: string,
  nonce: string
): Promise<{ sub: string; email: string | null } | null> {
  if (typeof idToken !== "string" || typeof nonce !== "string" || nonce.length < 16) return null;
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(b64urlBytes(parts[0]))) as { kid?: string; alg?: string };
    if (header.alg !== "RS256" || !header.kid) return null;
    const jwk = (await appleKeys()).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(b64urlBytes(parts[1]))) as {
      aud?: string;
      iss?: string;
      exp?: number;
      sub?: string;
      email?: string;
      email_verified?: boolean | string;
      nonce?: string;
    };
    if (p.iss !== "https://appleid.apple.com" || p.aud !== APPLE_BUNDLE_ID) return null;
    if (!p.exp || p.exp * 1000 < Date.now() || !p.sub) return null;
    if (p.nonce !== (await sha256Hex(nonce))) return null;
    const verified = p.email_verified === true || p.email_verified === "true";
    return { sub: p.sub, email: p.email && verified ? p.email.toLowerCase() : null };
  } catch {
    return null;
  }
}

// ── Apple token revoke on account deletion (17 Nov 2026, guideline 5.1.1(v)) ─
// Needs a «Sign in with Apple» key from the developer account, as Runtime vars
// APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_P8 (the .p8 file's text). Without them
// sign-in works as before and deletion simply has nothing to revoke.

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** The ES256 client secret Apple asks for on /auth/token and /auth/revoke, or null if the key is not set. */
async function appleClientSecret(): Promise<string | null> {
  const team = process.env.APPLE_TEAM_ID || "";
  const kid = process.env.APPLE_KEY_ID || "";
  const p8 = process.env.APPLE_P8 || "";
  if (!team || !kid || !p8) return null;
  try {
    const der = p8
      .replace(/\\n/g, "\n")
      .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
      .replace(/\s+/g, "");
    const raw = Uint8Array.from(atob(der), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("pkcs8", raw, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    const now = Math.floor(Date.now() / 1000);
    const enc = (o: object) => b64url(new TextEncoder().encode(JSON.stringify(o)));
    const head = `${enc({ alg: "ES256", kid })}.${enc({ iss: team, iat: now, exp: now + 600, aud: "https://appleid.apple.com", sub: APPLE_BUNDLE_ID })}`;
    const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(head)));
    return `${head}.${b64url(sig)}`;
  } catch {
    return null;
  }
}

/** Swaps the app's one-time authorization code for Apple's refresh token, or null. */
export async function appleRefreshToken(code: string): Promise<string | null> {
  if (typeof code !== "string" || !code || code.length > 2000) return null;
  const secret = await appleClientSecret();
  if (!secret) return null;
  try {
    const res = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: APPLE_BUNDLE_ID, client_secret: secret, code, grant_type: "authorization_code" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { refresh_token?: string };
    return typeof json.refresh_token === "string" ? json.refresh_token : null;
  } catch {
    return null;
  }
}

/** Revokes a member's Apple refresh token (account deleted). True when Apple accepted it. */
export async function appleRevoke(refresh: string): Promise<boolean> {
  const secret = await appleClientSecret();
  if (!secret) return false;
  try {
    const res = await fetch("https://appleid.apple.com/auth/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: APPLE_BUNDLE_ID, client_secret: secret, token: refresh, token_type_hint: "refresh_token" }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Health check of the Sign in with Apple key, no secret in the answer:
 * a made-up code makes Apple say «invalid_grant» when our client secret is
 * accepted, «invalid_client» when the key / ids are wrong.
 */
export async function appleKeyCheck(): Promise<{ vars: boolean; signed: boolean; apple: string }> {
  const vars = !!(process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_P8);
  const secret = await appleClientSecret();
  if (!secret) return { vars, signed: false, apple: "" };
  try {
    const res = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: APPLE_BUNDLE_ID, client_secret: secret, code: "sfrtna-check", grant_type: "authorization_code" }),
      signal: AbortSignal.timeout(8000),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    return { vars, signed: true, apple: `${res.status} ${j.error || ""}`.trim() };
  } catch (e) {
    return { vars, signed: true, apple: `fetch ${(e as Error).name}` };
  }
}
