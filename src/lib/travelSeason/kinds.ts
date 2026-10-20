// What kind of season a month is, for the "type of season" filter and
// preference (owner, 21 Oct: winter, autumn, snow, spring…, several at once).
// Read from the season name the traveller sees on the card (text.ts →
// seasonName), so a filter never disagrees with the card it filters.

export const SEASON_KINDS = ["winter", "spring", "summer", "autumn", "snow", "dry", "rainy", "allyear"] as const;
export type SeasonKind = (typeof SEASON_KINDS)[number];

export const SEASON_KIND_ICON: Record<SeasonKind, string> = {
  winter: "🧥",
  spring: "🌸",
  summer: "☀️",
  autumn: "🍂",
  snow: "❄️",
  dry: "🌤️",
  rainy: "🌧️",
  allyear: "🌴",
};

/** The kinds a month's season name stands for (English name, as stored). */
export function seasonKindsOf(nameEn: string | null | undefined): SeasonKind[] {
  if (!nameEn) return [];
  const n = nameEn.toLowerCase();
  const out = new Set<SeasonKind>();
  if (/winter/.test(n)) out.add("winter");
  if (/spring/.test(n)) out.add("spring");
  if (/summer/.test(n)) out.add("summer");
  if (/autumn/.test(n)) out.add("autumn");
  if (/snow/.test(n)) out.add("snow");
  // "Rainy …", "peak rains", "Rainy season" — not "end/start of the rainy season".
  if (/^rainy|peak rains|^rainy season/.test(n)) out.add("rainy");
  if (/dry season/.test(n) && !/end of the dry/.test(n)) out.add("dry");
  if (/all year/.test(n)) out.add("allyear");
  return [...out];
}
