"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDictionary } from "@/lib/dict/context";
import type { Locale } from "@/lib/types";
import { inApp } from "@/lib/nativeApp";
import { PENDING_PLAN_KEY, refreshAccount, setSignedIn, useAccount, type AccountUser } from "@/lib/useAccount";

interface SavedPlan {
  id: string;
  title: string;
  created: number;
  plan: { code: string; slug: string; from: string; to: string; days: string[][] };
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string; locale?: string }): void;
          renderButton(el: HTMLElement, o: Record<string, unknown>): void;
        };
      };
    };
  }
}

/** Where to go after signing in: our own path only. */
function nextPath(): string | null {
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : null;
}

export function savedPlanHref(locale: Locale, p: SavedPlan): string {
  const q = new URLSearchParams({ saved: p.id, from: p.plan.from, to: p.plan.to });
  return `/${locale}/attractions/${p.plan.code}/${p.plan.slug}?${q}#trip-plan`;
}

/**
 * «حسابي»: sign in (Google or an emailed code), then the saved plans, sign
 * out and delete. A plan the traveller tried to save before signing in is
 * saved right after, and they are taken back to it.
 */
export default function AccountPanel({ locale }: { locale: Locale }) {
  const t = useDictionary().account;
  const account = useAccount();
  const router = useRouter();

  const afterSignIn = useCallback(
    async (user: AccountUser) => {
      setSignedIn(user);
      let savedId: string | null = null;
      try {
        const pending = sessionStorage.getItem(PENDING_PLAN_KEY);
        if (pending) {
          const res = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: pending });
          const json = (await res.json()) as { ok: boolean; id?: string };
          if (json.ok && json.id) savedId = json.id;
          sessionStorage.removeItem(PENDING_PLAN_KEY);
        }
      } catch {
        // The plan can be saved again from its page.
      }
      const next = nextPath();
      if (next) {
        const url = new URL(next, window.location.origin);
        if (savedId) url.searchParams.set("saved", savedId);
        router.replace(url.pathname + url.search + url.hash);
      }
    },
    [router]
  );

  if (account.status === "loading") return <p className="py-10 text-center text-navy-500">{t.loading}</p>;
  if (account.user) return <SignedIn locale={locale} user={account.user} />;
  return <SignInForm locale={locale} methods={account.methods} onSignedIn={afterSignIn} />;
}

function SignInForm({
  locale,
  methods,
  onSignedIn,
}: {
  locale: Locale;
  methods: { google: string | null; email: boolean };
  onSignedIn: (u: AccountUser) => void;
}) {
  const t = useDictionary().account;
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const googleBox = useRef<HTMLDivElement>(null);
  const [app, setApp] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount (the app is known from the user agent)
    setApp(inApp());
  }, []);

  const reasonText = (r: string | undefined) =>
    r === "wrong" ? t.wrongCode : r === "expired" ? t.expiredCode : r === "too_many" ? t.tooMany : r === "bad_email" ? t.badEmail : r === "off" ? t.off : t.sendFailed;

  // Google's own button (Google Identity Services). Google does not allow
  // its sign-in inside an app's WebView, so the app offers email only.
  const googleId = !app ? methods.google : null;
  useEffect(() => {
    if (!googleId || !googleBox.current) return;
    const box = googleBox.current;
    const draw = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id: googleId,
        locale,
        callback: async ({ credential }) => {
          setBusy(true);
          setError("");
          try {
            const res = await fetch("/api/auth/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }) });
            const json = (await res.json()) as { ok: boolean; user?: AccountUser };
            if (json.ok && json.user) onSignedIn(json.user);
            else setError(t.googleFailed);
          } catch {
            setError(t.googleFailed);
          } finally {
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.renderButton(box, { theme: "outline", size: "large", shape: "pill", text: "continue_with", width: Math.min(box.clientWidth || 320, 400), locale });
    };
    if (window.google) return draw();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = draw;
    document.head.appendChild(s);
  }, [googleId, locale, onSignedIn, t.googleFailed]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim())) return setError(t.badEmail);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/email-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), locale }) });
      const json = (await res.json()) as { ok: boolean; reason?: string };
      if (json.ok) {
        setStep("code");
        setCode("");
      } else setError(reasonText(json.reason));
    } catch {
      setError(t.sendFailed);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/email-verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), code }) });
      const json = (await res.json()) as { ok: boolean; reason?: string; user?: AccountUser };
      if (json.ok && json.user) onSignedIn(json.user);
      else setError(reasonText(json.reason));
    } catch {
      setError(t.wrongCode);
    } finally {
      setBusy(false);
    }
  }

  const none = !googleId && !methods.email;
  const input =
    "w-full rounded-2xl border border-mist-300 bg-white px-4 py-3 text-base text-navy-900 outline-none focus:border-sea-500 focus:ring-2 focus:ring-sea-200";
  const primary =
    "w-full rounded-full bg-sun-400 px-5 py-3 font-extrabold text-navy-950 transition hover:bg-sun-300 disabled:opacity-60";

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 sm:p-8">
      <h2 className="font-display text-xl font-extrabold text-navy-900">{t.signInTitle}</h2>
      <p className="mt-1 text-sm leading-relaxed text-navy-600">{t.signInSub}</p>

      {none ? (
        <p className="mt-6 rounded-2xl bg-mist-50 px-4 py-3 text-sm text-navy-700">{t.off}</p>
      ) : (
        <div className="mt-6 space-y-5">
          {googleId && (
            <>
              <div ref={googleBox} className="flex min-h-11 justify-center" aria-label={t.google} />
              {methods.email && (
                <div className="flex items-center gap-3 text-xs font-bold text-navy-400">
                  <span className="h-px flex-1 bg-mist-200" />
                  {t.or}
                  <span className="h-px flex-1 bg-mist-200" />
                </div>
              )}
            </>
          )}
          {app && methods.google && <p className="text-center text-xs text-navy-500">{t.googleInApp}</p>}

          {methods.email &&
            (step === "email" ? (
              <form onSubmit={sendCode} className="space-y-3">
                <label className="block text-sm font-bold text-navy-800" htmlFor="acc-email">
                  {t.emailLabel}
                </label>
                <input
                  id="acc-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  dir="ltr"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  className={input}
                />
                <button type="submit" disabled={busy} className={primary}>
                  {busy ? t.sending : t.sendCode}
                </button>
              </form>
            ) : (
              <form onSubmit={verify} className="space-y-3">
                <p className="rounded-2xl bg-sea-50 px-4 py-3 text-sm leading-relaxed text-navy-800">{t.codeSent.replace("{email}", email.trim())}</p>
                <label className="block text-sm font-bold text-navy-800" htmlFor="acc-code">
                  {t.codeLabel}
                </label>
                <input
                  id="acc-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  dir="ltr"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className={`${input} text-center text-2xl tracking-[0.5em]`}
                />
                <button type="submit" disabled={busy || code.length !== 6} className={primary}>
                  {busy ? t.verifying : t.verify}
                </button>
                <div className="flex justify-between text-sm font-bold text-sea-700">
                  <button type="button" onClick={() => setStep("email")} className="hover:underline">
                    {t.changeEmail}
                  </button>
                  <button type="button" onClick={() => sendCode()} disabled={busy} className="hover:underline">
                    {t.resend}
                  </button>
                </div>
              </form>
            ))}

          {error && (
            <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </p>
          )}
          <p className="text-center text-xs text-navy-400">
            <Link href={`/${locale}/terms`} className="hover:underline">
              {t.agree}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

function SignedIn({ locale, user }: { locale: Locale; user: AccountUser }) {
  const t = useDictionary().account;
  const [plans, setPlans] = useState<SavedPlan[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/plans", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ok: boolean; plans?: SavedPlan[] }>)
      .then((j) => live && setPlans(j.plans ?? []))
      .catch(() => live && setPlans([]));
    return () => {
      live = false;
    };
  }, []);

  async function removePlan(id: string) {
    setRemoving(null);
    await fetch("/api/plans/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setPlans((p) => (p ? p.filter((x) => x.id !== id) : p));
  }

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    await refreshAccount();
  }

  async function deleteAccount() {
    await fetch("/api/auth/delete", { method: "POST" });
    setConfirmDelete(false);
    await refreshAccount();
  }

  const fmt = (ms: number) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(ms);
  const fmtDay = (iso: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-navy-950/5">
        <div className="min-w-0">
          <p className="font-display text-lg font-extrabold text-navy-900">{t.hello.replace("{name}", user.name || user.email?.split("@")[0] || "")}</p>
          {user.email && (
            <p className="truncate text-sm text-navy-500" dir="auto">
              {t.signedInAs.replace("{email}", user.email)}
            </p>
          )}
        </div>
        <button type="button" onClick={signOut} className="rounded-full px-4 py-2 text-sm font-bold text-navy-700 ring-1 ring-mist-300 hover:ring-navy-300">
          {t.signOut}
        </button>
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-extrabold text-navy-900">🧳 {t.myPlans}</h2>
        {plans === null ? (
          <p className="text-sm text-navy-500">{t.loading}</p>
        ) : plans.length === 0 ? (
          <div className="rounded-3xl bg-mist-50 p-5 text-sm leading-relaxed text-navy-700">
            <p>{t.noPlans}</p>
            <Link href={`/${locale}/itinerary`} className="mt-3 inline-block rounded-full bg-sun-400 px-5 py-2.5 font-extrabold text-navy-950 hover:bg-sun-300">
              {t.makePlan}
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {plans.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-navy-950/5">
                <div className="min-w-0">
                  <p className="font-bold text-navy-900">{p.title}</p>
                  <p className="text-xs text-navy-500">
                    {fmtDay(p.plan.from)} – {fmtDay(p.plan.to)} · {t.savedOn.replace("{date}", fmt(p.created))}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={savedPlanHref(locale, p)} className="rounded-full bg-sea-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-sea-700">
                    {t.open}
                  </Link>
                  {removing === p.id ? (
                    <>
                      <button type="button" onClick={() => removePlan(p.id)} className="rounded-full bg-red-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-red-700" aria-label={t.removeConfirm}>
                        {t.remove} ✓
                      </button>
                      <button type="button" onClick={() => setRemoving(null)} className="rounded-full px-3 py-2 text-sm font-bold text-navy-700 ring-1 ring-mist-300">
                        {t.cancel}
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setRemoving(p.id)} className="rounded-full px-3 py-2 text-sm font-bold text-red-700 ring-1 ring-red-200 hover:ring-red-400">
                      {t.remove}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="border-t border-mist-200 pt-5 text-center">
        {confirmDelete ? (
          <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
            <p className="font-bold">{t.deleteConfirm}</p>
            <div className="mt-3 flex justify-center gap-3">
              <button type="button" onClick={deleteAccount} className="rounded-full bg-red-600 px-4 py-2 font-extrabold text-white hover:bg-red-700">
                {t.deleteYes}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-full px-4 py-2 font-bold text-navy-700 ring-1 ring-mist-300">
                {t.cancel}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm font-bold text-red-700 hover:underline">
            {t.deleteAccount}
          </button>
        )}
      </div>
    </div>
  );
}
