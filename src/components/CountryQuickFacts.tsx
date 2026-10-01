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

// Static class names, so Tailwind sees them: how many columns the facts take
// on a wider screen. On a phone every fact is its own row.
const COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/**
 * One panel rather than a row of loose cards: the facts sit side by side,
 * separated by hairlines, each one an icon beside its label and value — so
 * the panel is as tall as its content and no card is left half empty.
 */
export default function CountryQuickFacts({
  locale,
  facts,
  heading,
  lead,
}: {
  locale: Locale;
  facts: QuickFact[];
  heading: string;
  /** A full-width first row (the visa on a country page). */
  lead?: React.ReactNode;
}) {
  if (facts.length === 0 && !lead) return null;
  const arrow = locale === "ar" ? "←" : "→";

  return (
    <section className="mb-8">
      <p className="eyebrow mb-3">{heading}</p>
      <div className="card overflow-hidden">
        {lead}
        {facts.length > 0 && (
          <div
            className={`grid grid-cols-1 gap-px bg-mist-200 ${COLS[Math.min(facts.length, 4)]} ${lead ? "border-t border-mist-200" : ""}`}
          >
            {facts.map((f) => {
              const body = (
                <>
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sea-50 text-xl ring-1 ring-sea-100"
                    aria-hidden="true"
                  >
                    {f.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-navy-500">{f.label}</span>
                    <span className="mt-0.5 block text-[15px] font-extrabold leading-snug text-navy-900">
                      {f.value}
                      {f.href && (
                        <span className="ms-1.5 text-navy-300 transition group-hover:text-brand-600" aria-hidden="true">
                          {arrow}
                        </span>
                      )}
                    </span>
                  </span>
                </>
              );
              const cell = "flex items-center gap-3.5 bg-white px-5 py-4";

              return f.href ? (
                <Link key={f.label} href={f.href} className={`${cell} group transition hover:bg-mist-50`} lang={locale}>
                  {body}
                </Link>
              ) : (
                <div key={f.label} className={cell}>
                  {body}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
