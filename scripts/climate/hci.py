#!/usr/bin/env python3
"""
Holiday Climate Index (HCI) — the published, peer-reviewed rating the
season classification is built on (replacing our own weights, 13 Oct 2026).

  Scott, D., Rutty, M., Amelung, B., Tang, M. (2016). An inter-comparison of
  the Holiday Climate Index (HCI) and the Tourism Climate Index (TCI) in
  Europe. Atmosphere 7(6), 80. https://doi.org/10.3390/atmos7060080
      → HCI:Urban, Tables 3–6 (read 13 Oct 2026).
  Rutty, M., Scott, D., Matthews, L., Burrowes, R., Trotman, A., Mahon, R.,
  Charles, A. (2020). An inter-comparison of the Holiday Climate Index
  (HCI:Beach) and the Tourism Climate Index (TCI) to explain Canadian tourism
  arrivals to the Caribbean. Atmosphere 11(4), 412.
      → HCI:Beach, Table 3.

    HCI:Urban = 4·TC + 2·A + 3·P + W        HCI:Beach = 2·TC + 4·A + 3·P + W

each facet rated 0–10 (a few bands are negative, as published), so a day
scores up to 100. TC (thermal comfort) is rated on the humidex of the day's
maximum temperature with the day's mean humidity (dew point), A on cloud
cover, P on the day's rain, W on the day's mean wind. The index is computed
for every day and a month's value is the mean of its days, as in the papers.

Implementation choices, stated:
  - Humidex (Environment Canada): H = T + 0.5555·(e − 10),
    e = 6.11·exp(5417.7530·(1/273.16 − 1/(273.15 + Td))) hPa.
  - "0 mm" rain is read as < 0.1 mm, the smallest amount a gauge records;
    reanalysis drizzle below that is not counted as rain.
  - Cloud cover comes from ERA5 monthly means (the daily value is the
    month's mean for that year); the papers use daily cloud.
  - Band edges between the published whole numbers are closed on the lower
    side: 25.9 °C sits in 23–25.9, as the decimal tables of Rutty 2020 write.
"""
from __future__ import annotations

import math

# (lower bound inclusive, rating), checked from the top: first bound the value reaches.
URBAN_TC = [(39, 0), (37, 2), (35, 4), (33, 5), (31, 6), (29, 7), (27, 8), (26, 9), (23, 10), (20, 9), (18, 7), (15, 6), (11, 5), (7, 4), (0, 3), (-5.95, 2), (-math.inf, 1)]
# -0.1 to -5.9 → 2, ≤ -6.0 → 1: a value in (-6, 0) reaches the -6 bound.
BEACH_TC = [(39, 0), (38, 2), (37, 3), (36, 5), (35, 6), (34, 7), (33, 8), (31, 9), (28, 10), (26, 9), (23, 7), (22, 6), (21, 5), (20, 4), (19, 3), (18, 2), (17, 1), (15, 0), (10, -5), (-math.inf, -10)]


def _band(value: float, table) -> float:
    for lower, rating in table:
        if value >= lower:
            return rating
    return table[-1][1]


def humidex(t_c: float, td_c: float) -> float:
    e = 6.11 * math.exp(5417.7530 * (1 / 273.16 - 1 / (273.15 + td_c)))
    return t_c + 0.5555 * (e - 10.0)


def thermal(h: float, kind: str) -> float:
    return _band(h, URBAN_TC if kind == "urban" else BEACH_TC)


def aesthetic(cloud_pct: float, kind: str) -> float:
    c = max(0.0, min(100.0, cloud_pct))
    if kind == "urban":
        if c >= 100: return 1
        if c > 90: return 2
        if c > 80: return 3
        if c > 70: return 4
        if c > 60: return 5
        if c > 50: return 6
        if c > 40: return 7
        if c > 30: return 8
        if c > 20: return 9
        if c > 10: return 10
        if c >= 1: return 9
        return 8
    if c >= 100: return 1
    if c >= 96: return 2
    if c >= 86: return 3
    if c >= 76: return 4
    if c >= 66: return 5
    if c >= 56: return 6
    if c >= 46: return 7
    if c >= 36: return 8
    if c >= 26: return 9
    if c >= 15: return 10
    if c >= 1: return 9
    return 8


def precipitation(mm: float, kind: str) -> float:
    if mm < 0.1: return 10
    if mm < 3: return 9
    if mm < 6: return 8
    if mm < 9: return 5 if kind == "urban" else 6
    if mm <= 12: return 2 if kind == "urban" else 4
    if mm <= 25: return 0
    return -1


def wind(kmh: float, kind: str) -> float:
    if kmh >= 70: return -10
    if kmh >= 50: return 0
    if kmh >= 40: return 3
    if kmh >= 30: return 6
    if kmh >= 20: return 8
    if kmh >= 10: return 9
    calm = 0.5 if kind == "beach" else 0.05
    return 10 if kmh >= calm else 8


def hci(high_c: float, dew_c: float, cloud_pct: float, rain_mm: float, wind_kmh: float, kind: str) -> float:
    tc = thermal(humidex(high_c, dew_c), kind)
    a = aesthetic(cloud_pct, kind)
    p = precipitation(rain_mm, kind)
    w = wind(wind_kmh, kind)
    if kind == "urban":
        return 4 * tc + 2 * a + 3 * p + w
    return 2 * tc + 4 * a + 3 * p + w


# Descriptive bands of the HCI papers (Scott et al. 2016, Table 2).
CATEGORIES = [(90, "ideal"), (80, "excellent"), (70, "very good"), (60, "good"), (50, "acceptable"), (40, "marginal"), (30, "unacceptable"), (-math.inf, "dangerous")]


def category(score: float) -> str:
    for lower, name in CATEGORIES:
        if score >= lower:
            return name
    return CATEGORIES[-1][1]


if __name__ == "__main__":
    # Hand-checked cases from the published tables.
    assert thermal(24.0, "urban") == 10 and thermal(26.5, "urban") == 9 and thermal(39.5, "urban") == 0
    assert thermal(30.0, "beach") == 10 and thermal(12.0, "beach") == -5 and thermal(8.0, "beach") == -10
    assert aesthetic(15, "urban") == 10 and aesthetic(5, "urban") == 9 and aesthetic(0, "urban") == 8 and aesthetic(100, "urban") == 1
    assert aesthetic(20, "beach") == 10 and aesthetic(30, "beach") == 9 and aesthetic(50, "beach") == 7
    assert precipitation(0, "urban") == 10 and precipitation(7, "urban") == 5 and precipitation(7, "beach") == 6 and precipitation(30, "urban") == -1
    assert wind(5, "urban") == 10 and wind(15, "urban") == 9 and wind(45, "urban") == 3 and wind(80, "urban") == -10
    # Humidex: 30 °C with dew point 15 °C is about 34 (Environment Canada table).
    assert abs(humidex(30, 15) - 34.0) < 0.6, humidex(30, 15)
    # An ideal city day: 24 °C, dry air, 15 % cloud, no rain, light wind → 100.
    assert hci(24, 5, 15, 0, 8, "urban") == 100
    assert category(100) == "ideal" and category(65) == "good" and category(35) == "unacceptable"
    print("hci: all checks passed")
