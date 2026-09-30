#!/usr/bin/env python3
"""
Hourly ERA5-Land (raw/<id>.csv) → 1991–2020 monthly climate normals per
destination → src/data/climate/normals.json.

    pip install pandas numpy timezonefinder
    python3 scripts/climate/build_normals.py

Method (the same for every destination):

1. Hours are converted from UTC to the destination's local time (IANA zone
   from its coordinates, timezonefinder), so a "day" is the local calendar
   day, 00:00–23:59.
2. For each local day with at least 23 hourly values (DST days have 23/25):
     daily high  = max of hourly 2 m temperature
     daily low   = min of hourly 2 m temperature
     daily mean  = mean of hourly 2 m temperature
     daily rain  = sum of hourly total precipitation (de-accumulated by CDS;
                   each value is the hour ending at its time stamp)
     dew point   = mean of hourly 2 m dew point
     humidity    = mean of hourly relative humidity, from temperature and dew
                   point with the Magnus formula (Alduchov & Eskridge 1996:
                   a = 17.625, b = 243.04 °C)
     wind        = mean of hourly √(u10² + v10²)
     snow cover  = mean of hourly snow cover
   Kelvin → Celsius: °C = K − 273.15. Metres of water → mm: × 1000.
3. For each year and month with at least 90 % of its days present:
     averageHigh = mean(daily high), averageLow = mean(daily low), …
     precipitation = sum of daily rain; rain days = days with ≥ 1.0 mm.
4. A month's normal is the mean of those yearly values over 1991–2020, and is
   published only when at least 24 of the 30 years qualify (80 %, the WMO
   guidance for monthly normals); otherwise it is null — never 0.

The monthly-mean 2 m temperature is never used as the high or the low.
"""
from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
RAW = HERE / "raw"
OUT = ROOT / "src" / "data" / "climate" / "normals.json"
PIPELINE_VERSION = "1.0"
YEARS = (1991, 2020)
MIN_YEARS = 24
MIN_DAY_SHARE = 0.9

ALIASES = {
    "time": ["valid_time", "time", "date"],
    "t2m": ["t2m", "2m_temperature"],
    "d2m": ["d2m", "2m_dewpoint_temperature"],
    "tp": ["tp", "total_precipitation"],
    "u10": ["u10", "10m_u_component_of_wind"],
    "v10": ["v10", "10m_v_component_of_wind"],
    "snowc": ["snowc", "snow_cover"],
}


def log(*args):
    """Print, and keep a copy in run.log next to this script."""
    msg = " ".join(str(a) for a in args)
    print(msg, flush=True)
    with open(Path(__file__).resolve().parent / "run.log", "a", encoding="utf-8") as f:
        f.write(msg + "\n")


def col(df, key, required=True):
    for c in ALIASES[key]:
        if c in df.columns:
            return c
    if required:
        raise KeyError(f"column for {key} not found in {list(df.columns)}")
    return None


def rh_from(t_c, td_c):
    a, b = 17.625, 243.04
    return 100.0 * np.exp(a * td_c / (b + td_c)) / np.exp(a * t_c / (b + t_c))


EXPECTED_HOURS = 262_992  # 1991-01-01 00:00 to 2020-12-31 23:00 UTC


def read_complete(path: Path, full_period: bool = True):
    """Read the hourly CSV and insist on every hour of the period. A short
    read (a network-mounted folder can return a file partially) is retried,
    and a file that stays short stops the build rather than yielding normals
    from fewer hours than it claims."""
    import io
    import time

    for attempt in range(5):
        data = path.read_bytes()
        if len(data) == path.stat().st_size:
            df = pd.read_csv(io.BytesIO(data))
            if not full_period:
                return df
            if len(df) == EXPECTED_HOURS and pd.to_datetime(df[col(df, "time")].iloc[[0, -1]]).tolist() == [
                pd.Timestamp("1991-01-01 00:00:00"),
                pd.Timestamp("2020-12-31 23:00:00"),
            ]:
                return df
        time.sleep(2 * (attempt + 1))
    raise SystemExit(f"{path.name}: incomplete after 5 reads ({len(data):,} of {path.stat().st_size:,} bytes) — re-download it")


def normals_for(path: Path, tz: str, full_period: bool = True):
    df = read_complete(path, full_period)
    t = pd.to_datetime(df[col(df, "time")], utc=True).dt.tz_convert(tz)
    h = pd.DataFrame({"t": df[col(df, "t2m")] - 273.15})
    h["td"] = df[col(df, "d2m")] - 273.15
    h["tp"] = (df[col(df, "tp")].clip(lower=0)) * 1000.0
    u, v = col(df, "u10", False), col(df, "v10", False)
    h["wind"] = np.sqrt(df[u] ** 2 + df[v] ** 2) if u and v else np.nan
    sc = col(df, "snowc", False)
    h["snowc"] = df[sc] if sc else np.nan
    h["rh"] = rh_from(h["t"], h["td"]).clip(upper=100)
    h["day"] = t.dt.tz_localize(None).dt.floor("D")
    # Precipitation stamped hh:00 fell in the hour ending then, so it belongs
    # to the day of (hh:00 − 1 h): the 00:00 value is the previous evening's.
    rain_day = (t - pd.Timedelta(hours=1)).dt.tz_localize(None).dt.floor("D")
    rain = h["tp"].groupby(rain_day).sum(min_count=23)

    g = h.groupby("day")
    daily = pd.DataFrame(
        {
            "n": g["t"].count(),
            "high": g["t"].max(),
            "low": g["t"].min(),
            "mean": g["t"].mean(),
            "rain": rain.reindex(g["t"].count().index),
            "dew": g["td"].mean(),
            "rh": g["rh"].mean(),
            "wind": g["wind"].mean(),
            "snowc": g["snowc"].mean(),
        }
    )
    daily = daily[daily["n"] >= 23]
    daily = daily[(daily.index.year >= YEARS[0]) & (daily.index.year <= YEARS[1])]
    daily["year"] = daily.index.year
    daily["month"] = daily.index.month
    daily["wet"] = (daily["rain"] >= 1.0).astype(float)

    rows = []
    for (y, m), grp in daily.groupby(["year", "month"]):
        days_in_month = pd.Period(f"{y}-{m:02d}").days_in_month
        if len(grp) < MIN_DAY_SHARE * days_in_month:
            continue
        scale = days_in_month / len(grp)  # totals scaled for the few missing days
        rows.append(
            {
                "year": y,
                "month": m,
                "high": grp["high"].mean(),
                "low": grp["low"].mean(),
                "mean": grp["mean"].mean(),
                "rain": grp["rain"].sum() * scale,
                "wet": grp["wet"].sum() * scale,
                "dew": grp["dew"].mean(),
                "rh": grp["rh"].mean(),
                "wind": grp["wind"].mean(),
                "snowc": grp["snowc"].mean(),
            }
        )
    ym = pd.DataFrame(rows)
    months = []
    for m in range(1, 13):
        sub = ym[ym["month"] == m] if len(ym) else ym
        ok = len(sub) >= MIN_YEARS

        def mean(k, nd):
            if not ok or sub[k].isna().all():
                return None
            v = float(sub[k].mean())
            return None if math.isnan(v) else round(v, nd)

        months.append(
            {
                "highC": mean("high", 1),
                "lowC": mean("low", 1),
                "meanC": mean("mean", 1),
                "precipMm": mean("rain", 0),
                "precipDays": mean("wet", 1),
                "dewPointC": mean("dew", 1),
                "relativeHumidity": mean("rh", 0),
                "windMs": mean("wind", 1),
                "snowCoverPct": mean("snowc", 0),
                "yearsUsed": int(len(sub)),
            }
        )
    return months


def cached_normals(did: str, tz: str):
    """normals_for, remembered in raw/normals_cache/ against the CSV's size,
    modification time and this pipeline version, so an interrupted build
    resumes where it stopped instead of re-reading every file."""
    csv = RAW / f"{did}.csv"
    st = csv.stat()
    key = {"size": st.st_size, "mtime": int(st.st_mtime), "tz": tz, "pipelineVersion": PIPELINE_VERSION}
    cache = RAW / "normals_cache" / f"{did}.json"
    if cache.exists():
        try:
            c = json.loads(cache.read_text(encoding="utf-8"))
            if c["key"] == key:
                return c["months"]
        except (ValueError, KeyError):
            pass
    months = normals_for(csv, tz)
    cache.parent.mkdir(exist_ok=True)
    cache.write_text(json.dumps({"key": key, "months": months}), encoding="utf-8")
    return months


def main():
    from timezonefinder import TimezoneFinder

    tf = TimezoneFinder()
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    out = {
        "meta": {
            "source": "Copernicus Climate Change Service (C3S), ERA5-Land",
            "dataset": "ERA5-Land hourly time-series (reanalysis-era5-land-timeseries)",
            "datasetUrl": "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land-timeseries",
            "licence": "CC-BY 4.0 — Contains modified Copernicus Climate Change Service information",
            "citation": "Muñoz Sabater, J. et al. (2021): ERA5-Land: a state-of-the-art global reanalysis dataset for land applications. Earth Syst. Sci. Data, 13, 4349–4383.",
            "period": "1991–2020",
            "normalsStandard": "WMO climatological standard normal period 1991–2020",
            "method": __doc__.strip().split("Method (the same for every destination):")[1].strip(),
            "pipelineVersion": PIPELINE_VERSION,
            "generatedAt": now,
        },
        "destinations": {},
        "missing": [],
    }
    # Height of the town vs. the cell used (check_cells.py) and any decision
    # recorded for it (cell_overrides.json) — carried into the provenance so
    # the scoring can lower confidence where the cell does not represent the town.
    cell_check = {}
    if (RAW / "cell_check.json").exists():
        cell_check = json.loads((RAW / "cell_check.json").read_text(encoding="utf-8"))["destinations"]
    decisions = {}
    if (HERE / "cell_overrides.json").exists():
        decisions = json.loads((HERE / "cell_overrides.json").read_text(encoding="utf-8"))["overrides"]
    metas = sorted(RAW.glob("*.meta.json"))
    for mp in metas:
        try:
            meta = json.loads(mp.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            log(f"{mp.name}: unreadable metadata, skipped (re-run the fetch)")
            continue
        did = meta["id"]
        tz = tf.timezone_at(lat=meta["usedLatitude"], lng=meta["usedLongitude"]) or tf.timezone_at(
            lat=meta["requestedLatitude"], lng=meta["requestedLongitude"]
        )
        if not tz:
            out["missing"].append({"id": did, "why": "no time zone found"})
            continue
        months = cached_normals(did, tz)
        cc = cell_check.get(did, {})
        # Town height is known only for the stored coordinate, not for a reference place.
        same_cell = not meta.get("reference") and cc.get("usedCell") == [round(meta["usedLatitude"], 2), round(meta["usedLongitude"], 2)]
        dec = decisions.get(did, {})
        out["destinations"][did] = {
            "countryCode": meta["countryCode"],
            "latitude": meta["requestedLatitude"],
            "longitude": meta["requestedLongitude"],
            "coordinateSource": meta["coordinateSource"],
            "geocode": meta.get("geocode"),
            "reference": meta.get("reference"),
            "months": months,
            "provenance": {
                "kind": "era5-land",
                "source": out["meta"]["source"],
                "dataset": out["meta"]["dataset"],
                "datasetUrl": out["meta"]["datasetUrl"],
                "period": out["meta"]["period"],
                "usedLat": meta["usedLatitude"],
                "usedLon": meta["usedLongitude"],
                "distanceKm": meta["distanceKm"],
                "gridNote": meta["gridNote"],
                "cellOverrideReason": meta.get("cellOverrideReason"),
                "referencePlace": (meta.get("reference") or {}).get("display_name"),
                "townElevationM": cc.get("townElevationM") if same_cell else None,
                "cellElevationM": cc.get("usedCellElevationM") if same_cell else None,
                "elevationDifferenceM": cc.get("differenceM") if same_cell else None,
                "elevationAccepted": dec.get("reason") if dec.get("accept") else None,
                "withheldReason": dec.get("withhold"),
                "timezone": tz,
                "retrievedAt": meta["retrievedAt"],
                "generatedAt": now,
                "pipelineVersion": PIPELINE_VERSION,
            },
        }
        log(f"{did}: tz {tz}, Jan {months[0]['highC']}/{months[0]['lowC']} °C, Jul {months[6]['highC']}/{months[6]['lowC']} °C")
    for nd in sorted(RAW.glob("*.nodata.json")):
        nid = json.loads(nd.read_text(encoding="utf-8"))["id"]
        if nid in out["destinations"]:
            continue  # a later try (e.g. an elevation-matched cell) had no data; the earlier download stands
        out["missing"].append({"id": nid, "why": "no ERA5-Land land cell within search radius"})

    # Station overrides (official 1991–2020 normals) — see README.md.
    ov_path = HERE / "station_overrides.json"
    if ov_path.exists():
        for did, ov in json.loads(ov_path.read_text(encoding="utf-8")).items():
            required = ["stationName", "stationId", "latitude", "longitude", "distanceKm", "period", "source", "url", "retrievedAt", "months"]
            missing = [k for k in required if k not in ov]
            if missing:
                sys.exit(f"station override {did} is missing {missing}")
            base = out["destinations"].get(did, {})
            out["destinations"][did] = {
                **base,
                "months": ov["months"],
                "provenance": {
                    "kind": "station",
                    "source": ov["source"],
                    "dataset": ov.get("dataset", ov["source"]),
                    "datasetUrl": ov["url"],
                    "period": ov["period"],
                    "usedLat": ov["latitude"],
                    "usedLon": ov["longitude"],
                    "distanceKm": ov["distanceKm"],
                    "gridNote": "official station normals",
                    "stationName": ov["stationName"],
                    "stationId": ov["stationId"],
                    "timezone": base.get("provenance", {}).get("timezone", ""),
                    "retrievedAt": ov["retrievedAt"],
                    "generatedAt": now,
                    "pipelineVersion": PIPELINE_VERSION,
                },
            }
            out["missing"] = [m for m in out["missing"] if m["id"] != did]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    log(f"\n{len(out['destinations'])} destinations → {OUT.relative_to(ROOT)}; missing: {[m['id'] for m in out['missing']]}")


if __name__ == "__main__":
    main()
