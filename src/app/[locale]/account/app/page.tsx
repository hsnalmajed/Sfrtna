import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import { redirect } from "next/navigation";
import AppHandoff from "@/components/member/AppHandoff";

// Opened by the app in the phone's browser (Custom Tab) to sign in — see
// src/lib/appAuth.ts. Never indexed, never linked from the site.
export async function generateMetadata({ params }: PageProps<"/[locale]/account/app">): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary((locale === "en" ? "en" : "ar") as Locale);
  return { title: dict.member.appTitle, robots: { index: false, follow: false } };
}

export default async function AppSignInPage({ params, searchParams }: PageProps<"/[locale]/account/app">) {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  // «المتابعة باستخدام Google» in the app (owner, 24 Nov 2026: «like every
  // other site»): straight to Google's list of accounts, and after the pick
  // straight back into the app (/api/auth/google/return) — no page of ours
  // in between. E-mail sign-in happens inside the app, so this page is for
  // Google only; «?f=1» is the fallback when the hand-back could not be made.
  const q = await searchParams;
  const c = typeof q.c === "string" ? q.c : "";
  if (/^[A-Za-z0-9_-]{43}$/.test(c) && q.f !== "1") redirect(`/api/auth/google/start?lang=${loc}&app=${c}`);
  return (
    <div className="bg-mist-50">
      <div className="mx-auto max-w-md px-4 pb-16 pt-28 sm:pt-32">
        <AppHandoff locale={loc} />
      </div>
    </div>
  );
}
