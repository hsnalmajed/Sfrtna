/**
 * Tours, tickets and activities at partner sites — the hand-over for things
 * to do, as affiliateLinks.ts is for hotels.
 *
 * We do not have these partners' catalogues or prices (GetYourGuide gives
 * this account links only; Klook and Tiqets come through Travelpayouts), so
 * the site links to each partner's own search for the city or the landmark
 * and shows no price — the partner's page shows the live one.
 *
 * Every link goes through our own redirect (/api/go/gyg, /api/go/tp), not
 * straight to the partner: Stay22's LinkSwap rewrites partner links it
 * recognises on the page, and the redirect is also where the Travelpayouts
 * link is made (its API needs our server token). The visitor's browser only
 * ever sees a link to sfrtna.com, which also keeps the partner tags off the
 * page.
 */

export type ActivityPartner = "getyourguide" | "tiqets" | "klook";

export interface ActivityLink {
  partner: ActivityPartner;
  /** Shown on the button. */
  name: string;
  href: string;
}

/** GetYourGuide's public partner tag (rides in the link, not a secret). */
export const GYG_PARTNER_ID = "NNJW64J";

/** The partner's own search for `q` — the page our redirect lands on. */
export function partnerSearchUrl(partner: ActivityPartner, q: string): string {
  const query = q.trim().replace(/\s+/g, " ").slice(0, 120);
  switch (partner) {
    case "getyourguide": {
      // No language in the path: GetYourGuide picks the visitor's own (it has
      // Arabic), checked 10 Oct 2026.
      const u = new URL("https://www.getyourguide.com/s/");
      u.searchParams.set("q", query);
      u.searchParams.set("partner_id", GYG_PARTNER_ID);
      u.searchParams.set("utm_medium", "online_publisher");
      return u.toString();
    }
    case "tiqets": {
      // Tiqets' search jumps straight to the landmark's page when it knows it
      // ("Hagia Sophia" → its ticket page), checked 10 Oct 2026.
      const u = new URL("https://www.tiqets.com/en/search");
      u.searchParams.set("q", query);
      return u.toString();
    }
    case "klook": {
      const u = new URL("https://www.klook.com/en-US/search/result/");
      u.searchParams.set("query", query);
      return u.toString();
    }
  }
}

const NAMES: Record<ActivityPartner, string> = {
  getyourguide: "GetYourGuide",
  tiqets: "Tiqets",
  klook: "Klook",
};

/** The way out to each partner's search for `q`, through our redirects. */
export function activityLinks(q: string, partners: ActivityPartner[] = ["getyourguide", "tiqets", "klook"]): ActivityLink[] {
  const query = encodeURIComponent(q.trim().replace(/\s+/g, " ").slice(0, 120));
  return partners.map((partner) => ({
    partner,
    name: NAMES[partner],
    href: partner === "getyourguide" ? `/api/go/gyg?q=${query}` : `/api/go/tp?b=${partner}&q=${query}`,
  }));
}

/**
 * Kinds of place a ticket or a tour is usually sold for. A park, a market or
 * a memorial gets no ticket buttons: a search with nothing behind it is a
 * dead end, not a service.
 */
export const TICKETED_KINDS = new Set([
  "museum",
  "gallery",
  "zoo",
  "aquarium",
  "theme_park",
  "water_park",
  "attraction",
  "castle",
  "fort",
  "citadel",
  "palace",
  "archaeological_site",
  "ruins",
]);
