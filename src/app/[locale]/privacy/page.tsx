import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import { ConsentSettingsButton } from "@/components/Analytics";
import LegalPage from "@/components/LegalPage";
import { pageMetadata } from "@/lib/seo";

const LAST_UPDATED = "2026-10-08";

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
        { heading: t.privacyUseTitle, body: t.privacyUseBody },
        {
          heading: t.privacyCookiesTitle,
          body: t.privacyCookiesBody,
          // The one place a visitor changes their mind about measurement.
          action: (
            <ConsentSettingsButton
              label={t.privacyCookiesChange}
              className="inline-flex rounded-full bg-navy-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-navy-800"
            />
          ),
        },
        { heading: t.privacyLocationTitle, body: t.privacyLocationBody },
        { heading: t.privacyPartnersTitle, body: t.privacyPartnersBody },
        { heading: t.privacyProtectTitle, body: t.privacyProtectBody },
        { heading: t.privacyChildrenTitle, body: t.privacyChildrenBody },
        { heading: t.privacyRightsTitle, body: t.privacyRightsBody },
        { heading: t.privacyChangesTitle, body: t.privacyChangesBody },
      ]}
    />
  );
}
