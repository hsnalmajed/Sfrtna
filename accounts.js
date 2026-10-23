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
//   items     what the traveller keeps (owner, 21 Oct): the travel profile
//             (home airport, travellers, preferences), favourite cities and
//             hotels, recent searches, and trips with their checklist
//   appcodes  SHA-256 of a one-time code that carries a sign-in from the
//             phone's browser back into the app (2 minutes, used once,
//             bound to a PKCE challenge only the app knows the answer to)
//   feedback  what visitors send through «شاركنا رأيك» (owner, 22 Oct): kind,
//             section, rating, text, the page and device it came from, and
//             an email only when the visitor typed one. A hash of the
//             sender's address is kept one day for the hourly limit, then
//             cleared. Screenshots are mailed to the owner, never stored.
//   stats     anonymous daily counts for the owner's weekly report (owner,
//             23 Oct): visits by platform/device/source, searches by type,
//             destination, origin and hotel, partner clicks by partner. Only
//             (day, kind, key, count) — no person, address or session.
// Deleting an account deletes all of its rows (its feedback stays, with the
// account and email removed from it).

import { DurableObject } from "cloudflare:workers";

const SESSION_DAYS = 180;
const CODE_MINUTES = 10;
const CODE_TRIES = 5;
const CODES_PER_HOUR = 5;
const MAX_PLANS = 50;
const MAX_PLAN_BYTES = 20_000;
const APP_CODE_SECONDS = 120;
// Sessions are renewed while used: a traveller who opens the app now and
// then stays signed in (owner, 21 Oct).
const SESSION_RENEW_DAYS = 90;
const ITEM_LIMITS = { profile: 1, fav: 200, search: 20, trip: 30 };
const MAX_ITEM_BYTES = 4_000;
const FEEDBACK_PER_HOUR = 6;
const STATS_KEYS_PER_DAY = 3000;
const STATS_KEEP_DAYS = 400;

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sha256(text) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}
async function sha256url(text) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return btoa(String.fromCharCode(...d)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
      CREATE TABLE IF NOT EXISTS items (user TEXT NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL, data TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (user, kind, key));
      CREATE INDEX IF NOT EXISTS items_user ON items(user, kind, created);
      CREATE TABLE IF NOT EXISTS stats (day TEXT NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, kind, key));
      CREATE TABLE IF NOT EXISTS appcodes (hash TEXT PRIMARY KEY, user TEXT NOT NULL, challenge TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, created INTEGER NOT NULL, user TEXT, kind TEXT NOT NULL, area TEXT NOT NULL, rating INTEGER, text TEXT NOT NULL, email TEXT, contact INTEGER NOT NULL, ctx TEXT NOT NULL, ip TEXT);
      CREATE INDEX IF NOT EXISTS feedback_created ON feedback(created);
      CREATE INDEX IF NOT EXISTS feedback_ip ON feedback(ip, created);
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
    const hash = await sha256(token);
    const s = this.one("SELECT user, expires FROM sessions WHERE hash = ?", hash);
    const now = Date.now();
    if (!s || s.expires < now) return null;
    if (s.expires - now < SESSION_RENEW_DAYS * 864e5) this.sql.exec("UPDATE sessions SET expires = ? WHERE hash = ?", now + SESSION_DAYS * 864e5, hash);
    return this.publicUser(this.one("SELECT * FROM users WHERE id = ?", s.user));
  }

  /** The renewed cookie lifetime for a session in use (seconds). */
  sessionMaxAge() {
    return SESSION_DAYS * 86400;
  }

  // ---- Sign-in carried from the phone's browser into the app ---------

  /** A one-time code for the signed-in browser to hand to the app. */
  async appCodeStart(token, challenge) {
    const user = await this.userFor(token);
    if (!user) return { ok: false, reason: "signed_out" };
    if (typeof challenge !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) return { ok: false, reason: "bad_challenge" };
    const now = Date.now();
    this.sql.exec("DELETE FROM appcodes WHERE expires < ?", now);
    const code = randomToken();
    this.sql.exec("INSERT INTO appcodes (hash, user, challenge, expires) VALUES (?, ?, ?, ?)", await sha256(code), user.id, challenge, now + APP_CODE_SECONDS * 1000);
    return { ok: true, code };
  }

  /** The app trades the code and its secret verifier for its own session. */
  async appCodeExchange(code, verifier) {
    if (typeof code !== "string" || !/^[a-f0-9]{64}$/.test(code) || typeof verifier !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier))
      return { ok: false, reason: "bad_code" };
    const hash = await sha256(code);
    const row = this.one("SELECT user, challenge, expires FROM appcodes WHERE hash = ?", hash);
    // Used once, whatever the outcome.
    this.sql.exec("DELETE FROM appcodes WHERE hash = ?", hash);
    if (!row || row.expires < Date.now()) return { ok: false, reason: "expired" };
    if ((await sha256url(verifier)) !== row.challenge) return { ok: false, reason: "bad_code" };
    const user = this.one("SELECT * FROM users WHERE id = ?", row.user);
    if (!user) return { ok: false, reason: "expired" };
    return { ok: true, user: this.publicUser(user), ...(await this.newSession(user.id)) };
  }

  // ---- What the traveller keeps --------------------------------------

  async itemsList(token) {
    const user = await this.userFor(token);
    if (!user) return null;
    return this.sql
      .exec("SELECT kind, key, data, created FROM items WHERE user = ? ORDER BY created DESC", user.id)
      .toArray()
      .map((r) => ({ kind: r.kind, key: r.key, created: r.created, data: JSON.parse(r.data) }));
  }

  async itemPut(token, kind, key, data) {
    const user = await this.userFor(token);
    if (!user) return { ok: false, reason: "signed_out" };
    const limit = ITEM_LIMITS[kind];
    if (!limit || typeof key !== "string" || !key || key.length > 200) return { ok: false, reason: "bad_item" };
    const json = JSON.stringify(data);
    if (json.length > MAX_ITEM_BYTES) return { ok: false, reason: "too_big" };
    const now = Date.now();
    const exists = this.one("SELECT created FROM items WHERE user = ? AND kind = ? AND key = ?", user.id, kind, key);
    // Searches move to the top when repeated; everything else keeps its date.
    const created = exists && kind !== "search" ? exists.created : now;
    this.sql.exec(
      "INSERT INTO items (user, kind, key, data, created) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user, kind, key) DO UPDATE SET data = excluded.data, created = excluded.created",
      user.id,
      kind,
      key,
      json,
      created
    );
    const count = this.one("SELECT COUNT(*) AS n FROM items WHERE user = ? AND kind = ?", user.id, kind).n;
    if (count > limit) {
      if (kind !== "search") {
        this.sql.exec("DELETE FROM items WHERE user = ? AND kind = ? AND key = ?", user.id, kind, key);
        return { ok: false, reason: "too_many" };
      }
      // The oldest searches make way.
      this.sql.exec(
        "DELETE FROM items WHERE user = ? AND kind = 'search' AND key IN (SELECT key FROM items WHERE user = ? AND kind = 'search' ORDER BY created ASC LIMIT ?)",
        user.id,
        user.id,
        count - limit
      );
    }
    return { ok: true };
  }

  async itemDelete(token, kind, key) {
    const user = await this.userFor(token);
    if (!user) return { ok: false, reason: "signed_out" };
    this.sql.exec("DELETE FROM items WHERE user = ? AND kind = ? AND key = ?", user.id, kind, key);
    return { ok: true };
  }

  async signOut(token) {
    if (token) this.sql.exec("DELETE FROM sessions WHERE hash = ?", await sha256(token));
    return { ok: true };
  }

  async deleteAccount(token) {
    const user = await this.userFor(token);
    if (!user) return { ok: false };
    this.sql.exec("DELETE FROM plans WHERE user = ?", user.id);
    this.sql.exec("DELETE FROM items WHERE user = ?", user.id);
    this.sql.exec("DELETE FROM appcodes WHERE user = ?", user.id);
    this.sql.exec("DELETE FROM sessions WHERE user = ?", user.id);
    if (user.email) this.sql.exec("DELETE FROM codes WHERE email = ?", user.email);
    this.sql.exec("UPDATE feedback SET user = NULL, email = NULL WHERE user = ?", user.id);
    this.sql.exec("DELETE FROM users WHERE id = ?", user.id);
    return { ok: true };
  }

  /**
   * One piece of feedback. `ip` is already a hash (src/lib/feedback.ts);
   * at most FEEDBACK_PER_HOUR from one address, so a script cannot flood
   * the owner's inbox. Returns the reference shown to the visitor.
   */
  async feedbackAdd(token, f) {
    const now = Date.now();
    this.sql.exec("UPDATE feedback SET ip = NULL WHERE created < ?", now - 864e5);
    const recent = this.one("SELECT COUNT(*) AS n FROM feedback WHERE ip = ? AND created > ?", f.ip, now - 3600e3);
    if (recent && recent.n >= FEEDBACK_PER_HOUR) return { ok: false, reason: "too_many" };
    const user = token ? await this.userFor(token) : null;
    const email = f.email || user?.email || null;
    this.sql.exec(
      "INSERT INTO feedback (created, user, kind, area, rating, text, email, contact, ctx, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      now, user?.id ?? null, f.kind, f.area, f.rating ?? null, f.text, email, f.contact ? 1 : 0, JSON.stringify(f.ctx ?? {}), f.ip
    );
    const row = this.one("SELECT last_insert_rowid() AS id");
    return { ok: true, id: row.id, ref: `F-${String(row.id).padStart(4, "0")}`, email, signedIn: Boolean(user) };
  }

  /** Feedback since a time, newest first — for the owner's status email. */
  async feedbackRecent(since) {
    return this.sql
      .exec("SELECT id, created, kind, area, rating, text, email, contact, ctx FROM feedback WHERE created > ? ORDER BY id DESC LIMIT 100", since)
      .toArray()
      .map((r) => ({ ...r, ref: `F-${String(r.id).padStart(4, "0")}`, ctx: JSON.parse(r.ctx) }));
  }

  /** Add 1 to each (kind, key) for today. Unknown keys past the daily cap are dropped. */
  async statsAdd(pairs) {
    const day = new Date().toISOString().slice(0, 10);
    const rows = this.sql.exec("SELECT COUNT(*) AS c FROM stats WHERE day = ?", day).one().c;
    for (const [kind, key] of pairs) {
      const hit = this.sql.exec("UPDATE stats SET n = n + 1 WHERE day = ? AND kind = ? AND key = ?", day, kind, key).rowsWritten;
      if (!hit && rows < STATS_KEYS_PER_DAY) this.sql.exec("INSERT OR IGNORE INTO stats (day, kind, key, n) VALUES (?, ?, ?, 1)", day, kind, key);
    }
    if (Math.random() < 0.01) {
      const cut = new Date(Date.now() - STATS_KEEP_DAYS * 86400e3).toISOString().slice(0, 10);
      this.sql.exec("DELETE FROM stats WHERE day < ?", cut);
    }
    return { ok: true };
  }

  /** Totals per (kind, key) between two days (inclusive from, exclusive to). */
  async statsRange(from, to) {
    return this.sql
      .exec("SELECT kind, key, SUM(n) AS n FROM stats WHERE day >= ? AND day < ? GROUP BY kind, key ORDER BY n DESC", from, to)
      .toArray();
  }

  /** Daily totals of one kind (for a trend line). */
  async statsDaily(kind, from, to) {
    return this.sql.exec("SELECT day, SUM(n) AS n FROM stats WHERE kind = ? AND day >= ? AND day < ? GROUP BY day ORDER BY day", kind, from, to).toArray();
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
