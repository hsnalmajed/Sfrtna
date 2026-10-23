/**
 * Anonymous counts for the owner's weekly report «لوحة سفرتنا» (owner, 23 Oct).
 * The browser sends a few words about an event — never who, never an address —
 * and the server adds one to each (kind, key) for the day.
 */
export const STAT_KINDS = [
  "visit", // web|app
  "device", // mobile|desktop
  "source", // utm_source, else referrer host, else "direct"
  "lang", // ar|en
  "page", // page type of the visit's first page
  "search", // flight|hotel|discover|multicity|flight_hotel…
  "dest", // destination code or city
  "origin", // origin code
  "hotel", // named hotel
  "hotel_city", // hotel search city
  "partner", // partner clicked
  "partner_page", // where the click happened (results, city page…)
] as const;
export type StatKind = (typeof STAT_KINDS)[number];

/** Keys are short plain words: letters, digits, space, - _ . and Arabic. */
export function cleanStatKey(v: unknown): string {
  if (typeof v !== "string") return "";
  return v
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} ._-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}
