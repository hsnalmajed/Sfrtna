// Accounts: who is signed in and the trip plans they saved (owner, 13 Oct
// 2026: "Google + email now; Apple later"). One SQLite-backed Durable Object
// for the whole site — strongly consistent, free on the Workers free plan, no
// database for the owner to create. Called only from the /api/auth and
// /api/plans route handlers (src/lib/accounts.ts), never from outside.
//
// What is kept, and nothing more:
//   users     id, email, Google subject id, display name, created
//   sessions  SHA-256 of the session token (the token itself lives only in
//             the visitor's HttpOnly cookie), user, expiry
//   codes     SHA-256 of a 6-digit sign-in code, its email, expiry, tries
//   plans     a saved plan: city, dates, the chosen places by key (no copies
//             of place data), title
// Deleting an account deletes all of its rows.

import { DurableObject } from "cloudflare:workers";

const SESSION_DAYS = 180;
const CODE_MINUTES = 10;
const CODE_TRIES = 5;
const CODES_PER_HOUR = 5;
const MAX_PLANS = 50;
const MAX_PLAN_BYTES = 20_000;

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sha256(text) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}
function randomToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return hex(b);
}
function randomId() {
  const b = new Uint8Array(9);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_");
}
function randomCode() {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return String(b[0] % 1_000_000).padStart(6, "0");
}

export class Accounts extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE, google TEXT UNIQUE, name TEXT, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user);
      CREATE TABLE IF NOT EXISTS codes (email TEXT PRIMARY KEY, hash TEXT NOT NULL, expires INTEGER NOT NULL, tries INTEGER NOT NULL, sent TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, user TEXT NOT NULL, title TEXT NOT NULL, data TEXT NOT NULL, created INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS plans_user ON plans(user, created);
    `);
  }

  one(query, ...args) {
    return this.sql.exec(query, ...args).toArray()[0] ?? null;
  }

  async newSession(userId) {
    const token = randomToken();
    const now = Date.now();
    this.sql.exec("DELETE FROM sessions WHERE expires < ?", now);
    this.sql.exec("INSERT INTO sessions (hash, user, expires) VALUES (?, ?, ?)", await sha256(token), userId, now + SESSION_DAYS * 864e5);
    return { token, maxAge: SESSION_DAYS * 86400 };
  }

  publicUser(u) {
    return u ? { id: u.id, email: u.email ?? null, name: u.name ?? null, google: Boolean(u.google) } : null;
  }

  /** A new sign-in code for this email, or {ok:false} when too many were asked for this hour. */
  async codeStart(email) {
    const now = Date.now();
    const row = this.one("SELECT sent FROM codes WHERE email = ?", email);
    const recent = (row ? JSON.parse(row.sent) : []).filter((t) => t > now - 3600e3);
    if (recent.length >= CODES_PER_HOUR) return { ok: false, reason: "too_many" };
    const code = randomCode();
    recent.push(now);
    this.sql.exec(
      "INSERT INTO codes (email, hash, expires, tries, sent) VALUES (?, ?, ?, 0, ?) ON CONFLICT(email) DO UPDATE SET hash = excluded.hash, expires = excluded.expires, tries = 0, sent = excluded.sent",
      email,
      await sha256(`${email}:${code}`),
      now + CODE_MINUTES * 60e3,
      JSON.stringify(recent)
    );
    return { ok: true, code };
  }

  /** Checks the code; on success signs in (creating the account on first use). */
  async codeVerify(email, code) {
    const row = this.one("SELECT hash, expires, tries FROM codes WHERE email = ?", email);
    if (!row || row.expires < Date.now()) return { ok: false, reason: "expired" };
    if (row.tries >= CODE_TRIES) return { ok: false, reason: "too_many" };
    if ((await sha256(`${email}:${code}`)) !== row.hash) {
      this.sql.exec("UPDATE codes SET tries = tries + 1 WHERE email = ?", email);
      return { ok: false, reason: "wrong" };
    }
    // Used once.
    this.sql.exec("UPDATE codes SET expires = 0 WHERE email = ?", email);
    let user = this.one("SELECT * FROM users WHERE email = ?", email);
    if (!user) {
      const id = randomId();
      this.sql.exec("INSERT INTO users (id, email, created) VALUES (?, ?, ?)", id, email, Date.now());
      user = this.one("SELECT * FROM users WHERE id = ?", id);
    }
    return { ok: true, user: this.publicUser(user), ...(await this.newSession(user.id)) };
  }

  /** Sign-in with a Google account already verified by the caller. */
  async googleSignIn(sub, email, name) {
    let user = this.one("SELECT * FROM users WHERE google = ?", sub);
    if (!user && email) {
      // The same person who signed in by email before: one account.
      user = this.one("SELECT * FROM users WHERE email = ?", email);
      if (user) this.sql.exec("UPDATE users SET google = ?, name = COALESCE(name, ?) WHERE id = ?", sub, name, user.id);
    }
    if (!user) {
      const id = randomId();
      this.sql.exec("INSERT INTO users (id, email, google, name, created) VALUES (?, ?, ?, ?, ?)", id, email, sub, name, Date.now());
    }
    user = this.one("SELECT * FROM users WHERE google = ?", sub);
    return { ok: true, user: this.publicUser(user), ...(await this.newSession(user.id)) };
  }

  async userFor(token) {
    if (!token) return null;
    const s = this.one("SELECT user, expires FROM sessions WHERE hash = ?", await sha256(token));
    if (!s || s.expires < Date.now()) return null;
    return this.publicUser(this.one("SELECT * FROM users WHERE id = ?", s.user));
  }

  async signOut(token) {
    if (token) this.sql.exec("DELETE FROM sessions WHERE hash = ?", await sha256(token));
    return { ok: true };
  }

  async deleteAccount(token) {
    const user = await this.userFor(token);
    if (!user) return { ok: false };
    this.sql.exec("DELETE FROM plans WHERE user = ?", user.id);
    this.sql.exec("DELETE FROM sessions WHERE user = ?", user.id);
    if (user.email) this.sql.exec("DELETE FROM codes WHERE email = ?", user.email);
    this.sql.exec("DELETE FROM users WHERE id = ?", user.id);
    return { ok: true };
  }

  async plansList(token) {
    const user = await this.userFor(token);
    if (!user) return null;
    return this.sql
      .exec("SELECT id, title, data, created FROM plans WHERE user = ? ORDER BY created DESC", user.id)
      .toArray()
      .map((r) => ({ id: r.id, title: r.title, created: r.created, plan: JSON.parse(r.data) }));
  }

  async planSave(token, title, data) {
    const user = await this.userFor(token);
    if (!user) return { ok: false, reason: "signed_out" };
    const json = JSON.stringify(data);
    if (json.length > MAX_PLAN_BYTES) return { ok: false, reason: "too_big" };
    const count = this.one("SELECT COUNT(*) AS n FROM plans WHERE user = ?", user.id).n;
    if (count >= MAX_PLANS) return { ok: false, reason: "too_many" };
    const id = randomId();
    this.sql.exec("INSERT INTO plans (id, user, title, data, created) VALUES (?, ?, ?, ?, ?)", id, user.id, String(title).slice(0, 120), json, Date.now());
    return { ok: true, id };
  }

  async planDelete(token, id) {
    const user = await this.userFor(token);
    if (!user) return { ok: false, reason: "signed_out" };
    this.sql.exec("DELETE FROM plans WHERE id = ? AND user = ?", id, user.id);
    return { ok: true };
  }
}
