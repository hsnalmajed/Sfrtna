"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { refreshAccount, setSignedIn, useAccount } from "@/lib/useAccount";
import { SignInForm } from "@/components/AccountPanel";

/**
 * Step 2 of signing in to the app (src/lib/appAuth.ts), in the phone's
 * browser: sign in (or use the account already signed in here), then one
 * tap carries a one-time code back to the app.
 */
export default function AppHandoff({ locale }: { locale: Locale }) {
  const t = useDictionary().member;
  const account = useAccount();
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState<{ value: string; at: number } | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "sent" | "failed">("idle");
  const asking = useRef(false);

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c") || "";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the address once
    setChallenge(/^[A-Za-z0-9_-]{43}$/.test(c) ? c : "");
  }, []);

  const ask = useCallback(async () => {
    if (asking.current) return null;
    asking.current = true;
    try {
      const res = await fetch("/api/auth/app-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challenge }) });
      const j = (await res.json()) as { ok: boolean; code?: string };
      if (!j.ok || !j.code) return null;
      const next = { value: j.code, at: Date.now() };
      setCode(next);
      return next;
    } catch {
      return null;
    } finally {
      asking.current = false;
    }
  }, [challenge]);

  // Signed in: have the code ready, so the tap goes straight back.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the state is set after the request answers
    if (account.user && challenge && !code) void ask();
  }, [account.user, challenge, code, ask]);

  async function back() {
    setState("busy");
    const fresh = code && Date.now() - code.at < 90_000 ? code : await ask();
    if (!fresh) return setState("failed");
    setCode(null);
    setState("sent");
    window.location.href = `sfrtna://auth?code=${fresh.value}&lang=${locale}`;
  }

  async function other() {
    await fetch("/api/auth/signout", { method: "POST" });
    setCode(null);
    await refreshAccount();
  }

  if (!challenge) return <p className="rounded-3xl bg-white p-6 text-center text-navy-700 shadow-sm">{t.appBadLink}</p>;
  if (account.status === "loading") return null;
  if (!account.user) {
    return (
      <>
        <p className="mb-4 text-center font-display text-xl font-extrabold text-navy-950">{t.appTitle}</p>
        <SignInForm locale={locale} methods={account.methods} onSignedIn={(u) => setSignedIn(u)} />
      </>
    );
  }
  const name = account.user.name || account.user.email || "";
  return (
    <div className="rounded-3xl bg-white p-6 text-center shadow-[var(--shadow-card)] ring-1 ring-navy-950/5">
      <p className="font-display text-xl font-extrabold text-navy-950">{t.appTitle}</p>
      <p className="mt-1 text-sm text-navy-600">{t.appSub}</p>
      <button
        type="button"
        onClick={back}
        disabled={state === "busy"}
        className="mt-6 w-full rounded-full bg-sun-400 px-5 py-3.5 font-extrabold text-navy-950 shadow-[var(--shadow-sun)] hover:bg-sun-300 disabled:opacity-60"
      >
        {state === "sent" ? t.backToApp : t.continueAs.replace("{name}", name)}
      </button>
      {state === "failed" && <p className="mt-3 text-sm font-bold text-red-700">{t.appFailed}</p>}
      <button type="button" onClick={other} className="mt-3 min-h-10 text-sm font-bold text-sea-700 hover:underline">
        {t.otherAccount}
      </button>
    </div>
  );
}
