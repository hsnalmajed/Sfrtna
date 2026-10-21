import type { Dictionary } from "@/lib/dictionaries";

/**
 * The dictionary sections client components read. Only these travel to the
 * browser (in the page's data, one language). Legal texts, guides and other
 * server-only words stay on the server.
 *
 * useDictionary() is typed with exactly this shape, so a client component
 * that reads a section (or a picked key) missing here fails `tsc` — add it.
 */
export const CLIENT_SECTIONS = [
  "account", "member", "smart", "appInstall", "appWelcome", "recent", "share", "back", "categories", "combo", "consent", "currency", "discoverForm", "discoverResults",
  "filters", "footer", "form", "hotelForm", "hotelPrefs", "hotelResults", "itinerary", "modeSelect", "multicity",
  "nav", "nextSteps", "notFound", "plan", "productSelect", "results", "siteName", "siteNameAr",
  "siteNameEn", "stayType", "travelSeasons", "travelers", "tripPlan", "visa",
] as const satisfies readonly (keyof Dictionary)[];

/**
 * Big sections the browser needs only a few keys of (legal = whole policy
 * texts, of which the app menu shows four titles).
 */
export const CLIENT_KEYS = {
  legal: ["aboutTitle", "contactTitle", "privacyTitle", "termsTitle"],
  home: ["cardVisaUnknown", "seasonRainFew", "seasonRainMany", "seasonRainNone", "seasonRainOne", "seasonRainTwo", "summaryClose"],
  attractions: [
    "continents", "servicesTitle", "servicesSub", "serviceActivity", "serviceEsim", "serviceTransfer",
    "serviceCar", "serviceLuggage", "serviceCompensation",
  ],
} as const satisfies { [S in keyof Dictionary]?: readonly (keyof Dictionary[S])[] };

type Keys = typeof CLIENT_KEYS;
export type ClientDictionary = Pick<Dictionary, (typeof CLIENT_SECTIONS)[number]> & {
  [S in keyof Keys]: Pick<Dictionary[S], Extract<Keys[S][number], keyof Dictionary[S]>>;
};

export function clientDictionary(dict: Dictionary): ClientDictionary {
  const out: Record<string, unknown> = {};
  for (const k of CLIENT_SECTIONS) out[k] = dict[k];
  for (const [section, keys] of Object.entries(CLIENT_KEYS)) {
    const full = dict[section as keyof Keys] as Record<string, unknown>;
    out[section] = Object.fromEntries(keys.map((k) => [k, full[k]]));
  }
  return out as ClientDictionary;
}
