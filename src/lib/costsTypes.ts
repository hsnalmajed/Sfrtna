// What a day in a city costs, by trip level, in US dollars — written by
// scripts/guide/costs.ts into public/data/costs.json. Estimates: the site
// always labels them «تقدير» and never shows them as a price.

export type Pair = [number, number];
/** [budget, mid-range, luxury] — or, for hotels, [3-star, 4-star, 5-star]. */
export type Levels = [Pair, Pair, Pair];

export interface CityCosts {
  at: string;
  /** Per adult per day. */
  food: Levels;
  transport: Levels;
  activities: Levels;
  /** Per night, double room. */
  hotel: Levels;
  /** Airport ↔ centre by taxi, one way, per car. */
  transfer: Pair;
  /** A week's tourist SIM/eSIM. */
  sim: Pair;
  tipsAr: string[];
  tipsEn: string[];
}
