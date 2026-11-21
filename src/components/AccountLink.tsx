"use client";

import Link from "next/link";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { useAccount } from "@/lib/useAccount";
import { useEffect, useState } from "react";
import { appFeatures, inApp } from "@/lib/nativeApp";

/**
 * «تسجيل الدخول» / «حسابي» — shown once sign-in is switched on (or someone
 * is already signed in), so there is never a link to a page that cannot sign
 * anyone in.
 */
export default function AccountLink({
  locale,
  variant,
  onNavigate,
}: {
  locale: Locale;
  variant: "header" | "drawer" | "sheet";
  onNavigate?: (e: React.MouseEvent, href: string) => void;
}) {
  const nav = useDictionary().nav;
  const member = useDictionary().member;
  const { status, user, methods } = useAccount();
  const [appAuth, setAppAuth] = useState(false);
  const [apple, setApple] = useState(false);
  useEffect(() => {
    void appFeatures().then((f) => {
      setAppAuth(f.includes("auth"));
      setApple(f.includes("apple"));
    });
  }, []);
  // While the account is being asked for, the header keeps the button's
  // place (invisible), so nothing beside it jumps when it appears.
  if (status !== "ready" && variant === "header")
    return (
      <span aria-hidden="true" className="invisible hidden items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold sm:inline-flex">
        <PersonIcon /> {nav.signIn}
      </span>
    );
  // Google refuses sign-in inside the app's WebView: in the app Google
  // counts only when this build can sign in through the phone's browser —
  // no link to a page that cannot sign anyone in.
  const google = Boolean(methods.google) && (!(status === "ready" && inApp()) || appAuth);
  if (status !== "ready" || (!user && !methods.email && !google && !apple)) return null;
  const href = `/${locale}/account`;
  const label = user ? nav.account : nav.signIn;
  const click = onNavigate ? (e: React.MouseEvent) => onNavigate(e, href) : undefined;

  if (variant === "header")
    return (
      <Link href={href} className="hidden items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-bold text-navy-900 shadow-sm transition hover:bg-mist-100 sm:inline-flex">
        <PersonIcon /> {label}
      </Link>
    );
  if (variant === "drawer")
    return (
      <Link href={href} className="mt-2 block rounded-xl px-3 py-3 text-sm font-semibold text-white/85 ring-1 ring-white/15 hover:bg-white/5">
        <span className="inline-flex items-center gap-1.5"><PersonIcon /> {label}</span>
      </Link>
    );
  // The app's «المزيد» (owner, 21 Nov 2026): right under the language. Signed
  // in → one row with the initial and the e-mail; signed out → a card with
  // each way of signing in this device can use, each opening the account
  // page with that way already started (SignInForm reads «?start=»).
  const t = useDictionary().account;
  const go = (how: string) => (e: React.MouseEvent) => {
    const to = `${href}?start=${how}`;
    if (onNavigate) onNavigate(e, to);
  };
  if (user)
    return (
      <Link
        href={href}
        onClick={click}
        className="flex items-center gap-3 rounded-[1.25rem] bg-white p-3.5 shadow-[0_1px_2px_rgba(11,45,91,0.06)] active:bg-mist-50"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-900 font-display text-lg font-black text-[#f8b840]">
          {(user.name || user.email || "?").trim().charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-black text-navy-900">{nav.account}</span>
          {user.email && <span dir="ltr" className="block truncate text-end text-xs text-navy-900/55">{user.email}</span>}
        </span>
        <Chevron />
      </Link>
    );
  const btn = "mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-[0.95rem] font-extrabold active:scale-[0.99]";
  return (
    <div className="rounded-[1.25rem] bg-white p-3.5 shadow-[0_1px_2px_rgba(11,45,91,0.06)]">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mist-100 text-navy-900">
          <PersonIcon />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-base font-black text-navy-900">{nav.signIn}</span>
          <span className="block text-xs text-navy-900/60">{member.moreSub}</span>
        </span>
      </div>
      <div className="mt-1">
        {apple && (
          <Link href={`${href}?start=apple`} onClick={go("apple")} className={`${btn} bg-black text-white`}>
            <svg aria-hidden="true" viewBox="0 0 384 512" className="h-[1.1rem] w-[1.1rem] fill-current">
              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
            </svg>
            {t.apple}
          </Link>
        )}
        {google && (
          <Link href={`${href}?start=google`} onClick={go("google")} className={`${btn} border border-[#c9d3e0] bg-white text-[#1f1f1f]`}>
            <svg aria-hidden="true" viewBox="0 0 48 48" className="h-[1.1rem] w-[1.1rem] shrink-0">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            {t.google}
          </Link>
        )}
        {methods.email && (
          <Link href={`${href}?start=email`} onClick={go("email")} className={`${btn} bg-mist-100 text-navy-900`}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[1.1rem] w-[1.1rem]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            {t.emailStart}
          </Link>
        )}
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.1rem] w-[1.1rem] shrink-0 text-navy-900/30 ltr:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path strokeLinecap="round" d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
