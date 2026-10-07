"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import { COUNTRY_CITIES } from "@/lib/cities";
import { findCountry, flagEmoji } from "@/lib/countries";
import { searchMatches } from "@/lib/search";

/**
 * A wrong link should still be a Sfrtna page.
 *
 * `/ar/attractions/XX` used to land on Next's own black screen with "404 This
 * page could not be found" in English — no header, no way back, and in the
 * wrong language for someone who had been reading Arabic a second earlier.
 * For a commercial site that reads as the site being broken rather than the
 * link being wrong.
 *
 * So this is a real page: the site's header and footer come from the locale
 * layout above it, and the body does the one useful thing a 404 can do, which
 * is help someone find what they were looking for. A search box over the
 * destinations we actually cover, six of the most wanted, and a way home.
 *
 * It is a client component because Next renders not-found without route
 * params. The locale is read off the path instead, which works for every
 * route under /[locale] including the ones that call notFound() themselves.
 */

/** Countries worth offering first when someone is lost. */
const POPULAR = ["TR", "GE", "AE", "EG", "MY", "GB"];

export default function LocaleNotFound() {
  const pathname = usePathname();
  const router = useRouter();
  const locale: Locale = pathname?.startsWith("/en") ? "en" : "ar";
  const dict = getDictionary(locale);
  const isAr = locale === "ar";
  const [query, setQuery] = useState("");

  // Only countries we can actually open — a 404 that leads to another 404
  // would be worse than the one it replaced.
  const destinations = useMemo(
    () =>
      Object.keys(COUNTRY_CITIES)
        .map((code) => findCountry(code))
        .filter((c): c is NonNullable<typeof c> => Boolean(c)),
    []
  );

  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return destinations
      .filter((c) =>
        searchMatches([c.nameAr, c.nameEn, ...(COUNTRY_CITIES[c.code] ?? []).flatMap((city) => [city.nameAr, city.nameEn])], q)
      )
      .slice(0, 6);
  }, [destinations, query]);

  const popular = POPULAR.map((code) => findCountry(code)).filter(
    (c): c is NonNullable<typeof c> => Boolean(c)
  );

  return (
    <div className="bg-mist-50">
      <section className="relative isolate overflow-hidden bg-gradient-to-b from-navy-900 to-navy-990 hero-pad pb-12 pt-28 sm:pt-32">
        <div
          className="absolute inset-0 -z-10 bg-[radial-gradient(90%_70%_at_75%_0%,rgb(255_166_48/0.16),transparent_70%)]"
          aria-hidden="true"
        />
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="eyebrow eyebrow-light mb-3">{dict.notFound.eyebrow}</p>
          <h1 className="font-display text-h1 font-extrabold text-white">{dict.notFound.title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-lead text-white/75">{dict.notFound.body}</p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6">
        <div className="card p-5 sm:p-7">
          <label
            htmlFor="notfound-search"
            className="mb-2 block text-sm font-bold text-navy-800"
          >
            {dict.notFound.searchLabel}
          </label>
          <input
            id="notfound-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={dict.notFound.searchPlaceholder}
            className="w-full rounded-xl border border-mist-300 bg-white px-4 py-3 text-sm text-navy-900 outline-none transition focus:border-sun-400 focus:ring-2 focus:ring-sun-400/30"
          />

          {query.trim() && (
            <ul className="mt-3 space-y-1.5">
              {matches.length === 0 ? (
                <li className="rounded-xl bg-mist-50 px-4 py-3 text-sm text-navy-500">
                  {dict.filters.noResults}
                </li>
              ) : (
                matches.map((c) => (
                  <li key={c.code}>
                    <Link
                      href={`/${locale}/attractions/${c.code}`}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-navy-800 transition hover:bg-mist-100"
                    >
                      <span aria-hidden="true">{flagEmoji(c.code)}</span>
                      {isAr ? c.nameAr : c.nameEn}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <p className="eyebrow mb-3 mt-9">{dict.notFound.popular}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {popular.map((c) => (
            <Link
              key={c.code}
              href={`/${locale}/attractions/${c.code}`}
              className="card card-hover flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-navy-800"
            >
              <span className="text-lg" aria-hidden="true">
                {flagEmoji(c.code)}
              </span>
              {isAr ? c.nameAr : c.nameEn}
            </Link>
          ))}
        </div>

        <div className="mt-9 flex justify-center">
          <button
            type="button"
            onClick={() => router.push(`/${locale}`)}
            className="inline-flex items-center gap-2 rounded-xl bg-sun-400 px-6 py-3.5 text-sm font-bold text-navy-950 shadow-[var(--shadow-sun)] transition hover:-translate-y-0.5 hover:bg-sun-300"
          >
            {dict.notFound.home}
            <span aria-hidden="true">{isAr ? "←" : "→"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
