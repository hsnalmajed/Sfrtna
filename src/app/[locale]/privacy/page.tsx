import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import LegalPage from "@/components/LegalPage";
import { pageMetadata } from "@/lib/seo";

const LAST_UPDATED = "2026-10-06";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  return pageMetadata({
    locale: loc,
    path: "/privacy",
    title: dict.legal.privacyTitle,
    description: dict.legal.privacyLead,
  });
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  const t = dict.legal;

  return (
    <LegalPage
      locale={loc}
      title={t.privacyTitle}
      lead={t.privacyLead}
      lastUpdated={t.lastUpdated.replace("{date}", LAST_UPDATED)}
      sections={[
        { heading: t.privacyCollectTitle, body: t.privacyCollectBody },
        { heading: t.privacyStorageTitle, body: t.privacyStorageBody },
        { heading: t.privacyAnalyticsTitle, body: t.privacyAnalyticsBody },
        { heading: t.privacyThirdTitle, body: t.privacyThirdBody },
        { heading: t.privacyRightsTitle, body: t.privacyRightsBody },
      ]}
    />
  );
}
