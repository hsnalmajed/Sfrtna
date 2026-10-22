/**
 * «شاركنا رأيك» — the parts both the page and the server use (no server
 * code here: this file travels to the browser). See src/lib/feedback.ts.
 */
export const FEEDBACK_KINDS = ["problem", "wrong", "idea", "opinion", "question"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_AREAS = [
  "flights", "hotels", "discover", "plan", "destinations", "visa",
  "seasons", "budget", "services", "account", "app", "other",
] as const;
export type FeedbackArea = (typeof FEEDBACK_AREAS)[number];

export const FEEDBACK_TEXT_MIN = 10;
export const FEEDBACK_TEXT_MAX = 3000;
/** Base64 length of the (already shrunk) screenshot: ~1.1 MB of image. */
export const FEEDBACK_SHOT_MAX = 1_500_000;

/** Which section a page belongs to — the form opens with it chosen. */
export function areaForPath(pathname: string, inApp: boolean): FeedbackArea {
  const p = pathname.replace(/^\/(ar|en)(?=\/|$)/, "");
  if (p.startsWith("/results") || p.startsWith("/multicity-results")) return "flights";
  if (p.startsWith("/hotel-results")) return "hotels";
  if (p.startsWith("/discover-results")) return "discover";
  if (p.startsWith("/itinerary")) return "plan";
  if (p.startsWith("/attractions") || p.startsWith("/maps")) return "destinations";
  if (p.startsWith("/visa")) return "visa";
  if (p.startsWith("/seasons")) return "seasons";
  if (p.startsWith("/budget")) return "budget";
  if (p.startsWith("/services")) return "services";
  if (p.startsWith("/account")) return "account";
  return inApp ? "app" : "other";
}

