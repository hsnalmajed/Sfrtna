import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import { pageMetadata } from "@/lib/seo";
import type { Locale } from "@/lib/types";
import PageHero from "@/components/ui/PageHero";
import { sectionHero } from "@/lib/sectionHero";
import AccountPanel from "@/components/AccountPanel";

// «حسابي»: sign in, saved plans, sign out, delete. The page itself is the
// same for everyone (cached at the edge); who is signed in is asked by the
// browser (src/lib/useAccount.ts). Personal, so kept out of search engines.
export async function generateMetadata({ params }: PageProps<"/[locale]/account">): Promise<Metadata> {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  return { ...pageMetadata({ locale: loc, path: "/account", title: dict.account.title, description: dict.account.subtitle }), robots: { index: false, follow: false } };
}

export default async function AccountPage({ params }: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  const hero = await sectionHero("attractions", loc);
  return (
    <div>
      <PageHero {...hero} size="sm" align="center" title={dict.account.title} subtitle={dict.account.subtitle} />
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <AccountPanel locale={loc} />
      </div>
    </div>
  );
}
