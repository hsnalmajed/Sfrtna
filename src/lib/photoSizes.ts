/**
 * Sharper card photos on sharp phone screens.
 *
 * Card photos are stored as Pexels' 640-wide file. Our city cards are tall
 * (3:4) and the photos wide (about 3:2), so `object-cover` draws a photo
 * about twice as wide as the card: a two-per-row card on a 3× phone needs a
 * file ~1,000 px wide, and the 640 file showed blurry (ux-audit ×1.6–1.9).
 *
 * `cardSrcSet` offers the same photo at 640/960/1280 from Pexels' own
 * resizer (no extra API call — the stored address only changes its `w=`).
 * The `sizes` values below already include that "twice the card" factor,
 * so the browser fetches no more than it needs.
 */

const WIDTHS = [640, 960, 1280];

/** Tall card in a 2 / 3 / 4–6 column grid (city and country cards). */
export const TALL_CARD_GRID = "(min-width: 1024px) 600px, (min-width: 640px) 66vw, 100vw";

/** Tall card in the home strip (fixed ~11 rem wide). */
export const TALL_CARD_STRIP = "384px";

/** srcSet for a stored Pexels card photo; undefined for any other address. */
export function cardSrcSet(src?: string): string | undefined {
  if (!src || !src.includes("images.pexels.com/") || !/[?&]w=\d+/.test(src)) return undefined;
  return WIDTHS.map((w) => `${src.replace(/([?&])w=\d+/, `$1w=${w}`)} ${w}w`).join(", ");
}
