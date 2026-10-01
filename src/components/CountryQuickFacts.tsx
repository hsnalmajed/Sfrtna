import Link from "next/link";
import type { Locale } from "@/lib/types";

/**
 * What a traveller needs in the first screen of a country page.
 *
 * Every fact here is one the site already holds: the best months from the
 * country's own guide, the currency from the converter's list, and the flight
 * time from the origin airports we cover. Nothing is invented, and a fact we
 * do not have is left out rather than filled with a plausible guess — a wrong
 * flight time is worse than no flight time.
 */
export interface QuickFact {
  icon: string;
  label: string;
  value: string;
  /** Turns the value into a link — the currency converter, say. */
  href?: string;
}

export default function CountryQuickFacts({
  locale,
  facts,
  heading,
  lead,
}: {
  locale: Locale;
  facts: QuickFact[];
  heading: string;
  /** A wider first card (the visa card on a country page). */
  lead?: React.ReactNode;
}) {
  if (facts.length === 0 && !lead) return null;

  return (
    <section className="mb-8">
      <p className="eyebrow mb-3">{heading}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {lead}
        {facts.map((f) => {
          const tone = "bg-white text-navy-900";
          const body = (
            <>
              <span className="text-lg leading-none" aria-hidden="true">
                {f.icon}
              </span>
              <span className="mt-2 block text-2xs font-bold uppercase tracking-wide text-navy-400">
                {f.label}
              </span>
              <span className="mt-1 block text-sm font-extrabold leading-snug">{f.value}</span>
            </>
          );

          return f.href ? (
            <Link
              key={f.label}
              href={f.href}
              className={`card card-hover block px-4 py-3.5 ${tone}`}
              lang={locale}
            >
              {body}
            </Link>
          ) : (
            <div key={f.label} className={`card px-4 py-3.5 ${tone}`}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
