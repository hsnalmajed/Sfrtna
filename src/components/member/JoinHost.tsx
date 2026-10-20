"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { useAccount } from "@/lib/useAccount";
import { appFeatures, inApp } from "@/lib/nativeApp";
import JoinBenefits from "@/components/member/JoinBenefits";
import type { JoinReason, ToastMsg } from "@/components/member/events";

/**
 * Mounted once in the layout: the «create your account» sheet (opened when
 * a signed-out traveller taps ♡, or books a flight) and the small toast that
 * confirms a save. The sheet shows only when signing in is possible here.
 */
export default function JoinHost({ locale }: { locale: Locale }) {
  const t = useDictionary().member;
  const account = useAccount();
  const [reason, setReason] = useState<JoinReason | null>(null);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [appAuth, setAppAuth] = useState(false);
  const [next, setNext] = useState("");

  useEffect(() => {
    void appFeatures().then((f) => setAppAuth(f.includes("auth")));
  }, []);

  const canSignIn =
    account.status === "ready" &&
    (account.methods.email || (Boolean(account.methods.google) && (!inApp() || appAuth)));

  useEffect(() => {
    const onJoin = (e: Event) => {
      if (!canSignIn) return;
      setNext(window.location.pathname + window.location.search + window.location.hash);
      setReason((e as CustomEvent<JoinReason>).detail);
    };
    const onToast = (e: Event) => setToast((e as CustomEvent<ToastMsg>).detail);
    window.addEventListener("sfr:join", onJoin);
    window.addEventListener("sfr:toast", onToast);
    return () => {
      window.removeEventListener("sfr:join", onJoin);
      window.removeEventListener("sfr:toast", onToast);
    };
  }, [canSignIn]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!reason) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setReason(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reason]);

  const title = reason === "fav" ? t.joinFav : reason === "trip" ? t.joinTrip : t.joinGeneric;
  const href = `/${locale}/account${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <>
      {reason && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center print:hidden" role="dialog" aria-modal="true" aria-label={title}>
          <button type="button" aria-label={t.notNow} onClick={() => setReason(null)} className="absolute inset-0 bg-navy-990/60 backdrop-blur-[2px]" />
          <div className="relative max-h-[88svh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl sm:rounded-3xl sm:p-7">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-navy-900/15 sm:hidden" aria-hidden="true" />
            <p className="font-display text-lg font-extrabold text-navy-950">{title}</p>
            <p className="mb-4 mt-0.5 text-sm text-navy-600">{t.free}</p>
            <JoinBenefits compact />
            <div className="mt-5 space-y-2">
              <Link
                href={href}
                onClick={() => setReason(null)}
                className="block w-full rounded-full bg-sun-400 px-5 py-3 text-center font-extrabold text-navy-950 shadow-[var(--shadow-sun)] hover:bg-sun-300"
              >
                {t.joinCta}
              </Link>
              <button type="button" onClick={() => setReason(null)} className="block min-h-10 w-full rounded-full text-sm font-bold text-navy-600">
                {t.notNow}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div
          role="status"
          className="lift-over-tabbar fixed inset-x-4 bottom-4 z-[65] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-navy-950 px-4 py-3 text-sm font-bold text-white shadow-2xl print:hidden"
        >
          <span>{toast.text}</span>
          {toast.href && (
            <Link href={toast.href} onClick={() => setToast(null)} className="shrink-0 rounded-full bg-sun-400 px-3.5 py-1.5 text-xs font-extrabold text-navy-950">
              {toast.linkText}
            </Link>
          )}
        </div>
      )}
    </>
  );
}
