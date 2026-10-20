// The season-record fields the site reads. scripts/climate/generate_seasons.mts
// writes src/data/climate/travelSeasons.site.json with only these, and
// site.ts imports that file instead of the full one: the full records (scores,
// sources, station details — ~6 MB for 211 cities) are bundled into the
// Worker and parsed at start-up, which put every /api route over Cloudflare's
// limit on 14 Oct 2026 (error 1102). Reading a field not listed here fails
// `tsc` — add it here and regenerate.
export const SITE_FIELDS = [
  "month",
  "classification",
  "finalScore",
  "season",
  "climatePattern",
  "seasonNameAr",
  "seasonNameEn",
  "seasonIcon",
  "favorablePhase",
  "averageHighC",
  "averageLowC",
  "precipitationDays",
  "weatherSummaryAr",
  "weatherSummaryEn",
  "confidenceLevel",
  "tourismSignal",
  "highlightAr",
  "highlightEn",
  "highlightIcon",
] as const;

export type SiteField = (typeof SITE_FIELDS)[number];
