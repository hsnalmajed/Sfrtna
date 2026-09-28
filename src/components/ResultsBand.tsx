import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The navy band every results page opens with — the same one as the flight
 * results: what was asked (eyebrow and title), the trip in a line of facts,
 * and the way back to change it.
 *
 * Pages that opened with dark text on white looked like the unfinished ones
 * of the site, and put the fixed header over white where its links read
 * poorly; this gives every search the same first screen.
 */
export default function ResultsBand({
  locale,
  eyebrow,
  title,
  facts,
  backHref,
  backLabel,
}: {
  locale: "ar" | "en";
  eyebrow?: string;
  title: ReactNode;
  /** Short facts about the search, shown in one line separated by dots. */
  facts: ReactNode[];
  backHref: string;
  backLabel: string;
}) {
  const shown = facts.filter(Boolean);
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-navy-900 to-navy-990 pb-9 pt-24 sm:pt-28">
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(90%_60%_at_85%_0%,rgb(255_166_48/0.14),transparent_70%)]"
        aria-hidden="true"
      />
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-5 px-4 sm:px-6">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow eyebrow-light mb-2.5">{eyebrow}</p>}
          <h1 className="font-display text-h1 font-extrabold text-white">{title}</h1>
          {shown.length > 0 && (
            <p className="mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm font-semibold text-white/80">
              {shown.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-2.5">
                  {i > 0 && (
                    <span className="text-white/30" aria-hidden="true">
                      ·
                    </span>
                  )}
                  {f}
                </span>
              ))}
            </p>
          )}
        </div>
        <Link
          href={backHref}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400"
        >
          <span aria-hidden="true">{locale === "ar" ? "→" : "←"}</span>
          {backLabel}
        </Link>
      </div>
    </section>
  );
}
