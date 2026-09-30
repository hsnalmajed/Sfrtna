import type { Classification, DestinationType } from "./config.ts";

/** One month of climate normals for one destination. null = not available. */
export interface MonthClimate {
  /** Mean of daily maxima (max of hourly 2 m temperature per local day), °C. */
  highC: number | null;
  /** Mean of daily minima, °C. */
  lowC: number | null;
  /** Mean 2 m temperature, °C. */
  meanC: number | null;
  /** Mean monthly total precipitation, mm. */
  precipMm: number | null;
  /** Mean number of local days with ≥ 1 mm. */
  precipDays: number | null;
  /** Mean 2 m dew point, °C. */
  dewPointC: number | null;
  /** Mean relative humidity from hourly temperature and dew point, %. */
  relativeHumidity: number | null;
  /** Mean 10 m wind speed, m/s. */
  windMs: number | null;
  /** Mean snow cover of the grid cell, %. */
  snowCoverPct: number | null;
}

export interface ClimateProvenance {
  /** "era5-land" or "station". */
  kind: "era5-land" | "station";
  source: string;
  dataset: string;
  datasetUrl: string;
  period: string;
  /** Point actually used (grid cell centre or station). */
  usedLat: number;
  usedLon: number;
  /** Distance from the destination's coordinates to the point used, km. */
  distanceKm: number;
  /** Why this point: "exact", "nearest land cell", "station". */
  gridNote: string;
  stationName?: string | null;
  stationId?: string | null;
  timezone: string;
  retrievedAt: string;
  generatedAt: string;
  pipelineVersion: string;
}

export interface DestinationClimate {
  id: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  /** January first. */
  months: MonthClimate[];
  provenance: ClimateProvenance;
}

export interface TourismSignalInput {
  sourceName: string;
  sourceNameAr: string;
  sourceUrl: string;
  official: boolean;
  /** 1–12. */
  recommendedMonths: number[];
  /** The source speaks of the region or country rather than the city. */
  broad: boolean;
  lastVerified: string;
}

export type Season = "winter" | "spring" | "summer" | "autumn";
export type ClimatePattern = "rainy_season" | "dry_season" | "snow_season" | null;
export type FavorablePhase = "start" | "peak" | "end" | null;
export type ConfidenceLevel = "high" | "medium" | "low";

export interface CapHit {
  id: string;
  cap: number;
}

/** The single record for one destination × month. */
export interface SeasonRecord {
  destinationId: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  month: number;

  hemisphere: "north" | "south";
  season: Season;
  climatePattern: ClimatePattern;

  averageHighC: number | null;
  averageLowC: number | null;
  meanTemperatureC: number | null;
  precipitationMm: number | null;
  precipitationDays: number | null;
  relativeHumidity: number | null;
  dewPointC: number | null;
  windSpeedMs: number | null;
  snowCoverPct: number | null;

  destinationTypes: DestinationType[];
  /** The profile that gave the best score. */
  scoredAs: DestinationType | null;

  thermalScore: number | null;
  precipitationScore: number | null;
  humidityScore: number | null;
  otherClimateScore: number | null;
  /** Before caps. */
  rawClimateScore: number | null;
  climateScore: number | null;
  caps: CapHit[];
  relativeRank: number | null;
  relativeBonus: number;

  tourismSignal: "listed" | "unlisted" | "unavailable";
  tourismAdjustment: number;
  tourismSourceName: string | null;
  tourismSourceNameAr: string | null;
  tourismSourceUrl: string | null;
  tourismOfficial: boolean | null;
  tourismBroad: boolean | null;
  tourismLastVerified: string | null;

  finalScore: number | null;
  classification: Classification | null;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  favorablePhase: FavorablePhase;

  weatherSummaryAr: string | null;
  weatherSummaryEn: string | null;
  reasonAr: string | null;
  reasonEn: string | null;

  climateSource: string;
  climateDataset: string;
  climateDatasetUrl: string;
  climatePeriod: string;
  climateGridInfo: string;
  climateStation: string | null;
  climateDistanceKm: number;
  climateRetrievedAt: string;

  scoringVersion: string;
  generatedAt: string;
}
