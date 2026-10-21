import type { Metadata } from "next";
import type { Locale } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";

/**
 * One page, one title.
 *
 * Every page on the site carried the same title and the same description —
 * "Sfrtna — لكل سفرة حكاية" — which means a search engine has nothing to
 * tell one from another, and a link shared on WhatsApp says nothing about
 * what is behind it. For a site whose whole growth path is someone sending
 * a friend a destination, that is the difference between a link that gets
 * opened and one that doesn't.
 *
 * `hreflang` and `canonical` are built here too, because they are the same
 * three lines on every page and getting them slightly different on each is
 * how a site ends up competing with itself.
 */

/**
 * Where the site actually lives.
 *
 * sfrtna.com is the real home, and every canonical, sitemap entry and piece
 * of structured data points at it. The Worker keeps its old internal name
 * (sfratna) because renaming it would break the deploy; that address still
 * answers, and Cloudflare serves the same Worker on the domain.
 *
 * NEXT_PUBLIC_SITE_URL can still override it — useful on a preview build —
 * but it is read at build time, not at run time, so the default here is what
 * production actually uses.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://sfrtna.com").replace(
  /\/$/,
  ""
);

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The one address a page is known by: locale + locale-less path, no query. */
export function canonicalUrl(locale: Locale, path: string): string {
  const clean = path === "/" ? "" : path;
  return absoluteUrl(`/${locale}${clean}`);
}

/**
 * canonical + hreflang for a page, on its own — for a page that keeps the
 * layout's title (the homepage) but still has to say which address is the
 * real one.
 *
 * Search Console, 22 Oct 2026: 337 pages "Duplicate without user-selected
 * canonical" — the homepage (also opened as /ar?from=…&to=… by "edit
 * search"), every country's visa page and every country's map page carried
 * no canonical at all, so Google had to guess which of many near-identical
 * addresses was the page.
 */
export function pageAlternates(locale: Locale, path: string): NonNullable<Metadata["alternates"]> {
  return {
    canonical: canonicalUrl(locale, path),
    languages: {
      ar: canonicalUrl("ar", path),
      en: canonicalUrl("en", path),
      "x-default": canonicalUrl("ar", path),
    },
  };
}

/**
 * Metadata for one page.
 *
 * `path` is the locale-less route ("/visa", "/attractions/TR"), so the two
 * language versions can point at each other without either being told where
 * the other is.
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  image,
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  /** An absolute image URL for link previews. */
  image?: string;
}): Metadata {
  const dict = getDictionary(locale);
  const url = canonicalUrl(locale, path);
  // The site name goes last so the distinctive part survives truncation in
  // a search result or a browser tab.
  const fullTitle = `${title} | ${dict.siteName}`;

  return {
    title: fullTitle,
    description,
    alternates: pageAlternates(locale, path),
    openGraph: {
      type: "website",
      siteName: dict.siteName,
      locale: locale === "ar" ? "ar_SA" : "en_US",
      title: fullTitle,
      description,
      url,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: fullTitle,
      description,
      images: image ? [image] : undefined,
    },
  };
}

/**
 * Structured data for a destination page.
 *
 * Returned as a string to drop into a JSON-LD script tag. Only fields we
 * actually know are included — an empty `image` or a made-up `geo` would be
 * worse than omitting them, and Google treats invented structured data as a
 * reason to distrust the rest.
 */
export function touristDestinationJsonLd({
  name,
  description,
  url,
  image,
  country,
}: {
  name: string;
  description?: string;
  url: string;
  image?: string;
  country?: string;
}): string {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name,
    url,
  };
  if (description) data.description = description;
  if (image) data.image = image;
  if (country) {
    data.containedInPlace = { "@type": "Country", name: country };
  }
  return JSON.stringify(data);
}


/**
 * Who the site is, for search engines — the homepage's WebSite and
 * Organization records.
 *
 * Google shows one name per site and takes it, above all else, from WebSite
 * structured data on the homepage: https://developers.google.com/search/docs/appearance/site-names
 * Without it Google guesses from the title, and a guess is how a brand ends
 * up listed under a slogan.
 *
 * The name is declared in the page's own language, because Google asks that
 * it match how the homepage refers to itself — and the domain root redirects
 * to the Arabic homepage, so سفرتنا is the name it will display. Every other
 * spelling a person might type goes in `alternateName`: the Latin name on
 * the logo, the old spelling the site launched under (links to it are
 * already out there), and the vowelled transliteration people reach for
 * when they spell it out by ear.
 */
export function brandJsonLd(locale: Locale): object[] {
  const dict = getDictionary(locale);
  const primary = locale === "ar" ? dict.siteNameAr : dict.siteNameEn;
  const others = [
    locale === "ar" ? dict.siteNameEn : dict.siteNameAr,
    "Sfratna",
    "Safratna",
  ];
  const home = `${SITE_URL}/`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: primary,
      alternateName: others,
      url: home,
      inLanguage: ["ar", "en"],
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: primary,
      alternateName: others,
      url: home,
      logo: absoluteUrl("/sfrtna-mark.png"),
    },
  ];
}
