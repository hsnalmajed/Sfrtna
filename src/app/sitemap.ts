import type { MetadataRoute } from "next";
import { COUNTRY_CITIES } from "@/lib/cities";
import { COUNTRIES } from "@/lib/countries";
import { SITE_URL } from "@/lib/seo";

/**
 * Every page worth indexing, in both languages.
 *
 * Built from the same tables the routes are, so it cannot list a country
 * page that does not exist or miss one that does — a hand-written sitemap
 * drifts within a release.
 *
 * Search and results pages are deliberately absent: they are generated from
 * a visitor's own query and there is no useful version of them to index.
 */
const LOCALES = ["ar", "en"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();

  const staticPaths = [
    { path: "", priority: 1 },
    { path: "/attractions", priority: 0.9 },
    { path: "/maps", priority: 0.8 },
    { path: "/seasons", priority: 0.8 },
    { path: "/visa", priority: 0.9 },
    { path: "/currency", priority: 0.7 },
    { path: "/itinerary", priority: 0.7 },
    { path: "/about", priority: 0.5 },
    { path: "/contact", priority: 0.5 },
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
  ];

  for (const locale of LOCALES) {
    for (const { path, priority } of staticPaths) {
      entries.push({
        url: `${SITE_URL}/${locale}${path}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority,
        alternates: {
          languages: {
            ar: `${SITE_URL}/ar${path}`,
            en: `${SITE_URL}/en${path}`,
          },
        },
      });
    }

    // Only countries that have somewhere to go — a country page with no
    // cities leads nowhere, and indexing it invites a visitor to a dead end.
    for (const country of COUNTRIES) {
      const cities = COUNTRY_CITIES[country.code];
      if (!cities || cities.length === 0) continue;

      entries.push({
        url: `${SITE_URL}/${locale}/attractions/${country.code}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.7,
      });
      entries.push({
        url: `${SITE_URL}/${locale}/visa/${country.code}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      });

      for (const city of cities) {
        entries.push({
          url: `${SITE_URL}/${locale}/attractions/${country.code}/${city.slug}`,
          lastModified: now,
          changeFrequency: "monthly",
          priority: 0.6,
        });
        entries.push({
          url: `${SITE_URL}/${locale}/maps/${country.code}/${city.slug}`,
          lastModified: now,
          changeFrequency: "monthly",
          priority: 0.5,
        });
      }
    }
  }

  return entries;
}
