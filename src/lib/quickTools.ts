import type { Locale } from "@/lib/types";

/**
 * Our travel tools, in one order everywhere: the app's «المزيد» sheet and the
 * home page strip (owner, 21 Nov 2026: «same as المزيد», one neat row, so a
 * traveller reaches them fast and notices them).
 */
export function quickTools(
  locale: Locale,
  d: { nav: { itinerary: string; visa: string; currency: string; services: string; budget: string }; visited: { title: string } },
) {
  // Order (owner left it to us, 21 Nov): the traveller's path and what sets
  // us apart first — plan, budget, visa, trip services; then currency, and
  // «خريطتي» last (a keepsake after the trip). On phones the first four show.
  return [
    { href: `/${locale}/itinerary`, label: d.nav.itinerary, icon: "🗺️" },
    { href: `/${locale}/budget`, label: d.nav.budget, icon: "💰" },
    { href: `/${locale}/visa`, label: d.nav.visa, icon: "🛂" },
    { href: `/${locale}/services`, label: d.nav.services, icon: "🧳" },
    { href: `/${locale}/currency`, label: d.nav.currency, icon: "💱" },
    { href: `/${locale}/my-map`, label: d.visited.title, icon: "🌍" },
  ];
}
