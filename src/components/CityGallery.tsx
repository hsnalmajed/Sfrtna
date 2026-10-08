import Link from "next/link";
import Photo from "@/components/Photo";

export interface CityCard {
  slug: string;
  /** Already resolved to the reader's language by the page. */
  name: string;
  photo?: string;
  /** Optional line under the name — a place count, say. */
  subtitle?: string;
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
          className="group relative block aspect-[4/3] overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg app:flex app:aspect-auto app:flex-col app:bg-white app:ring-navy-900/5 app:hover:translate-y-0 app:active:scale-[0.98]"
        >
          {/* In the app: picture on top of a white card, the name under it. */}
          <div className="absolute inset-0 app:relative app:h-24">
            <Photo
              placeholder
              src={c.photo}
              className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
              fallback={
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-800 to-brand-950 text-4xl app:from-sea-50 app:to-mist-100">
                  🏙️
                </div>
              }
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent app:hidden" />
          </div>
          <div className="absolute bottom-2.5 start-3 end-3 app:static app:p-3">
            <p className="truncate text-sm sm:text-base font-bold text-white drop-shadow-sm app:font-display app:text-base app:font-extrabold app:text-navy-900 app:drop-shadow-none">{c.name}</p>
            {c.subtitle && <p className="text-[11px] text-white/75 app:mt-0.5 app:text-xs app:text-[#5d6b80]">{c.subtitle}</p>}
          </div>
        </Link>
      ))}
    </div>
  );
}
