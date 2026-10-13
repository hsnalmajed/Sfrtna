#!/usr/bin/env python3
"""
Official station normals, second source: NOAA's Global Historical
Climatology Network – Daily (GHCN-Daily), the quality-controlled daily
observations of national weather services' stations. Used where the WMO
1991–2020 normals (fetch_wmo_normals.py) have no station near a city —
Greece, Portugal, Vietnam, Brazil, Kenya, Oman and others did not submit
min24 normals there.

  Menne, M.J. et al. (2012): An overview of the Global Historical Climatology
  Network-Daily Database. J. Atmos. Oceanic Technol. 29, 897–910.
  https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-daily

    python3 scripts/climate/fetch_ghcn.py   → scripts/climate/data/ghcn_normals.json

For every city (cityCoords.ts + staged batches) the GHCN stations within
CAL_KM that report TMAX and TMIN through 1991–2020 are found from NOAA's own
station inventory; the nearest few are downloaded and their 1991–2020
normals computed with the WMO rules (WMO-No. 1203, 2017):
  - a monthly mean temperature needs ≤ 10 missing days and ≤ 4 in a row
    (the "11/5" rule); a monthly rain total needs no missing day;
  - a normal needs ≥ 24 of the 30 years for that month;
  - values that failed NOAA's quality checks (QFLAG set) count as missing.
GHCN has no humidity: that stays with WMO vapour pressure or ERA5-Land.
"""
from __future__ import annotations

import csv
import gzip
import io
import json
import math
import re
import sys
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
BASE = "https://www.ncei.noaa.gov/pub/data/ghcn/daily/"
UA = {"User-Agent": "Sfrtna climate pipeline (https://sfrtna.com)"}
DIRECT_KM = 25.0
CAL_KM = 150.0
PER_CITY = 4
YEARS = range(1991, 2021)


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
        return r.read()


def hav(a, b, c, d):
    p1, p2 = math.radians(a), math.radians(c)
    x = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(d - b) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(x))


def cities():
    sys.path.insert(0, str(HERE))
    from station_plan import cities as plan_cities

    return plan_cities()


def month_normals(rows):
    """rows: {(element, date): value}. Returns {element: [12 normals] | None}."""
    by = defaultdict(dict)
    for (el, d), v in rows.items():
        by[el][d] = v
    out = {}
    for el in ("TMAX", "TMIN", "PRCP"):
        series = by.get(el, {})
        per_month = defaultdict(list)
        for y in YEARS:
            for m in range(1, 13):
                n = (date(y + (m == 12), m % 12 + 1, 1) - date(y, m, 1)).days
                vals, missing, run, worst = [], 0, 0, 0
                for k in range(1, n + 1):
                    v = series.get(date(y, m, k))
                    if v is None:
                        missing += 1
                        run += 1
                        worst = max(worst, run)
                    else:
                        run = 0
                        vals.append(v)
                if el == "PRCP":
                    if missing == 0:
                        per_month[m].append((sum(vals), sum(1 for v in vals if v >= 1.0)))
                elif missing <= 10 and worst <= 4 and vals:
                    per_month[m].append(sum(vals) / len(vals))
        if all(len(per_month[m]) >= 24 for m in range(1, 13)):
            if el == "PRCP":
                out["PRCP"] = [round(sum(t for t, _ in per_month[m]) / len(per_month[m])) for m in range(1, 13)]
                out["DP01"] = [round(sum(w for _, w in per_month[m]) / len(per_month[m]), 1) for m in range(1, 13)]
            else:
                out[el] = [round(sum(per_month[m]) / len(per_month[m]), 1) for m in range(1, 13)]
        else:
            out[el] = None
            if el == "PRCP":
                out["DP01"] = None
    return out


def main():
    stations = {}
    for line in get(BASE + "ghcnd-stations.txt").decode("utf-8", "replace").splitlines():
        sid = line[0:11].strip()
        stations[sid] = {
            "lat": float(line[12:20]), "lon": float(line[21:30]), "elev": float(line[31:37]),
            "name": line[41:71].strip(), "wmoId": line[80:85].strip() or None,
        }
    inv = defaultdict(dict)
    for line in get(BASE + "ghcnd-inventory.txt").decode("utf-8", "replace").splitlines():
        p = line.split()
        if len(p) >= 6 and p[3] in ("TMAX", "TMIN", "PRCP"):
            inv[p[0]][p[3]] = (int(p[4]), int(p[5]))
    # A station whose record overlaps 1991–2020 by at least 24 years can meet
    # the WMO rule (month_normals checks the actual years); requiring the
    # whole span would drop stations whose reports to NOAA stop before 2020.
    overlap = lambda a, b: min(b, 2020) - max(a, 1991) + 1
    usable = [sid for sid, e in inv.items()
              if all(k in e and overlap(*e[k]) >= 24 for k in ("TMAX", "TMIN")) and sid in stations]
    print(f"{len(stations):,} GHCN stations, {len(usable):,} with TMAX+TMIN overlapping 1991–2020 by ≥ 24 years", flush=True)

    wanted = {}
    for slug, c in cities().items():
        near = sorted((hav(c["lat"], c["lon"], stations[s]["lat"], stations[s]["lon"]), s) for s in usable)
        for d, s in [x for x in near if x[0] <= CAL_KM][:PER_CITY]:
            wanted.setdefault(s, d)
    print(f"{len(wanted)} stations to download", flush=True)

    out = {}
    for i, sid in enumerate(sorted(wanted)):
        try:
            raw = gzip.decompress(get(f"{BASE}by_station/{sid}.csv.gz")).decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001 — one station failing must not stop the rest
            print(f"{sid}: {e}", flush=True)
            continue
        rows = {}
        for r in csv.reader(io.StringIO(raw)):
            if len(r) < 6 or r[2] not in ("TMAX", "TMIN", "PRCP") or r[5].strip():
                continue
            y = int(r[1][:4])
            if y < 1991 or y > 2020:
                continue
            v = int(r[3]) / 10.0
            rows[(r[2], date(y, int(r[1][4:6]), int(r[1][6:8])))] = v
        normals = month_normals(rows)
        if not any(normals.get(k) for k in ("TMAX", "TMIN")):
            continue
        out[sid] = {**stations[sid], **normals}
        if i % 25 == 0:
            print(f"{i + 1}/{len(wanted)} {sid} {stations[sid]['name']}: TMAX {'ok' if normals.get('TMAX') else '—'}", flush=True)

    (HERE / "data").mkdir(exist_ok=True)
    (HERE / "data/ghcn_normals.json").write_text(json.dumps({
        "source": "NOAA NCEI Global Historical Climatology Network – Daily (GHCN-Daily), station observations; 1991–2020 normals computed with the WMO-No. 1203 completeness rules",
        "sourceUrl": "https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-daily",
        "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "stations": out,
    }, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"{len(out)} stations with 1991–2020 normals → data/ghcn_normals.json")


if __name__ == "__main__":
    main()
