import type { Locale } from "@/lib/types";
import type { IconName } from "@/components/ui/Icon";

/**
 * Our travel tools, in one order everywhere: the app's «المزيد» sheet and the
 * home page strip (owner, 21 Nov 2026: «same as المزيد», one neat row, so a
 * traveller reaches them fast and notices them).
 */
export function quickTools(
  locale: Locale,
  d: {
    nav: { itinerary: string; visa: string; currency: string; services: string; budget: string; toolsShort: { itinerary: string; budget: string; visa: string; services: string; currency: string } };
    visited: { title: string };
  },
) {
  // Order (owner left it to us, 21 Nov): the traveller's path and what sets
  // us apart first — plan, budget, visa, trip services; then currency, and
  // «خريطتي» last (a keepsake after the trip). On phones the first four show.
  const short = d.nav.toolsShort;
  const tools: { href: string; label: string; short: string; icon: string; glyph: IconName }[] = [
    { href: `/${locale}/itinerary`, label: d.nav.itinerary, short: short.itinerary, icon: "🗺️", glyph: "map" },
    { href: `/${locale}/budget`, label: d.nav.budget, short: short.budget, icon: "💰", glyph: "wallet" },
    { href: `/${locale}/visa`, label: d.nav.visa, short: short.visa, icon: "🛂", glyph: "idCard" },
    { href: `/${locale}/services`, label: d.nav.services, short: short.services, icon: "🧳", glyph: "luggage" },
    { href: `/${locale}/currency`, label: d.nav.currency, short: short.currency, icon: "💱", glyph: "coins" },
    { href: `/${locale}/my-map`, label: d.visited.title, short: d.visited.title, icon: "🌍", glyph: "globe" },
  ];
  return tools;
}
