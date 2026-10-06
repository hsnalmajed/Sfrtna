import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import LegalPage from "@/components/LegalPage";
import { pageMetadata } from "@/lib/seo";

const LAST_UPDATED = "2026-10-07";

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
        { heading: t.termsAccuracyTitle, body: t.termsAccuracyBody },
        { heading: t.termsLiabilityTitle, body: t.termsLiabilityBody },
        { heading: t.termsContentTitle, body: t.termsContentBody },
        { heading: t.termsCopyTitle, body: t.termsCopyBody },
        { heading: t.termsChangesTitle, body: t.termsChangesBody },
      ]}
    />
  );
}
