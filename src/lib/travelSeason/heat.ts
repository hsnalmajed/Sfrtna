// Heat index of a month's average high — shared by the engine and the texts.

import { SCORING } from "./config.ts";
import type { MonthClimate } from "./types.ts";

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Saturation vapour pressure (Magnus, over water), hPa. */
const satVp = (tC: number) => 6.1094 * Math.exp((17.625 * tC) / (tC + 243.04));

/**
 * Heat index of the month's average high (NOAA/NWS: Rothfusz regression with
 * its two published adjustments, Steadman's simple formula below 80 °F), at
 * the relative humidity the mean dew point gives at that temperature. null
 * when the high is below SCORING.heatIndexFromHighC or data is missing.
 * https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml
 */
export function heatIndexC(m: MonthClimate): number | null {
  if (m.highC === null || m.dewPointC === null || m.highC < SCORING.heatIndexFromHighC) return null;
  const rh = Math.min(100, (100 * satVp(m.dewPointC)) / satVp(m.highC));
  const t = (m.highC * 9) / 5 + 32;
  let hi = 0.5 * (t + 61 + (t - 68) * 1.2 + rh * 0.094);
  if ((hi + t) / 2 >= 80) {
    hi =
      -42.379 + 2.04901523 * t + 10.14333127 * rh - 0.22475541 * t * rh - 0.00683783 * t * t -
      0.05481717 * rh * rh + 0.00122874 * t * t * rh + 0.00085282 * t * rh * rh - 0.00000199 * t * t * rh * rh;
    if (rh < 13 && t >= 80 && t <= 112) hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
    else if (rh > 85 && t >= 80 && t <= 87) hi += ((rh - 85) / 10) * ((87 - t) / 5);
  }
  return round1(((hi - 32) * 5) / 9);
}
