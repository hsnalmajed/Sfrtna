// Sfrtna travel-season scoring model — every weight, threshold, penalty and
// bonus the engine uses, and nowhere else.
//
// Changing any number here changes results, so it must come with a new
// `version`. Stored records carry the version they were scored with
// (src/data/climate/travelSeasons.json), and a test fails when the stored
// file no longer matches what this version produces.
//
// Units: °C, mm, days, m/s, %. Scores are 0–100.

export type DestinationType =
  | "city"
  | "beach"
  | "nature"
  | "mountain"
  | "ski"
  | "desert"
  | "tropical"
  | "mixed";

/**
 * How a kind of trip judges temperature. A month is scored once per profile
 * the destination carries and the best profile wins — a beach town in July is
 * judged as a beach, not as a city — but the universal caps below apply to
 * every profile, so no tag can turn 42 °C into a good month.
 */
export interface ThermalProfile {
  /** Average daily high inside this band scores 100. */
  idealHigh: [number, number];
  /** Points lost per °C the high sits below / above the band. */
  perDegreeBelow: number;
  perDegreeAbove: number;
  /** Nights: average daily low inside this band scores 100. */
  idealLow: [number, number];
  perDegreeLowBelow: number;
  perDegreeLowAbove: number;
  /** Dew point (°C) from which humidity starts to cost, and where it reaches 0. */
  dewPointComfort: number;
  dewPointOppressive: number;
}

export const SCORING = {
  version: "1.0",

  profiles: {
    city: {
      idealHigh: [20, 28], perDegreeBelow: 6, perDegreeAbove: 9,
      idealLow: [8, 22], perDegreeLowBelow: 3, perDegreeLowAbove: 5,
      dewPointComfort: 16, dewPointOppressive: 25,
    },
    beach: {
      idealHigh: [25, 32], perDegreeBelow: 7, perDegreeAbove: 8,
      idealLow: [16, 26], perDegreeLowBelow: 4, perDegreeLowAbove: 5,
      dewPointComfort: 18, dewPointOppressive: 26,
    },
    nature: {
      idealHigh: [15, 27], perDegreeBelow: 6, perDegreeAbove: 8,
      idealLow: [5, 20], perDegreeLowBelow: 3, perDegreeLowAbove: 5,
      dewPointComfort: 16, dewPointOppressive: 25,
    },
    mountain: {
      idealHigh: [13, 25], perDegreeBelow: 6, perDegreeAbove: 7,
      idealLow: [3, 18], perDegreeLowBelow: 3, perDegreeLowAbove: 5,
      dewPointComfort: 15, dewPointOppressive: 24,
    },
    desert: {
      idealHigh: [20, 30], perDegreeBelow: 6, perDegreeAbove: 9,
      idealLow: [8, 22], perDegreeLowBelow: 3, perDegreeLowAbove: 5,
      dewPointComfort: 16, dewPointOppressive: 25,
    },
    tropical: {
      idealHigh: [24, 32], perDegreeBelow: 6, perDegreeAbove: 7,
      idealLow: [18, 26], perDegreeLowBelow: 4, perDegreeLowAbove: 5,
      // People travelling to the tropics expect humid air; it costs later.
      dewPointComfort: 20, dewPointOppressive: 27,
    },
    mixed: {
      idealHigh: [20, 29], perDegreeBelow: 6, perDegreeAbove: 9,
      idealLow: [8, 22], perDegreeLowBelow: 3, perDegreeLowAbove: 5,
      dewPointComfort: 16, dewPointOppressive: 25,
    },
  } satisfies Record<Exclude<DestinationType, "ski">, ThermalProfile>,

  /**
   * A destination's first type is its main one. When another of its types
   * suits the month better, the score moves this share of the way towards it.
   */
  secondaryTypeShare: 0.5,

  /** A ski trip is judged on snow, not warmth. */
  ski: {
    idealHigh: [-8, 4] as [number, number],
    perDegreeBelow: 5,
    perDegreeAbove: 12,
    /** Snow cover (% of the grid cell) that scores 100, and 0. */
    snowCoverFull: 80,
    snowCoverNone: 20,
    weights: { snow: 0.5, thermal: 0.3, precipitation: 0.1, wind: 0.1 },
  },

  /** Sub-score weights for every profile except ski. Sum to 1. */
  weights: { high: 0.35, low: 0.1, humidity: 0.2, precipitation: 0.3, wind: 0.05 },

  /** Humidity only counts when it is warm enough to feel muggy; below this it is left out of the month's score. */
  humidityAppliesFromHighC: 20,

  /**
   * A month is only as good as its weakest essential part: a perfect
   * temperature does not make up for rain every other day. The weighted
   * score is multiplied by base + (1 − base) × (lowest of these sub-scores) / 100.
   */
  weakest: { base: 0.6, factors: ["high", "precipitation", "humidity"] as const },

  /**
   * Heat index (NOAA, Rothfusz regression) of the average high at the
   * relative humidity it has at that hour — from the month's mean dew point.
   * Used only by the heat caps below; it is not a forecast of any day.
   */
  heatIndexFromHighC: 27,

  precipitation: {
    /** Days with ≥ 1 mm: 100 up to `daysGood`, 0 from `daysBad`. */
    daysGood: 8,
    daysBad: 20,
    /** Monthly total: 100 up to `mmGood`, 0 from `mmBad`. */
    mmGood: 60,
    mmBad: 450,
    /** Share of the precipitation score taken by rain days (the rest by mm). */
    // ERA5-Land counts more ≥ 1 mm days than rain gauges do (light drizzle in
    // the model), most in the humid tropics and on wet coasts, so the monthly
    // total carries more of the weight than the day count.
    daysShare: 0.35,
  },

  wind: {
    /** Mean 10 m wind speed: 100 up to `good`, 0 from `bad`. */
    good: 5,
    bad: 10,
  },

  /**
   * Absolute limits. Whatever the profile, the tourism signal or the rank
   * within the year, a month cannot score above the cap once a condition is
   * met. Evaluated in order; the lowest applicable cap wins.
   */
  caps: [
    { id: "extremeHeat", when: { highAtLeast: 40 }, cap: 25 },
    { id: "extremeHeatIndex", when: { heatIndexAtLeast: 45 }, cap: 25 },
    { id: "veryHot", when: { highAtLeast: 37 }, cap: 50 },
    // NOAA's "danger" category starts at a heat index of 103 °F (39.4 °C).
    { id: "hotHumid", when: { heatIndexAtLeast: 40 }, cap: 50 },
    { id: "extremeRain", when: { precipMmAtLeast: 450 }, cap: 30 },
    { id: "monsoonRain", when: { precipDaysAtLeast: 22, precipMmAtLeast: 250 }, cap: 50 },
    { id: "heavyRain", when: { precipMmAtLeast: 300 }, cap: 55 },
    // Cold caps do not apply to ski destinations.
    { id: "extremeCold", when: { highAtMost: 0 }, cap: 30, exceptSki: true },
    { id: "veryCold", when: { highAtMost: 5 }, cap: 50, exceptSki: true },
  ],

  relative: {
    /** Bonus for the destination's best months, only if already good. */
    topMonths: 3,
    bonus: 4,
    minClimateScore: 65,
  },

  tourism: {
    /** Month named by the tourism source. */
    listedBonus: 8,
    /** A source exists but does not name this month. */
    unlistedPenalty: 4,
    /** The bonus is not given to a month whose climate score is below this. */
    listedMinClimate: 45,
  },

  classes: [
    // Evaluated top-down; the first match wins.
    // EXCELLENT also needs the month to be within `excellentWithinBest`
    // points of the destination's own best month (see below).
    { id: "EXCELLENT", minFinal: 85, minClimate: 85 },
    { id: "VERY_GOOD", minFinal: 72, minClimate: 70 },
    { id: "GOOD", minFinal: 58, minClimate: 0 },
    { id: "ACCEPTABLE", minFinal: 42, minClimate: 0 },
    { id: "NOT_RECOMMENDED", minFinal: 0, minClimate: 0 },
  ],

  /**
   * "Not recommended climatically" is kept for months where one of the
   * universal limits applies (extreme heat or heat index, monsoon-scale rain,
   * deep cold); an ordinary cool or damp month is at worst ACCEPTABLE.
   */
  notRecommendedNeedsCap: true,

  /**
   * "Best time" is the destination's best stretch, not every good month: its
   * climate score must be within this many points of the best month's. (Climate
   * rather than final score, so a tourism source naming one month does not
   * push an equally good unnamed month out.)
   */
  excellentWithinBest: 8,

  confidence: {
    climateComplete: 35,
    climatePartial: 15,
    /** The destination's own 0.1° cell (its centre can be up to ~8 km away). */
    gridOwnCell: 20,
    /** A neighbouring land cell within this distance… */
    gridNearbyKm: 12,
    gridNearby: 12,
    /** …or further (up to the 25 km search limit). */
    gridFar: 5,
    stationOverride: 20,
    reanalysis: 15,
    tourismOfficial: 25,
    tourismGuide: 18,
    tourismNone: 0,
    /**
     * Town height vs. the height of the cell used (check_cells.py): a cell
     * much higher or lower than the town reads too cold or too warm.
     */
    elevationOkM: 150,
    elevationPoorM: 400,
    elevationPenaltySome: 10,
    elevationPenaltyLarge: 30,
    /** Levels. */
    high: 75,
    medium: 50,
  },

  /** A pattern month relative to its own year. */
  patterns: {
    /** Wet/dry seasons exist when the wettest month has at least this much… */
    wetMonthMinMm: 150,
    /** …and at least this multiple of the driest month. */
    wetDryRatio: 4,
    /** A rainy-season month holds at least this share of the wettest month. */
    rainyShareOfMax: 0.6,
    /** A dry-season month holds at most this share of the wettest month and this many mm. */
    dryShareOfMax: 0.25,
    dryMaxMm: 60,
    /** Snow season: this share of the cell snow-covered on average. */
    snowCoverPct: 50,
  },

  summary: {
    // Temperature words by average daily high.
    cold: 5,
    cool: 15,
    mild: 25,
    warm: 31,
    // Humidity words, from the mean dew point, once the high reaches humidFromHighC:
    // "some humidity" from the first, "humid" from the second, "very humid" from the third.
    moderateHumidDewPoint: 18,
    humidDewPoint: 21,
    veryHumidDewPoint: 24,
    humidFromHighC: 25,
    // Rain words. "Mostly dry" by the monthly total (the model's day count
    // runs high, see precipitation.daysShare), or by few days with little rain.
    dryMm: 30,
    dryDays: 4,
    dryDaysMaxMm: 40,
    occasionalDays: 10,
  },

  /**
   * What to call the month. A destination inside the tropics whose average
   * highs change by less than `temperateMinRangeC` over the year is warm all
   * year, so it is described by its rainy and dry seasons ("winter" means
   * nothing at 31 °C); everywhere else has winter, spring, summer and autumn
   * by hemisphere. A month is called rainy when it is one of the wetter
   * months of its own year — at least `rainyShareOfMedian` × the year's
   * median month, `rainyMinMm` and `rainyMinDays` — or in a rainy-season
   * month; snowy from `snowCoverPct` of the grid cell snow-covered.
   */
  seasonNames: {
    tropicLatitude: 23.44,
    temperateMinRangeC: 8,
    rainyShareOfMedian: 1.25,
    rainyMinMm: 60,
    rainyMinDays: 10,
    snowCoverPct: 50,
    // "Hot all year" from this mean of the twelve average highs, "warm all year" from the second.
    hotAllYearC: 28,
    warmAllYearC: 22,
  },

  /** Home page: classes shown, and the fallback when too few. */
  home: {
    classes: ["EXCELLENT", "VERY_GOOD"],
    fallbackClass: "GOOD",
    minCount: 8,
    minConfidence: "medium",
  },
} as const;

export type Classification = (typeof SCORING.classes)[number]["id"];
