import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import AppHandoff from "@/components/member/AppHandoff";

// Opened by the app in the phone's browser (Custom Tab) to sign in — see
// src/lib/appAuth.ts. Never indexed, never linked from the site.
export async function generateMetadata({ params }: PageProps<"/[locale]/account/app">): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary((locale === "en" ? "en" : "ar") as Locale);
  return { title: dict.member.appTitle, robots: { index: false, follow: false } };
}

export default async function AppSignInPage({ params }: PageProps<"/[locale]/account/app">) {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  return (
    <div className="bg-mist-50">
      <div className="mx-auto max-w-md px-4 pb-16 pt-28 sm:pt-32">
        <AppHandoff locale={loc} />
      </div>
    </div>
  );
}
