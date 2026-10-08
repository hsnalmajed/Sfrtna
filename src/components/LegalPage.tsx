import type { Locale } from "@/lib/types";
import PageHero from "@/components/ui/PageHero";

export interface LegalSection {
  heading: string;
  body: string;
  /** Something to do about it, under the text — the privacy page's cookie choice. */
  action?: React.ReactNode;
}

/**
 * The shape the four trust pages share.
 *
 * About, contact, privacy and terms are the pages a visitor checks when they
 * are deciding whether a site is a real business — which on a travel site
 * they are deciding before they trust a price. They had no reason to differ
 * from each other, and four hand-built pages would have drifted.
 *
 * Deliberately plain: no hero photograph, a narrow measure, and generous
 * line height. These are pages to be read, and a photograph of a mountain
 * above a liability clause is a small lie about what the page is.
 */
export default function LegalPage({
  locale,
  title,
  lead,
  sections,
  children,
  lastUpdated,
}: {
  locale: Locale;
  title: string;
  lead: string;
  sections: LegalSection[];
  /** Anything that isn't prose — the contact page's email block. */
  children?: React.ReactNode;
  lastUpdated?: string;
}) {
  return (
    <div className="bg-mist-50">
      <PageHero size="sm" title={title} subtitle={lead} />

      <div className="mx-auto max-w-2xl px-4 pb-16 pt-10 sm:px-6">
        {children}

        <div className="space-y-7">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="font-display text-h3 font-extrabold text-navy-900">{s.heading}</h2>
              <p className="mt-2.5 text-base leading-relaxed text-navy-700">{s.body}</p>
              {s.action && <div className="mt-3">{s.action}</div>}
            </section>
          ))}
        </div>

        {lastUpdated && (
          <p className="mt-10 border-t border-mist-200 pt-5 text-xs text-navy-400" lang={locale}>
            {lastUpdated}
          </p>
        )}
      </div>
    </div>
  );
}
