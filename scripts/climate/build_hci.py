#!/usr/bin/env python3
"""
Holiday Climate Index for every destination and month, from its days.

    python3 scripts/climate/build_hci.py   → src/data/climate/hci.json

For each destination with an ERA5-Land download (raw/<id>.csv), every local
day of 1991–2020 is rated with hci.py — HCI:Urban and HCI:Beach — and a
month's value is the mean over its ~900 days, as the HCI papers compute it.
Also kept: the share of days rated at least "very good" (≥ 70) and the share
"unacceptable" (< 40), the papers' measure of how dependable a month is.

The days are first brought in line with the published monthly figures:
each day's high, low and dew point gets its month's offset from
normals.json (`era5OffsetC` — official station minus ERA5-Land, or the
nearby-stations calibration), so a city 1.7 °C too cold in ERA5-Land is not
rated as cooler than it is. Cloud cover: raw/cloud.json (fetch_cloud.py),
that year-month's mean. Wind: daily mean 10 m wind, km/h. Rain: the day's
total (de-accumulated, local day).

Resumable: a destination whose CSV, offsets and cloud series are unchanged is
read from raw/hci_cache/.
"""
from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from build_normals import RAW, daily_for
from hci import hci

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = ROOT / "src" / "data" / "climate" / "hci.json"
VERSION = "1.0"


def month_stats(daily, cloud_series, kind):
    scores = []
    for (y, m), grp in daily.groupby(["year", "month"]):
        cloud = cloud_series.get(f"{y}-{m:02d}")
        if cloud is None:
            continue
        for row in grp.itertuples():
            if np.isnan(row.high) or np.isnan(row.dew) or np.isnan(row.rain):
                continue
            wind_kmh = 0.0 if np.isnan(row.wind) else row.wind * 3.6
            scores.append((m, hci(row.high, row.dew, cloud, row.rain, wind_kmh, kind)))
    out = []
    for m in range(1, 13):
        v = [s for mm, s in scores if mm == m]
        if len(v) < 24 * 28:  # fewer than ~24 years of days: no value
            out.append(None)
            continue
        a = np.array(v, dtype=float)
        out.append({
            "mean": round(float(a.mean()), 1),
            "goodShare": round(float((a >= 70).mean()), 3),
            "poorShare": round(float((a < 40).mean()), 3),
            "days": int(len(a)),
        })
    return out


def main():
    from timezonefinder import TimezoneFinder

    tf = TimezoneFinder()
    normals = json.loads((ROOT / "src/data/climate/normals.json").read_text(encoding="utf-8"))["destinations"]
    cloud = json.loads((RAW / "cloud.json").read_text(encoding="utf-8"))
    out = {
        "meta": {
            "index": "Holiday Climate Index — HCI:Urban (Scott, Rutty, Amelung & Tang 2016, Atmosphere 7(6):80) and HCI:Beach (Rutty et al. 2020, Atmosphere 11(4):412)",
            "computedFrom": "daily ERA5-Land 1991–2020 (highs, lows, dew point brought to the published monthly figures), ERA5 monthly cloud cover",
            "cloudSource": cloud["source"],
            "version": VERSION,
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "destinations": {},
        "missing": [],
    }
    cache_dir = RAW / "hci_cache"
    cache_dir.mkdir(exist_ok=True)
    for did, rec in sorted(normals.items()):
        csv = RAW / f"{did}.csv"
        meta = RAW / f"{did}.meta.json"
        cs = cloud["destinations"].get(did)
        if not csv.exists() or not meta.exists() or not cs:
            out["missing"].append({"id": did, "why": "no ERA5-Land download" if not csv.exists() else "no cloud series"})
            continue
        offsets = rec.get("era5OffsetC") or {"high": [0] * 12, "low": [0] * 12, "dew": [0] * 12}
        st = csv.stat()
        key = hashlib.sha1(json.dumps([st.st_size, int(st.st_mtime), offsets, cs["monthlyPct"], VERSION]).encode()).hexdigest()
        cpath = cache_dir / f"{did}.json"
        if cpath.exists():
            c = json.loads(cpath.read_text(encoding="utf-8"))
            if c.get("key") == key:
                out["destinations"][did] = c["value"]
                continue
        m = json.loads(meta.read_text(encoding="utf-8"))
        tz = tf.timezone_at(lat=m["usedLatitude"], lng=m["usedLongitude"]) or tf.timezone_at(lat=m["requestedLatitude"], lng=m["requestedLongitude"])
        daily = daily_for(csv, tz)
        mi = daily["month"].to_numpy() - 1
        for col, k in (("high", "high"), ("low", "low"), ("dew", "dew")):
            off = np.array([0.0 if v is None else v for v in offsets.get(k) or [0] * 12])
            daily[col] = daily[col].to_numpy() + off[mi]
        value = {
            "urban": month_stats(daily, cs["monthlyPct"], "urban"),
            "beach": month_stats(daily, cs["monthlyPct"], "beach"),
            "cloudPct": [round(float(np.mean([v for k2, v in cs["monthlyPct"].items() if int(k2[5:7]) == mm])), 0) for mm in range(1, 13)],
        }
        out["destinations"][did] = value
        cpath.write_text(json.dumps({"key": key, "value": value}), encoding="utf-8")
        u = [x["mean"] if x else None for x in value["urban"]]
        print(f"{did}: urban HCI {u}", flush=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(out['destinations'])} destinations → {OUT.relative_to(ROOT)}; missing {len(out['missing'])}")
    if out["missing"]:
        print("missing:", [x["id"] for x in out["missing"]][:40], file=sys.stderr)


if __name__ == "__main__":
    main()
