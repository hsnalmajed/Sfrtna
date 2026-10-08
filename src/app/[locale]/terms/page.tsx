import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import LegalPage from "@/components/LegalPage";
import { pageMetadata } from "@/lib/seo";

const LAST_UPDATED = "2026-10-08";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  return pageMetadata({
    locale: loc,
    path: "/terms",
    title: dict.legal.termsTitle,
    description: dict.legal.termsLead,
  });
}

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  const t = dict.legal;

  return (
    <LegalPage
      locale={loc}
      title={t.termsTitle}
      lead={t.termsLead}
      lastUpdated={t.lastUpdated.replace("{date}", LAST_UPDATED)}
      sections={[
        { heading: t.termsServiceTitle, body: t.termsServiceBody },
        { heading: t.termsPricesTitle, body: t.termsPricesBody },
        { heading: t.termsInfoTitle, body: t.termsInfoBody },
        { heading: t.termsUseTitle, body: t.termsUseBody },
        { heading: t.termsCopyTitle, body: t.termsCopyBody },
        { heading: t.termsLinksTitle, body: t.termsLinksBody },
        { heading: t.termsLiabilityTitle, body: t.termsLiabilityBody },
        { heading: t.termsChangesTitle, body: t.termsChangesBody },
      ]}
    />
  );
}
