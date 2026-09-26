/**
 * "Open the booking tab", from anywhere on the homepage.
 *
 * The flight and hotel search lives in the showcase's "book your trip" tab.
 * The header's button, already on the homepage, cannot rely on a #plan link
 * alone — the hash may already be #plan, and a hash does not switch a tab —
 * so it announces the request and the showcase, which listens, switches to
 * the tab (and to flights or hotels, when one is named) and scrolls to it.
 */

export type PlanProduct = "flights" | "hotels";

export const PLAN_EVENT = "sfrtna:open-planner";

export function openPlanner(product?: PlanProduct) {
  window.dispatchEvent(new CustomEvent<PlanProduct | undefined>(PLAN_EVENT, { detail: product }));
}

/** Which search a homepage URL asks for: `product=`, or the edit-search params. */
export function planFromParams(get: (key: string) => string | null | undefined): PlanProduct | null {
  const p = get("product");
  if (p === "flights" || p === "hotels") return p;
  if (get("hmode")) return "hotels";
  if (get("mode")) return "flights";
  return null;
}
