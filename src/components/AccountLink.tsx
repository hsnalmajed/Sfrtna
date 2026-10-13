"use client";

import Link from "next/link";
import type { Locale } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";
import { useAccount } from "@/lib/useAccount";

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
  const nav = getDictionary(locale).nav;
  const { status, user, methods } = useAccount();
  if (status !== "ready" || (!user && !methods.email && !methods.google)) return null;
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
  return (
    <Link
      href={href}
      onClick={click}
      className="mb-4 flex items-center justify-between rounded-2xl bg-navy-900 px-4 py-3.5 text-sm font-extrabold text-white active:bg-navy-800"
    >
      <span className="flex min-w-0 items-center gap-2">
        <PersonIcon />
        <span className="truncate">{user ? `${label}${user.email ? ` · ${user.email}` : ""}` : label}</span>
      </span>
      <span aria-hidden="true" className="text-white/50 rtl:rotate-180">›</span>
    </Link>
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
