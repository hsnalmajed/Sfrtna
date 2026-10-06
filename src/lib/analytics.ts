/**
 * Google Analytics 4 — one place for every measurement call on the site.
 *
 * The tracking plan this implements (agreed with the owner, Oct 2026):
 *
 *   search           a search form was sent            → which search, where, how many, budget
 *   budget_change    the same search again, new budget → from / to
 *   flight_results   the flight widget finished         → fares shown, how many fit the budget
 *   partner_click ★  a link out to a booking partner    → partner, page, the search it came from
 *   visa_check · language_switch · currency_convert · map_download
 *
 * ★ partner_click is the key event. Every partner_click carries the
 * search_id of the last search in the tab, so "searches that ended in a
 * partner click" can be counted per search as well as per session.
 *
 * Rules:
 *  - Nothing personal is sent: no names, emails or free text a visitor typed
 *    about themselves. Places, dates, party size and budget only.
 *  - Consent Mode v2: analytics cookies stay off until the visitor accepts
 *    (see ConsentBanner). Advertising storage is never granted — the site
 *    runs no ads.
 *  - Only sfrtna.com is measured, so local runs and preview hosts never
 *    pollute the numbers.
 */

/** Public by design: it is printed in every page's HTML. Not a secret. */
export const GA_ID = "G-1438PGGH2W";

export const CONSENT_KEY = "sfrtna-consent-v1";
export type ConsentChoice = "granted" | "denied";

/** Fired on window to reopen the consent banner (footer "cookie settings"). */
export const CONSENT_OPEN_EVENT = "sfrtna:consent-open";

type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function isMeasuredHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "sfrtna.com" || h.endsWith(".sfrtna.com");
}

/** GA4 drops parameter values over 100 characters. */
function clean(params: Params): Params {
  const out: Params = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    out[k] = typeof v === "string" ? v.slice(0, 100) : v;
  }
  return out;
}

export function track(event: string, params: Params = {}): void {
  if (!isMeasuredHost()) return;
  try {
    // gtag may not have loaded yet; the queue is read in order when it does.
    window.dataLayer = window.dataLayer || [];
    // eslint-disable-next-line prefer-rest-params
    const gtag = window.gtag || function () { window.dataLayer!.push(arguments); };
    gtag("event", event, clean(params));
  } catch {
    /* measurement must never break the page */
  }
}

export function readConsent(): ConsentChoice | null {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function saveConsent(choice: ConsentChoice): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    /* private window: the choice holds for this page only */
  }
  window.gtag?.("consent", "update", { analytics_storage: choice });
}

// ── Searches ────────────────────────────────────────────────────────────

const LAST_SEARCH_KEY = "sfrtna-last-search";

interface LastSearch {
  id: string;
  type: string;
  /** The search without its budget, to recognise "same search, new budget". */
  shape: string;
  budget: number;
}

function readLastSearch(): LastSearch | null {
  try {
    const raw = window.sessionStorage.getItem(LAST_SEARCH_KEY);
    return raw ? (JSON.parse(raw) as LastSearch) : null;
  } catch {
    return null;
  }
}

const SEARCH_TYPES: Record<string, string> = {
  results: "flight",
  "discover-results": "discover",
  "multicity-results": "multicity",
  "hotel-results": "hotel",
};

function daysUntil(iso: string | null): number | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const ms = new Date(`${iso}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime();
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : undefined;
}

function count(list: string | null): number {
  if (!list) return 0;
  try {
    const parsed: unknown = JSON.parse(list);
    if (Array.isArray(parsed)) return parsed.length;
  } catch {
    /* comma list */
  }
  return list.split(",").filter(Boolean).length;
}

/**
 * Record a search from the URL a form is about to open. Call it right
 * before router.push — the URL already holds every answer the form took,
 * so each form needs one line and none can describe itself differently.
 */
export function trackSearchUrl(url: string): void {
  if (!isMeasuredHost()) return;
  try {
    const u = new URL(url, window.location.origin);
    const route = u.pathname.split("/").filter(Boolean).pop() || "";
    const type = SEARCH_TYPES[route];
    if (!type) return;
    const q = u.searchParams;

    const budget = Number(q.get("budget")) || 0;
    const depart = q.get("departDate") || q.get("checkIn");
    const back = q.get("returnDate") || q.get("checkOut");
    const nightsParam = Number(q.get("nights"));
    let nights: number | undefined = nightsParam > 0 ? nightsParam : undefined;
    if (depart && back) {
      const d = daysUntil(back)! - daysUntil(depart)!;
      if (Number.isFinite(d) && d > 0) nights = d;
    }

    const params: Params = {
      search_type: type,
      search_mode: q.get("hmode") || q.get("mode") || undefined,
      trip_route: q.get("tripRoute") || undefined,
      origin: q.get("origin") || undefined,
      destination: q.get("destination") || q.get("city") || undefined,
      hotel_name: q.get("hotel") || undefined,
      legs: q.get("legs") ? count(q.get("legs")) : undefined,
      days_to_departure: daysUntil(depart),
      nights,
      adults: Number(q.get("adults")) || undefined,
      children: count(q.get("childrenAges")),
      infants: Number(q.get("infants")) || 0,
      budget: budget || undefined,
      currency: q.get("currency") || undefined,
      direct_only: q.get("directOnly") === "true" ? true : undefined,
      preference: q.get("preferenceCategory") || undefined,
    };

    const shapeParams = new URLSearchParams(q);
    shapeParams.delete("budget");
    shapeParams.sort();
    const shape = `${route}?${shapeParams.toString()}`;

    const last = readLastSearch();
    if (last && last.shape === shape && budget && last.budget !== budget) {
      track("budget_change", {
        search_type: type,
        budget_from: last.budget,
        budget_to: budget,
        currency: params.currency,
      });
    }

    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    track("search", { ...params, search_id: id });
    try {
      window.sessionStorage.setItem(LAST_SEARCH_KEY, JSON.stringify({ id, type, shape, budget }));
    } catch {
      /* fine: clicks just won't carry a search_id */
    }
  } catch {
    /* never block the search itself */
  }
}

/** The search a partner click most likely came from: the last one in this tab. */
export function lastSearchContext(): Params {
  const last = readLastSearch();
  return last ? { search_id: last.id, search_type: last.type } : {};
}

/** "/ar/hotel-results" → "hotel-results"; "/en/visa/ge" → "visa". */
export function pageType(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  return parts[1] || "home";
}
