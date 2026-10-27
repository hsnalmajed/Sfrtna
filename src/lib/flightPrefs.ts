/**
 * Departure time slots (owner, 27 Oct): the same four the results filter
 * uses (FlightResultsGuide: hour / 6) — night 0–6, morning 6–12,
 * afternoon 12–18, evening 18–24 — so a choice in the form opens the results
 * already filtered.
 */
export const DEP_SLOTS = ["1", "2", "3", "0"] as const;
export type DepSlot = (typeof DEP_SLOTS)[number];
