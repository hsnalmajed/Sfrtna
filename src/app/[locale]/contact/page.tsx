import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import { notFound } from "next/navigation";
import { CONTACT_EMAIL } from "@/lib/contact";
import LegalPage from "@/components/LegalPage";
import { pageMetadata } from "@/lib/seo";


export async function generateMetadata({
  params,
}: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  return pageMetadata({
    locale: loc,
    path: "/contact",
    title: dict.legal.contactTitle,
    description: dict.legal.contactLead,
  });
}

export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  const t = dict.legal;
  // No page with nothing on it: until an address is chosen there is no page.
  if (!CONTACT_EMAIL) notFound();

  return (
    <LegalPage locale={loc} title={t.contactTitle} lead={t.contactLead} sections={[]}>
      {CONTACT_EMAIL ? (
        <div className="card mb-8 px-5 py-5">
          <p className="eyebrow mb-2">{t.contactEmailLabel}</p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            dir="ltr"
            className="font-display text-h3 font-extrabold text-navy-900 underline decoration-sun-400 decoration-2 underline-offset-4 transition hover:text-sun-700"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      ) : null}
    </LegalPage>
  );
}
