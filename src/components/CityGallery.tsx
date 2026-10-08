import Link from "next/link";
import Photo from "@/components/Photo";
import { VISA_STYLES } from "@/components/VisaBadge";
import type { CityCardFacts } from "@/lib/cityCardFacts";

export interface CityCard {
  slug: string;
  /** Already resolved to the reader's language by the page. */
  name: string;
  photo?: string;
  /** Optional line under the name — a place count, say. */
  subtitle?: string;
  /** This month's rating, season, temperatures and visa (cityCardFacts). */
  facts?: CityCardFacts;
}

// The same card the country list uses, one level down. Cities are picked
// visually far more often than they're read off a list, so a real photo of
// each one does more work here than any amount of text.
//
// A city whose photo didn't resolve keeps its card and shows a plain tile
// rather than a stand-in image of somewhere else.
export default function CityGallery({
  cities,
  hrefBase,
}: {
  cities: CityCard[];
  /** Cities link to `${hrefBase}/${slug}`. */
  hrefBase: string;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {cities.map((c) => (
        <Link
          key={c.slug}
          href={`${hrefBase}/${c.slug}`}
          className="group relative isolate flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]"
        >
          <div className="absolute inset-0 -z-10">
            <Photo
              placeholder
              src={c.photo}
              className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
              fallback={<div className="absolute inset-0 bg-gradient-to-br from-brand-800 to-brand-950" />}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/25" />
          </div>
          {/* Top: this month's rating and the visa — what decides a trip. */}
          <div className="flex min-w-0 flex-col items-start gap-1 p-2">
            {c.facts?.classLabel && (
              <span className="max-w-full truncate rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-extrabold text-navy-900 shadow-sm">
                {c.facts.classLabel}
              </span>
            )}
            {c.facts && (
              <span
                className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-0.5 text-xs font-bold shadow-sm ring-1 ${
                  c.facts.visa ? VISA_STYLES[c.facts.visa.category].chip : "bg-white/85 text-navy-800 ring-white/40"
                }`}
              >
                <span aria-hidden="true">{c.facts.visa ? VISA_STYLES[c.facts.visa.category].icon : "🛂"}</span>
                <span className="truncate">{c.facts.visa ? c.facts.visa.short : c.facts.visaUnknown}</span>
              </span>
            )}
          </div>
          <div className="min-w-0 p-3 pt-2">
            <p className="truncate font-display text-base font-extrabold text-white drop-shadow-sm">{c.name}</p>
            {c.subtitle && <p className="truncate text-xs text-white/75">{c.subtitle}</p>}
            {(c.facts?.season || c.facts?.temps) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {c.facts.season && (
                  <span className="inline-flex max-w-full truncate rounded-full bg-navy-990/65 px-2 py-0.5 text-xs font-bold text-sun-200 backdrop-blur-sm">
                    {c.facts.season}
                  </span>
                )}
                {c.facts.temps && (
                  <span className="inline-flex rounded-full bg-navy-990/65 px-2 py-0.5 text-xs font-bold text-sun-300 backdrop-blur-sm" dir="ltr">
                    🌡 {c.facts.temps}
                  </span>
                )}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
